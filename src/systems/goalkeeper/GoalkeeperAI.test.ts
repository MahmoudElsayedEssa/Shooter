import { describe, expect, it } from "vitest";
import { DIFFICULTY_PRESETS, resolveDifficultyBalance } from "../../config/difficulty";
import {
  GOALKEEPER_MOOD_CONFIG,
  decideGoalkeeperAction,
  getReachAtDiveProgress,
  updateShotPatternMemory,
  type DiveDirection,
  type GoalkeeperContext
} from "./GoalkeeperAI";

const baseContext: GoalkeeperContext = {
  pressure: 0.2,
  playerScore: 0,
  goalkeeperScore: 0,
  consecutiveGoalsAgainst: 0,
  consecutiveSaves: 0,
  matchPoint: false,
  difficulty: 0.5,
  shotQuality: 0.8,
  curve: 0,
  targetX: 240,
  goalCenterX: 200,
  shotHistory: [],
  difficultyPreset: "standard",
  shotIndex: 2,
  aiSeed: "goalkeeper-test"
};

function decision(overrides: Partial<GoalkeeperContext> = {}) {
  return decideGoalkeeperAction({ ...baseContext, ...overrides });
}

describe("REQ-GOALIE-001 goalkeeper AI", () => {
  it("AC1 returns emotional, tactical, physical, and animation layers", () => {
    const output = decision();
    const expected = getExpectedPrediction();
    const expectedReaction = getExpectedReaction("calm");

    expect(output.emotional.mood).toBe("calm");
    expect(output.emotional.tension).toBeCloseTo(0.11);
    expect(output.tactical.predictionAccuracy).toBeCloseTo(expected.accuracy);
    expect(output.tactical.predictedX).toBeCloseTo(expected.predictedX);
    expect(output.tactical.diveDirection).toBe("right");
    expect(output.tactical.committedTargetX).toBe(baseContext.targetX);
    expect(output.tactical.wrongCommitChance).toBe(DIFFICULTY_PRESETS.standard.wrongCommitChance);
    expect(output.physical.reactionMs).toBeCloseTo(expectedReaction);
    expect(output.physical.reachRadiusPx).toBeCloseTo(69.6);
    expect(output.physical.handReachPx).toBeCloseTo(84.912);
    expect(output.physical.teleported).toBe(false);
    expect(output.animation).toMatchObject({
      pose: "idle",
      face: "neutral",
      recoveryMs: 240,
      fastRetryMs: 500,
      maxFailureAnimationMs: 620,
      clearSaveContact: true,
      clearMissReason: true
    });
  });

  it("AC2 gives all five moods distinct visual and gameplay behavior", () => {
    const cases: readonly [string, Partial<GoalkeeperContext>, string][] = [
      ["calm", {}, "neutral"],
      ["focused", { pressure: 0.6, consecutiveSaves: 2 }, "locked_in"],
      ["nervous", { playerScore: 2, goalkeeperScore: 0, consecutiveGoalsAgainst: 2 }, "worried"],
      ["aggressive", { playerScore: 0, goalkeeperScore: 1, pressure: 0.72 }, "challenging"],
      ["desperate", { playerScore: 2, goalkeeperScore: 1, pressure: 0.9, matchPoint: true }, "strained"]
    ];

    for (const [mood, context, face] of cases) {
      const output = decision(context);
      expect(output.emotional.mood).toBe(mood);
      expect(output.animation.face).toBe(face);
      expect(output.tactical.predictionAccuracy).toBeCloseTo(
        GOALKEEPER_MOOD_CONFIG[output.emotional.mood].accuracyBase +
          ((context.difficulty ?? baseContext.difficulty) * 0.18) +
          (Math.max(0, (context.shotQuality ?? baseContext.shotQuality) - DIFFICULTY_PRESETS.standard.shotQualityTolerance) * 0.14) -
          Math.abs(context.curve ?? baseContext.curve) * 0.18
      );
      const [min, max] = GOALKEEPER_MOOD_CONFIG[output.emotional.mood].reactionRangeMs;
      expect(output.physical.reactionMs).toBeCloseTo(
        min + (max - min) * 0.5 + resolveDifficultyBalance("standard", 2, "goalkeeper-test").reactionJitterMs
      );
    }
  });

  it("AC3 transitions mood from pressure, score deficit, streaks, and match point", () => {
    const focused = decision({ pressure: 0.58, consecutiveSaves: 2 });
    const nervous = decision({ playerScore: 3, goalkeeperScore: 1, consecutiveGoalsAgainst: 2 });
    const aggressive = decision({ playerScore: 0, goalkeeperScore: 1, pressure: 0.75 });
    const desperate = decision({ playerScore: 4, goalkeeperScore: 3, pressure: 0.9, matchPoint: true });

    expect(focused.emotional).toEqual({ mood: "focused", tension: 0.319 });
    expect(nervous.emotional).toEqual({ mood: "nervous", tension: 0.65 });
    expect(aggressive.emotional).toEqual({ mood: "aggressive", tension: 0.41250000000000003 });
    expect(desperate.emotional.mood).toBe("desperate");
    expect(desperate.emotional.tension).toBeCloseTo(0.825);
  });

  it("AC4 makes prediction accuracy depend on mood, difficulty, shot quality, and curve strength", () => {
    const easyHighQuality = decision({ difficulty: 1, shotQuality: 1, curve: 0 }).tactical.predictionAccuracy;
    const easyCurved = decision({ difficulty: 1, shotQuality: 1, curve: 1 }).tactical.predictionAccuracy;
    const hardLowQuality = decision({ difficulty: 0, shotQuality: 0.2, curve: 0 }).tactical.predictionAccuracy;
    const focused = decision({ pressure: 0.6, consecutiveSaves: 2 }).tactical.predictionAccuracy;

    expect(easyHighQuality).toBeCloseTo(0.8092);
    expect(easyCurved).toBeCloseTo(0.6292);
    expect(hardLowQuality).toBeCloseTo(0.5172);
    expect(focused).toBeCloseTo(0.8512);
  });

  it("AC5 keeps reaction timing inside each mood range", () => {
    const balance = resolveDifficultyBalance("standard", 2, "goalkeeper-test");

    for (const mood of Object.keys(GOALKEEPER_MOOD_CONFIG) as Array<keyof typeof GOALKEEPER_MOOD_CONFIG>) {
      const [min, max] = GOALKEEPER_MOOD_CONFIG[mood].reactionRangeMs;
      const contextByMood: Record<typeof mood, Partial<GoalkeeperContext>> = {
        calm: {},
        focused: { consecutiveSaves: 2 },
        nervous: { consecutiveGoalsAgainst: 2, playerScore: 2 },
        aggressive: { goalkeeperScore: 1, pressure: 0.8 },
        desperate: { playerScore: 2, pressure: 0.9, matchPoint: true }
      };
      const output = decision(contextByMood[mood]);

      expect(output.physical.reactionMs).toBeCloseTo(min + (max - min) * 0.5 + balance.reactionJitterMs);
      expect(decision({ ...contextByMood[mood], difficulty: 1 }).physical.reactionMs).toBeCloseTo(
        min + balance.reactionJitterMs
      );
      expect(decision({ ...contextByMood[mood], difficulty: 0 }).physical.reactionMs).toBeCloseTo(
        max + balance.reactionJitterMs
      );
    }
  });

  it("AC6 expands reach at dive peak, weakens wrong-footed reach, and never teleports", () => {
    const early = getReachAtDiveProgress(50, 0, false);
    const peak = getReachAtDiveProgress(50, 0.5, false);
    const wrongFootedPeak = getReachAtDiveProgress(50, 0.5, true);
    const output = decision({
      targetX: 160,
      difficulty: 0,
      shotQuality: 0.2,
      curve: 1,
      pressure: 0.9,
      playerScore: 2,
      matchPoint: true
    });

    expect(early).toBe(50);
    expect(peak).toBe(72.5);
    expect(wrongFootedPeak).toBe(52.199999999999996);
    expect(output.physical.reachRadiusPx).toBeCloseTo(60.552);
    expect(output.physical.handReachPx).toBeCloseTo(73.87344);
    expect(output.physical.teleported).toBe(false);
    expect(output.physical.wrongFooted).toBe(true);
  });

  it("AC7 improves repeated-direction prediction and uses anticipation pose", () => {
    const history = ["right", "right", "right"].reduce<readonly DiveDirection[]>(
      (next, direction) => updateShotPatternMemory(next, direction as DiveDirection),
      []
    );
    const baseline = decision({ shotHistory: [] });
    const learned = decision({ shotHistory: history });

    expect(history).toEqual(["right", "right", "right"]);
    expect(learned.tactical.repeatPatternBonus).toBe(0.12);
    expect(baseline.tactical.predictionAccuracy).toBeCloseTo(0.6912);
    expect(learned.tactical.predictionAccuracy).toBeCloseTo(0.8112);
    expect(learned.animation.pose).toBe("anticipate");
  });

  it("REQ-BALANCE-001 AC3 and AC4 never forces shot outcome through goalkeeper decision data", () => {
    const highQualityShot = decision({ difficultyPreset: "elite", difficulty: 1, shotQuality: 1, curve: 0.1 });
    const dramaticShot = decision({
      difficultyPreset: "elite",
      difficulty: 1,
      shotQuality: 0.3,
      curve: 1,
      pressure: 1,
      matchPoint: true,
      playerScore: 4,
      goalkeeperScore: 4
    });

    expect("result" in highQualityShot).toBe(false);
    expect("result" in dramaticShot).toBe(false);
    expect(highQualityShot.physical.teleported).toBe(false);
    expect(dramaticShot.physical.teleported).toBe(false);
    expect(dramaticShot.physical.reachRadiusPx <= dramaticShot.physical.handReachPx).toBe(true);
  });

  it("REQ-BALANCE-001 AC5 keeps the committed target fixed after prediction variation", () => {
    const first = decision({ targetX: 178, aiSeed: "seed-a", shotQuality: 0.55 });
    const second = decision({ targetX: 178, aiSeed: "seed-b", shotQuality: 0.55 });

    expect(first.tactical.committedTargetX).toBe(178);
    expect(second.tactical.committedTargetX).toBe(178);
    expect(first.tactical.predictedX === second.tactical.predictedX).toBe(false);
  });
});

function getExpectedPrediction(overrides: Partial<GoalkeeperContext> = {}) {
  const context = { ...baseContext, ...overrides };
  const balance = resolveDifficultyBalance(context.difficultyPreset, context.shotIndex, context.aiSeed);
  const accuracy = GOALKEEPER_MOOD_CONFIG.calm.accuracyBase +
    context.difficulty * 0.18 +
    Math.max(0, context.shotQuality - balance.preset.shotQualityTolerance) * 0.14 -
    Math.abs(context.curve) * balance.preset.curveDifficultyMultiplier * 0.18;

  return {
    accuracy,
    predictedX: context.goalCenterX +
      (context.targetX - context.goalCenterX) * accuracy +
      balance.predictionOffsetPx * (1 - context.shotQuality)
  };
}

function getExpectedReaction(mood: keyof typeof GOALKEEPER_MOOD_CONFIG) {
  const [min, max] = GOALKEEPER_MOOD_CONFIG[mood].reactionRangeMs;
  return min + (max - min) * 0.5 +
    resolveDifficultyBalance(baseContext.difficultyPreset, baseContext.shotIndex, baseContext.aiSeed).reactionJitterMs;
}
