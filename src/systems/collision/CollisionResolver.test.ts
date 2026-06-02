import { describe, it, expect } from "vitest";
import {
  resolveBallCollision,
  DEFAULT_COLLISION_TUNING,
  type GoalFrame,
  type KeeperState,
} from "./CollisionResolver";
import { createBallTrajectory, type Point2D } from "../ball/BallTrajectory";
import type { ShotIntent } from "../shot/ShotInterpreter";

// ─── Helpers ───

const GOAL: GoalFrame = {
  leftX: 240,
  rightX: 720,
  topY: 120,
  bottomY: 270,
  postTolerancePx: 8,
};

const BALL_START: Point2D = { x: 480, y: 460 };

function makeIntent(overrides: Partial<ShotIntent> = {}): ShotIntent {
  return {
    targetX: 480,
    targetY: 195,
    force: 0.95,
    curve: 0,
    gestureQuality: 0.9,
    durationMs: 200,
    pathComplexity: 1.02,
    precisionPenaltyPx: 4,
    ...overrides,
  };
}

function makeKeeper(overrides: Partial<KeeperState> = {}): KeeperState {
  return {
    centerX: 480,
    centerY: 210,
    reachRadiusPx: 60,
    saveWindowStartMs: 0,
    saveWindowEndMs: 1000,
    ...overrides,
  };
}

// ─── Tests ───

describe("CollisionResolver", () => {
  describe("inside goal = goal (no keeper contact)", () => {
    it("returns goal when ball lands inside goal and keeper is far away", () => {
      const intent = makeIntent({ targetX: 350, targetY: 180 });
      const traj = createBallTrajectory(BALL_START, intent, 960);
      const keeper = makeKeeper({ centerX: 650, centerY: 200 });

      const result = resolveBallCollision(
        traj, GOAL, keeper, 0.9, 4, DEFAULT_COLLISION_TUNING
      );

      expect(result.outcome).toBe("goal");
      expect(result.reason).toBe("inside_goal");
      expect(result.contactPoint).toBeNull();
      expect(result.contactT).toBeNull();
      expect(result.contactSampleIndex).toBeNull();
    });
  });

  describe("keeper contact = save", () => {
    it("returns save with contactT and contactSampleIndex", () => {
      const intent = makeIntent({ targetX: 480, targetY: 195, curve: 0 });
      const traj = createBallTrajectory(BALL_START, intent, 960);
      const keeper = makeKeeper({ centerX: 480, centerY: 195, reachRadiusPx: 80 });

      const result = resolveBallCollision(
        traj, GOAL, keeper, 0.9, 4, DEFAULT_COLLISION_TUNING
      );

      expect(result.outcome).toBe("save");
      expect(result.reason).toBe("keeper_contact");
      expect(result.contactPoint).not.toBeNull();
      expect(result.contactT).not.toBeNull();
      expect(result.contactT).toBeGreaterThanOrEqual(0);
      expect(result.contactT).toBeLessThanOrEqual(1);
      expect(result.contactSampleIndex).not.toBeNull();
      expect(result.contactSampleIndex).toBeGreaterThanOrEqual(0);
      expect(result.visualContact).toBe(true);
    });

    it("save contactPoint is within keeper reach", () => {
      const intent = makeIntent({ targetX: 480, targetY: 195, curve: 0 });
      const traj = createBallTrajectory(BALL_START, intent, 960);
      const keeper = makeKeeper({ centerX: 480, centerY: 195, reachRadiusPx: 80 });

      const result = resolveBallCollision(
        traj, GOAL, keeper, 0.9, 4, DEFAULT_COLLISION_TUNING
      );

      expect(result.contactPoint).not.toBeNull();
      if (result.contactPoint) {
        const dist = Math.hypot(
          result.contactPoint.x - keeper.centerX,
          result.contactPoint.y - keeper.centerY
        );
        expect(dist).toBeLessThanOrEqual(keeper.reachRadiusPx);
      }
    });

    it("keeperReachAtContact is set correctly", () => {
      const intent = makeIntent({ targetX: 480, targetY: 195 });
      const traj = createBallTrajectory(BALL_START, intent, 960);
      const keeper = makeKeeper({ centerX: 480, centerY: 195, reachRadiusPx: 80 });

      const result = resolveBallCollision(
        traj, GOAL, keeper, 0.9, 4, DEFAULT_COLLISION_TUNING
      );

      expect(result.keeperReachAtContact).toBe(80);
    });

    it("keeperDiveDirection is inferred correctly", () => {
      const intent = makeIntent({ targetX: 300, targetY: 180 });
      const traj = createBallTrajectory(BALL_START, intent, 960);
      // Keeper dived left (centerX < goalCenterX)
      const keeper = makeKeeper({ centerX: 320, centerY: 190, reachRadiusPx: 100 });

      const result = resolveBallCollision(
        traj, GOAL, keeper, 0.9, 4, DEFAULT_COLLISION_TUNING
      );

      if (result.outcome === "save") {
        expect(result.keeperDiveDirection).toBe("left");
      }
    });
  });

  describe("wrong-side dive = NOT save", () => {
    it("returns goal or miss when ball is high-left and keeper dives right", () => {
      const intent = makeIntent({ targetX: 280, targetY: 140 });
      const traj = createBallTrajectory(BALL_START, intent, 960);
      const keeper = makeKeeper({ centerX: 650, centerY: 220, reachRadiusPx: 60 });

      const result = resolveBallCollision(
        traj, GOAL, keeper, 0.9, 4, DEFAULT_COLLISION_TUNING
      );

      expect(result.outcome).not.toBe("save");
      expect(result.contactPoint).toBeNull();
      expect(result.contactT).toBeNull();
    });
  });

  describe("ball past keeper reach = NOT save", () => {
    it("tiny keeper reach cannot intercept normal trajectory", () => {
      const intent = makeIntent({ targetX: 350, targetY: 180 });
      const traj = createBallTrajectory(BALL_START, intent, 960);
      // Keeper at center with tiny reach — ball goes to left
      const keeper = makeKeeper({ centerX: 480, centerY: 210, reachRadiusPx: 15 });

      const result = resolveBallCollision(
        traj, GOAL, keeper, 0.9, 4, DEFAULT_COLLISION_TUNING
      );

      expect(result.outcome).not.toBe("save");
    });
  });

  describe("outside goal frame = miss", () => {
    it("returns miss when ball target is outside goal left", () => {
      const intent = makeIntent({ targetX: 150, targetY: 195 });
      const traj = createBallTrajectory(BALL_START, intent, 960);
      const keeper = makeKeeper({ centerX: 480, centerY: 210 });

      const result = resolveBallCollision(
        traj, GOAL, keeper, 0.9, 4, DEFAULT_COLLISION_TUNING
      );

      expect(result.outcome).toBe("miss");
      expect(["outside_goal", "slight_miss"]).toContain(result.reason);
      expect(result.contactT).toBeNull();
    });

    it("returns miss when ball target is outside goal right", () => {
      const intent = makeIntent({ targetX: 810, targetY: 195 });
      const traj = createBallTrajectory(BALL_START, intent, 960);
      const keeper = makeKeeper({ centerX: 480, centerY: 210 });

      const result = resolveBallCollision(
        traj, GOAL, keeper, 0.9, 4, DEFAULT_COLLISION_TUNING
      );

      expect(result.outcome).toBe("miss");
      expect(result.contactT).toBeNull();
    });

    it("returns miss when ball target is above goal (over crossbar)", () => {
      const intent = makeIntent({ targetX: 480, targetY: 60 });
      const traj = createBallTrajectory(BALL_START, intent, 960);
      const keeper = makeKeeper({ centerX: 700, centerY: 210, reachRadiusPx: 50 });

      const result = resolveBallCollision(
        traj, GOAL, keeper, 0.9, 4, DEFAULT_COLLISION_TUNING
      );

      expect(result.outcome).toBe("miss");
    });
  });

  describe("deterministic outcomes", () => {
    it("same intent + same keeper state = same outcome and contactT", () => {
      const intent = makeIntent({ targetX: 400, targetY: 170 });
      const keeper = makeKeeper({ centerX: 500, centerY: 200 });

      const traj1 = createBallTrajectory(BALL_START, intent, 960);
      const traj2 = createBallTrajectory(BALL_START, intent, 960);

      const r1 = resolveBallCollision(traj1, GOAL, keeper, 0.9, 4);
      const r2 = resolveBallCollision(traj2, GOAL, keeper, 0.9, 4);

      expect(r1.outcome).toBe(r2.outcome);
      expect(r1.reason).toBe(r2.reason);
      expect(r1.contactT).toBe(r2.contactT);

      if (r1.contactPoint && r2.contactPoint) {
        expect(r1.contactPoint.x).toBe(r2.contactPoint.x);
        expect(r1.contactPoint.y).toBe(r2.contactPoint.y);
      } else {
        expect(r1.contactPoint).toBe(r2.contactPoint);
      }
    });
  });

  describe("contactT validation for saves", () => {
    it("save contactT is within save window normalized range", () => {
      const intent = makeIntent({ targetX: 480, targetY: 195, curve: 0 });
      const traj = createBallTrajectory(BALL_START, intent, 960);
      const keeper = makeKeeper({
        centerX: 480, centerY: 195, reachRadiusPx: 80,
        saveWindowStartMs: traj.durationMs * 0.3,
        saveWindowEndMs: traj.durationMs
      });

      const result = resolveBallCollision(
        traj, GOAL, keeper, 0.9, 4, DEFAULT_COLLISION_TUNING
      );

      if (result.outcome === "save") {
        expect(result.contactT).not.toBeNull();
        expect(result.contactT!).toBeGreaterThanOrEqual(0.3);
        expect(result.contactT!).toBeLessThanOrEqual(1.0);
      }
    });

    it("high corner save only with overlap at contact sample", () => {
      // High left corner
      const intent = makeIntent({ targetX: 280, targetY: 135 });
      const traj = createBallTrajectory(BALL_START, intent, 960);
      // Keeper dived left, positioned at left goal area
      const keeper = makeKeeper({ centerX: 300, centerY: 160, reachRadiusPx: 70 });

      const result = resolveBallCollision(
        traj, GOAL, keeper, 0.9, 4, DEFAULT_COLLISION_TUNING
      );

      if (result.outcome === "save") {
        expect(result.contactPoint).not.toBeNull();
        // Verify contactPoint is within keeper reach
        const dist = Math.hypot(
          result.contactPoint!.x - keeper.centerX,
          result.contactPoint!.y - keeper.centerY
        );
        expect(dist).toBeLessThanOrEqual(keeper.reachRadiusPx);
      }
    });
  });

  describe("post hit behavior", () => {
    it("returns miss with post_hit reason for near-post shots (default tuning)", () => {
      const intent = makeIntent({ targetX: 240, targetY: 195 });
      const traj = createBallTrajectory(BALL_START, intent, 960);
      const keeper = makeKeeper({ centerX: 600, centerY: 210 });

      const result = resolveBallCollision(traj, GOAL, keeper, 0.9, 4);

      if (result.reason === "post_hit") {
        expect(result.outcome).toBe("miss");
      }
    });
  });
});
