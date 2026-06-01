import { describe, expect, it } from "vitest";
import Phaser from "phaser";
import { createGameConfig } from "../main";
import { MATCH_LIMITS } from "../systems/match/MatchFlow";
import {
  PlayablePenaltyScene,
  createInitialPlayableSnapshot,
  planPlayableShot
} from "./PlayablePenaltyScene";

const validGesture = [
  { x: 480, y: 460, timeMs: 0 },
  { x: 500, y: 390, timeMs: 90 },
  { x: 510, y: 300, timeMs: 180 },
  { x: 500, y: 170, timeMs: 300 }
] as const;

describe("REQ-PLAYABLE-001 playable penalty vertical slice", () => {
  it("REQ-PLAYABLE-001 provides a blocking executable playable penalty vertical slice", () => {
    const config = createGameConfig("game-root");
    const snapshot = createInitialPlayableSnapshot();

    expect(config.scene).toEqual([PlayablePenaltyScene]);
    expect(snapshot.maxShots).toBe(MATCH_LIMITS.maxShots);
    expect(snapshot.phase).toBe("aiming");
  });

  it("uses the requested playable slice refs through main and game scene wiring", () => {
    const config = createGameConfig("game-root");

    expect(config.scene).toEqual([PlayablePenaltyScene]);
    expect(PlayablePenaltyScene.name).toBe("PlayablePenaltyScene");
  });

  it("browser starts an actual match screen instead of only a title", () => {
    const config = createGameConfig("game-root");

    expect(config.scene).toEqual([PlayablePenaltyScene]);
    expect(config.width).toBe(960);
    expect(config.height).toBe(540);
    expect(config.scale).toMatchObject({
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    });
  });

  it("player drag shot creates visible ball travel toward the goal", () => {
    const plan = planPlayableShot(validGesture, { player: 0, goalkeeper: 0 }, 0);
    const first = plan.ballSamples[0];
    const final = plan.ballSamples.at(-1);

    expect(plan.intent.force).toBeGreaterThan(0);
    expect(plan.ballSamples.length).toBeGreaterThan(3);
    expect(first).toMatchObject({ x: 480, y: 460, progress: 0 });
    expect(final?.progress).toBe(1);
    expect(final?.y).toBeLessThan(first.y);
  });

  it("goalkeeper reacts to the committed shot", () => {
    const plan = planPlayableShot(validGesture, { player: 0, goalkeeper: 0 }, 0);

    expect(["left", "center", "right"]).toContain(plan.keeperDecision.tactical.diveDirection);
    expect(plan.keeperDecision.physical.reactionMs).toBeGreaterThanOrEqual(0);
    expect(plan.keeperDecision.animation.pose).not.toBe("recover");
  });

  it("outcome is shown as goal save or miss and score or shot count updates", () => {
    const plan = planPlayableShot(validGesture, { player: 0, goalkeeper: 0 }, 0);

    expect(["goal", "save", "miss"]).toContain(plan.outcome);
    expect(plan.score.player + plan.score.goalkeeper).toBe(1);
    expect(plan.shotNumber).toBe(1);
    expect(plan.matchEnded).toBe(false);
  });

  it("tracks match continuation through the final shot", () => {
    let score = { player: 0, goalkeeper: 0 };
    let finalPlan = planPlayableShot(validGesture, score, 0);

    for (let shotsTaken = 1; shotsTaken < MATCH_LIMITS.maxShots; shotsTaken += 1) {
      score = finalPlan.score;
      finalPlan = planPlayableShot(validGesture, score, shotsTaken);
    }

    expect(finalPlan.shotNumber).toBe(MATCH_LIMITS.maxShots);
    expect(finalPlan.score.player + finalPlan.score.goalkeeper).toBe(MATCH_LIMITS.maxShots);
    expect(finalPlan.matchEnded).toBe(true);
  });

  it("browser smoke proof has stable initial state for canvas gameplay interaction", () => {
    expect(createInitialPlayableSnapshot()).toEqual({
      score: { player: 0, goalkeeper: 0 },
      shotNumber: 1,
      maxShots: MATCH_LIMITS.maxShots,
      phase: "aiming",
      outcome: "none"
    });
  });
});
