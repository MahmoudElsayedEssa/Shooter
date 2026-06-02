import { describe, it, expect } from "vitest";
import {
  createMatchState,
  reduceMatchState,
  isMatchDecided,
  scoreShot,
  MATCH_LIMITS,
  type MatchState,
} from "./MatchFlow";

// ─── Helpers ───

function bootedState(): MatchState {
  let s = createMatchState();
  s = reduceMatchState(s, { type: "boot_complete" });
  s = reduceMatchState(s, { type: "ready_to_aim" });
  return s;
}

/** Scores a goal using the explicit resolve_shot action. */
function resolveGoal(state: MatchState): MatchState {
  let s = reduceMatchState(state, { type: "begin_drawing" });
  s = reduceMatchState(s, { type: "resolve_shot", outcome: "goal" });
  return s;
}

/** Scores a save using the explicit resolve_shot action. */
function resolveSave(state: MatchState): MatchState {
  let s = reduceMatchState(state, { type: "begin_drawing" });
  s = reduceMatchState(s, { type: "resolve_shot", outcome: "save" });
  return s;
}

/** Scores a miss using the explicit resolve_shot action. */
function resolveMiss(state: MatchState): MatchState {
  let s = reduceMatchState(state, { type: "begin_drawing" });
  s = reduceMatchState(s, { type: "resolve_shot", outcome: "miss" });
  return s;
}

// ─── Tests ───

describe("MatchFlow", () => {
  describe("createMatchState", () => {
    it("starts in boot phase with zero score", () => {
      const s = createMatchState();

      expect(s.phase).toBe("boot");
      expect(s.score.player).toBe(0);
      expect(s.score.goalkeeper).toBe(0);
      expect(s.shotsTaken).toBe(0);
    });
  });

  describe("reduceMatchState", () => {
    it("transitions boot → ready → aiming", () => {
      let s = createMatchState();
      s = reduceMatchState(s, { type: "boot_complete" });
      expect(s.phase).toBe("ready");

      s = reduceMatchState(s, { type: "ready_to_aim" });
      expect(s.phase).toBe("aiming");
    });

    it("transitions aiming → drawing → shot_commit", () => {
      let s = bootedState();
      s = reduceMatchState(s, { type: "begin_drawing" });
      expect(s.phase).toBe("drawing");

      s = reduceMatchState(s, { type: "commit_shot", outcome: "goal" });
      expect(s.phase).toBe("shot_commit");
      expect(s.pendingOutcome).toBe("goal");
    });

    it("invalid gesture returns to aiming", () => {
      let s = bootedState();
      s = reduceMatchState(s, { type: "begin_drawing" });
      s = reduceMatchState(s, { type: "invalid_gesture" });
      expect(s.phase).toBe("aiming");
    });

    it("pauses and restores correctly", () => {
      let s = bootedState();
      s = reduceMatchState(s, { type: "visibility_lost" });
      expect(s.phase).toBe("pause");

      s = reduceMatchState(s, { type: "visibility_restored" });
      expect(s.phase).toBe("aiming");
    });

    it("throws for unknown action types", () => {
      const s = bootedState();
      expect(() =>
        reduceMatchState(s, { type: "unknown_action" } as never)
      ).toThrow();
    });
  });

  describe("resolve_shot action", () => {
    it("goal increments player score immediately", () => {
      let s = bootedState();
      s = resolveGoal(s);

      expect(s.score.player).toBe(1);
      expect(s.score.goalkeeper).toBe(0);
      expect(s.shotsTaken).toBe(1);
    });

    it("save increments goalkeeper score immediately", () => {
      let s = bootedState();
      s = resolveSave(s);

      expect(s.score.player).toBe(0);
      expect(s.score.goalkeeper).toBe(1);
      expect(s.shotsTaken).toBe(1);
    });

    it("miss increments goalkeeper score immediately", () => {
      let s = bootedState();
      s = resolveMiss(s);

      expect(s.score.player).toBe(0);
      expect(s.score.goalkeeper).toBe(1);
      expect(s.shotsTaken).toBe(1);
    });

    it("transitions to reset when match not decided", () => {
      let s = bootedState();
      s = resolveGoal(s);

      expect(s.phase).toBe("reset");
    });

    it("transitions to match_end when match decided", () => {
      let s = bootedState();
      // Score 3 goals — after 3-0 with 2 remaining, lead 3 > 2
      for (let i = 0; i < 3; i++) {
        if (s.phase === "reset") {
          s = reduceMatchState(s, { type: "advance", elapsedMs: 500 });
        }
        s = resolveGoal(s);
      }

      expect(s.phase).toBe("match_end");
      expect(s.score.player).toBe(3);
    });

    it("five shots ends match", () => {
      let s = bootedState();

      for (let i = 0; i < MATCH_LIMITS.maxShots; i++) {
        if (s.phase === "reset") {
          s = reduceMatchState(s, { type: "advance", elapsedMs: 500 });
        }
        if (s.phase === "match_end") break;
        if (s.phase !== "aiming") break;
        // Alternate goal/save to prevent early match_end from uncatchable lead
        if (i % 2 === 0) {
          s = resolveGoal(s);
        } else {
          s = resolveSave(s);
        }
      }

      expect(s.phase).toBe("match_end");
      expect(s.score.player + s.score.goalkeeper).toBe(s.shotsTaken);
    });

    it("restart resets score and shot count", () => {
      let s = bootedState();
      s = resolveGoal(s);
      // Advance to aiming for next shot
      if (s.phase === "reset") {
        s = reduceMatchState(s, { type: "advance", elapsedMs: 500 });
      }
      s = resolveGoal(s);
      if (s.phase === "reset") {
        s = reduceMatchState(s, { type: "advance", elapsedMs: 500 });
      }
      s = resolveGoal(s);
      // Should be match_end after 3-0
      expect(s.phase).toBe("match_end");

      // Restart
      s = reduceMatchState(s, { type: "restart" });
      expect(s.phase).toBe("aiming");
      expect(s.score.player).toBe(0);
      expect(s.score.goalkeeper).toBe(0);
      expect(s.shotsTaken).toBe(0);
    });

    it("clears pendingOutcome", () => {
      let s = bootedState();
      s = reduceMatchState(s, { type: "begin_drawing" });
      s = reduceMatchState(s, { type: "resolve_shot", outcome: "goal" });
      expect(s.pendingOutcome).toBeNull();
    });

    it("works from ball_flight phase", () => {
      let s = bootedState();
      s = reduceMatchState(s, { type: "begin_drawing" });
      s = reduceMatchState(s, { type: "commit_shot", outcome: "goal" });
      s = reduceMatchState(s, { type: "advance", elapsedMs: 200 }); // → ball_flight
      expect(s.phase).toBe("ball_flight");

      s = reduceMatchState(s, { type: "resolve_shot", outcome: "goal" });
      expect(s.score.player).toBe(1);
      expect(s.shotsTaken).toBe(1);
    });

    it("works directly from aiming phase (real scene scenario)", () => {
      // Scene manages its own phase independently — MatchState stays in aiming
      // when the scene goes through drawing→ball_flight→finishShot
      let s = bootedState();
      expect(s.phase).toBe("aiming");

      s = reduceMatchState(s, { type: "resolve_shot", outcome: "goal" });
      expect(s.score.player).toBe(1);
      expect(s.shotsTaken).toBe(1);
    });

    it("does NOT work from boot or match_end", () => {
      const boot = createMatchState();
      const afterBoot = reduceMatchState(boot, { type: "resolve_shot", outcome: "goal" });
      expect(afterBoot.score.player).toBe(0); // no change

      let decided = bootedState();
      decided = reduceMatchState(decided, { type: "resolve_shot", outcome: "goal" });
      decided = reduceMatchState(decided, { type: "resolve_shot", outcome: "goal" });
      decided = reduceMatchState(decided, { type: "resolve_shot", outcome: "goal" });
      expect(decided.phase).toBe("match_end");
      const afterEnd = reduceMatchState(decided, { type: "resolve_shot", outcome: "goal" });
      expect(afterEnd.score.player).toBe(3); // no change after match_end
    });
  });

  describe("isMatchDecided", () => {
    it("is decided after maxShots", () => {
      expect(isMatchDecided({ player: 3, goalkeeper: 2 }, 5)).toBe(true);
    });

    it("is decided when lead is uncatchable", () => {
      expect(isMatchDecided({ player: 3, goalkeeper: 0 }, 3)).toBe(true);
    });

    it("is not decided when lead is catchable", () => {
      expect(isMatchDecided({ player: 2, goalkeeper: 1 }, 3)).toBe(false);
    });
  });

  describe("scoreShot", () => {
    it("increments player for goal", () => {
      const score = scoreShot({ player: 1, goalkeeper: 0 }, "goal");
      expect(score.player).toBe(2);
      expect(score.goalkeeper).toBe(0);
    });

    it("increments goalkeeper for save", () => {
      const score = scoreShot({ player: 1, goalkeeper: 0 }, "save");
      expect(score.player).toBe(1);
      expect(score.goalkeeper).toBe(1);
    });

    it("increments goalkeeper for miss", () => {
      const score = scoreShot({ player: 1, goalkeeper: 0 }, "miss");
      expect(score.player).toBe(1);
      expect(score.goalkeeper).toBe(1);
    });
  });
});
