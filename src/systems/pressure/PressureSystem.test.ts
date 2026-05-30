import { describe, expect, it } from "vitest";
import { PRESSURE_LIMITS, calculatePressure, getEscalationFloor, type PressureContext } from "./PressureSystem";

const baseContext: PressureContext = {
  shotIndex: 2,
  maxShots: 5,
  playerScore: 2,
  goalkeeperScore: 2,
  matchPoint: true,
  finalShot: false,
  alreadyDecided: false,
  resolvedOutcome: "goal"
};

describe("REQ-PRESSURE-001 pressure", () => {
  it("AC1 calculates weighted pressure and clamps to 0-1", () => {
    const pressure = calculatePressure(baseContext);
    const expected = ((3 / 5) * 0.55) + (1 * 0.25) + 0.14;

    expect(pressure.pressure).toBeCloseTo(expected);
    expect(calculatePressure({ ...baseContext, shotIndex: 99, finalShot: true }).pressure).toBe(1);
  });

  it("AC2 applies per-shot escalation floor and context multiplier", () => {
    expect(PRESSURE_LIMITS.escalationFloors).toEqual([0.1, 0.18, 0.3, 0.45, 0.5]);
    expect(getEscalationFloor({ ...baseContext, shotIndex: 0 })).toBe(0.1);
    expect(getEscalationFloor({ ...baseContext, shotIndex: 4 })).toBe(0.5);
    expect(getEscalationFloor({ ...baseContext, shotIndex: 4, alreadyDecided: true })).toBe(0.15);
  });

  it("AC3 maps pressure only to presentation and never changes resolved outcome", () => {
    const low = calculatePressure({ ...baseContext, shotIndex: 0, matchPoint: false });
    const high = calculatePressure({ ...baseContext, shotIndex: 4, finalShot: true, matchPoint: true });

    expect(high.presentation.cameraZoom).toBeGreaterThan(low.presentation.cameraZoom);
    expect(high.presentation.fxIntensity).toBeGreaterThan(low.presentation.fxIntensity);
    expect(high.presentation.audioTension).toBeGreaterThan(low.presentation.audioTension);
    expect(high.presentation.trailBrightness).toBeGreaterThan(low.presentation.trailBrightness);
    expect(high.presentation.uiUrgency).toBeGreaterThan(low.presentation.uiUrgency);
    expect(high.resolvedOutcome).toBe(baseContext.resolvedOutcome);
  });
});
