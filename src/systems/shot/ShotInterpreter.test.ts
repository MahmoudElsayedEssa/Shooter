import { describe, it, expect } from "vitest";
import {
  interpretShotIntent,
  SHOT_INTERPRETER_LIMITS,
  type ShotInterpretationContext,
} from "./ShotInterpreter";
import type { GesturePoint } from "../input/DrawToShootInput";

// ─── Helpers ───

const CTX: ShotInterpretationContext = {
  viewportWidth: 960,
  ballY: 460,
  goalLeftX: 240,
  goalRightX: 720,
  goalTopY: 120,
  goalBottomY: 270,
};

function makeGesture(
  coords: Array<[number, number]>,
  intervalMs = 30
): readonly GesturePoint[] {
  return coords.map(([x, y], i) => ({
    x,
    y,
    timeMs: 100 + i * intervalMs,
  }));
}

function straightUpGesture(
  startX: number,
  length: number,
  points = 6
): readonly GesturePoint[] {
  const coords: Array<[number, number]> = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    coords.push([startX, 460 - t * length]);
  }
  return makeGesture(coords);
}

// ─── Tests ───

describe("ShotInterpreter", () => {
  describe("interpretShotIntent", () => {
    it("returns a valid ShotIntent from a simple upward gesture", () => {
      const gesture = straightUpGesture(480, 150);
      const intent = interpretShotIntent(gesture, CTX);

      expect(intent).toHaveProperty("targetX");
      expect(intent).toHaveProperty("targetY");
      expect(intent).toHaveProperty("force");
      expect(intent).toHaveProperty("curve");
      expect(intent).toHaveProperty("gestureQuality");
      expect(intent).toHaveProperty("durationMs");
      expect(intent).toHaveProperty("pathComplexity");
      expect(intent).toHaveProperty("precisionPenaltyPx");
    });

    it("produces force within valid range", () => {
      const gesture = straightUpGesture(480, 150);
      const intent = interpretShotIntent(gesture, CTX);

      expect(intent.force).toBeGreaterThanOrEqual(SHOT_INTERPRETER_LIMITS.minForce);
      expect(intent.force).toBeLessThanOrEqual(SHOT_INTERPRETER_LIMITS.maxForce);
    });

    it("produces gestureQuality between minGestureQuality and 1.0", () => {
      const gesture = straightUpGesture(480, 150);
      const intent = interpretShotIntent(gesture, CTX);

      expect(intent.gestureQuality).toBeGreaterThanOrEqual(
        SHOT_INTERPRETER_LIMITS.minGestureQuality
      );
      expect(intent.gestureQuality).toBeLessThanOrEqual(1.0);
    });

    it("produces curve between -1 and 1", () => {
      const gesture = straightUpGesture(480, 150);
      const intent = interpretShotIntent(gesture, CTX);

      expect(intent.curve).toBeGreaterThanOrEqual(-1);
      expect(intent.curve).toBeLessThanOrEqual(1);
    });

    it("maps a center gesture to near goal center X", () => {
      const gesture = straightUpGesture(480, 150);
      const intent = interpretShotIntent(gesture, CTX);
      const goalCenterX = (CTX.goalLeftX + CTX.goalRightX) / 2;

      expect(Math.abs(intent.targetX - goalCenterX)).toBeLessThan(20);
    });

    it("maps a left gesture to near goal left X", () => {
      const gesture = straightUpGesture(280, 150);
      const intent = interpretShotIntent(gesture, CTX);

      expect(intent.targetX).toBeLessThan((CTX.goalLeftX + CTX.goalRightX) / 2);
    });

    it("maps a right gesture to near goal right X", () => {
      const gesture = straightUpGesture(680, 150);
      const intent = interpretShotIntent(gesture, CTX);

      expect(intent.targetX).toBeGreaterThan((CTX.goalLeftX + CTX.goalRightX) / 2);
    });

    it("detects left curve from a leftward-bowed gesture", () => {
      const gesture = makeGesture([
        [480, 460],
        [440, 400],
        [420, 340],
        [440, 300],
        [460, 280],
        [480, 260],
      ]);
      const intent = interpretShotIntent(gesture, CTX);

      expect(intent.curve).toBeLessThan(0);
    });

    it("detects right curve from a rightward-bowed gesture", () => {
      const gesture = makeGesture([
        [480, 460],
        [520, 400],
        [540, 340],
        [520, 300],
        [500, 280],
        [480, 260],
      ]);
      const intent = interpretShotIntent(gesture, CTX);

      expect(intent.curve).toBeGreaterThan(0);
    });

    it("produces near-zero curve for a straight gesture", () => {
      const gesture = straightUpGesture(480, 150);
      const intent = interpretShotIntent(gesture, CTX);

      expect(Math.abs(intent.curve)).toBeLessThan(0.1);
    });

    it("penalizes gesture quality for jittery gestures", () => {
      const clean = straightUpGesture(480, 150);
      const jittery = makeGesture([
        [480, 460],
        [500, 430],
        [460, 400],
        [510, 370],
        [450, 340],
        [490, 310],
        [470, 280],
        [500, 260],
      ]);
      const cleanIntent = interpretShotIntent(clean, CTX);
      const jitteryIntent = interpretShotIntent(jittery, CTX);

      expect(jitteryIntent.gestureQuality).toBeLessThan(cleanIntent.gestureQuality);
    });

    it("is deterministic: same gesture produces same intent", () => {
      const gesture = straightUpGesture(350, 180);
      const a = interpretShotIntent(gesture, CTX);
      const b = interpretShotIntent(gesture, CTX);

      expect(a.targetX).toBe(b.targetX);
      expect(a.targetY).toBe(b.targetY);
      expect(a.force).toBe(b.force);
      expect(a.curve).toBe(b.curve);
      expect(a.gestureQuality).toBe(b.gestureQuality);
    });

    it("throws for fewer than 2 points", () => {
      expect(() =>
        interpretShotIntent([{ x: 480, y: 460, timeMs: 100 }], CTX)
      ).toThrow();
    });
  });
});
