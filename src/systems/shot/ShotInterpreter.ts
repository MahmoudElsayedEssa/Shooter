import type { GesturePoint } from "../input/DrawToShootInput";
import { clamp } from "../../core/math";

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
  shortPathDistancePx: 48,
  // Enhanced curve & power (from reference 3D game)
  /** Minimum useful path deviation in px for curve detection */
  minBaselineLengthPx: 10,
  /** Max useful deviation in px — higher = need bigger curves for max spin */
  maxUsefulDeviationPx: 56,
  /** Penalty per sign change in curve direction (zigzag filtering) */
  signChangePenaltyScale: 0.22,
  /** Minimum chaos multiplier — even chaotic gestures get some curve */
  minChaosFactor: 0.3,
  /** Path length drag thresholds for power (px) */
  powerDragMinPx: 45,
  powerDragMaxPx: 620,
  /** Weight for path-length power vs speed power */
  powerLengthWeight: 0.72,
  /** Downward drawing penalty multiplier */
  downwardPenaltyScale: 0.45,
  /** Winding penalty scale (extra path / direct path) */
  windingPenaltyScale: 0.55
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
  const rawTargetY = mapEndpointToGoalY(last.y, context);
  const curve = getCurve(points, context.viewportWidth);
  const pathComplexity = directDistance === 0 ? 1 : totalDistance / directDistance;
  const gestureQuality = getGestureQuality(points, speedPxPerMs, pathComplexity);
  const precisionPenaltyPx = (1 - gestureQuality) * SHOT_INTERPRETER_LIMITS.maxPrecisionPenaltyPx;

  return {
    targetX: smoothSmallJitter(rawTargetX, context),
    targetY: rawTargetY,
    force: getForce(speedPxPerMs, totalDistance, gestureQuality),
    curve,
    gestureQuality,
    durationMs,
    pathComplexity,
    precisionPenaltyPx
  };
}

function mapEndpointToGoalX(endpointX: number, context: ShotInterpretationContext): number {
  // Map raw X endpoint to goal width range with small miss margin
  const goalCenterX = (context.goalLeftX + context.goalRightX) / 2;
  const goalHalfWidth = (context.goalRightX - context.goalLeftX) / 2;
  const offset = endpointX - goalCenterX;
  // Allow 5% overshoot for extreme angles (reduced from 12% to prevent visual mismatch)
  const missMarginRatio = 1.05;
  return goalCenterX + clamp(offset, -goalHalfWidth * missMarginRatio, goalHalfWidth * missMarginRatio);
}

function mapEndpointToGoalY(endpointY: number, context: ShotInterpretationContext): number {
  // Remap: the gesture goes from ballY upward.
  // We use a fixed logical drag distance (e.g. 180px) for a "full power" top-corner shot
  // rather than making the user drag all the way to the top of the goal on screen.
  const gestureRange = context.ballY - endpointY; // positive = drew upward
  const maxDragPx = 180; // A reasonable drag distance on mobile
  // Cap at 0.98 — the ball should never target above the crossbar.
  // Over the bar = always a miss in real football.
  const ratio = clamp(gestureRange / maxDragPx, -0.02, 0.98);
  // Map ratio to goal Y range: ratio 0 = bottom, ratio 1 = top
  const goalHeight = context.goalBottomY - context.goalTopY;
  return context.goalBottomY - goalHeight * ratio;
}

/**
 * Enhanced force: combines swipe speed AND path length (like reference game).
 * Longer decisive strokes = more power even if not lightning fast.
 * Quality multiplier rewards clean technique.
 */
function getForce(speedPxPerMs: number, totalDistance: number, quality: number): number {
  // Speed factor
  const speedNorm = clamp(
    (speedPxPerMs - SHOT_INTERPRETER_LIMITS.minSpeedPxPerMs) /
      (SHOT_INTERPRETER_LIMITS.maxSpeedPxPerMs - SHOT_INTERPRETER_LIMITS.minSpeedPxPerMs),
    0,
    1
  );
  // Path length factor
  const lengthNorm = clamp(
    (totalDistance - SHOT_INTERPRETER_LIMITS.powerDragMinPx) /
      (SHOT_INTERPRETER_LIMITS.powerDragMaxPx - SHOT_INTERPRETER_LIMITS.powerDragMinPx),
    0,
    1
  );
  // Blend: take whichever is higher, then modulate by quality
  const rawPower = Math.max(speedNorm, lengthNorm) * (SHOT_INTERPRETER_LIMITS.powerLengthWeight + quality * (1 - SHOT_INTERPRETER_LIMITS.powerLengthWeight));
  return SHOT_INTERPRETER_LIMITS.minForce +
    clamp(rawPower, 0, 1) * (SHOT_INTERPRETER_LIMITS.maxForce - SHOT_INTERPRETER_LIMITS.minForce);
}

/**
 * Enhanced curve detection using perpendicular deviation from the reference game.
 *
 * Instead of measuring X offset from linear interpolation,
 * this measures the signed distance of each point from the perpendicular
 * normal to the origin→endpoint baseline. Points in the middle of
 * the path are weighted more (sin(πt) envelope). Sign changes in
 * the deviation direction penalize the result (zigzag = less curve).
 */
function getCurve(points: readonly GesturePoint[], viewportWidth: number): number {
  if (points.length < 4) {
    return 0;
  }

  const origin = points[0];
  const end = points[points.length - 1];
  const dx = end.x - origin.x;
  const dy = end.y - origin.y;
  const baselineLength = Math.sqrt(dx * dx + dy * dy);

  if (baselineLength < SHOT_INTERPRETER_LIMITS.minBaselineLengthPx) {
    return 0;
  }

  // Normal vector (perpendicular to origin→end line)
  const nx = -dy / baselineLength;
  const ny = dx / baselineLength;

  let weightedDeviation = 0;
  let totalWeight = 0;
  let signChanges = 0;
  let lastSign = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const t = i / (points.length - 1);
    // sin(πt) weights the middle of the path most heavily
    const weight = Math.sin(Math.PI * t);
    const px = points[i].x - origin.x;
    const py = points[i].y - origin.y;
    // Signed perpendicular distance from the baseline
    const deviation = px * nx + py * ny;
    const sign = Math.sign(deviation);

    // Count direction changes (zigzag detection)
    if (sign !== 0 && lastSign !== 0 && sign !== lastSign) {
      signChanges++;
    }
    if (sign !== 0) {
      lastSign = sign;
    }

    weightedDeviation += deviation * weight;
    totalWeight += weight;
  }

  if (totalWeight <= 0) return 0;

  const avgDeviation = weightedDeviation / totalWeight;
  // Scale relative to viewport width (responsive)
  const maxUsefulDeviation = Math.max(SHOT_INTERPRETER_LIMITS.maxUsefulDeviationPx, viewportWidth * 0.08);
  // Chaos penalty: zigzag gestures produce less curve
  const chaosPenalty = Math.max(
    SHOT_INTERPRETER_LIMITS.minChaosFactor,
    1 - signChanges * SHOT_INTERPRETER_LIMITS.signChangePenaltyScale
  );
  return clamp(avgDeviation / maxUsefulDeviation, -1, 1) * chaosPenalty;
}

/**
 * Enhanced gesture quality with downward-drawing and winding penalties
 * from the reference game's analyzeShotIntent().
 */
function getGestureQuality(
  points: readonly GesturePoint[],
  speedPxPerMs: number,
  _pathComplexity: number
): number {
  const totalDistance = getPathDistance(points);
  const directDistance = points.length >= 2
    ? getDistance(points[0], points[points.length - 1])
    : 0;

  // Winding penalty: extra path length beyond the direct distance
  const extraPath = Math.max(0, totalDistance - directDistance);
  const windingPenalty = clamp(
    extraPath / Math.max(directDistance * 1.15, 1),
    0, 1
  ) * SHOT_INTERPRETER_LIMITS.windingPenaltyScale;

  // Sign-change penalty (horizontal reversals)
  const reversalPenalty = countHorizontalReversals(points) * SHOT_INTERPRETER_LIMITS.reversalPenalty;

  // Downward drawing penalty: segments going down (wrong direction)
  let downwardLength = 0;
  for (let i = 1; i < points.length; i++) {
    const sy = points[i].y - points[i - 1].y;
    if (sy > 0) { // positive Y = downward in screen coords
      const sx = points[i].x - points[i - 1].x;
      downwardLength += Math.sqrt(sx * sx + sy * sy);
    }
  }
  const downwardPenalty = totalDistance > 0
    ? clamp(downwardLength / totalDistance, 0, 1) * SHOT_INTERPRETER_LIMITS.downwardPenaltyScale
    : 0;

  // Short path penalty
  const lengthPenalty = totalDistance < SHOT_INTERPRETER_LIMITS.shortPathDistancePx
    ? SHOT_INTERPRETER_LIMITS.shortPathPenalty
    : 0;

  // Speed penalty
  const speedPenalty =
    speedPxPerMs < SHOT_INTERPRETER_LIMITS.minSpeedPxPerMs ||
    speedPxPerMs > SHOT_INTERPRETER_LIMITS.maxSpeedPxPerMs
      ? SHOT_INTERPRETER_LIMITS.speedOutOfRangePenalty
      : 0;

  return clamp(
    1 - windingPenalty - reversalPenalty - downwardPenalty - lengthPenalty - speedPenalty,
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
