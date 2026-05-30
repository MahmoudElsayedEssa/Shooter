export type GoalkeeperMood = "calm" | "focused" | "nervous" | "aggressive" | "desperate";
export type DiveDirection = "left" | "center" | "right";
export type ShotResult = "goal" | "save" | "miss";

export interface GoalkeeperContext {
  readonly pressure: number;
  readonly playerScore: number;
  readonly goalkeeperScore: number;
  readonly consecutiveGoalsAgainst: number;
  readonly consecutiveSaves: number;
  readonly matchPoint: boolean;
  readonly difficulty: number;
  readonly shotQuality: number;
  readonly curve: number;
  readonly targetX: number;
  readonly goalCenterX: number;
  readonly shotHistory: readonly DiveDirection[];
}

export interface GoalkeeperDecision {
  readonly emotional: EmotionalLayer;
  readonly tactical: TacticalLayer;
  readonly physical: PhysicalLayer;
  readonly animation: AnimationLayer;
}

export interface EmotionalLayer {
  readonly mood: GoalkeeperMood;
  readonly tension: number;
}

export interface TacticalLayer {
  readonly predictionAccuracy: number;
  readonly predictedX: number;
  readonly diveDirection: DiveDirection;
  readonly repeatPatternBonus: number;
}

export interface PhysicalLayer {
  readonly reactionMs: number;
  readonly bodyX: number;
  readonly reachRadiusPx: number;
  readonly handReachPx: number;
  readonly wrongFooted: boolean;
  readonly teleported: false;
}

export interface AnimationLayer {
  readonly pose: "idle" | "focus" | "anticipate" | "dive" | "recover";
  readonly face: "neutral" | "locked_in" | "worried" | "challenging" | "strained";
  readonly recoveryMs: number;
}

export const GOALKEEPER_MOOD_CONFIG: Readonly<Record<GoalkeeperMood, {
  readonly reactionRangeMs: readonly [number, number];
  readonly accuracyBase: number;
  readonly risk: number;
  readonly face: AnimationLayer["face"];
  readonly baselineReachPx: number;
}>> = {
  calm: { reactionRangeMs: [140, 190], accuracyBase: 0.52, risk: 0.18, face: "neutral", baselineReachPx: 48 },
  focused: { reactionRangeMs: [105, 155], accuracyBase: 0.68, risk: 0.1, face: "locked_in", baselineReachPx: 54 },
  nervous: { reactionRangeMs: [170, 240], accuracyBase: 0.42, risk: 0.28, face: "worried", baselineReachPx: 44 },
  aggressive: { reactionRangeMs: [80, 130], accuracyBase: 0.47, risk: 0.46, face: "challenging", baselineReachPx: 52 },
  desperate: { reactionRangeMs: [70, 180], accuracyBase: 0.38, risk: 0.62, face: "strained", baselineReachPx: 58 }
} as const;

export function decideGoalkeeperAction(context: GoalkeeperContext): GoalkeeperDecision {
  const emotional = getEmotionalLayer(context);
  const tactical = getTacticalLayer(context, emotional.mood);
  const wrongFooted = getDiveDirection(context.targetX, context.goalCenterX) !== tactical.diveDirection;
  const physical = getPhysicalLayer(context, emotional.mood, wrongFooted);

  return {
    emotional,
    tactical,
    physical,
    animation: getAnimationLayer(emotional.mood, tactical.repeatPatternBonus)
  };
}

export function getReachAtDiveProgress(baseReachPx: number, progress: number, wrongFooted: boolean): number {
  const peakMultiplier = 1 + Math.sin(clamp(progress, 0, 1) * Math.PI) * 0.45;
  const wrongFootMultiplier = wrongFooted ? 0.72 : 1;
  return baseReachPx * peakMultiplier * wrongFootMultiplier;
}

export function updateShotPatternMemory(
  history: readonly DiveDirection[],
  latestDirection: DiveDirection,
  maxEntries = 5
): readonly DiveDirection[] {
  return [...history, latestDirection].slice(-maxEntries);
}

function getEmotionalLayer(context: GoalkeeperContext): EmotionalLayer {
  const scoreDiff = context.playerScore - context.goalkeeperScore;
  const tension = clamp(
    context.pressure * 0.55 +
      Math.max(0, scoreDiff) * 0.15 +
      context.consecutiveGoalsAgainst * 0.12 +
      (context.matchPoint ? 0.18 : 0),
    0,
    1
  );

  if (context.matchPoint && (scoreDiff > 0 || context.pressure >= 0.82)) {
    return { mood: "desperate", tension };
  }

  if (context.consecutiveGoalsAgainst >= 2 || scoreDiff > 1) {
    return { mood: "nervous", tension };
  }

  if (context.consecutiveSaves >= 2 || (context.pressure >= 0.55 && scoreDiff === 0)) {
    return { mood: "focused", tension };
  }

  if (scoreDiff < 0 || (context.pressure >= 0.7 && !context.matchPoint)) {
    return { mood: "aggressive", tension };
  }

  return { mood: "calm", tension };
}

function getTacticalLayer(context: GoalkeeperContext, mood: GoalkeeperMood): TacticalLayer {
  const config = GOALKEEPER_MOOD_CONFIG[mood];
  const repeatPatternBonus = getRepeatPatternBonus(context.shotHistory);
  const curvePenalty = Math.abs(context.curve) * 0.18;
  const predictionAccuracy = clamp(
    config.accuracyBase + context.difficulty * 0.18 + context.shotQuality * 0.14 + repeatPatternBonus - curvePenalty,
    0.05,
    0.95
  );
  const rawDirection = getDiveDirection(context.targetX, context.goalCenterX);
  const diveDirection = config.risk > predictionAccuracy && rawDirection !== "center" ? opposite(rawDirection) : rawDirection;

  return {
    predictionAccuracy,
    predictedX: context.goalCenterX + (context.targetX - context.goalCenterX) * predictionAccuracy,
    diveDirection,
    repeatPatternBonus
  };
}

function getPhysicalLayer(context: GoalkeeperContext, mood: GoalkeeperMood, wrongFooted: boolean): PhysicalLayer {
  const config = GOALKEEPER_MOOD_CONFIG[mood];
  const reactionMs = config.reactionRangeMs[0] +
    (config.reactionRangeMs[1] - config.reactionRangeMs[0]) * (1 - clamp(context.difficulty, 0, 1));
  const reachRadiusPx = getReachAtDiveProgress(config.baselineReachPx, 0.5, wrongFooted);

  return {
    reactionMs,
    bodyX: context.goalCenterX,
    reachRadiusPx,
    handReachPx: reachRadiusPx * 1.22,
    wrongFooted,
    teleported: false
  };
}

function getAnimationLayer(mood: GoalkeeperMood, repeatPatternBonus: number): AnimationLayer {
  return {
    pose: repeatPatternBonus > 0 ? "anticipate" : mood === "calm" ? "idle" : "focus",
    face: GOALKEEPER_MOOD_CONFIG[mood].face,
    recoveryMs: mood === "desperate" ? 320 : 240
  };
}

function getRepeatPatternBonus(history: readonly DiveDirection[]): number {
  if (history.length < 2) {
    return 0;
  }

  const last = history[history.length - 1];
  const streak = [...history].reverse().findIndex((direction) => direction !== last);
  const repeatCount = streak === -1 ? history.length : streak;
  return repeatCount >= 2 ? Math.min(0.16, repeatCount * 0.04) : 0;
}

function getDiveDirection(targetX: number, goalCenterX: number): DiveDirection {
  const delta = targetX - goalCenterX;
  if (Math.abs(delta) <= 12) {
    return "center";
  }
  return delta < 0 ? "left" : "right";
}

function opposite(direction: DiveDirection): DiveDirection {
  if (direction === "left") {
    return "right";
  }
  if (direction === "right") {
    return "left";
  }
  return "center";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
