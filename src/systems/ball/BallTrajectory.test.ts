import { describe, expect, it } from "vitest";
import {
  BALL_TRAJECTORY_LIMITS,
  createBallTrajectory,
  getFlightDuration,
  getMaxCurveOffset,
  sampleBallFlight,
  type Point2D
} from "./BallTrajectory";
import type { ShotIntent } from "../shot/ShotInterpreter";

const start: Point2D = { x: 200, y: 420 };
const intent: ShotIntent = {
  targetX: 260,
  targetY: 120,
  force: 0.95,
  curve: 0.5,
  gestureQuality: 0.9,
  durationMs: 180,
  pathComplexity: 1.1,
  precisionPenaltyPx: 4
};

describe("REQ-BALL-001 ball trajectory", () => {
  it("AC1 uses cubic bezier controls with curve offset and lands on interpreted target", () => {
    const straight = createBallTrajectory(start, { ...intent, curve: 0 }, 640);
    const curved = createBallTrajectory(start, intent, 640);
    const straightMid = sampleBallFlight(straight, straight.durationMs / 2);
    const curvedMid = sampleBallFlight(curved, curved.durationMs / 2);

    expect(straight.target).toEqual({ x: intent.targetX, y: intent.targetY });
    expect(curved.control1.x).toBeGreaterThan(straight.control1.x);
    expect(curved.control2.x).toBeGreaterThan(straight.control2.x);
    expect(curvedMid.x).toBeGreaterThan(straightMid.x);
    expect(sampleBallFlight(curved, curved.durationMs)).toMatchObject({
      x: intent.targetX,
      y: intent.targetY,
      progress: 1
    });
  });

  it("AC2 scales max curve offset by viewport and shortens duration as force rises", () => {
    expect(getMaxCurveOffset(320)).toBe(BALL_TRAJECTORY_LIMITS.minCurveOffsetPx);
    expect(getMaxCurveOffset(960)).toBe(BALL_TRAJECTORY_LIMITS.maxCurveOffsetPx);
    expect(createBallTrajectory(start, { ...intent, curve: 1 }, 960).curveOffsetPx).toBe(160);
    expect(createBallTrajectory(start, { ...intent, curve: -1 }, 320).curveOffsetPx).toBe(-80);
    expect(getFlightDuration(0.55)).toBe(BALL_TRAJECTORY_LIMITS.maxDurationMs);
    expect(getFlightDuration(1.35)).toBe(BALL_TRAJECTORY_LIMITS.minDurationMs);
    expect(getFlightDuration(1.2)).toBeLessThan(getFlightDuration(0.75));
  });

  it("AC3 makes the ball larger near the shooter and smaller near the goal", () => {
    const trajectory = createBallTrajectory(start, intent, 640);
    const nearShooter = sampleBallFlight(trajectory, 0);
    const midFlight = sampleBallFlight(trajectory, trajectory.durationMs / 2);
    const nearGoal = sampleBallFlight(trajectory, trajectory.durationMs);

    expect(nearShooter.scale).toBe(BALL_TRAJECTORY_LIMITS.nearShooterScale);
    expect(midFlight.scale).toBeLessThan(nearShooter.scale);
    expect(nearGoal.scale).toBe(BALL_TRAJECTORY_LIMITS.nearGoalScale);
  });
});
