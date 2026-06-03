import { sampleBallFlight, type BallTrajectory } from "../ball/BallTrajectory";
import type { Point2D } from "../../core/types";

export type BallOutcome = "goal" | "save" | "miss" | "rebound";
export type CollisionReason = "inside_goal" | "keeper_contact" | "outside_goal" | "post_hit" | "slight_miss";

export interface GoalFrame {
  readonly leftX: number;
  readonly rightX: number;
  readonly topY: number;
  readonly bottomY: number;
  readonly postTolerancePx: number;
}

export interface KeeperState {
  readonly centerX: number;
  readonly centerY: number;
  readonly reachRadiusPx: number;
  readonly saveWindowStartMs: number;
  readonly saveWindowEndMs: number;
}

export interface CollisionTuning {
  readonly postBehavior: "miss" | "rebound";
  readonly poorQualityMissThreshold: number;
}

export interface CollisionResult {
  readonly outcome: BallOutcome;
  readonly reason: CollisionReason;
  readonly contactPoint: Point2D | null;
  /** Normalized progress [0,1] at which keeper contact occurs. Null if no save. */
  readonly contactT: number | null;
  /** Index of the sample in which contact first occurs. Null if no save. */
  readonly contactSampleIndex: number | null;
  /** Keeper reach radius used at the contact check. */
  readonly keeperReachAtContact: number;
  /** Keeper dive direction passed through from collision state. */
  readonly keeperDiveDirection: "left" | "center" | "right";
  readonly visualContact: boolean;
}

export const DEFAULT_COLLISION_TUNING: CollisionTuning = {
  postBehavior: "miss",
  poorQualityMissThreshold: 0.5
};

// Number of samples to check along the trajectory for keeper contact
const COLLISION_SAMPLE_COUNT = 48;

export function resolveBallCollision(
  trajectory: BallTrajectory,
  goal: GoalFrame,
  keeper: KeeperState,
  gestureQuality: number,
  precisionPenaltyPx: number,
  tuning: CollisionTuning = DEFAULT_COLLISION_TUNING
): CollisionResult {
  const keeperContact = findKeeperContact(trajectory, keeper);
  if (keeperContact !== null) {
    return {
      outcome: "save",
      reason: "keeper_contact",
      contactPoint: keeperContact.point,
      contactT: keeperContact.t,
      contactSampleIndex: keeperContact.sampleIndex,
      keeperReachAtContact: keeper.reachRadiusPx,
      keeperDiveDirection: inferDiveDirection(keeper.centerX, goal),
      visualContact: true
    };
  }

  // No keeper contact — determine goal/miss/post
  const noContactBase = {
    contactT: null,
    contactSampleIndex: null,
    keeperReachAtContact: keeper.reachRadiusPx,
    keeperDiveDirection: inferDiveDirection(keeper.centerX, goal) as "left" | "center" | "right",
  };

  const final = sampleBallFlight(trajectory, trajectory.durationMs);
  if (hitsGoalFrame(final, goal)) {
    return {
      ...noContactBase,
      outcome: tuning.postBehavior,
      reason: "post_hit",
      contactPoint: { x: final.x, y: final.y },
      visualContact: tuning.postBehavior === "rebound"
    };
  }

  if (isInsideGoal(final, goal)) {
    return {
      ...noContactBase,
      outcome: "goal",
      reason: "inside_goal",
      contactPoint: null,
      visualContact: false
    };
  }

  const nearGoal = distanceOutsideGoal(final, goal) <= precisionPenaltyPx;
  const reason = nearGoal && gestureQuality < tuning.poorQualityMissThreshold ? "slight_miss" : "outside_goal";
  return {
    ...noContactBase,
    outcome: "miss",
    reason,
    contactPoint: null,
    visualContact: false
  };
}

interface KeeperContactResult {
  readonly point: Point2D;
  readonly t: number;
  readonly sampleIndex: number;
}

function findKeeperContact(trajectory: BallTrajectory, keeper: KeeperState): KeeperContactResult | null {
  for (let index = 0; index <= COLLISION_SAMPLE_COUNT; index += 1) {
    const elapsedMs = (trajectory.durationMs * index) / COLLISION_SAMPLE_COUNT;
    if (elapsedMs < keeper.saveWindowStartMs || elapsedMs > keeper.saveWindowEndMs) {
      continue;
    }

    const point = sampleBallFlight(trajectory, elapsedMs);
    if (Math.hypot(point.x - keeper.centerX, point.y - keeper.centerY) <= keeper.reachRadiusPx) {
      return {
        point: { x: point.x, y: point.y },
        t: elapsedMs / trajectory.durationMs,
        sampleIndex: index
      };
    }
  }
  return null;
}

/** Infer dive direction from keeper center X relative to goal center. */
function inferDiveDirection(keeperCenterX: number, goal: GoalFrame): "left" | "center" | "right" {
  const goalCenterX = (goal.leftX + goal.rightX) / 2;
  const delta = keeperCenterX - goalCenterX;
  if (Math.abs(delta) < 20) return "center";
  return delta < 0 ? "left" : "right";
}

function isInsideGoal(point: Point2D, goal: GoalFrame): boolean {
  return point.x > goal.leftX && point.x < goal.rightX && point.y > goal.topY && point.y < goal.bottomY;
}

function hitsGoalFrame(point: Point2D, goal: GoalFrame): boolean {
  const nearPost =
    Math.abs(point.x - goal.leftX) <= goal.postTolerancePx ||
    Math.abs(point.x - goal.rightX) <= goal.postTolerancePx;
  const nearCrossbar = Math.abs(point.y - goal.topY) <= goal.postTolerancePx;
  return (nearPost && point.y >= goal.topY && point.y <= goal.bottomY) ||
    (nearCrossbar && point.x >= goal.leftX && point.x <= goal.rightX);
}

function distanceOutsideGoal(point: Point2D, goal: GoalFrame): number {
  const clampedX = Math.min(goal.rightX, Math.max(goal.leftX, point.x));
  const clampedY = Math.min(goal.bottomY, Math.max(goal.topY, point.y));
  return Math.hypot(point.x - clampedX, point.y - clampedY);
}
