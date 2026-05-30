import { describe, expect, it } from "vitest";
import {
  SHOT_INTERPRETER_LIMITS,
  interpretShotIntent,
  type ShotInterpretationContext
} from "./ShotInterpreter";
import type { GesturePoint } from "../input/DrawToShootInput";

const context: ShotInterpretationContext = {
  viewportWidth: 400,
  ballY: 420,
  goalLeftX: 90,
  goalRightX: 310,
  goalTopY: 80,
  goalBottomY: 210,
  curveReferenceWidthPx: 120
};

const cleanGesture: readonly GesturePoint[] = [
  { x: 200, y: 380, timeMs: 0 },
  { x: 212, y: 300, timeMs: 100 },
  { x: 260, y: 210, timeMs: 200 }
];

describe("REQ-SHOT-001 shot intent interpreter", () => {
  it("AC1 outputs complete target, force, curve, quality, duration, and complexity fields", () => {
    const start = cleanGesture[0];
    const end = cleanGesture.at(-1)!;
    const intent = interpretShotIntent(cleanGesture, context);
    const invalidInput = [cleanGesture[0]];
    const complexityGesture: readonly GesturePoint[] = [
      { x: 0, y: 0, timeMs: 0 },
      { x: 3, y: 4, timeMs: 50 },
      { x: 6, y: 0, timeMs: 100 }
    ];
    const complexityIntent = interpretShotIntent(complexityGesture, context);

    expect(intent).not.toBeNull();
    expect(intent).toEqual({
      targetX: expect.any(Number),
      targetY: expect.any(Number),
      force: expect.any(Number),
      curve: expect.any(Number),
      gestureQuality: expect.any(Number),
      durationMs: 200,
      pathComplexity: expect.any(Number),
      precisionPenaltyPx: expect.any(Number)
    });
    expect(Number.isFinite(intent.targetX)).toBe(true);
    expect(Number.isFinite(intent.targetY)).toBe(true);
    expect(Number.isFinite(intent.force)).toBe(true);
    expect(Number.isFinite(intent.curve)).toBe(true);
    expect(Number.isFinite(intent.gestureQuality)).toBe(true);
    expect(Number.isFinite(intent.durationMs)).toBe(true);
    expect(Number.isFinite(intent.pathComplexity)).toBe(true);
    expect(intent.durationMs).toBe(end.timeMs - start.timeMs);
    expect(intent.pathComplexity).toBeGreaterThanOrEqual(1);
    expect(complexityIntent.pathComplexity).toBeCloseTo(10 / 6);
    expect(() => interpretShotIntent(invalidInput, context)).toThrow("at least two gesture points");
  });

  it("AC2 derives force from speed and clamps the 0.25-1.20 px/ms range to 0.55-1.35", () => {
    const slow = interpretShotIntent(
      [
        { x: 200, y: 380, timeMs: 0 },
        { x: 200, y: 350, timeMs: 300 }
      ],
      context
    );
    const fast = interpretShotIntent(
      [
        { x: 200, y: 380, timeMs: 0 },
        { x: 260, y: 80, timeMs: 100 }
      ],
      context
    );
    const boundary = interpretShotIntent(
      [
        { x: 200, y: 380, timeMs: 0 },
        { x: 200, y: 355, timeMs: 100 }
      ],
      context
    );
    const midRange = interpretShotIntent(
      [
        { x: 200, y: 380, timeMs: 0 },
        { x: 200, y: 307.5, timeMs: 100 }
      ],
      context
    );
    const sameDistanceSlower = interpretShotIntent(
      [
        { x: 200, y: 380, timeMs: 0 },
        { x: 200, y: 307.5, timeMs: 200 }
      ],
      context
    );
    const sameDurationFarther = interpretShotIntent(
      [
        { x: 200, y: 380, timeMs: 0 },
        { x: 200, y: 280, timeMs: 100 }
      ],
      context
    );

    expect(slow.force).toBe(SHOT_INTERPRETER_LIMITS.minForce);
    expect(fast.force).toBe(SHOT_INTERPRETER_LIMITS.maxForce);
    expect(boundary.force).toBe(SHOT_INTERPRETER_LIMITS.minForce);
    expect(midRange.force).toBeCloseTo(0.95);
    expect(sameDistanceSlower.force).toBeLessThan(midRange.force);
    expect(sameDurationFarther.force).toBeGreaterThan(midRange.force);
  });

  it("AC3 maps horizontal endpoint to non-square goal width and upward height to clamped goal height", () => {
    expect(interpretShotIntent([{ x: 200, y: 420, timeMs: 0 }, { x: 0, y: 330, timeMs: 100 }], context).targetX).toBe(
      context.goalLeftX
    );
    expect(
      interpretShotIntent([{ x: 200, y: 420, timeMs: 0 }, { x: 400, y: 330, timeMs: 100 }], context).targetX
    ).toBe(context.goalRightX);
    expect(
      interpretShotIntent([{ x: 200, y: 420, timeMs: 0 }, { x: 200, y: 80, timeMs: 200 }], context).targetY
    ).toBe(context.goalTopY);
    expect(
      interpretShotIntent([{ x: 200, y: 420, timeMs: 0 }, { x: 200, y: 500, timeMs: 200 }], context).targetY
    ).toBe(context.goalBottomY);
    expect(
      interpretShotIntent([{ x: 200, y: 420, timeMs: 0 }, { x: 200, y: 418, timeMs: 200 }], context).targetY
    ).toBeCloseTo(context.goalBottomY - ((context.goalBottomY - context.goalTopY) * 2) / 340);
  });

  it("AC4 extracts center-weighted curve from lateral deviation and clamps against reference width", () => {
    const leftCurve = interpretShotIntent(
      [
        { x: 200, y: 380, timeMs: 0 },
        { x: 140, y: 300, timeMs: 100 },
        { x: 260, y: 210, timeMs: 200 }
      ],
      context
    );
    const rightCurve = interpretShotIntent(
      [
        { x: 200, y: 380, timeMs: 0 },
        { x: 340, y: 300, timeMs: 100 },
        { x: 260, y: 210, timeMs: 200 }
      ],
      context
    );

    expect(leftCurve.curve).toBeLessThan(0);
    expect(rightCurve.curve).toBeGreaterThan(0);
    expect(Math.abs(rightCurve.curve)).toBeLessThanOrEqual(1);
    expect(interpretShotIntent(cleanGesture, context).curve).toBeLessThan(0);
    expect(
      interpretShotIntent(
        [
          { x: 200, y: 380, timeMs: 0 },
          { x: 230, y: 300, timeMs: 100 },
          { x: 260, y: 210, timeMs: 200 }
        ],
        context
      ).curve
    ).toBe(0);
  });

  it("AC5 scores gesture quality from jitter, reversals, length, and speed with a 0.35 floor", () => {
    const erratic = interpretShotIntent(
      [
        { x: 200, y: 380, timeMs: 0 },
        { x: 260, y: 355, timeMs: 20 },
        { x: 130, y: 330, timeMs: 40 },
        { x: 290, y: 300, timeMs: 60 },
        { x: 120, y: 260, timeMs: 80 }
      ],
      context
    );
    const tooShort = interpretShotIntent(
      [
        { x: 200, y: 380, timeMs: 0 },
        { x: 203, y: 374, timeMs: 100 }
      ],
      context
    );

    expect(erratic.gestureQuality).toBeLessThan(interpretShotIntent(cleanGesture, context).gestureQuality);
    expect(interpretShotIntent(cleanGesture, context).gestureQuality).toBeGreaterThan(0.9);
    expect(erratic.gestureQuality).toBeGreaterThanOrEqual(SHOT_INTERPRETER_LIMITS.minGestureQuality);
    expect(tooShort.gestureQuality).toBeGreaterThanOrEqual(SHOT_INTERPRETER_LIMITS.minGestureQuality);
  });

  it("AC6 reduces precision for poor quality without stealing control and smooths small center jitter", () => {
    const centered = interpretShotIntent(
      [
        { x: 200, y: 380, timeMs: 0 },
        { x: 202, y: 320, timeMs: 100 },
        { x: 204, y: 240, timeMs: 200 }
      ],
      context
    );
    const poor = interpretShotIntent(
      [
        { x: 200, y: 380, timeMs: 0 },
        { x: 280, y: 350, timeMs: 30 },
        { x: 120, y: 320, timeMs: 60 },
        { x: 300, y: 290, timeMs: 90 },
        { x: 260, y: 240, timeMs: 120 }
      ],
      context
    );

    expect(centered.targetX).toBe(200);
    expect(poor.targetX).toBeGreaterThan(context.goalLeftX);
    expect(poor.targetX).toBeLessThan(context.goalRightX);
    expect(poor.precisionPenaltyPx).toBeGreaterThan(centered.precisionPenaltyPx);
    expect(interpretShotIntent(cleanGesture, context)).toEqual(interpretShotIntent(cleanGesture, context));
  });
});
