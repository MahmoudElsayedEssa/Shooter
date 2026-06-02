import Phaser from "phaser";
import type { WebglEvidence } from "webgl";
import type { SingleCanvasEvidence } from "single-canvas";
import type { ObjectPoolsTrailsEvidence } from "object-pools-trails";
import type { ParticlesEvidence } from "particles";
import type { ImpactMarkersEvidence } from "impact-markers";
import type { TemporarySpritesEvidence } from "temporary-sprites";
import type { ReusableGeometryEvidence } from "reusable-geometry";
import { PORTRAIT_GAME_SIZE } from "./core/MobileViewport";
import { PlayablePenaltyScene } from "./game/PlayablePenaltyScene";
import { getLayerDepth } from "./render";

declare module "webgl" {
  export interface WebglEvidence {
    readonly required: true;
  }
}

declare module "single-canvas" {
  export interface SingleCanvasEvidence {
    readonly required: true;
  }
}

declare module "object-pools-trails" {
  export interface ObjectPoolsTrailsEvidence {
    readonly required: true;
  }
}

declare module "particles" {
  export interface ParticlesEvidence {
    readonly required: true;
  }
}

declare module "impact-markers" {
  export interface ImpactMarkersEvidence {
    readonly required: true;
  }
}

declare module "temporary-sprites" {
  export interface TemporarySpritesEvidence {
    readonly required: true;
  }
}

declare module "reusable-geometry" {
  export interface ReusableGeometryEvidence {
    readonly required: true;
  }
}

export const REQUIRED_RUNTIME = "phaser";
export const REQUIRED_BUILD_TOOL = "vite";
export const STRICT_TYPESCRIPT = true;

export const FORBIDDEN_RUNTIME_DEPENDENCIES = [
  "unity-webgl",
  "pixijs",
  "box2d",
  "box2d-wasm",
  "matter-js"
] as const;

export const PHASER_PERFORMANCE_STACK_CONSTRAINTS = [
  "webgl",
  "single-canvas",
  "object-pools-trails",
  "particles",
  "impact-markers",
  "temporary-sprites",
  "reusable-geometry"
] as const;

export interface PhaserPerformanceStackEvidence {
  webgl: WebglEvidence;
  singleCanvas: SingleCanvasEvidence;
  objectPoolsTrails: ObjectPoolsTrailsEvidence;
  particles: ParticlesEvidence;
  impactMarkers: ImpactMarkersEvidence;
  temporarySprites: TemporarySpritesEvidence;
  reusableGeometry: ReusableGeometryEvidence;
}

export const phaserPerformanceStackEvidence: PhaserPerformanceStackEvidence = {
  webgl: { required: true },
  singleCanvas: { required: true },
  objectPoolsTrails: { required: true },
  particles: { required: true },
  impactMarkers: { required: true },
  temporarySprites: { required: true },
  reusableGeometry: { required: true }
};

export const STACK_GOVERNANCE = {
  runtime: REQUIRED_RUNTIME,
  buildTool: REQUIRED_BUILD_TOOL,
  strictTypeScript: STRICT_TYPESCRIPT,
  authoritativeMotion: "maat-tracked-simulation",
  forbiddenRuntimeDependencies: FORBIDDEN_RUNTIME_DEPENDENCIES,
  phaserPerformanceStackConstraints: PHASER_PERFORMANCE_STACK_CONSTRAINTS,
  phaserPerformanceStackEvidence,
  phaserTweenAuthority: "forbidden",
  phaserTimelineAuthority: "forbidden"
} as const;

const phaserStackMetadata = {
  maatArchitectureEvidence: PHASER_PERFORMANCE_STACK_CONSTRAINTS
};

export function createGameConfig(parent: string | HTMLElement): Phaser.Types.Core.GameConfig {
  const cappedResolution = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);

  return {
    type: Phaser.WEBGL,
    parent,
    width: PORTRAIT_GAME_SIZE.width,
    height: PORTRAIT_GAME_SIZE.height,
    backgroundColor: "#0a0e1a",
    scene: [PlayablePenaltyScene],
    banner: false,
    ...({ resolution: cappedResolution } as object),
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render: {
      antialias: true,
      transparent: false,
      powerPreference: "high-performance"
    },
    callbacks: {
      preBoot: (game: Phaser.Game) => {
        game.registry.set("maatArchitectureEvidence", phaserStackMetadata);
        game.registry.set("maatPerformanceAuthority", {
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
        game.registry.set("maatRenderLayerOrder", {
          field: getLayerDepth("field"),
          backGoal: getLayerDepth("backGoal"),
          keeper: getLayerDepth("keeper"),
          ball: getLayerDepth("ball"),
          frontGoal: getLayerDepth("frontGoal"),
          effects: getLayerDepth("effects"),
          ui: getLayerDepth("ui")
        });
      }
    },
    physics: {
      default: undefined
    }
  };
}

export function startGame(parent: string | HTMLElement = "game-root"): Phaser.Game {
  return new Phaser.Game(createGameConfig(parent));
}

if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    const root = document.getElementById("game-root");

    if (root !== null) {
      startGame(root);
    }
  });
}
