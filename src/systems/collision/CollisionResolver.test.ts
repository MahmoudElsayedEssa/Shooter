import { describe, expect, it } from "vitest";
import { createBallTrajectory, type Point2D } from "../ball/BallTrajectory";
import type { ShotIntent } from "../shot/ShotInterpreter";
import { resolveBallCollision, type GoalFrame, type KeeperState } from "./CollisionResolver";

const start: Point2D = { x: 200, y: 420 };
const goal: GoalFrame = { leftX: 100, rightX: 300, topY: 90, bottomY: 220, postTolerancePx: 4 };
const inactiveKeeper: KeeperState = {
  centerX: 200,
  centerY: 150,
  reachRadiusPx: 0,
  saveWindowStartMs: 0,
  saveWindowEndMs: 0
};

function shot(overrides: Partial<ShotIntent> = {}): ShotIntent {
  return {
    targetX: 200,
    targetY: 150,
    force: 0.95,
    curve: 0,
    gestureQuality: 0.9,
    durationMs: 160,
    pathComplexity: 1,
    precisionPenaltyPx: 6,
    ...overrides
  };
}

describe("REQ-BALL-001 collision resolution", () => {
  it("AC4 is deterministic for the same shot intent and same keeper state", () => {
    const trajectory = createBallTrajectory(start, shot({ targetX: 250 }), 640);
    const first = resolveBallCollision(trajectory, goal, inactiveKeeper, 0.9, 4);
    const second = resolveBallCollision(trajectory, goal, inactiveKeeper, 0.9, 4);

    expect(second).toEqual(first);
  });

  it("AC5 resolves goal, save, and miss from goal frame and keeper reach", () => {
    const goalTrajectory = createBallTrajectory(start, shot({ targetX: 220, targetY: 150 }), 640);
    const missTrajectory = createBallTrajectory(start, shot({ targetX: 360, targetY: 150 }), 640);
    const saveTrajectory = createBallTrajectory(start, shot({ targetX: 200, targetY: 150 }), 640);
    const keeper: KeeperState = {
      centerX: 200,
      centerY: 150,
      reachRadiusPx: 32,
      saveWindowStartMs: 250,
      saveWindowEndMs: 700
    };

    expect(resolveBallCollision(goalTrajectory, goal, inactiveKeeper, 0.9, 4).outcome).toBe("goal");
    expect(resolveBallCollision(missTrajectory, goal, inactiveKeeper, 0.9, 4).outcome).toBe("miss");
    expect(resolveBallCollision(saveTrajectory, goal, keeper, 0.9, 4)).toMatchObject({
      outcome: "save",
      reason: "keeper_contact"
    });
  });

  it("AC6 includes visual contact data for saves", () => {
    const trajectory = createBallTrajectory(start, shot(), 640);
    const result = resolveBallCollision(
      trajectory,
      goal,
      { centerX: 200, centerY: 150, reachRadiusPx: 36, saveWindowStartMs: 250, saveWindowEndMs: 700 },
      0.9,
      4
    );

    expect(result.outcome).toBe("save");
    expect(result.visualContact).toBe(true);
    expect(result.contactPoint).toEqual({ x: expect.any(Number), y: expect.any(Number) });
  });

  it("AC7 resolves post and crossbar hits according to tuning", () => {
    const post = createBallTrajectory(start, shot({ targetX: goal.leftX, targetY: 160 }), 640);
    const crossbar = createBallTrajectory(start, shot({ targetX: 180, targetY: goal.topY }), 640);

    expect(resolveBallCollision(post, goal, inactiveKeeper, 0.9, 4)).toMatchObject({
      outcome: "miss",
      reason: "post_hit"
    });
    expect(resolveBallCollision(crossbar, goal, inactiveKeeper, 0.9, 4, {
      postBehavior: "rebound",
      poorQualityMissThreshold: 0.5
    })).toMatchObject({ outcome: "rebound", reason: "post_hit", visualContact: true });
  });

  it("AC8 permits slight misses outside the frame for poor quality gestures", () => {
    const slightMiss = createBallTrajectory(start, shot({ targetX: goal.rightX + 12, targetY: 160 }), 640);
    const cleanMiss = resolveBallCollision(slightMiss, goal, inactiveKeeper, 0.9, 20);
    const poorMiss = resolveBallCollision(slightMiss, goal, inactiveKeeper, 0.35, 20);

    expect(cleanMiss.reason).toBe("outside_goal");
    expect(poorMiss).toMatchObject({ outcome: "miss", reason: "slight_miss" });
  });
});
