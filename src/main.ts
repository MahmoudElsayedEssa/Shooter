import Phaser from "phaser";
import { PORTRAIT_GAME_SIZE } from "./core/MobileViewport";
import { PlayablePenaltyScene } from "./game/PlayablePenaltyScene";
import { getLayerDepth } from "./render";

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
