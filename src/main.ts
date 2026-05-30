import Phaser from "phaser";
import type { WebglEvidence } from "webgl";
import type { SingleCanvasEvidence } from "single-canvas";
import type { ObjectPoolsTrailsEvidence } from "object-pools-trails";
import type { ParticlesEvidence } from "particles";
import type { ImpactMarkersEvidence } from "impact-markers";
import type { TemporarySpritesEvidence } from "temporary-sprites";
import type { ReusableGeometryEvidence } from "reusable-geometry";

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

class BootstrapScene extends Phaser.Scene {
  constructor() {
    super("BootstrapScene");
  }

  create(): void {
    this.add.text(16, 16, "Shooter", {
      color: "#ffffff",
      fontFamily: "Arial, sans-serif",
      fontSize: "24px"
    });
  }
}

export function createGameConfig(parent: string | HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.WEBGL,
    parent,
    width: 960,
    height: 540,
    backgroundColor: "#111827",
    scene: [BootstrapScene],
    banner: false,
    callbacks: {
      preBoot: (game: Phaser.Game) => {
        game.registry.set("maatArchitectureEvidence", phaserStackMetadata);
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
