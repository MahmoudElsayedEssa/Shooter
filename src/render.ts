import type Phaser from "phaser";

export type RenderLayerName =
  | "field"
  | "backGoal"
  | "keeper"
  | "ball"
  | "frontGoal"
  | "effects"
  | "ui";

export interface RenderLayerDefinition {
  readonly name: RenderLayerName;
  readonly depth: number;
}

export const LOGICAL_LAYER_ORDER: readonly RenderLayerDefinition[] = [
  { name: "field", depth: 0 },
  { name: "backGoal", depth: 10 },
  { name: "keeper", depth: 20 },
  { name: "ball", depth: 30 },
  { name: "frontGoal", depth: 40 },
  { name: "effects", depth: 50 },
  { name: "ui", depth: 60 }
] as const;

export interface PhaserLayerLike {
  add(child: Phaser.GameObjects.GameObject): this;
  setDepth(depth: number): this;
  setName(name: string): this;
}

export interface PhaserLayerSceneLike {
  readonly add: {
    layer(): PhaserLayerLike;
  };
}

export type RenderLayerMap = Readonly<Record<RenderLayerName, PhaserLayerLike>>;

export function getLayerDepth(layerName: RenderLayerName): number {
  return LOGICAL_LAYER_ORDER.find((layer) => layer.name === layerName)?.depth ?? unreachableLayer(layerName);
}

export function createLogicalLayers(scene: PhaserLayerSceneLike): RenderLayerMap {
  const layers = {} as Record<RenderLayerName, PhaserLayerLike>;

  for (const layer of LOGICAL_LAYER_ORDER) {
    layers[layer.name] = scene.add.layer().setName(layer.name).setDepth(layer.depth);
  }

  return layers;
}

function unreachableLayer(layerName: string): never {
  throw new Error(`Unknown render layer: ${layerName}`);
}
