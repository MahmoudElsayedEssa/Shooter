export type CameraLayerId =
  | "base_framing"
  | "ball_tracking"
  | "tension_zoom"
  | "impact_shake"
  | "slow_motion_pulse"
  | "emotional_focus";

export type ImpactStrength = "none" | "light" | "strong";

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface CameraContext {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly goalFrame: Rect;
  readonly ball: Point2D;
  readonly keeper: Point2D;
  readonly pressure: number;
  readonly impact: ImpactStrength;
  readonly finalShot: boolean;
  readonly matchPoint: boolean;
  readonly nearSave: boolean;
  readonly postContact: boolean;
  readonly emotionalFocus?: Point2D;
}

export interface CinematicCameraPlan {
  readonly layers: readonly CameraLayerId[];
  readonly center: Point2D;
  readonly zoom: number;
  readonly ballTrackingStrength: number;
  readonly shake: {
    readonly durationMs: number;
    readonly intensity: number;
  };
  readonly slowMotion: {
    readonly active: boolean;
    readonly durationMs: number;
    readonly timeScale: number;
    readonly resetDelayMs: number;
  };
  readonly damping: {
    readonly position: number;
    readonly zoom: number;
  };
}

export interface CameraState {
  readonly center: Point2D;
  readonly zoom: number;
}

export const CAMERA_LIMITS = {
  minZoom: 1,
  maxZoom: 1.12,
  lowTracking: [0.05, 0.1],
  mediumTracking: [0.1, 0.18],
  highTracking: [0.18, 0.3],
  lightShakeMs: 110,
  strongShakeMs: 210,
  finalShotShakeBonusMs: 90,
  maxFinalShotShakeMs: 350,
  minSlowMotionMs: 180,
  maxSlowMotionMs: 450,
  minTimeScale: 0.35,
  maxTimeScale: 0.7,
  maxResetDelayMs: 520,
  positionDamping: [8, 14],
  zoomDamping: [6, 10],
  framingPaddingPx: 24
} as const;

export function planCinematicCamera(context: CameraContext): CinematicCameraPlan {
  const pressure = clamp(context.pressure, 0, 1);
  const focus = context.emotionalFocus ?? context.keeper;
  const trackingStrength = getBallTrackingStrength(pressure);
  const baseCenter = getBoundsCenter(context.goalFrame, context.ball, context.keeper);
  const trackedCenter = mixPoint(baseCenter, context.ball, trackingStrength);
  const focusedCenter = mixPoint(trackedCenter, focus, pressure * 0.08);
  const safeZoom = getSafeZoom(context);
  const zoom = Math.min(CAMERA_LIMITS.minZoom + pressure * (CAMERA_LIMITS.maxZoom - 1), safeZoom);

  return {
    layers: [
      "base_framing",
      "ball_tracking",
      "tension_zoom",
      "impact_shake",
      "slow_motion_pulse",
      "emotional_focus"
    ],
    center: focusedCenter,
    zoom,
    ballTrackingStrength: trackingStrength,
    shake: getShake(context.impact, context.finalShot),
    slowMotion: getSlowMotion(context, pressure),
    damping: {
      position: mix(CAMERA_LIMITS.positionDamping[0], CAMERA_LIMITS.positionDamping[1], pressure),
      zoom: mix(CAMERA_LIMITS.zoomDamping[0], CAMERA_LIMITS.zoomDamping[1], pressure)
    }
  };
}

export function stepCinematicCamera(
  current: CameraState,
  target: Pick<CinematicCameraPlan, "center" | "zoom" | "damping">,
  deltaSeconds: number
): CameraState {
  const positionAlpha = exponentialAlpha(target.damping.position, deltaSeconds);
  const zoomAlpha = exponentialAlpha(target.damping.zoom, deltaSeconds);

  return {
    center: mixPoint(current.center, target.center, positionAlpha),
    zoom: mix(current.zoom, target.zoom, zoomAlpha)
  };
}

function getBallTrackingStrength(pressure: number): number {
  if (pressure < 1 / 3) {
    return mix(CAMERA_LIMITS.lowTracking[0], CAMERA_LIMITS.lowTracking[1], pressure * 3);
  }
  if (pressure < 2 / 3) {
    return mix(CAMERA_LIMITS.mediumTracking[0], CAMERA_LIMITS.mediumTracking[1], (pressure - 1 / 3) * 3);
  }
  return mix(CAMERA_LIMITS.highTracking[0], CAMERA_LIMITS.highTracking[1], (pressure - 2 / 3) * 3);
}

function getShake(impact: ImpactStrength, finalShot: boolean): CinematicCameraPlan["shake"] {
  if (impact === "none") {
    return { durationMs: 0, intensity: 0 };
  }

  const baseDuration = impact === "light" ? CAMERA_LIMITS.lightShakeMs : CAMERA_LIMITS.strongShakeMs;
  const durationMs = finalShot
    ? Math.min(baseDuration + CAMERA_LIMITS.finalShotShakeBonusMs, CAMERA_LIMITS.maxFinalShotShakeMs)
    : baseDuration;

  return {
    durationMs,
    intensity: impact === "light" ? 0.35 : 0.75
  };
}

function getSlowMotion(context: CameraContext, pressure: number): CinematicCameraPlan["slowMotion"] {
  const active = context.finalShot || context.matchPoint || context.nearSave || context.postContact;

  if (!active) {
    return { active: false, durationMs: 0, timeScale: 1, resetDelayMs: 0 };
  }

  const durationMs = Math.round(mix(CAMERA_LIMITS.minSlowMotionMs, CAMERA_LIMITS.maxSlowMotionMs, pressure));
  const timeScale = mix(CAMERA_LIMITS.maxTimeScale, CAMERA_LIMITS.minTimeScale, pressure);

  return {
    active: true,
    durationMs,
    timeScale,
    resetDelayMs: Math.min(CAMERA_LIMITS.maxResetDelayMs, durationMs + 70)
  };
}

function getSafeZoom(context: CameraContext): number {
  const bounds = getBounds(context.goalFrame, context.ball, context.keeper);
  const paddedWidth = bounds.right - bounds.left + CAMERA_LIMITS.framingPaddingPx * 2;
  const paddedHeight = bounds.bottom - bounds.top + CAMERA_LIMITS.framingPaddingPx * 2;
  const widthZoom = context.viewportWidth / Math.max(1, paddedWidth);
  const heightZoom = context.viewportHeight / Math.max(1, paddedHeight);
  return clamp(Math.min(widthZoom, heightZoom, CAMERA_LIMITS.maxZoom), CAMERA_LIMITS.minZoom, CAMERA_LIMITS.maxZoom);
}

function getBoundsCenter(goalFrame: Rect, ball: Point2D, keeper: Point2D): Point2D {
  const bounds = getBounds(goalFrame, ball, keeper);
  return {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2
  };
}

function getBounds(goalFrame: Rect, ball: Point2D, keeper: Point2D): Rect {
  return {
    left: Math.min(goalFrame.left, ball.x, keeper.x),
    top: Math.min(goalFrame.top, ball.y, keeper.y),
    right: Math.max(goalFrame.right, ball.x, keeper.x),
    bottom: Math.max(goalFrame.bottom, ball.y, keeper.y)
  };
}

function exponentialAlpha(damping: number, deltaSeconds: number): number {
  return 1 - Math.exp(-damping * Math.max(0, deltaSeconds));
}

function mixPoint(a: Point2D, b: Point2D, amount: number): Point2D {
  return {
    x: mix(a.x, b.x, amount),
    y: mix(a.y, b.y, amount)
  };
}

function mix(a: number, b: number, amount: number): number {
  return a + (b - a) * clamp(amount, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
