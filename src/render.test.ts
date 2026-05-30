import { createRequire } from "node:module";
import Phaser from "phaser";
import { describe, expect, it } from "vitest";
import packageJson from "../package.json";
import { createGameConfig } from "./main";
import {
  LOGICAL_LAYER_ORDER,
  SINGLE_CANVAS_RENDER_CONTRACT,
  createLogicalLayers,
  getLayerDepth,
  isDrawnAbove,
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
      canvasOwner: "Phaser.Game",
      canvasCount: 1
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
