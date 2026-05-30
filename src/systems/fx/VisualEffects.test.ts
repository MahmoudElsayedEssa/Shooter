import { describe, expect, it } from "vitest";
import {
  createFxPool,
  evaluateFxPerformanceGate,
  getFxPerformanceBudget,
  planVisualEffects,
  simulateFxFrameBudget,
  type FxContext
} from "./VisualEffects";

const baseContext: FxContext = {
  outcome: "goal",
  reason: "inside_goal",
  shotForce: 1,
  pressure: 0.5,
  shotImportance: 0.5,
  heroGoal: false,
  decisiveGoal: false,
  reducedMotion: false,
  lowEndMode: false,
  contactPoint: { x: 240, y: 96 }
};

function plan(overrides: Partial<FxContext> = {}) {
  return planVisualEffects({ ...baseContext, ...overrides }, createFxPool(32));
}

describe("REQ-FX-001 visual effects system", () => {
  it("AC1 is procedural pool-based and never decides gameplay outcomes", () => {
    const fx = plan({ outcome: "save", reason: "keeper_contact", pressure: 0.75 });

    expect(fx.poolBased).toBe(true);
    expect(fx.outcome).toBe("save");
    expect(fx.effects.every((effect) => effect.gameplayDecision === false)).toBe(true);
  });

  it("AC2 keeps ball trail behind the ball with lifetime opacity and width rules", () => {
    const low = plan({ pressure: 0, shotForce: 0.5 });
    const high = plan({ pressure: 1, shotForce: 1.3 });
    const lowTrail = low.effects[0];
    const highTrail = high.effects[0];

    expect(lowTrail).toMatchObject({
      kind: "ball_trail",
      durationMs: 180,
      opacityStart: 1,
      opacityEnd: 0,
      widthPx: 3,
      layer: "behind_ball"
    });
    expect(highTrail).toMatchObject({
      kind: "ball_trail",
      durationMs: 450,
      opacityStart: 1,
      opacityEnd: 0,
      widthPx: 6.6,
      layer: "behind_ball"
    });
  });

  it("AC3 scales goal net pulse and extends hero goal ripple", () => {
    const normal = plan({ outcome: "goal", shotImportance: 0.25, heroGoal: false });
    const hero = plan({ outcome: "goal", shotImportance: 1, heroGoal: true });

    expect(normal.effects.find((effect) => effect.kind === "net_pulse")?.durationMs).toBe(308);
    expect(hero.effects.find((effect) => effect.kind === "net_pulse")?.durationMs).toBe(670);
    expect(hero.effects.find((effect) => effect.kind === "impact_burst")?.intensity).toBeCloseTo(1.2);
  });

  it("AC4 creates save contact burst and deflection at the visual contact point", () => {
    const fx = plan({ outcome: "save", reason: "keeper_contact", pressure: 0.7, contactPoint: { x: 212, y: 118 } });

    expect(fx.effects.find((effect) => effect.kind === "contact_burst")).toMatchObject({
      durationMs: 190,
      origin: { x: 212, y: 118 },
      intensity: 0.85
    });
    expect(fx.effects.find((effect) => effect.kind === "ball_deflection")).toMatchObject({
      durationMs: 190,
      origin: { x: 212, y: 118 },
      intensity: 0.6
    });
  });

  it("AC5 keeps ordinary miss fx quieter than save unless the miss hits the frame", () => {
    const ordinaryMiss = plan({ outcome: "miss", reason: "outside_goal" });
    const postMiss = plan({ outcome: "miss", reason: "post_hit" });
    const save = plan({ outcome: "save", reason: "keeper_contact" });

    expect(ordinaryMiss.effects.find((effect) => effect.kind === "miss_wisp")?.intensity).toBe(0.2);
    expect(postMiss.effects.find((effect) => effect.kind === "miss_wisp")?.intensity).toBe(0.55);
    expect(save.effects.find((effect) => effect.kind === "contact_burst")?.intensity).toBe(0.85);
  });

  it("AC6 reduces or disables screen effects without obscuring ball or goal frame", () => {
    const normal = plan({ pressure: 1 });
    const lowEnd = plan({ pressure: 1, lowEndMode: true });
    const reduced = plan({ pressure: 1, reducedMotion: true });

    expect(normal.effects.find((effect) => effect.kind === "screen_vignette")?.opacityStart).toBe(0.18);
    expect(normal.effects.find((effect) => effect.kind === "screen_flash")?.opacityStart).toBe(0.12);
    expect(lowEnd.effects.find((effect) => effect.kind === "screen_vignette")?.opacityStart).toBe(0.063);
    expect(reduced.effects.some((effect) => effect.layer === "screen")).toBe(false);
  });

  it("AC7 applies bounded hit stop only to strong saves post hits or decisive goals", () => {
    expect(plan({ outcome: "save", reason: "keeper_contact", pressure: 0.8 }).hitStopMs).toBe(80);
    expect(plan({ outcome: "miss", reason: "post_hit", pressure: 0.4 }).hitStopMs).toBe(60);
    expect(plan({ outcome: "goal", decisiveGoal: true, pressure: 1 }).hitStopMs).toBe(90);
    expect(plan({ outcome: "goal", decisiveGoal: true, pressure: 1 }).inputLocked).toBe(false);
  });

  it("AC8 reduces fx density on low-end devices without changing gameplay result", () => {
    const normal = plan({ outcome: "goal", lowEndMode: false });
    const lowEnd = plan({ outcome: "goal", lowEndMode: true });

    expect(normal.densityMultiplier).toBe(1);
    expect(lowEnd.densityMultiplier).toBe(0.5);
    expect(lowEnd.outcome).toBe(normal.outcome);
  });
});

describe("NFR-PERF-001 fx performance budgets", () => {
  it("AC1 and AC2 simulate target and low-end frame budgets", () => {
    const target = getFxPerformanceBudget(false, false);
    const lowEnd = getFxPerformanceBudget(true, false);

    expect(simulateFxFrameBudget(target, 2)).toEqual({
      frames: 120,
      fps: 60,
      averageFrameMs: 16.666666666666668,
      droppedFrames: 0
    });
    expect(simulateFxFrameBudget(lowEnd, 2)).toEqual({
      frames: 96,
      fps: 48,
      averageFrameMs: 20.833333333333332,
      droppedFrames: 0
    });
  });

  it("AC3 through AC6 enforce pooling canvas particle and texture budgets", () => {
    expect({
      normal: getFxPerformanceBudget(false, false),
      hero: getFxPerformanceBudget(false, true),
      lowEndHero: getFxPerformanceBudget(true, true)
    }).toEqual({
      normal: {
        targetFps: 60,
        estimatedActiveFps: 60,
        canvasCount: 1,
        particleCount: 40,
        pooledResources: ["trail_points", "particles", "impact_effects", "temporary_visual_markers"],
        criticalTextureMb: 28,
        activeTextureMb: 56
      },
      hero: {
        targetFps: 60,
        estimatedActiveFps: 60,
        canvasCount: 1,
        particleCount: 120,
        pooledResources: ["trail_points", "particles", "impact_effects", "temporary_visual_markers"],
        criticalTextureMb: 28,
        activeTextureMb: 56
      },
      lowEndHero: {
        targetFps: 45,
        estimatedActiveFps: 48,
        canvasCount: 1,
        particleCount: 60,
        pooledResources: ["trail_points", "particles", "impact_effects", "temporary_visual_markers"],
        criticalTextureMb: 28,
        activeTextureMb: 42
      }
    });
  });
});

describe("PILLAR-006 performance is gameplay", () => {
  it("keeps reduced-fx performance mode from changing gameplay result or input safety", () => {
    const normal = plan({ outcome: "save", reason: "keeper_contact", lowEndMode: false });
    const reduced = plan({ outcome: "save", reason: "keeper_contact", lowEndMode: true });

    expect(normal.performanceMode).toBe("full_fidelity");
    expect(reduced.performanceMode).toBe("reduced_fx");
    expect(reduced.densityMultiplier).toBeLessThan(normal.densityMultiplier);
    expect(reduced).toMatchObject({
      outcome: normal.outcome,
      inputLocked: false,
      gameplayPreserved: true
    });
  });
});

describe("METHOD-PERFORMANCE-001 performance budget release gate", () => {
  it("passes release when the active fx budget stays inside fps particle canvas and texture limits", () => {
    expect(evaluateFxPerformanceGate(getFxPerformanceBudget(false, true))).toMatchObject({
      releaseGate: true,
      passed: true,
      reasons: []
    });
  });

  it("blocks release with explicit reasons when the active fx budget exceeds mobile limits", () => {
    const report = evaluateFxPerformanceGate({
      ...getFxPerformanceBudget(false, true),
      estimatedActiveFps: 52,
      canvasCount: 2,
      particleCount: 160,
      criticalTextureMb: 34,
      activeTextureMb: 72
    });

    expect(report).toMatchObject({
      releaseGate: true,
      passed: false,
      reasons: [
        "fps_below_target",
        "multiple_canvases",
        "particle_budget_exceeded",
        "critical_texture_budget_exceeded",
        "active_texture_budget_exceeded"
      ]
    });
  });
});
