import { clamp } from "../core/math";

export type DifficultyPresetId = "rookie" | "standard" | "elite";

export interface DifficultyPreset {
  readonly predictionErrorPx: number;
  readonly reactionTimeMultiplier: number;
  readonly reachRadiusMultiplier: number;
  readonly wrongCommitChance: number;
  readonly shotQualityTolerance: number;
  readonly curveDifficultyMultiplier: number;
  readonly skillMultipliersByShot: readonly [number, number, number, number, number];
  readonly variation: DifficultyVariationConfig;
  readonly antiFrustration: AntiFrustrationConfig;
}

export interface DifficultyVariationConfig {
  readonly predictionOffsetPx: number;
  readonly reactionJitterMs: number;
  readonly animationVariants: readonly ["balanced", "early", "late"];
}

export interface AntiFrustrationConfig {
  readonly forgivingInputTolerancePx: number;
  readonly clearSaveContact: true;
  readonly clearMissReason: true;
  readonly fastRetryMs: number;
  readonly maxFailureAnimationMs: number;
}

export const GOALKEEPER_SKILL_MULTIPLIERS = [0.85, 0.95, 1, 1.05, 1.1] as const;

export const DIFFICULTY_PRESETS: Readonly<Record<DifficultyPresetId, DifficultyPreset>> = {
  rookie: {
    predictionErrorPx: 28,
    reactionTimeMultiplier: 1.16,
    reachRadiusMultiplier: 0.9,
    wrongCommitChance: 0.15,
    shotQualityTolerance: 0.35,
    curveDifficultyMultiplier: 1.2,
    skillMultipliersByShot: GOALKEEPER_SKILL_MULTIPLIERS,
    variation: {
      predictionOffsetPx: 14,
      reactionJitterMs: 24,
      animationVariants: ["balanced", "early", "late"]
    },
    antiFrustration: {
      forgivingInputTolerancePx: 12,
      clearSaveContact: true,
      clearMissReason: true,
      fastRetryMs: 520,
      maxFailureAnimationMs: 650
    }
  },
  standard: {
    predictionErrorPx: 18,
    reactionTimeMultiplier: 1,
    reachRadiusMultiplier: 1.05,
    wrongCommitChance: 0.08,
    shotQualityTolerance: 0.22,
    curveDifficultyMultiplier: 1,
    skillMultipliersByShot: GOALKEEPER_SKILL_MULTIPLIERS,
    variation: {
      predictionOffsetPx: 9,
      reactionJitterMs: 18,
      animationVariants: ["balanced", "early", "late"]
    },
    antiFrustration: {
      forgivingInputTolerancePx: 10,
      clearSaveContact: true,
      clearMissReason: true,
      fastRetryMs: 500,
      maxFailureAnimationMs: 620
    }
  },
  elite: {
    predictionErrorPx: 10,
    reactionTimeMultiplier: 0.9,
    reachRadiusMultiplier: 1.12,
    wrongCommitChance: 0.04,
    shotQualityTolerance: 0.12,
    curveDifficultyMultiplier: 0.82,
    skillMultipliersByShot: GOALKEEPER_SKILL_MULTIPLIERS,
    variation: {
      predictionOffsetPx: 5,
      reactionJitterMs: 12,
      animationVariants: ["balanced", "early", "late"]
    },
    antiFrustration: {
      forgivingInputTolerancePx: 8,
      clearSaveContact: true,
      clearMissReason: true,
      fastRetryMs: 480,
      maxFailureAnimationMs: 600
    }
  }
} as const;

export interface DifficultyBalance {
  readonly presetId: DifficultyPresetId;
  readonly preset: DifficultyPreset;
  readonly shotIndex: number;
  readonly skillMultiplier: number;
  readonly predictionOffsetPx: number;
  readonly reactionJitterMs: number;
  readonly animationVariant: DifficultyVariationConfig["animationVariants"][number];
}

export function resolveDifficultyBalance(
  presetId: DifficultyPresetId = "standard",
  shotIndex = 0,
  seed: string | number = 0
): DifficultyBalance {
  const preset = DIFFICULTY_PRESETS[presetId];
  const boundedShotIndex = clamp(Math.trunc(shotIndex), 0, preset.skillMultipliersByShot.length - 1);
  const offsetRoll = seededUnit(`${seed}:prediction:${boundedShotIndex}`);
  const reactionRoll = seededUnit(`${seed}:reaction:${boundedShotIndex}`);
  const variantRoll = seededUnit(`${seed}:animation:${boundedShotIndex}`);
  const variants = preset.variation.animationVariants;

  return {
    presetId,
    preset,
    shotIndex: boundedShotIndex,
    skillMultiplier: preset.skillMultipliersByShot[boundedShotIndex],
    predictionOffsetPx: toSignedRange(offsetRoll, preset.variation.predictionOffsetPx),
    reactionJitterMs: toSignedRange(reactionRoll, preset.variation.reactionJitterMs),
    animationVariant: variants[Math.min(variants.length - 1, Math.floor(variantRoll * variants.length))]
  };
}

export function shouldWrongCommit(chance: number, seed: string | number, shotIndex: number): boolean {
  return seededUnit(`${seed}:wrong-commit:${shotIndex}`) < clamp(chance, 0, 1);
}

function toSignedRange(unit: number, radius: number): number {
  return (unit * 2 - 1) * radius;
}

function seededUnit(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}
