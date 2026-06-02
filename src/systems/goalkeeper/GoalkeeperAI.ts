import {
  resolveDifficultyBalance,
  shouldWrongCommit,
  type DifficultyBalance,
  type DifficultyPresetId,
  type DifficultyVariationConfig
} from "../../config/difficulty";
import { clamp } from "../../core/math";

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
  readonly difficultyPreset?: DifficultyPresetId;
  readonly shotIndex?: number;
  readonly aiSeed?: string | number;
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
  readonly committedTargetX: number;
  readonly predictionErrorPx: number;
  readonly wrongCommitChance: number;
}

export interface PhysicalLayer {
  readonly reactionMs: number;
  readonly bodyX: number;
  readonly reachRadiusPx: number;
  readonly handReachPx: number;
  readonly wrongFooted: boolean;
  readonly teleported: false;
  readonly skillMultiplier: number;
  readonly reactionJitterMs: number;
}

export interface AnimationLayer {
  readonly pose: "idle" | "focus" | "anticipate" | "dive" | "recover";
  readonly face: "neutral" | "locked_in" | "worried" | "challenging" | "strained";
  readonly recoveryMs: number;
  readonly variation: DifficultyVariationConfig["animationVariants"][number];
  readonly fastRetryMs: number;
  readonly maxFailureAnimationMs: number;
  readonly clearSaveContact: true;
  readonly clearMissReason: true;
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
  const balance = resolveDifficultyBalance(context.difficultyPreset, context.shotIndex, context.aiSeed);
  const emotional = getEmotionalLayer(context);
  const tactical = getTacticalLayer(context, emotional.mood, balance);
  const wrongFooted = getDiveDirection(context.targetX, context.goalCenterX) !== tactical.diveDirection;
  const physical = getPhysicalLayer(context, emotional.mood, wrongFooted, balance);

  return {
    emotional,
    tactical,
    physical,
    animation: getAnimationLayer(emotional.mood, tactical.repeatPatternBonus, balance)
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

function getTacticalLayer(context: GoalkeeperContext, mood: GoalkeeperMood, balance: DifficultyBalance): TacticalLayer {
  const config = GOALKEEPER_MOOD_CONFIG[mood];
  const repeatPatternBonus = getRepeatPatternBonus(context.shotHistory);
  const qualityTolerance = balance.preset.shotQualityTolerance;
  const curvePenalty = Math.abs(context.curve) * balance.preset.curveDifficultyMultiplier * 0.18;
  const qualityBonus = clamp(context.shotQuality - qualityTolerance, 0, 1) * 0.14;
  const skillAdjustedDifficulty = clamp(context.difficulty * balance.skillMultiplier, 0, 1.15);
  const predictionAccuracy = clamp(
    config.accuracyBase + skillAdjustedDifficulty * 0.18 + qualityBonus + repeatPatternBonus - curvePenalty,
    0.05,
    0.95
  );
  const rawDirection = getDiveDirection(context.targetX, context.goalCenterX);
  const difficultyWrongCommit = shouldWrongCommit(
    balance.preset.wrongCommitChance,
    context.aiSeed ?? 0,
    balance.shotIndex
  );
  const moodWrongCommit = config.risk > predictionAccuracy && rawDirection !== "center";
  const diveDirection = (difficultyWrongCommit || moodWrongCommit) ? opposite(rawDirection) : rawDirection;
  const predictionErrorPx = (1 - predictionAccuracy) * balance.preset.predictionErrorPx;

  return {
    predictionAccuracy,
    predictedX: context.goalCenterX +
      (context.targetX - context.goalCenterX) * predictionAccuracy +
      balance.predictionOffsetPx * (1 - context.shotQuality),
    diveDirection,
    repeatPatternBonus,
    committedTargetX: context.targetX,
    predictionErrorPx,
    wrongCommitChance: balance.preset.wrongCommitChance
  };
}

function getPhysicalLayer(
  context: GoalkeeperContext,
  mood: GoalkeeperMood,
  wrongFooted: boolean,
  balance: DifficultyBalance
): PhysicalLayer {
  const config = GOALKEEPER_MOOD_CONFIG[mood];
  const baseReactionMs = config.reactionRangeMs[0] +
    (config.reactionRangeMs[1] - config.reactionRangeMs[0]) * (1 - clamp(context.difficulty, 0, 1));
  const reactionMs = Math.max(0, baseReactionMs * balance.preset.reactionTimeMultiplier + balance.reactionJitterMs);
  const reachRadiusPx = getReachAtDiveProgress(
    config.baselineReachPx * balance.preset.reachRadiusMultiplier * balance.skillMultiplier,
    0.5,
    wrongFooted
  );

  return {
    reactionMs,
    bodyX: context.goalCenterX,
    reachRadiusPx,
    handReachPx: reachRadiusPx * 1.22,
    wrongFooted,
    teleported: false,
    skillMultiplier: balance.skillMultiplier,
    reactionJitterMs: balance.reactionJitterMs
  };
}

function getAnimationLayer(
  mood: GoalkeeperMood,
  repeatPatternBonus: number,
  balance: DifficultyBalance
): AnimationLayer {
  const baseRecoveryMs = mood === "desperate" ? 320 : 240;

  return {
    pose: repeatPatternBonus > 0 ? "anticipate" : mood === "calm" ? "idle" : "focus",
    face: GOALKEEPER_MOOD_CONFIG[mood].face,
    recoveryMs: Math.min(baseRecoveryMs, balance.preset.antiFrustration.maxFailureAnimationMs),
    variation: balance.animationVariant,
    fastRetryMs: balance.preset.antiFrustration.fastRetryMs,
    maxFailureAnimationMs: balance.preset.antiFrustration.maxFailureAnimationMs,
    clearSaveContact: balance.preset.antiFrustration.clearSaveContact,
    clearMissReason: balance.preset.antiFrustration.clearMissReason
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
