import { sampleBallFlight, type BallTrajectory, type Point2D } from "../ball/BallTrajectory";

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
  readonly visualContact: boolean;
}

export const DEFAULT_COLLISION_TUNING: CollisionTuning = {
  postBehavior: "miss",
  poorQualityMissThreshold: 0.5
};

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
    return { outcome: "save", reason: "keeper_contact", contactPoint: keeperContact, visualContact: true };
  }

  const final = sampleBallFlight(trajectory, trajectory.durationMs);
  if (hitsGoalFrame(final, goal)) {
    return {
      outcome: tuning.postBehavior,
      reason: "post_hit",
      contactPoint: { x: final.x, y: final.y },
      visualContact: tuning.postBehavior === "rebound"
    };
  }

  if (isInsideGoal(final, goal)) {
    return { outcome: "goal", reason: "inside_goal", contactPoint: null, visualContact: false };
  }

  const nearGoal = distanceOutsideGoal(final, goal) <= precisionPenaltyPx;
  const reason = nearGoal && gestureQuality < tuning.poorQualityMissThreshold ? "slight_miss" : "outside_goal";
  return { outcome: "miss", reason, contactPoint: null, visualContact: false };
}

function findKeeperContact(trajectory: BallTrajectory, keeper: KeeperState): Point2D | null {
  const sampleCount = 24;
  for (let index = 0; index <= sampleCount; index += 1) {
    const elapsedMs = (trajectory.durationMs * index) / sampleCount;
    if (elapsedMs < keeper.saveWindowStartMs || elapsedMs > keeper.saveWindowEndMs) {
      continue;
    }

    const point = sampleBallFlight(trajectory, elapsedMs);
    if (Math.hypot(point.x - keeper.centerX, point.y - keeper.centerY) <= keeper.reachRadiusPx) {
      return { x: point.x, y: point.y };
    }
  }
  return null;
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
