import { describe, expect, it } from "vitest";
import {
  INPUT_LIMITS,
  captureInputPoint,
  capturesInputType,
  createTrailState,
  getShotZoneRadius,
  nextInputPhaseAfterGesture,
  recoverInvalidGesture,
  sampleGesturePoint,
  startsInsideShotZone,
  validateGesture,
  type GesturePoint
} from "./DrawToShootInput";

const validGesture: readonly GesturePoint[] = [
  { x: 100, y: 220, timeMs: 0 },
  { x: 106, y: 198, timeMs: 80 },
  { x: 118, y: 170, timeMs: 160 }
];

describe("REQ-INPUT-001 draw-to-shoot input", () => {
  it("AC1 captures touch, pointer, and mouse input families", () => {
    expect((["touch", "pointer", "mouse"] as const).every(capturesInputType)).toBe(true);
    expect(captureInputPoint({ type: "touch", clientX: 1, clientY: 2, timeMs: 3 })).toEqual({
      x: 1,
      y: 2,
      timeMs: 3
    });
    expect(captureInputPoint({ type: "pointer", clientX: 4, clientY: 5, timeMs: 6 })).toEqual({
      x: 4,
      y: 5,
      timeMs: 6
    });
    expect(captureInputPoint({ type: "mouse", clientX: 7, clientY: 8, timeMs: 9 })).toEqual({
      x: 7,
      y: 8,
      timeMs: 9
    });
  });

  it("AC2 requires gestures to start inside the ball-centered shot zone", () => {
    const zone = { centerX: 100, centerY: 200, viewportWidth: 320 };

    expect(getShotZoneRadius(320)).toBeCloseTo(44.8);
    expect(getShotZoneRadius(200)).toBe(INPUT_LIMITS.shotZoneMinRadiusPx);
    expect(startsInsideShotZone({ x: 144, y: 200, timeMs: 0 }, zone)).toBe(true);
    expect(startsInsideShotZone({ x: 145, y: 200, timeMs: 0 }, zone)).toBe(false);
    expect(startsInsideShotZone({ x: 100, y: 156, timeMs: 0 }, zone)).toBe(true);
    expect(startsInsideShotZone({ x: 100, y: 154, timeMs: 0 }, zone)).toBe(false);
  });

  it("AC3 samples at least 4px and 16ms apart, capped at 48 points", () => {
    let result = sampleGesturePoint([], { x: 0, y: 0, timeMs: 0 });
    expect(result.accepted).toBe(true);

    result = sampleGesturePoint(result.points, { x: 3, y: 0, timeMs: 20 });
    expect(result.accepted).toBe(false);

    result = sampleGesturePoint(result.points, { x: 4, y: 0, timeMs: 15 });
    expect(result.accepted).toBe(false);

    result = sampleGesturePoint(result.points, { x: 4, y: 0, timeMs: 16 });
    expect(result.accepted).toBe(true);

    const maxed = Array.from({ length: INPUT_LIMITS.maxPoints }, (_, index) => ({
      x: index * 4,
      y: 0,
      timeMs: index * 16
    }));
    expect(sampleGesturePoint(maxed, { x: 999, y: 0, timeMs: 999 }).accepted).toBe(false);
  });

  it("AC4 validates point count, distance, upward finish, and duration bounds", () => {
    expect(validateGesture(validGesture)).toEqual({ valid: true, reason: "ok" });
    expect(validateGesture(validGesture.slice(0, 2)).reason).toBe("too_few_points");
    expect(
      validateGesture([
        { x: 0, y: 20, timeMs: 0 },
        { x: 4, y: 18, timeMs: 25 },
        { x: 8, y: 16, timeMs: 80 }
      ]).reason
    ).toBe("too_short");
    expect(validateGesture([{ ...validGesture[0] }, { x: 110, y: 216, timeMs: 80 }, { x: 130, y: 214, timeMs: 160 }]).reason).toBe("not_upward");
    expect(validateGesture(validGesture.map((point) => ({ ...point, timeMs: point.timeMs / 10 }))).reason).toBe("too_fast");
    expect(validateGesture(validGesture.map((point) => ({ ...point, timeMs: point.timeMs * 10 }))).reason).toBe("too_slow");
  });

  it("AC5 returns invalid gestures to aiming without penalty path", () => {
    const drawingState = { phase: "drawing", playerScore: 2, goalkeeperScore: 1 } as const;

    expect(nextInputPhaseAfterGesture(validGesture)).toBe("shot_commit");
    expect(nextInputPhaseAfterGesture(validGesture.slice(0, 2))).toBe("aiming");
    expect(recoverInvalidGesture(drawingState)).toEqual({
      phase: "aiming",
      playerScore: 2,
      goalkeeperScore: 1
    });
  });

  it("AC6 shows live trail on the same or next frame after input begins", () => {
    expect(createTrailState([], 0, null).visible).toBe(false);
    expect(createTrailState([validGesture[0]], 0, null).visible).toBe(true);
    expect(createTrailState([validGesture[0]], 1, null).visible).toBe(true);
    expect(createTrailState([validGesture[0]], 2, null).visible).toBe(false);
  });

  it("AC7 fades trail within 120-260ms after shot commit", () => {
    expect(createTrailState(validGesture, 2, 120).opacity).toBeGreaterThan(
      createTrailState(validGesture, 2, 200).opacity
    );
    expect(createTrailState(validGesture, 2, 119).visible).toBe(true);
    expect(createTrailState(validGesture, 2, 260)).toMatchObject({
      visible: true,
      opacity: 0,
      pointsCleared: false
    });
    expect(createTrailState(validGesture, 2, 261)).toMatchObject({
      visible: false,
      pointsCleared: true
    });
  });

  it("AC8 communicates curve and force without blocking goal visibility", () => {
    expect(createTrailState(validGesture, 1, null)).toMatchObject({
      communicatesCurve: true,
      communicatesForce: true,
      curveDirection: "left",
      force: expect.any(Number),
      blocksGoal: false
    });
  });
});
