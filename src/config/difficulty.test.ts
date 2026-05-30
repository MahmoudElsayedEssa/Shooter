import { describe, expect, it } from "vitest";
import {
  DIFFICULTY_PRESETS,
  GOALKEEPER_SKILL_MULTIPLIERS,
  resolveDifficultyBalance,
  shouldWrongCommit
} from "./difficulty";

describe("REQ-BALANCE-001 difficulty configuration", () => {
  it("AC1 exposes every goalkeeper tuning lever as preset data", () => {
    expect(DIFFICULTY_PRESETS.rookie).toMatchObject({
      predictionErrorPx: 28,
      reactionTimeMultiplier: 1.16,
      reachRadiusMultiplier: 0.9,
      wrongCommitChance: 0.18,
      shotQualityTolerance: 0.35,
      curveDifficultyMultiplier: 1.2
    });
    expect(DIFFICULTY_PRESETS.standard).toMatchObject({
      predictionErrorPx: 18,
      reactionTimeMultiplier: 1,
      reachRadiusMultiplier: 1,
      wrongCommitChance: 0.1,
      shotQualityTolerance: 0.22,
      curveDifficultyMultiplier: 1
    });
    expect(DIFFICULTY_PRESETS.elite).toMatchObject({
      predictionErrorPx: 10,
      reactionTimeMultiplier: 0.9,
      reachRadiusMultiplier: 1.08,
      wrongCommitChance: 0.04,
      shotQualityTolerance: 0.12,
      curveDifficultyMultiplier: 0.82
    });
  });

  it("AC2 stores presets as data and resolves values without algorithm rewrites", () => {
    expect(Object.keys(DIFFICULTY_PRESETS)).toEqual(["rookie", "standard", "elite"]);
    expect({
      rookieErrorExceedsElite: DIFFICULTY_PRESETS.rookie.predictionErrorPx > DIFFICULTY_PRESETS.elite.predictionErrorPx,
      eliteReachExceedsRookie: DIFFICULTY_PRESETS.elite.reachRadiusMultiplier > DIFFICULTY_PRESETS.rookie.reachRadiusMultiplier,
      rookiePresetResolved: resolveDifficultyBalance("rookie", 0, "same-seed").preset === DIFFICULTY_PRESETS.rookie,
      elitePresetResolved: resolveDifficultyBalance("elite", 0, "same-seed").preset === DIFFICULTY_PRESETS.elite
    }).toEqual({
      rookieErrorExceedsElite: true,
      eliteReachExceedsRookie: true,
      rookiePresetResolved: true,
      elitePresetResolved: true
    });
  });

  it("AC6 keeps variation bounded, seedable, and visible", () => {
    const first = resolveDifficultyBalance("standard", 3, "seed-a");
    const repeated = resolveDifficultyBalance("standard", 3, "seed-a");
    const differentSeed = resolveDifficultyBalance("standard", 3, "seed-b");

    expect({
      repeated,
      predictionOffsetInsideBounds:
        first.predictionOffsetPx >= -DIFFICULTY_PRESETS.standard.variation.predictionOffsetPx &&
        first.predictionOffsetPx <= DIFFICULTY_PRESETS.standard.variation.predictionOffsetPx,
      reactionJitterInsideBounds:
        first.reactionJitterMs >= -DIFFICULTY_PRESETS.standard.variation.reactionJitterMs &&
        first.reactionJitterMs <= DIFFICULTY_PRESETS.standard.variation.reactionJitterMs,
      animationVariantVisible: DIFFICULTY_PRESETS.standard.variation.animationVariants.includes(first.animationVariant),
      differentSeedChangesOffset: differentSeed.predictionOffsetPx !== first.predictionOffsetPx
    }).toEqual({
      repeated: first,
      predictionOffsetInsideBounds: true,
      reactionJitterInsideBounds: true,
      animationVariantVisible: true,
      differentSeedChangesOffset: true
    });
  });

  it("AC7 makes wrong-commit variation deterministic for the same seed", () => {
    expect(shouldWrongCommit(0.5, "ai-seed", 1)).toBe(shouldWrongCommit(0.5, "ai-seed", 1));
    expect(shouldWrongCommit(0, "ai-seed", 1)).toBe(false);
    expect(shouldWrongCommit(1, "ai-seed", 1)).toBe(true);
  });

  it("AC8 increases goalkeeper skill by shot", () => {
    expect(GOALKEEPER_SKILL_MULTIPLIERS).toEqual([0.85, 0.95, 1, 1.05, 1.1]);
    expect(resolveDifficultyBalance("standard", -3, "seed").skillMultiplier).toBe(0.85);
    expect(resolveDifficultyBalance("standard", 4, "seed").skillMultiplier).toBe(1.1);
    expect(resolveDifficultyBalance("standard", 99, "seed").skillMultiplier).toBe(1.1);
  });

  it("AC9 defines forgiving input and fast readable failure presentation bounds", () => {
    expect({
      rookie: DIFFICULTY_PRESETS.rookie.antiFrustration,
      standard: DIFFICULTY_PRESETS.standard.antiFrustration,
      elite: DIFFICULTY_PRESETS.elite.antiFrustration
    }).toEqual({
      rookie: {
        forgivingInputTolerancePx: 12,
        clearSaveContact: true,
        clearMissReason: true,
        fastRetryMs: 520,
        maxFailureAnimationMs: 650
      },
      standard: {
        forgivingInputTolerancePx: 10,
        clearSaveContact: true,
        clearMissReason: true,
        fastRetryMs: 500,
        maxFailureAnimationMs: 620
      },
      elite: {
        forgivingInputTolerancePx: 8,
        clearSaveContact: true,
        clearMissReason: true,
        fastRetryMs: 480,
        maxFailureAnimationMs: 600
      }
    });
  });
});
