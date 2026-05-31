import { createRequire } from "node:module";
import Phaser from "phaser";
import { describe, expect, it } from "vitest";
import packageJson from "../package.json";
import { createGameConfig } from "./main";
import {
  LOGICAL_LAYER_ORDER,
  SINGLE_CANVAS_RENDER_CONTRACT,
  createFairnessPresentationState,
  createLogicalLayers,
  getLayerDepth,
  isDrawnAbove,
  type FairShotOutcome,
  type PhaserLayerLike
} from "./render";

const requireFromTest = createRequire(import.meta.url);

class FakeLayer implements PhaserLayerLike {
  readonly children: Phaser.GameObjects.GameObject[] = [];
  depth = -1;
  name = "";

  add(child: Phaser.GameObjects.GameObject): this {
    this.children.push(child);
    return this;
  }

  setDepth(depth: number): this {
    this.depth = depth;
    return this;
  }

  setName(name: string): this {
    this.name = name;
    return this;
  }
}

describe("ARCH-RENDER-001 render architecture", () => {
  it("AC1 delegates single canvas ownership to one Phaser WebGL game", () => {
    const config = createGameConfig("game-root");

    expect(config.type).toBe(Phaser.WEBGL);
    expect(config.parent).toBe("game-root");
    expect(config.canvas).toBeUndefined();
    expect(SINGLE_CANVAS_RENDER_CONTRACT).toMatchObject({
      renderer: "phaser",
      preferredRenderer: "webgl",
      canvasOwner: "Phaser.Game",
      canvasCount: 1,
      activeGameplayControlSurface: "phaser_canvas",
      domHeavyActiveGameplayUi: false
    });
  });

  it("AC2 creates 7 logical layers in documented z-order", () => {
    const createdLayers: FakeLayer[] = [];
    const scene = {
      add: {
        layer: () => {
          const layer = new FakeLayer();
          createdLayers.push(layer);
          return layer;
        }
      }
    };

    const layers = createLogicalLayers(scene);

    expect(LOGICAL_LAYER_ORDER.map((layer) => layer.name)).toEqual([
      "field",
      "backGoal",
      "keeper",
      "ball",
      "frontGoal",
      "effects",
      "ui"
    ]);
    expect(createdLayers).toHaveLength(7);
    expect(createdLayers.map((layer) => [layer.name, layer.depth])).toEqual(
      LOGICAL_LAYER_ORDER.map((layer) => [layer.name, layer.depth])
    );
    expect(layers.ball).toBe(createdLayers[3]);
  });

  it("AC2 exposes the documented layer order through Phaser boot registry metadata", () => {
    const config = createGameConfig("game-root");
    const registryValues = new Map<string, unknown>();
    const game = {
      registry: {
        set: (key: string, value: unknown) => {
          registryValues.set(key, value);
        }
      }
    } as Phaser.Game;

    config.callbacks?.preBoot?.(game);

    expect(registryValues.get("maatRenderLayerOrder")).toEqual({
      field: 0,
      backGoal: 10,
      keeper: 20,
      ball: 30,
      frontGoal: 40,
      effects: 50,
      ui: 60
    });
    expect(registryValues.get("maatPerformanceAuthority")).toEqual({
      renderer: "webgl",
      canvasCount: 1,
      activeGameplayControlSurface: "phaser_canvas",
      instrumentation: [
        "fps",
        "frameTimeMs",
        "droppedCatchUpSteps",
        "activeParticles",
        "textureMemoryEstimateMb",
        "lowEndMode"
      ]
    });
  });

  it("AC3 preserves depth illusion for keeper, ball, and front goal", () => {
    expect(isDrawnAbove("ball", "keeper")).toBe(true);
    expect(isDrawnAbove("frontGoal", "ball")).toBe(true);
    expect(getLayerDepth("keeper")).toBeLessThan(getLayerDepth("ball"));
    expect(getLayerDepth("ball")).toBeLessThan(getLayerDepth("frontGoal"));
  });

  it("AC4 keeps PixiJS out of the render stack and dependencies", () => {
    const allDependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    expect(allDependencies).not.toHaveProperty("pixijs");
    expect(SINGLE_CANVAS_RENDER_CONTRACT.forbiddenRenderer).toBe("pixijs");
    expect(() => requireFromTest.resolve("pixijs")).toThrow();
  });
});

describe("ARCH-PERF-001 Phaser WebGL mobile performance authority", () => {
  it("AC2 uses one Phaser WebGL canvas with high-performance render preference", () => {
    const config = createGameConfig("game-root");

    expect(config.type).toBe(Phaser.WEBGL);
    expect(config.render).toMatchObject({
      antialias: true,
      transparent: false,
      powerPreference: "high-performance"
    });
    expect(SINGLE_CANVAS_RENDER_CONTRACT.canvasCount).toBe(1);
  });

  it("AC3 keeps gameplay authority independent from Phaser tweens and timelines", () => {
    expect(SINGLE_CANVAS_RENDER_CONTRACT.simulationAuthority).toEqual({
      phaserTweens: "forbidden",
      phaserTimelines: "forbidden",
      authoritativeSystems: ["ball_flight", "collision", "goalkeeper_reach", "scoring", "pressure"]
    });
  });

  it("AC4 exposes required performance instrumentation fields", () => {
    expect(SINGLE_CANVAS_RENDER_CONTRACT.performanceInstrumentation).toEqual({
      fps: true,
      frameTimeMs: true,
      droppedCatchUpSteps: true,
      activeParticles: true,
      textureMemoryEstimateMb: true,
      lowEndMode: true
    });
  });

  it("AC5 lets low-end mode reduce presentation without changing shot outcome logic", () => {
    expect(SINGLE_CANVAS_RENDER_CONTRACT.lowEndMode).toEqual({
      reducesPresentationOnly: true,
      preservesShotOutcomeLogic: true
    });
  });

  it("METHOD-FAIRNESS-001 keeps presentation and low-end mode from forcing outcomes", () => {
    expect(SINGLE_CANVAS_RENDER_CONTRACT.fairnessAuthority).toEqual({
      outcomeAuthority: "simulation",
      forcedOutcomes: "forbidden",
      presentationMayOverrideOutcome: false,
      lowEndModeMayChangeOutcome: false
    });

    const outcomes: readonly FairShotOutcome[] = ["goal", "save", "miss"];
    for (const committedOutcome of outcomes) {
      const requestedPresentationOutcome = outcomes.find((outcome) => outcome !== committedOutcome);
      const presentationState = createFairnessPresentationState({
        committedOutcome,
        requestedPresentationOutcome,
        lowEndMode: true
      });

      expect(presentationState).toEqual({
        outcome: committedOutcome,
        outcomeAuthority: "simulation",
        presentationOutcome: committedOutcome,
        lowEndMode: true,
        ignoredPresentationOverride: true,
        allowsForcedOutcome: false
      });
      expect(Object.isFrozen(presentationState)).toBe(true);
    }
  });
});

describe("ARCH-STATE-001 runtime state architecture", () => {
  const runtimeState = SINGLE_CANVAS_RENDER_CONTRACT.runtimeState;

  it("AC1 exposes documented runtime sub-states with typed fields", () => {
    const state = runtimeState.createInitialRuntimeState();

    expect(state.input).toEqual({
      pointerX: 0,
      pointerY: 0,
      isPressed: false,
      sequence: 0
    });
    expect(state.simulation).toMatchObject({
      tick: 0,
      elapsedSeconds: 0,
      droppedTimeSeconds: 0
    });
    expect(state.render).toEqual({
      frame: 0,
      interpolationAlpha: 0,
      visibleLayerCount: 7
    });
    expect(state.tuning).toBe(runtimeState.defaultTuningConfig);
  });

  it("AC2 documents read and write ownership for each runtime system", () => {
    expect(runtimeState.stateOwnership).toEqual([
      {
        system: "input",
        reads: ["input", "tuning"],
        writes: ["input"]
      },
      {
        system: "simulation",
        reads: ["input", "simulation", "tuning"],
        writes: ["simulation"]
      },
      {
        system: "post-simulation",
        reads: ["simulation", "render", "tuning"],
        writes: ["render"]
      }
    ]);

    for (const ownership of runtimeState.stateOwnership) {
      expect(runtimeState.getSystemOwnership(ownership.system)).toBe(ownership);
      expect(ownership.writes).toHaveLength(1);
    }
  });

  it("AC2 prevents systems from writing outside their owned state", () => {
    const state = runtimeState.createInitialRuntimeState();
    const updatedInput = {
      ...state.input,
      pointerX: 25,
      sequence: 1
    };

    expect(runtimeState.applyOwnedStateUpdate("input", state, "input", updatedInput).input).toBe(
      updatedInput
    );
    expect(() =>
      runtimeState.applyOwnedStateUpdate("input", state, "simulation", state.simulation)
    ).toThrow("input cannot write simulation state");
    expect(() =>
      runtimeState.applyOwnedStateUpdate("simulation", state, "render", state.render)
    ).toThrow("simulation cannot write render state");
  });

  it("AC3 loads all tuning constants from centralized data without algorithm changes", () => {
    const customTuning = {
      fixedDtSeconds: 1 / 30,
      maxCatchUpSteps: 2,
      renderWidth: 1280,
      renderHeight: 720
    };
    const state = runtimeState.createInitialRuntimeState(customTuning);

    expect(runtimeState.defaultTuningConfig).toEqual({
      fixedDtSeconds: 1 / 60,
      maxCatchUpSteps: 3,
      renderWidth: 960,
      renderHeight: 540
    });
    expect(state.tuning).toBe(customTuning);
    expect(
      runtimeState.createInitialRuntimeState({ ...customTuning, renderWidth: 1440 }).tuning
        .renderWidth
    ).toBe(1440);
  });
});
