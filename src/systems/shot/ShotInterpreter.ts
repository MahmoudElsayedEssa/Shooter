import type { GesturePoint } from "../input/DrawToShootInput";

export interface ShotInterpretationContext {
  readonly viewportWidth: number;
  readonly ballY: number;
  readonly goalLeftX: number;
  readonly goalRightX: number;
  readonly goalTopY: number;
  readonly goalBottomY: number;
  readonly curveReferenceWidthPx?: number;
}

export interface ShotIntent {
  readonly targetX: number;
  readonly targetY: number;
  readonly force: number;
  readonly curve: number;
  readonly gestureQuality: number;
  readonly durationMs: number;
  readonly pathComplexity: number;
  readonly precisionPenaltyPx: number;
}

export const SHOT_INTERPRETER_LIMITS = {
  minForce: 0.55,
  maxForce: 1.35,
  minSpeedPxPerMs: 0.25,
  maxSpeedPxPerMs: 1.2,
  minGestureQuality: 0.35,
  curveReferenceWidthPx: 120,
  maxPrecisionPenaltyPx: 42,
  jitterTolerancePx: 3,
  idealComplexityMax: 1.08,
  jitterPenaltyScale: 0.7,
  reversalPenalty: 0.12,
  shortPathPenalty: 0.15,
  speedOutOfRangePenalty: 0.12,
  shortPathDistancePx: 48
} as const;

export function interpretShotIntent(
  points: readonly GesturePoint[],
  context: ShotInterpretationContext
): ShotIntent {
  if (points.length < 2) {
    throw new Error("Shot intent requires at least two gesture points");
  }

  const first = points[0];
  const last = points[points.length - 1];
  const durationMs = Math.max(1, last.timeMs - first.timeMs);
  const totalDistance = getPathDistance(points);
  const directDistance = getDistance(first, last);
  const speedPxPerMs = totalDistance / durationMs;
  const rawTargetX = mapEndpointToGoalX(last.x, context);
  const rawTargetY = mapUpwardDeltaToGoalY(first.y - last.y, context);
  const curve = getCurve(points, context.curveReferenceWidthPx ?? SHOT_INTERPRETER_LIMITS.curveReferenceWidthPx);
  const pathComplexity = directDistance === 0 ? 1 : totalDistance / directDistance;
  const gestureQuality = getGestureQuality(points, speedPxPerMs, pathComplexity);
  const precisionPenaltyPx = (1 - gestureQuality) * SHOT_INTERPRETER_LIMITS.maxPrecisionPenaltyPx;

  return {
    targetX: smoothSmallJitter(rawTargetX, context),
    targetY: rawTargetY,
    force: getForce(speedPxPerMs),
    curve,
    gestureQuality,
    durationMs,
    pathComplexity,
    precisionPenaltyPx
  };
}

function mapEndpointToGoalX(endpointX: number, context: ShotInterpretationContext): number {
  const goalWidth = context.goalRightX - context.goalLeftX;
  const horizontalRatio = clamp(endpointX / context.viewportWidth, 0, 1);
  return context.goalLeftX + goalWidth * horizontalRatio;
}

function mapUpwardDeltaToGoalY(upwardDelta: number, context: ShotInterpretationContext): number {
  const verticalTravel = Math.max(1, context.ballY - context.goalTopY);
  const heightRatio = clamp(upwardDelta / verticalTravel, 0, 1);
  return context.goalBottomY - (context.goalBottomY - context.goalTopY) * heightRatio;
}

function getForce(speedPxPerMs: number): number {
  const speedRatio = clamp(
    (speedPxPerMs - SHOT_INTERPRETER_LIMITS.minSpeedPxPerMs) /
      (SHOT_INTERPRETER_LIMITS.maxSpeedPxPerMs - SHOT_INTERPRETER_LIMITS.minSpeedPxPerMs),
    0,
    1
  );
  return SHOT_INTERPRETER_LIMITS.minForce +
    speedRatio * (SHOT_INTERPRETER_LIMITS.maxForce - SHOT_INTERPRETER_LIMITS.minForce);
}

function getCurve(points: readonly GesturePoint[], referenceWidthPx: number): number {
  if (points.length < 3) {
    return 0;
  }

  const first = points[0];
  const last = points[points.length - 1];
  let weightedOffset = 0;
  let totalWeight = 0;

  for (let index = 1; index < points.length - 1; index += 1) {
    const t = index / (points.length - 1);
    const expectedX = first.x + (last.x - first.x) * t;
    const centerWeight = 1 - Math.abs(0.5 - t) * 2;
    weightedOffset += (points[index].x - expectedX) * centerWeight;
    totalWeight += centerWeight;
  }

  return clamp((weightedOffset / Math.max(1, totalWeight)) / referenceWidthPx, -1, 1);
}

function getGestureQuality(
  points: readonly GesturePoint[],
  speedPxPerMs: number,
  pathComplexity: number
): number {
  const jitterPenalty =
    Math.max(0, pathComplexity - SHOT_INTERPRETER_LIMITS.idealComplexityMax) *
    SHOT_INTERPRETER_LIMITS.jitterPenaltyScale;
  const reversalPenalty = countHorizontalReversals(points) * SHOT_INTERPRETER_LIMITS.reversalPenalty;
  const lengthPenalty =
    getPathDistance(points) < SHOT_INTERPRETER_LIMITS.shortPathDistancePx
      ? SHOT_INTERPRETER_LIMITS.shortPathPenalty
      : 0;
  const speedPenalty =
    speedPxPerMs < SHOT_INTERPRETER_LIMITS.minSpeedPxPerMs ||
    speedPxPerMs > SHOT_INTERPRETER_LIMITS.maxSpeedPxPerMs
      ? SHOT_INTERPRETER_LIMITS.speedOutOfRangePenalty
      : 0;

  return clamp(
    1 - jitterPenalty - reversalPenalty - lengthPenalty - speedPenalty,
    SHOT_INTERPRETER_LIMITS.minGestureQuality,
    1
  );
}

function countHorizontalReversals(points: readonly GesturePoint[]): number {
  let previousDirection = 0;
  let reversals = 0;

  for (let index = 1; index < points.length; index += 1) {
    const deltaX = points[index].x - points[index - 1].x;
    const direction = Math.abs(deltaX) <= SHOT_INTERPRETER_LIMITS.jitterTolerancePx ? 0 : Math.sign(deltaX);

    if (direction !== 0 && previousDirection !== 0 && direction !== previousDirection) {
      reversals += 1;
    }

    if (direction !== 0) {
      previousDirection = direction;
    }
  }

  return reversals;
}

function smoothSmallJitter(targetX: number, context: ShotInterpretationContext): number {
  const goalCenterX = (context.goalLeftX + context.goalRightX) / 2;

  return Math.abs(targetX - goalCenterX) <= SHOT_INTERPRETER_LIMITS.jitterTolerancePx
    ? goalCenterX
    : targetX;
}

function getPathDistance(points: readonly GesturePoint[]): number {
  return points.slice(1).reduce((sum, point, index) => sum + getDistance(points[index], point), 0);
}

function getDistance(a: GesturePoint, b: GesturePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
