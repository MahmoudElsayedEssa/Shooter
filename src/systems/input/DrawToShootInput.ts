export type CapturedInputType = "touch" | "pointer" | "mouse";

export interface CapturedInputEvent {
  readonly type: CapturedInputType;
  readonly clientX: number;
  readonly clientY: number;
  readonly timeMs: number;
}

export interface GesturePoint {
  readonly x: number;
  readonly y: number;
  readonly timeMs: number;
}

export interface ShotZone {
  readonly centerX: number;
  readonly centerY: number;
  readonly viewportWidth: number;
}

export interface GestureSampleResult {
  readonly points: readonly GesturePoint[];
  readonly accepted: boolean;
}

export interface GestureValidation {
  readonly valid: boolean;
  readonly reason: "ok" | "too_few_points" | "too_short" | "not_upward" | "too_fast" | "too_slow";
}

export interface TrailState {
  readonly visible: boolean;
  readonly opacity: number;
  readonly communicatesCurve: boolean;
  readonly communicatesForce: boolean;
  readonly blocksGoal: boolean;
  readonly curveDirection: "left" | "right" | "straight";
  readonly force: number;
  readonly pointsCleared: boolean;
}

export interface InputPenaltyState {
  readonly playerScore: number;
  readonly goalkeeperScore: number;
  readonly phase: "aiming" | "drawing";
}

export const INPUT_TYPES: readonly CapturedInputType[] = ["touch", "pointer", "mouse"] as const;

export const INPUT_LIMITS = {
  shotZoneMinRadiusPx: 52,
  shotZoneViewportRatio: 0.22,
  minPointDistancePx: 4,
  minPointIntervalMs: 16,
  maxPoints: 48,
  minValidPoints: 2,
  minTotalDistancePx: 20,
  minUpwardDeltaPx: 5,
  minDurationMs: 30,
  maxDurationMs: 1500,
  trailVisibleFrameDelay: 1,
  trailFadeMinMs: 120,
  trailFadeMaxMs: 260,
  maxTrailGoalOpacity: 0.55
} as const;

export function capturesInputType(inputType: CapturedInputType): boolean {
  return INPUT_TYPES.includes(inputType);
}

export function captureInputPoint(event: CapturedInputEvent): GesturePoint | null {
  if (!capturesInputType(event.type)) {
    return null;
  }

  return {
    x: event.clientX,
    y: event.clientY,
    timeMs: event.timeMs
  };
}

export function getShotZoneRadius(viewportWidth: number): number {
  return Math.max(INPUT_LIMITS.shotZoneMinRadiusPx, viewportWidth * INPUT_LIMITS.shotZoneViewportRatio);
}

export function startsInsideShotZone(point: GesturePoint, zone: ShotZone): boolean {
  return distance(point, { x: zone.centerX, y: zone.centerY, timeMs: point.timeMs }) <= getShotZoneRadius(zone.viewportWidth);
}

export function sampleGesturePoint(
  points: readonly GesturePoint[],
  nextPoint: GesturePoint
): GestureSampleResult {
  if (points.length >= INPUT_LIMITS.maxPoints) {
    return { points, accepted: false };
  }

  const last = points.at(-1);
  if (
    last !== undefined &&
    (distance(last, nextPoint) < INPUT_LIMITS.minPointDistancePx ||
      nextPoint.timeMs - last.timeMs < INPUT_LIMITS.minPointIntervalMs)
  ) {
    return { points, accepted: false };
  }

  return { points: [...points, nextPoint], accepted: true };
}

export function validateGesture(points: readonly GesturePoint[]): GestureValidation {
  if (points.length < INPUT_LIMITS.minValidPoints) {
    return { valid: false, reason: "too_few_points" };
  }

  const first = points[0];
  const last = points[points.length - 1];
  const totalDistance = points.slice(1).reduce((sum, point, index) => sum + distance(points[index], point), 0);
  const durationMs = last.timeMs - first.timeMs;

  if (totalDistance < INPUT_LIMITS.minTotalDistancePx) {
    return { valid: false, reason: "too_short" };
  }

  if (first.y - last.y < INPUT_LIMITS.minUpwardDeltaPx) {
    return { valid: false, reason: "not_upward" };
  }

  if (durationMs < INPUT_LIMITS.minDurationMs) {
    return { valid: false, reason: "too_fast" };
  }

  if (durationMs > INPUT_LIMITS.maxDurationMs) {
    return { valid: false, reason: "too_slow" };
  }

  return { valid: true, reason: "ok" };
}

export function nextInputPhaseAfterGesture(points: readonly GesturePoint[]): "shot_commit" | "aiming" {
  return validateGesture(points).valid ? "shot_commit" : "aiming";
}

export function recoverInvalidGesture(state: InputPenaltyState): InputPenaltyState {
  return {
    ...state,
    phase: "aiming"
  };
}

export function createTrailState(
  points: readonly GesturePoint[],
  framesSinceStart: number,
  elapsedSinceCommitMs: number | null
): TrailState {
  const hasInputStarted = points.length > 0 && framesSinceStart <= INPUT_LIMITS.trailVisibleFrameDelay;
  const fadeOpacity =
    elapsedSinceCommitMs === null
      ? 1
      : Math.max(0, 1 - elapsedSinceCommitMs / INPUT_LIMITS.trailFadeMaxMs);
  const visible =
    hasInputStarted ||
    (elapsedSinceCommitMs !== null &&
      elapsedSinceCommitMs >= 0 &&
      elapsedSinceCommitMs <= INPUT_LIMITS.trailFadeMaxMs);

  return {
    visible,
    opacity: Math.min(fadeOpacity, INPUT_LIMITS.maxTrailGoalOpacity),
    communicatesCurve: points.length >= 3,
    communicatesForce: pathDistance(points) >= INPUT_LIMITS.minTotalDistancePx,
    blocksGoal: fadeOpacity > INPUT_LIMITS.maxTrailGoalOpacity,
    curveDirection: getCurveDirection(points),
    force: pathDistance(points),
    pointsCleared: elapsedSinceCommitMs !== null && elapsedSinceCommitMs > INPUT_LIMITS.trailFadeMaxMs
  };
}

function pathDistance(points: readonly GesturePoint[]): number {
  return points.slice(1).reduce((sum, point, index) => sum + distance(points[index], point), 0);
}

function distance(a: GesturePoint, b: GesturePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getCurveDirection(points: readonly GesturePoint[]): "left" | "right" | "straight" {
  if (points.length < 3) {
    return "straight";
  }

  const first = points[0];
  const middle = points[Math.floor(points.length / 2)];
  const last = points[points.length - 1];
  const expectedMiddleX = (first.x + last.x) / 2;

  if (middle.x < expectedMiddleX - 1) {
    return "left";
  }

  if (middle.x > expectedMiddleX + 1) {
    return "right";
  }

  return "straight";
}
