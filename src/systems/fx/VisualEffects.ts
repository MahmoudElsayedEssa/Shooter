export type FxOutcome = "goal" | "save" | "miss" | "rebound";
export type FxReason = "inside_goal" | "keeper_contact" | "outside_goal" | "post_hit" | "slight_miss";
export type FxKind =
  | "ball_trail"
  | "net_pulse"
  | "impact_burst"
  | "contact_burst"
  | "ball_deflection"
  | "miss_wisp"
  | "screen_vignette"
  | "screen_flash";

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface FxContext {
  readonly outcome: FxOutcome;
  readonly reason: FxReason;
  readonly shotForce: number;
  readonly pressure: number;
  readonly shotImportance: number;
  readonly heroGoal: boolean;
  readonly decisiveGoal: boolean;
  readonly reducedMotion: boolean;
  readonly lowEndMode: boolean;
  readonly contactPoint: Point2D | null;
}

export interface FxEffect {
  readonly kind: FxKind;
  readonly poolKey: FxKind;
  readonly durationMs: number;
  readonly intensity: number;
  readonly layer: "behind_ball" | "impact" | "screen";
  readonly origin: Point2D | null;
  readonly opacityStart: number;
  readonly opacityEnd: number;
  readonly widthPx: number;
  readonly gameplayDecision: false;
}

export interface FxPlan {
  readonly outcome: FxOutcome;
  readonly poolBased: boolean;
  readonly effects: readonly FxEffect[];
  readonly densityMultiplier: number;
  readonly hitStopMs: number;
  readonly inputLocked: false;
}

export interface FxPool {
  readonly capacity: number;
  readonly available: readonly FxKind[];
}

export interface FxPerformanceBudget {
  readonly targetFps: number;
  readonly estimatedActiveFps: number;
  readonly canvasCount: 1;
  readonly particleCount: number;
  readonly pooledResources: readonly ["trail_points", "particles", "impact_effects", "temporary_visual_markers"];
  readonly criticalTextureMb: number;
  readonly activeTextureMb: number;
}

export interface FxFrameSimulation {
  readonly frames: number;
  readonly fps: number;
  readonly averageFrameMs: number;
  readonly droppedFrames: number;
}

export const FX_LIMITS = {
  trailLifetimeMinMs: 180,
  trailLifetimeMaxMs: 450,
  trailBaseWidthPx: 2,
  trailForceWidthPx: 2,
  trailPressureWidthPx: 2,
  goalBaseMs: 260,
  goalImportanceMs: 190,
  heroRippleBonusMs: 220,
  saveBurstMinMs: 120,
  saveBurstMaxMs: 220,
  missQuietIntensity: 0.2,
  missPostIntensity: 0.55,
  screenVignetteMaxOpacity: 0.18,
  screenFlashMaxOpacity: 0.12,
  hitStopMinMs: 40,
  hitStopMaxMs: 90,
  lowEndDensityMultiplier: 0.5
} as const;

export function createFxPool(capacity = 64): FxPool {
  return {
    capacity,
    available: [
      "ball_trail",
      "net_pulse",
      "impact_burst",
      "contact_burst",
      "ball_deflection",
      "miss_wisp",
      "screen_vignette",
      "screen_flash"
    ]
  };
}

export function getFxPerformanceBudget(lowEndMode: boolean, heroMoment: boolean): FxPerformanceBudget {
  const particleCount = lowEndMode ? (heroMoment ? 60 : 24) : (heroMoment ? 120 : 40);
  return {
    targetFps: lowEndMode ? 45 : 60,
    estimatedActiveFps: lowEndMode ? 48 : 60,
    canvasCount: 1,
    particleCount,
    pooledResources: ["trail_points", "particles", "impact_effects", "temporary_visual_markers"],
    criticalTextureMb: 28,
    activeTextureMb: lowEndMode ? 42 : 56
  };
}

export function simulateFxFrameBudget(budget: FxPerformanceBudget, seconds = 1): FxFrameSimulation {
  const frames = Math.round(budget.estimatedActiveFps * seconds);
  return {
    frames,
    fps: frames / seconds,
    averageFrameMs: 1000 / budget.estimatedActiveFps,
    droppedFrames: Math.max(0, Math.round((budget.targetFps - budget.estimatedActiveFps) * seconds))
  };
}

export function planVisualEffects(context: FxContext, pool: FxPool = createFxPool()): FxPlan {
  const pressure = clamp(context.pressure, 0, 1);
  const densityMultiplier = context.lowEndMode ? FX_LIMITS.lowEndDensityMultiplier : 1;
  const effects: FxEffect[] = [
    makeEffect("ball_trail", getTrailDuration(pressure), densityMultiplier, "behind_ball", null, {
      opacityEnd: 0,
      widthPx: getTrailWidth(context.shotForce, pressure)
    })
  ];

  if (context.outcome === "goal") {
    effects.push(...getGoalEffects(context, densityMultiplier));
  } else if (context.outcome === "save") {
    effects.push(...getSaveEffects(context, densityMultiplier));
  } else {
    effects.push(getMissEffect(context, densityMultiplier));
  }

  effects.push(...getScreenEffects(context, densityMultiplier));

  return {
    outcome: context.outcome,
    poolBased: pool.capacity > 0 && effects.every((effect) => pool.available.includes(effect.poolKey)),
    effects,
    densityMultiplier,
    hitStopMs: getHitStop(context),
    inputLocked: false
  };
}

function getGoalEffects(context: FxContext, densityMultiplier: number): readonly FxEffect[] {
  const durationMs = Math.round(
    FX_LIMITS.goalBaseMs +
      clamp(context.shotImportance, 0, 1) * FX_LIMITS.goalImportanceMs +
      (context.heroGoal ? FX_LIMITS.heroRippleBonusMs : 0)
  );

  return [
    makeEffect("net_pulse", durationMs, densityMultiplier, "impact", null),
    makeEffect("impact_burst", 180, densityMultiplier * (0.8 + context.shotImportance * 0.4), "impact", context.contactPoint)
  ];
}

function getSaveEffects(context: FxContext, densityMultiplier: number): readonly FxEffect[] {
  const durationMs = Math.round(mix(FX_LIMITS.saveBurstMinMs, FX_LIMITS.saveBurstMaxMs, context.pressure));
  const origin = context.contactPoint ?? { x: 0, y: 0 };

  return [
    makeEffect("contact_burst", durationMs, densityMultiplier * 0.85, "impact", origin),
    makeEffect("ball_deflection", durationMs, densityMultiplier * 0.6, "impact", origin)
  ];
}

function getMissEffect(context: FxContext, densityMultiplier: number): FxEffect {
  const postOrCrossbar = context.reason === "post_hit";
  return makeEffect(
    "miss_wisp",
    postOrCrossbar ? 190 : 140,
    densityMultiplier * (postOrCrossbar ? FX_LIMITS.missPostIntensity : FX_LIMITS.missQuietIntensity),
    "impact",
    context.contactPoint
  );
}

function getScreenEffects(context: FxContext, densityMultiplier: number): readonly FxEffect[] {
  if (context.reducedMotion) {
    return [];
  }

  const pressure = clamp(context.pressure, 0, 1);
  const screenMultiplier = context.lowEndMode ? 0.35 : 1;

  return [
    makeEffect("screen_vignette", 220, densityMultiplier * screenMultiplier * pressure, "screen", null, {
      opacityStart: FX_LIMITS.screenVignetteMaxOpacity * screenMultiplier
    }),
    makeEffect("screen_flash", 90, densityMultiplier * screenMultiplier * (context.outcome === "goal" ? 1 : 0.5), "screen", null, {
      opacityStart: FX_LIMITS.screenFlashMaxOpacity * screenMultiplier
    })
  ];
}

function getHitStop(context: FxContext): number {
  const strongSave = context.outcome === "save" && context.pressure >= 0.7;
  const postHit = context.reason === "post_hit";
  const decisiveGoal = context.outcome === "goal" && context.decisiveGoal;

  if (!strongSave && !postHit && !decisiveGoal) {
    return 0;
  }

  return Math.round(mix(FX_LIMITS.hitStopMinMs, FX_LIMITS.hitStopMaxMs, context.pressure));
}

function getTrailDuration(pressure: number): number {
  return Math.round(mix(FX_LIMITS.trailLifetimeMinMs, FX_LIMITS.trailLifetimeMaxMs, pressure));
}

function getTrailWidth(force: number, pressure: number): number {
  return FX_LIMITS.trailBaseWidthPx +
    clamp(force, 0, 1.5) * FX_LIMITS.trailForceWidthPx +
    pressure * FX_LIMITS.trailPressureWidthPx;
}

function makeEffect(
  kind: FxKind,
  durationMs: number,
  intensity: number,
  layer: FxEffect["layer"],
  origin: Point2D | null,
  overrides: Partial<Pick<FxEffect, "opacityStart" | "opacityEnd" | "widthPx">> = {}
): FxEffect {
  return {
    kind,
    poolKey: kind,
    durationMs,
    intensity,
    layer,
    origin,
    opacityStart: overrides.opacityStart ?? 1,
    opacityEnd: overrides.opacityEnd ?? 0,
    widthPx: overrides.widthPx ?? 0,
    gameplayDecision: false
  };
}

function mix(a: number, b: number, amount: number): number {
  return a + (b - a) * clamp(amount, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
