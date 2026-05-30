import { describe, expect, it } from "vitest";
import { FIXED_DT_SECONDS, GameLoop } from "../../core/GameLoop";
import { acceptsPerformanceGate, evaluatePerformanceGate } from "../../core/performance";

describe("NFR-PERF-002 mobile WebView performance gates", () => {
  it("AC1 targets 60 fps and rejects sub-budget regressions unless low-end fallback is documented", () => {
    const target = evaluatePerformanceGate({ lowEndMode: false, heroMoment: false, frameTimesMs: [16], droppedCatchUpFrames: 0 });
    const lowEnd = evaluatePerformanceGate({ lowEndMode: true, heroMoment: false, frameTimesMs: [21], droppedCatchUpFrames: 0 });

    expect(target).toMatchObject({ targetFps: 60, acceptedFps: 60, lowEndFallbackDocumented: false });
    expect(acceptsPerformanceGate(target)).toBe(true);
    expect(acceptsPerformanceGate({ ...target, acceptedFps: 50 })).toBe(false);
    expect(acceptsPerformanceGate(lowEnd)).toBe(true);
  });

  it("AC2 keeps low-end mode at 45 fps by reducing visuals before input responsiveness", () => {
    const gate = evaluatePerformanceGate({ lowEndMode: true, heroMoment: false, frameTimesMs: [21], droppedCatchUpFrames: 0 });

    expect(gate.acceptedFps).toBeGreaterThanOrEqual(45);
    expect(gate.reductionsBeforeInput).toEqual(["fx", "background_motion", "shake", "flash", "particle_density"]);
    expect(gate.inputResponsivenessFrames).toBe(1);
  });

  it("AC3 keeps drawing input feedback on the same frame or next frame in low-end mode", () => {
    expect(
      evaluatePerformanceGate({ lowEndMode: true, heroMoment: false, frameTimesMs: [21], droppedCatchUpFrames: 0 })
        .inputResponsivenessFrames
    ).toBeLessThanOrEqual(1);
  });

  it("AC4 keeps simulation deterministic under fluctuating render frame times", () => {
    const first = new GameLoop({ render: () => undefined, requestAnimationFrame: () => 1 });
    const second = new GameLoop({ render: () => undefined, requestAnimationFrame: () => 1 });
    const deltas = [FIXED_DT_SECONDS / 2, FIXED_DT_SECONDS * 2.5, FIXED_DT_SECONDS * 0.75, FIXED_DT_SECONDS * 3];

    for (const delta of deltas) {
      first.stepFrame(delta);
      second.stepFrame(delta);
    }

    expect(second.snapshot).toEqual(first.snapshot);
  });

  it("AC5 caps normal and hero particle counts for mobile WebView", () => {
    expect(evaluatePerformanceGate({ lowEndMode: false, heroMoment: false, frameTimesMs: [16], droppedCatchUpFrames: 0 }).particleCount).toBe(40);
    expect(evaluatePerformanceGate({ lowEndMode: false, heroMoment: true, frameTimesMs: [16], droppedCatchUpFrames: 0 }).particleCount).toBe(120);
  });

  it("AC6 requires pooled hot-path resources", () => {
    expect(evaluatePerformanceGate({ lowEndMode: false, heroMoment: false, frameTimesMs: [16], droppedCatchUpFrames: 0 }).pooledResources).toEqual([
      "trail_points",
      "particles",
      "impact_effects",
      "temporary_visual_markers"
    ]);
  });

  it("AC7 records warnings for repeated catch-up drops and slow frames", () => {
    expect(
      evaluatePerformanceGate({ lowEndMode: false, heroMoment: false, frameTimesMs: [16, 25], droppedCatchUpFrames: 2 }).warnings
    ).toEqual(["dropped_catch_up_steps", "frame_time_threshold"]);
  });
});
