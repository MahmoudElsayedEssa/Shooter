import { SHOT_INTERPRETER_LIMITS, type ShotIntent } from "../shot/ShotInterpreter";
import { clamp, lerp } from "../../core/math";

import type { Point2D } from "../../core/types";

export interface BallTrajectory {
  readonly start: Point2D;
  readonly target: Point2D;
  readonly control1: Point2D;
  readonly control2: Point2D;
  readonly curveOffsetPx: number;
  readonly durationMs: number;
}

export interface BallFlightSample extends Point2D {
  readonly progress: number;
  readonly scale: number;
}

export const BALL_TRAJECTORY_LIMITS = {
  minCurveOffsetPx: 80,
  maxCurveOffsetPx: 160,
  minViewportWidthPx: 320,
  maxViewportWidthPx: 960,
  // Save Timing Fix: slowed down for readability
  // weak shot ~900ms, normal ~740ms, strong ~640ms, max force ~600ms
  minDurationMs: 600,
  maxDurationMs: 900,
  nearShooterScale: 1.0,
  nearGoalScale: 0.72
} as const;

export function createBallTrajectory(
  start: Point2D,
  intent: ShotIntent,
  viewportWidth: number
): BallTrajectory {
  const curveOffsetPx = intent.curve * getMaxCurveOffset(viewportWidth);
  const target = { x: intent.targetX, y: intent.targetY };
  const oneThird = interpolate(start, target, 1 / 3);
  const twoThirds = interpolate(start, target, 2 / 3);

  return {
    start,
    target,
    control1: { x: oneThird.x + curveOffsetPx, y: oneThird.y },
    control2: { x: twoThirds.x + curveOffsetPx, y: twoThirds.y },
    curveOffsetPx,
    durationMs: getFlightDuration(intent.force)
  };
}

export function sampleBallFlight(trajectory: BallTrajectory, elapsedMs: number): BallFlightSample {
  const progress = clamp(elapsedMs / trajectory.durationMs, 0, 1);
  const position = sampleCubicBezier(
    trajectory.start,
    trajectory.control1,
    trajectory.control2,
    trajectory.target,
    progress
  );

  return {
    ...position,
    progress,
    scale: lerp(BALL_TRAJECTORY_LIMITS.nearShooterScale, BALL_TRAJECTORY_LIMITS.nearGoalScale, progress)
  };
}

export function getMaxCurveOffset(viewportWidth: number): number {
  const viewportRatio =
    (clamp(viewportWidth, BALL_TRAJECTORY_LIMITS.minViewportWidthPx, BALL_TRAJECTORY_LIMITS.maxViewportWidthPx) -
      BALL_TRAJECTORY_LIMITS.minViewportWidthPx) /
    (BALL_TRAJECTORY_LIMITS.maxViewportWidthPx - BALL_TRAJECTORY_LIMITS.minViewportWidthPx);
  return lerp(BALL_TRAJECTORY_LIMITS.minCurveOffsetPx, BALL_TRAJECTORY_LIMITS.maxCurveOffsetPx, viewportRatio);
}

export function getFlightDuration(force: number): number {
  const forceRatio = clamp(
    (force - SHOT_INTERPRETER_LIMITS.minForce) / (SHOT_INTERPRETER_LIMITS.maxForce - SHOT_INTERPRETER_LIMITS.minForce),
    0, 1
  );
  return lerp(BALL_TRAJECTORY_LIMITS.maxDurationMs, BALL_TRAJECTORY_LIMITS.minDurationMs, forceRatio);
}

function sampleCubicBezier(p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D, t: number): Point2D {
  const inv = 1 - t;
  return {
    x: inv ** 3 * p0.x + 3 * inv ** 2 * t * p1.x + 3 * inv * t ** 2 * p2.x + t ** 3 * p3.x,
    y: inv ** 3 * p0.y + 3 * inv ** 2 * t * p1.y + 3 * inv * t ** 2 * p2.y + t ** 3 * p3.y
  };
}

function interpolate(a: Point2D, b: Point2D, t: number): Point2D {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t)
  };
}
