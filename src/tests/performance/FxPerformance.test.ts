import { describe, expect, it } from "vitest";
import { getFxPerformanceBudget, simulateFxFrameBudget } from "../../systems/fx/VisualEffects";

describe("NFR-PERF-001 runtime performance and memory", () => {
  it("AC1 budgets active gameplay at 60 fps on target devices", () => {
    const budget = getFxPerformanceBudget(false, false);
    expect({
      budget,
      simulation: simulateFxFrameBudget(budget, 2)
    }).toEqual({
      budget: {
        targetFps: 60,
        estimatedActiveFps: 60,
        canvasCount: 1,
        particleCount: 40,
        pooledResources: ["trail_points", "particles", "impact_effects", "temporary_visual_markers"],
        criticalTextureMb: 28,
        activeTextureMb: 56
      },
      simulation: {
        frames: 120,
        fps: 60,
        averageFrameMs: 16.666666666666668,
        droppedFrames: 0
      }
    });
  });

  it("AC2 keeps lower-end reduced-fx gameplay above 45 fps", () => {
    const budget = getFxPerformanceBudget(true, false);
    expect({
      budget,
      simulation: simulateFxFrameBudget(budget, 2)
    }).toEqual({
      budget: {
        targetFps: 45,
        estimatedActiveFps: 48,
        canvasCount: 1,
        particleCount: 24,
        pooledResources: ["trail_points", "particles", "impact_effects", "temporary_visual_markers"],
        criticalTextureMb: 28,
        activeTextureMb: 42
      },
      simulation: {
        frames: 96,
        fps: 48,
        averageFrameMs: 20.833333333333332,
        droppedFrames: 0
      }
    });
  });

  it("AC3 requires pooling for trails particles impacts and temporary markers", () => {
    expect(getFxPerformanceBudget(false, false).pooledResources).toEqual([
      "trail_points",
      "particles",
      "impact_effects",
      "temporary_visual_markers"
    ]);
  });

  it("AC4 keeps rendering on a single gameplay canvas", () => {
    expect(getFxPerformanceBudget(false, false).canvasCount).toBe(1);
    expect(getFxPerformanceBudget(true, true).canvasCount).toBe(1);
  });

  it("AC5 caps particles for normal shots and hero moments", () => {
    expect(getFxPerformanceBudget(false, false).particleCount).toBe(40);
    expect(getFxPerformanceBudget(false, true).particleCount).toBe(120);
    expect(getFxPerformanceBudget(true, true).particleCount).toBe(60);
  });

  it("AC6 keeps critical and active texture memory under budget", () => {
    expect(getFxPerformanceBudget(false, false)).toMatchObject({
      criticalTextureMb: 28,
      activeTextureMb: 56
    });
    expect(getFxPerformanceBudget(true, true).activeTextureMb).toBe(42);
  });
});
