import { describe, expect, it } from "vitest";
import { planCinematicCamera, stepCinematicCamera, type CameraContext } from "./CinematicCamera";

const baseContext: CameraContext = {
  viewportWidth: 480,
  viewportHeight: 270,
  goalFrame: { left: 140, top: 42, right: 340, bottom: 132 },
  ball: { x: 260, y: 180 },
  keeper: { x: 240, y: 100 },
  pressure: 0,
  impact: "none",
  finalShot: false,
  matchPoint: false,
  nearSave: false,
  postContact: false
};

function plan(overrides: Partial<CameraContext> = {}) {
  return planCinematicCamera({ ...baseContext, ...overrides });
}

describe("REQ-CINEMA-001 cinematic camera system", () => {
  it("AC1 composes the six required cinematic camera layers", () => {
    const camera = plan({ pressure: 0.55, impact: "light", emotionalFocus: { x: 210, y: 92 } });

    expect(camera.layers).toEqual([
      "base_framing",
      "ball_tracking",
      "tension_zoom",
      "impact_shake",
      "slow_motion_pulse",
      "emotional_focus"
    ]);
    expect(camera.center).toEqual({ x: 241.58624, y: 120.190528 });
    expect(camera.zoom).toBeCloseTo(1.066);
  });

  it("AC2 clamps zoom between normal and 1.12 while keeping ball keeper and goal framed", () => {
    const normal = plan({ pressure: 0 });
    const intense = plan({ pressure: 1 });
    const crowded = plan({
      viewportWidth: 260,
      viewportHeight: 170,
      pressure: 1,
      ball: { x: 352, y: 196 },
      keeper: { x: 128, y: 98 }
    });

    expect(normal.zoom).toBe(1);
    expect(intense.zoom).toBe(1.12);
    expect(crowded.zoom).toBe(1);
  });

  it("AC3 scales ball tracking strength across low medium and high pressure bands", () => {
    expect({
      lowStart: plan({ pressure: 0 }).ballTrackingStrength,
      lowEnd: plan({ pressure: 1 / 3 }).ballTrackingStrength,
      medium: plan({ pressure: 0.5 }).ballTrackingStrength,
      highStart: plan({ pressure: 2 / 3 }).ballTrackingStrength,
      highEnd: plan({ pressure: 1 }).ballTrackingStrength
    }).toEqual({
      lowStart: 0.05,
      lowEnd: 0.1,
      medium: 0.14,
      highStart: 0.18,
      highEnd: 0.3
    });
  });

  it("AC4 keeps impact shake in light strong and final-shot timing ranges", () => {
    expect({
      none: plan({ impact: "none" }).shake,
      light: plan({ impact: "light" }).shake,
      strong: plan({ impact: "strong" }).shake,
      finalStrong: plan({ impact: "strong", finalShot: true }).shake
    }).toEqual({
      none: { durationMs: 0, intensity: 0 },
      light: { durationMs: 110, intensity: 0.35 },
      strong: { durationMs: 210, intensity: 0.75 },
      finalStrong: { durationMs: 300, intensity: 0.75 }
    });
  });

  it("AC5 triggers slow motion only for cinematic events and bounds duration and time scale", () => {
    const ordinary = plan({ pressure: 0.9 });
    const finalShot = plan({ pressure: 1, finalShot: true });
    const matchPoint = plan({ pressure: 0.5, matchPoint: true });
    const nearSave = plan({ pressure: 0.25, nearSave: true });
    const postContact = plan({ pressure: 0, postContact: true });

    expect(ordinary.slowMotion).toEqual({ active: false, durationMs: 0, timeScale: 1, resetDelayMs: 0 });
    expect(finalShot.slowMotion).toEqual({ active: true, durationMs: 450, timeScale: 0.35, resetDelayMs: 520 });
    expect(matchPoint.slowMotion).toEqual({ active: true, durationMs: 315, timeScale: 0.5249999999999999, resetDelayMs: 385 });
    expect(nearSave.slowMotion).toEqual({ active: true, durationMs: 248, timeScale: 0.6124999999999999, resetDelayMs: 318 });
    expect(postContact.slowMotion).toEqual({ active: true, durationMs: 180, timeScale: 0.7, resetDelayMs: 250 });
  });

  it("AC6 uses exponential damping inside position and zoom ranges", () => {
    const camera = plan({ pressure: 0.5 });
    const stepped = stepCinematicCamera(
      { center: { x: 100, y: 40 }, zoom: 1 },
      camera,
      1 / 60
    );

    expect(camera.damping).toEqual({ position: 11, zoom: 8 });
    expect(stepped.center.x).toBeCloseTo(123.901579);
    expect(stepped.center.y).toBeCloseTo(53.371926);
    expect(stepped.zoom).toBeCloseTo(1.00749);
  });

  it("AC7 keeps slow-motion reset pacing bounded", () => {
    const finalShot = plan({ pressure: 1, finalShot: true });

    expect(finalShot.slowMotion.durationMs).toBe(450);
    expect(finalShot.slowMotion.resetDelayMs).toBe(520);
  });
});
