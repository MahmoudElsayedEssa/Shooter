import type Phaser from "phaser";

export type RenderLayerName =
  | "field"
  | "backGoal"
  | "keeper"
  | "ball"
  | "frontGoal"
  | "effects"
  | "ui";
type RuntimeSystemName = "input" | "simulation" | "post-simulation";
type RuntimeStateKey = "input" | "simulation" | "render" | "tuning";

export interface RenderLayerDefinition {
  readonly name: RenderLayerName;
  readonly depth: number;
}

interface InputState {
  readonly pointerX: number;
  readonly pointerY: number;
  readonly isPressed: boolean;
  readonly sequence: number;
}

interface StateSimulationSnapshot {
  readonly tick: number;
  readonly elapsedSeconds: number;
  readonly droppedTimeSeconds: number;
}

interface RuntimeRenderState {
  readonly frame: number;
  readonly interpolationAlpha: number;
  readonly visibleLayerCount: number;
}

interface TuningConfig {
  readonly fixedDtSeconds: number;
  readonly maxCatchUpSteps: number;
  readonly renderWidth: number;
  readonly renderHeight: number;
}

interface RuntimeStateTree {
  readonly input: InputState;
  readonly simulation: StateSimulationSnapshot;
  readonly render: RuntimeRenderState;
  readonly tuning: TuningConfig;
}

export type FairShotOutcome = "goal" | "save" | "miss";

export interface FairnessPresentationInput {
  readonly committedOutcome: FairShotOutcome;
  readonly requestedPresentationOutcome?: FairShotOutcome;
  readonly lowEndMode: boolean;
}

export interface FairnessPresentationState {
  readonly outcome: FairShotOutcome;
  readonly outcomeAuthority: "simulation";
  readonly presentationOutcome: FairShotOutcome;
  readonly lowEndMode: boolean;
  readonly ignoredPresentationOverride: boolean;
  readonly allowsForcedOutcome: false;
}

interface SystemOwnership {
  readonly system: RuntimeSystemName;
  readonly reads: readonly RuntimeStateKey[];
  readonly writes: readonly RuntimeStateKey[];
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

const DEFAULT_TUNING_CONFIG: TuningConfig = Object.freeze({
  fixedDtSeconds: 1 / 60,
  maxCatchUpSteps: 3,
  renderWidth: 960,
  renderHeight: 540
});

const STATE_OWNERSHIP: readonly SystemOwnership[] = [
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
] as const;

export const SINGLE_CANVAS_RENDER_CONTRACT = {
  renderer: "phaser",
  preferredRenderer: "webgl",
  canvasOwner: "Phaser.Game",
  canvasCount: 1,
  forbiddenRenderer: "pixijs",
  activeGameplayControlSurface: "phaser_canvas",
  domHeavyActiveGameplayUi: false,
  simulationAuthority: {
    phaserTweens: "forbidden",
    phaserTimelines: "forbidden",
    authoritativeSystems: ["ball_flight", "collision", "goalkeeper_reach", "scoring", "pressure"]
  },
  performanceInstrumentation: {
    fps: true,
    frameTimeMs: true,
    droppedCatchUpSteps: true,
    activeParticles: true,
    textureMemoryEstimateMb: true,
    lowEndMode: true
  },
  lowEndMode: {
    reducesPresentationOnly: true,
    preservesShotOutcomeLogic: true
  },
  fairnessAuthority: {
    outcomeAuthority: "simulation",
    forcedOutcomes: "forbidden",
    presentationMayOverrideOutcome: false,
    lowEndModeMayChangeOutcome: false
  },
  runtimeState: {
    defaultTuningConfig: DEFAULT_TUNING_CONFIG,
    stateOwnership: STATE_OWNERSHIP,
    createInitialRuntimeState,
    getSystemOwnership,
    applyOwnedStateUpdate,
    createFairnessPresentationState
  }
} as const;

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

function createInitialRuntimeState(tuning: TuningConfig = DEFAULT_TUNING_CONFIG): RuntimeStateTree {
  return {
    input: {
      pointerX: 0,
      pointerY: 0,
      isPressed: false,
      sequence: 0
    },
    simulation: {
      tick: 0,
      elapsedSeconds: 0,
      droppedTimeSeconds: 0
    },
    render: {
      frame: 0,
      interpolationAlpha: 0,
      visibleLayerCount: LOGICAL_LAYER_ORDER.length
    },
    tuning
  };
}

function getSystemOwnership(system: RuntimeSystemName): SystemOwnership {
  const ownership = STATE_OWNERSHIP.find((entry) => entry.system === system);

  if (ownership === undefined) {
    throw new Error(`Unknown system ownership: ${system}`);
  }

  return ownership;
}

function applyOwnedStateUpdate<Key extends RuntimeStateKey>(
  system: RuntimeSystemName,
  state: RuntimeStateTree,
  key: Key,
  value: RuntimeStateTree[Key]
): RuntimeStateTree {
  const ownership = getSystemOwnership(system);

  if (!ownership.writes.includes(key)) {
    throw new Error(`${system} cannot write ${key} state`);
  }

  return {
    ...state,
    [key]: value
  };
}

export function createFairnessPresentationState(
  input: FairnessPresentationInput
): FairnessPresentationState {
  const ignoredPresentationOverride =
    input.requestedPresentationOutcome !== undefined &&
    input.requestedPresentationOutcome !== input.committedOutcome;

  return Object.freeze({
    outcome: input.committedOutcome,
    outcomeAuthority: "simulation",
    presentationOutcome: input.committedOutcome,
    lowEndMode: input.lowEndMode,
    ignoredPresentationOverride,
    allowsForcedOutcome: false
  });
}

export function isDrawnAbove(frontLayer: RenderLayerName, backLayer: RenderLayerName): boolean {
  return getLayerDepth(frontLayer) > getLayerDepth(backLayer);
}

function unreachableLayer(layerName: string): never {
  throw new Error(`Unknown render layer: ${layerName}`);
}
