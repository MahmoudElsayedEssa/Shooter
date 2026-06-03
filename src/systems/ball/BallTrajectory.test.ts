import { describe, it, expect } from "vitest";
import type { Point2D } from "../../core/types";
import {
  createBallTrajectory,
  sampleBallFlight,
  getFlightDuration,
  getMaxCurveOffset,
  BALL_TRAJECTORY_LIMITS,
} from "./BallTrajectory";
import type { ShotIntent } from "../shot/ShotInterpreter";

// ─── Helpers ───

function makeIntent(overrides: Partial<ShotIntent> = {}): ShotIntent {
  return {
    targetX: 480,
    targetY: 180,
    force: 0.95,
    curve: 0,
    gestureQuality: 0.9,
    durationMs: 200,
    pathComplexity: 1.02,
    precisionPenaltyPx: 4,
    ...overrides,
  };
}

const BALL_START: Point2D = { x: 480, y: 460 };

// ─── Tests ───

describe("BallTrajectory", () => {
  describe("createBallTrajectory", () => {
    it("creates a trajectory with start and target matching intent", () => {
      const intent = makeIntent({ targetX: 300, targetY: 150 });
      const traj = createBallTrajectory(BALL_START, intent, 960);

      expect(traj.start).toEqual(BALL_START);
      expect(traj.target.x).toBe(300);
      expect(traj.target.y).toBe(150);
    });

    it("has zero curveOffset for straight shots", () => {
      const traj = createBallTrajectory(BALL_START, makeIntent({ curve: 0 }), 960);

      expect(traj.curveOffsetPx).toBe(0);
    });

    it("has positive curveOffset for right-curve shots", () => {
      const traj = createBallTrajectory(
        BALL_START,
        makeIntent({ curve: 0.5 }),
        960
      );

      expect(traj.curveOffsetPx).toBeGreaterThan(0);
    });

    it("has negative curveOffset for left-curve shots", () => {
      const traj = createBallTrajectory(
        BALL_START,
        makeIntent({ curve: -0.5 }),
        960
      );

      expect(traj.curveOffsetPx).toBeLessThan(0);
    });

    it("has flight duration within valid range", () => {
      const traj = createBallTrajectory(BALL_START, makeIntent(), 960);

      expect(traj.durationMs).toBeGreaterThanOrEqual(
        BALL_TRAJECTORY_LIMITS.minDurationMs
      );
      expect(traj.durationMs).toBeLessThanOrEqual(
        BALL_TRAJECTORY_LIMITS.maxDurationMs
      );
    });
  });

  describe("sampleBallFlight", () => {
    it("returns start position at t=0", () => {
      const traj = createBallTrajectory(BALL_START, makeIntent(), 960);
      const sample = sampleBallFlight(traj, 0);

      expect(sample.x).toBeCloseTo(BALL_START.x, 1);
      expect(sample.y).toBeCloseTo(BALL_START.y, 1);
      expect(sample.progress).toBe(0);
    });

    it("returns target position at t=durationMs", () => {
      const intent = makeIntent({ targetX: 350, targetY: 160, curve: 0 });
      const traj = createBallTrajectory(BALL_START, intent, 960);
      const sample = sampleBallFlight(traj, traj.durationMs);

      expect(sample.x).toBeCloseTo(350, 0);
      expect(sample.y).toBeCloseTo(160, 0);
      expect(sample.progress).toBe(1);
    });

    it("scales ball from nearShooterScale to nearGoalScale", () => {
      const traj = createBallTrajectory(BALL_START, makeIntent(), 960);

      const start = sampleBallFlight(traj, 0);
      const end = sampleBallFlight(traj, traj.durationMs);

      expect(start.scale).toBeCloseTo(BALL_TRAJECTORY_LIMITS.nearShooterScale, 2);
      expect(end.scale).toBeCloseTo(BALL_TRAJECTORY_LIMITS.nearGoalScale, 2);
    });

    it("is deterministic: same sample time produces same result", () => {
      const traj = createBallTrajectory(BALL_START, makeIntent(), 960);
      const a = sampleBallFlight(traj, traj.durationMs * 0.5);
      const b = sampleBallFlight(traj, traj.durationMs * 0.5);

      expect(a.x).toBe(b.x);
      expect(a.y).toBe(b.y);
      expect(a.scale).toBe(b.scale);
    });

    it("clamps progress to [0, 1] for times outside range", () => {
      const traj = createBallTrajectory(BALL_START, makeIntent(), 960);

      const before = sampleBallFlight(traj, -100);
      const after = sampleBallFlight(traj, traj.durationMs + 500);

      expect(before.progress).toBe(0);
      expect(after.progress).toBe(1);
    });
  });

  describe("getFlightDuration", () => {
    it("returns max duration for minimum force", () => {
      const dur = getFlightDuration(0.55);
      expect(dur).toBeCloseTo(BALL_TRAJECTORY_LIMITS.maxDurationMs, 0);
    });

    it("returns min duration for maximum force", () => {
      const dur = getFlightDuration(1.35);
      expect(dur).toBeCloseTo(BALL_TRAJECTORY_LIMITS.minDurationMs, 0);
    });

    it("returns intermediate duration for mid force", () => {
      const dur = getFlightDuration(0.95);
      expect(dur).toBeGreaterThan(BALL_TRAJECTORY_LIMITS.minDurationMs);
      expect(dur).toBeLessThan(BALL_TRAJECTORY_LIMITS.maxDurationMs);
    });
  });

  describe("getMaxCurveOffset", () => {
    it("returns min offset for narrow viewports", () => {
      expect(getMaxCurveOffset(320)).toBe(BALL_TRAJECTORY_LIMITS.minCurveOffsetPx);
    });

    it("returns max offset for wide viewports", () => {
      expect(getMaxCurveOffset(960)).toBe(BALL_TRAJECTORY_LIMITS.maxCurveOffsetPx);
    });
  });
});
