import { describe, expect, it } from "vitest";
import {
  MATCH_LIMITS,
  createMatchState,
  isMatchDecided,
  reduceMatchState,
  scoreShot,
  type MatchState,
  type ShotOutcome
} from "./MatchFlow";

function playNormalShot(state: MatchState, outcome: ShotOutcome): MatchState {
  let next = reduceMatchState(state, { type: "begin_drawing" });
  next = reduceMatchState(next, { type: "commit_shot", outcome });
  next = reduceMatchState(next, { type: "advance", elapsedMs: MATCH_LIMITS.shotCommitMs });
  next = reduceMatchState(next, { type: "advance", elapsedMs: 0 });
  next = reduceMatchState(next, { type: "advance", elapsedMs: MATCH_LIMITS.resolutionMs });
  return reduceMatchState(next, { type: "advance", elapsedMs: MATCH_LIMITS.resetMs });
}

function readyMatch(): MatchState {
  return reduceMatchState(reduceMatchState(createMatchState(), { type: "boot_complete" }), {
    type: "ready_to_aim"
  });
}

describe("REQ-LOOP-001 core match flow", () => {
  it("AC1 follows the documented match state sequence", () => {
    const phases = ["boot"];
    let state = createMatchState();

    for (const action of [
      { type: "boot_complete" },
      { type: "ready_to_aim" },
      { type: "begin_drawing" },
      { type: "commit_shot", outcome: "goal" },
      { type: "advance", elapsedMs: MATCH_LIMITS.shotCommitMs },
      { type: "advance", elapsedMs: 0 },
      { type: "advance", elapsedMs: MATCH_LIMITS.resolutionMs },
      { type: "advance", elapsedMs: MATCH_LIMITS.resetMs }
    ] as const) {
      state = reduceMatchState(state, action);
      phases.push(state.phase);
    }

    expect(phases).toEqual([
      "boot",
      "ready",
      "aiming",
      "drawing",
      "shot_commit",
      "ball_flight",
      "resolution",
      "reset",
      "aiming"
    ]);
  });

  it("AC2 ends after 5 shots or when the result is mathematically decided", () => {
    let fifthShotState = readyMatch();
    for (const outcome of ["goal", "save", "goal", "save", "goal"] as const) {
      fifthShotState = playNormalShot(fifthShotState, outcome);
    }

    expect(fifthShotState.phase).toBe("match_end");
    expect(fifthShotState.shotsTaken).toBe(5);
    expect(isMatchDecided({ player: 3, goalkeeper: 0 }, 3)).toBe(true);
    expect(isMatchDecided({ player: 2, goalkeeper: 1 }, 3)).toBe(false);

    let earlyState = readyMatch();
    for (const outcome of ["goal", "goal", "goal"] as const) {
      earlyState = playNormalShot(earlyState, outcome);
    }

    expect(earlyState.phase).toBe("match_end");
    expect(earlyState.shotsTaken).toBe(3);
  });

  it("AC3 scores goals for the player and saves or misses for the goalkeeper", () => {
    expect(scoreShot({ player: 0, goalkeeper: 0 }, "goal")).toEqual({
      player: 1,
      goalkeeper: 0
    });

    for (const outcome of ["save", "miss"] as const) {
      expect(scoreShot({ player: 0, goalkeeper: 0 }, outcome)).toEqual({
        player: 0,
        goalkeeper: 1
      });
    }
  });

  it("METHOD-FAIRNESS-001 scores only the committed outcome without forced correction", () => {
    const score = { player: 2, goalkeeper: 1 };

    expect(scoreShot(score, "goal")).toEqual({ player: 3, goalkeeper: 1 });
    expect(scoreShot(score, "save")).toEqual({ player: 2, goalkeeper: 2 });
    expect(scoreShot(score, "miss")).toEqual({ player: 2, goalkeeper: 2 });
    expect(score).toEqual({ player: 2, goalkeeper: 1 });
  });

  it("AC4 restarts from match_end with one action", () => {
    const ended = {
      ...createMatchState(),
      phase: "match_end",
      shotsTaken: 5,
      score: { player: 2, goalkeeper: 3 }
    } as const;

    expect(reduceMatchState(ended, { type: "restart" })).toMatchObject({
      phase: "aiming",
      shotsTaken: 0,
      score: { player: 0, goalkeeper: 0 }
    });
  });

  it("AC5 keeps transition timings inside required bounds and AC8 next shot budget", () => {
    let state = reduceMatchState(readyMatch(), { type: "begin_drawing" });
    state = reduceMatchState(state, { type: "commit_shot", outcome: "goal" });
    state = reduceMatchState(state, { type: "advance", elapsedMs: 99 });
    expect(state.phase).toBe("shot_commit");

    state = reduceMatchState(state, { type: "advance", elapsedMs: 1 });
    expect(state.phase).toBe("ball_flight");
    state = reduceMatchState(state, { type: "advance", elapsedMs: 0 });
    expect(state.phase).toBe("resolution");

    state = reduceMatchState(state, { type: "advance", elapsedMs: 599 });
    expect(state.phase).toBe("resolution");
    state = reduceMatchState(state, { type: "advance", elapsedMs: 1 });
    expect(state.phase).toBe("reset");

    state = reduceMatchState(state, { type: "advance", elapsedMs: 299 });
    expect(state.phase).toBe("reset");
    state = reduceMatchState(state, { type: "advance", elapsedMs: 1 });
    expect(state.phase).toBe("aiming");
    expect(MATCH_LIMITS.shotCommitMs + MATCH_LIMITS.resolutionMs + MATCH_LIMITS.resetMs).toBeLessThanOrEqual(
      MATCH_LIMITS.nextShotBudgetMs
    );
  });

  it("AC6 rejects invalid drawing gestures without penalty or corruption", () => {
    const drawing = reduceMatchState(readyMatch(), { type: "begin_drawing" });
    const afterInvalid = reduceMatchState(drawing, { type: "invalid_gesture" });

    expect(afterInvalid.phase).toBe("aiming");
    expect(afterInvalid.shotsTaken).toBe(0);
    expect(afterInvalid.score).toEqual({ player: 0, goalkeeper: 0 });
    expect(afterInvalid.pendingOutcome).toBeNull();
  });

  it("AC7 pauses active states and restores to the previous safe state", () => {
    const drawing = reduceMatchState(readyMatch(), { type: "begin_drawing" });
    const pausedDrawing = reduceMatchState(drawing, { type: "visibility_lost" });

    expect(pausedDrawing).toMatchObject({
      phase: "pause",
      previousSafePhase: "drawing"
    });
    expect(reduceMatchState(pausedDrawing, { type: "visibility_restored" }).phase).toBe("drawing");

    const transient = reduceMatchState(drawing, { type: "commit_shot", outcome: "goal" });
    const pausedTransient = reduceMatchState(transient, { type: "visibility_lost" });
    expect(pausedTransient.previousSafePhase).toBe("aiming");
    expect(reduceMatchState(pausedTransient, { type: "visibility_restored" }).phase).toBe("aiming");
  });
});
