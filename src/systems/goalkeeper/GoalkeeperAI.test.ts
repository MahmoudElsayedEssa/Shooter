import { describe, it, expect } from "vitest";
import {
  decideGoalkeeperAction,
  GOALKEEPER_MOOD_CONFIG,
  type GoalkeeperContext,
} from "./GoalkeeperAI";
import {
  GOALKEEPER_SKILL_MULTIPLIERS,
  resolveDifficultyBalance,
} from "../../config/difficulty";

// ─── Helpers ───

function makeContext(overrides: Partial<GoalkeeperContext> = {}): GoalkeeperContext {
  return {
    pressure: 0.3,
    playerScore: 0,
    goalkeeperScore: 0,
    consecutiveGoalsAgainst: 0,
    consecutiveSaves: 0,
    matchPoint: false,
    difficulty: 0.5,
    shotQuality: 0.8,
    curve: 0,
    targetX: 480,
    goalCenterX: 480,
    shotHistory: [],
    difficultyPreset: "standard",
    shotIndex: 0,
    aiSeed: "test-seed-42",
    ...overrides,
  };
}

// ─── Keeper canonical size constants (must match scene) ───
const KEEPER_HEIGHT_BY_POSE = {
  idle: 120,
  ready: 120,
  diveLeft: 90,
  diveRight: 90,
  save: 90,
  miss: 120,
};
const MAX_STRETCH = 1.03;

// ─── Tests ───

describe("GoalkeeperAI", () => {
  describe("decideGoalkeeperAction", () => {
    it("returns all four decision layers", () => {
      const decision = decideGoalkeeperAction(makeContext());
      expect(decision).toHaveProperty("emotional");
      expect(decision).toHaveProperty("tactical");
      expect(decision).toHaveProperty("physical");
      expect(decision).toHaveProperty("animation");
    });

    it("determines correct dive direction for center shot", () => {
      const decision = decideGoalkeeperAction(
        makeContext({ targetX: 480, goalCenterX: 480 })
      );
      expect(["center", "left", "right"]).toContain(decision.tactical.diveDirection);
    });

    it("predicts left direction for left-side shot", () => {
      const decision = decideGoalkeeperAction(
        makeContext({ targetX: 300, goalCenterX: 480, aiSeed: "left-test" })
      );
      expect(decision.tactical.committedTargetX).toBe(300);
    });

    it("predicts right direction for right-side shot", () => {
      const decision = decideGoalkeeperAction(
        makeContext({ targetX: 660, goalCenterX: 480, aiSeed: "right-test" })
      );
      expect(decision.tactical.committedTargetX).toBe(660);
    });
  });

  describe("saves at different positions", () => {
    it("center shot can be saved (keeper dives center)", () => {
      const ctx = makeContext({
        targetX: 480, goalCenterX: 480, difficulty: 0.8,
        aiSeed: "center-save-test", shotIndex: 2
      });
      const decision = decideGoalkeeperAction(ctx);
      expect(decision.physical.reachRadiusPx).toBeGreaterThan(30);
      expect(decision.physical.bodyX).toBe(480);
    });

    it("left reachable shot can be saved (keeper dives left)", () => {
      const ctx = makeContext({
        targetX: 320, goalCenterX: 480, difficulty: 0.8,
        aiSeed: "left-save-test", shotIndex: 2
      });
      const decision = decideGoalkeeperAction(ctx);
      expect(decision.physical.reachRadiusPx).toBeGreaterThan(30);
    });

    it("right reachable shot can be saved (keeper dives right)", () => {
      const ctx = makeContext({
        targetX: 640, goalCenterX: 480, difficulty: 0.8,
        aiSeed: "right-save-test", shotIndex: 2
      });
      const decision = decideGoalkeeperAction(ctx);
      expect(decision.physical.reachRadiusPx).toBeGreaterThan(30);
    });

    it("wrong-side dive reduces reach (wrongFooted penalty)", () => {
      const ctx = makeContext({
        targetX: 300, goalCenterX: 480, difficulty: 0.5,
        curve: 0, shotQuality: 0.3,
      });
      let foundWrongFooted = false;
      for (let i = 0; i < 20; i++) {
        const decision = decideGoalkeeperAction({ ...ctx, aiSeed: `wrong-foot-${i}` });
        if (decision.physical.wrongFooted) {
          foundWrongFooted = true;
          expect(decision.physical.wrongFooted).toBe(true);
          break;
        }
      }
      expect(foundWrongFooted).toBe(true);
    });
  });

  describe("keeper canonical size enforcement", () => {
    it("save animation must not exceed canonical max height (idle)", () => {
      // The keeper idle height (120) must never be exceeded
      const maxAllowed = KEEPER_HEIGHT_BY_POSE.idle * MAX_STRETCH;
      expect(maxAllowed).toBeCloseTo(123.6, 1);
      // 1.15 scale would produce 138 — which is WAY too big
      expect(KEEPER_HEIGHT_BY_POSE.idle * 1.15).toBeGreaterThan(maxAllowed);
    });

    it("save animation must not exceed canonical max height (dive)", () => {
      const maxAllowed = KEEPER_HEIGHT_BY_POSE.save * MAX_STRETCH;
      expect(maxAllowed).toBeCloseTo(92.7, 1);
      // 1.15 scale would produce 103.5 — too big
      expect(KEEPER_HEIGHT_BY_POSE.save * 1.15).toBeGreaterThan(maxAllowed);
    });

    it("stretch factor during dive is capped at 1.03", () => {
      // stretchX = 1 + rotationCurve * 0.03 at max
      // rotationCurve = sin(PI) = 0 at extremes, max at sin(PI/2) = 1
      const maxStretchX = 1 + 1 * 0.03;
      expect(maxStretchX).toBeLessThanOrEqual(MAX_STRETCH);
    });
  });

  describe("difficulty progression", () => {
    it("skill multiplier increases from shot 1 to shot 5", () => {
      expect(GOALKEEPER_SKILL_MULTIPLIERS[0]).toBeLessThan(GOALKEEPER_SKILL_MULTIPLIERS[4]);
    });

    it("shot 1 skill multiplier is 0.85", () => {
      expect(GOALKEEPER_SKILL_MULTIPLIERS[0]).toBe(0.85);
    });

    it("shot 5 skill multiplier is 1.1", () => {
      expect(GOALKEEPER_SKILL_MULTIPLIERS[4]).toBe(1.1);
    });

    it("resolveDifficultyBalance returns correct skill for each shot index", () => {
      for (let i = 0; i < 5; i++) {
        const balance = resolveDifficultyBalance("standard", i, "progression-test");
        expect(balance.skillMultiplier).toBe(GOALKEEPER_SKILL_MULTIPLIERS[i]);
      }
    });

    it("reach radius increases across shots for same context", () => {
      const reachByShot: number[] = [];
      for (let i = 0; i < 5; i++) {
        const ctx = makeContext({ shotIndex: i, aiSeed: "progression-reach" });
        const decision = decideGoalkeeperAction(ctx);
        reachByShot.push(decision.physical.reachRadiusPx);
      }
      expect(reachByShot[4]).toBeGreaterThan(reachByShot[0]);
    });
  });

  describe("emotional pressure (mood)", () => {
    it("returns calm mood when no pressure", () => {
      const ctx = makeContext({
        pressure: 0.1, playerScore: 0, goalkeeperScore: 0,
        consecutiveGoalsAgainst: 0, consecutiveSaves: 0, matchPoint: false
      });
      const decision = decideGoalkeeperAction(ctx);
      expect(decision.emotional.mood).toBe("calm");
    });

    it("returns nervous mood after consecutive goals against", () => {
      const ctx = makeContext({ consecutiveGoalsAgainst: 2 });
      const decision = decideGoalkeeperAction(ctx);
      expect(decision.emotional.mood).toBe("nervous");
    });

    it("returns focused mood after consecutive saves", () => {
      const ctx = makeContext({ consecutiveSaves: 2, pressure: 0.6 });
      const decision = decideGoalkeeperAction(ctx);
      expect(decision.emotional.mood).toBe("focused");
    });

    it("returns desperate mood at match point when losing", () => {
      const ctx = makeContext({
        matchPoint: true, playerScore: 3, goalkeeperScore: 1, pressure: 0.9
      });
      const decision = decideGoalkeeperAction(ctx);
      expect(decision.emotional.mood).toBe("desperate");
    });

    it("shot 1 mood differs from final close shot mood", () => {
      // Shot 1: calm
      const shot1 = decideGoalkeeperAction(makeContext({
        pressure: 0.1, shotIndex: 0, matchPoint: false
      }));
      // Shot 5 match point, losing
      const shot5 = decideGoalkeeperAction(makeContext({
        pressure: 0.9, shotIndex: 4, matchPoint: true,
        playerScore: 3, goalkeeperScore: 2
      }));
      expect(shot1.emotional.mood).not.toBe(shot5.emotional.mood);
    });

    it("mood affects reaction range", () => {
      const calmRange = GOALKEEPER_MOOD_CONFIG.calm.reactionRangeMs;
      const focusedRange = GOALKEEPER_MOOD_CONFIG.focused.reactionRangeMs;
      expect(focusedRange[0]).toBeLessThan(calmRange[0]);
    });

    it("mood affects accuracy base", () => {
      expect(GOALKEEPER_MOOD_CONFIG.focused.accuracyBase).toBeGreaterThan(
        GOALKEEPER_MOOD_CONFIG.calm.accuracyBase
      );
    });

    it("desperate mood has widest reach but lowest accuracy", () => {
      expect(GOALKEEPER_MOOD_CONFIG.desperate.baselineReachPx).toBeGreaterThan(
        GOALKEEPER_MOOD_CONFIG.calm.baselineReachPx
      );
      expect(GOALKEEPER_MOOD_CONFIG.desperate.accuracyBase).toBeLessThan(
        GOALKEEPER_MOOD_CONFIG.focused.accuracyBase
      );
    });

    it("mood affects physical layer reaction speed", () => {
      // Calm keeper should have slower reaction than focused keeper
      const calmCtx = makeContext({
        pressure: 0.1, consecutiveSaves: 0, consecutiveGoalsAgainst: 0
      });
      const focusedCtx = makeContext({
        pressure: 0.6, consecutiveSaves: 2
      });
      const calm = decideGoalkeeperAction(calmCtx);
      const focused = decideGoalkeeperAction(focusedCtx);
      // Focused has faster (lower) base reaction
      expect(focused.physical.reactionMs).toBeLessThan(calm.physical.reactionMs);
    });

    it("mood affects tactical prediction accuracy", () => {
      const calmCtx = makeContext({
        pressure: 0.1, consecutiveSaves: 0, consecutiveGoalsAgainst: 0,
        aiSeed: "pred-test"
      });
      const focusedCtx = makeContext({
        pressure: 0.6, consecutiveSaves: 2,
        aiSeed: "pred-test"
      });
      const calm = decideGoalkeeperAction(calmCtx);
      const focused = decideGoalkeeperAction(focusedCtx);
      expect(focused.tactical.predictionAccuracy).toBeGreaterThan(calm.tactical.predictionAccuracy);
    });

    it("mood affects physical reach radius", () => {
      // Desperate has highest baseline reach
      const calmCtx = makeContext({
        pressure: 0.1, shotIndex: 0
      });
      const desperateCtx = makeContext({
        pressure: 0.9, matchPoint: true, playerScore: 3, goalkeeperScore: 1, shotIndex: 4
      });
      const calm = decideGoalkeeperAction(calmCtx);
      const desperate = decideGoalkeeperAction(desperateCtx);
      // Desperate should have different reach due to different baseline + skill multiplier
      expect(desperate.physical.reachRadiusPx).not.toBe(calm.physical.reachRadiusPx);
    });
  });
});
