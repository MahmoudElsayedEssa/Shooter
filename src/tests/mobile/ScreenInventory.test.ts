import { describe, expect, it } from "vitest";
import {
  REQUIRED_GAME_SCREENS,
  getFirstPlayableScreenAfterCriticalAssets,
  getReachableScreens,
  getScreenComposition
} from "../../core/layout";
import { getOutcomeUi, type UiContext } from "../../ui/OutcomeUi";

const context: UiContext = {
  playerScore: 1,
  goalkeeperScore: 1,
  shotNumber: 3,
  maxShots: 5,
  outcome: "none",
  firstValidGestureSeen: true,
  viewportWidth: 390,
  viewportHeight: 844,
  ballStartZone: { left: 163, top: 740, right: 227, bottom: 804 },
  goalCorners: [
    { left: 166, top: 92, right: 194, bottom: 120 },
    { left: 196, top: 92, right: 224, bottom: 120 }
  ],
  goalkeeperBody: { left: 156, top: 150, right: 234, bottom: 232 },
  gesturePath: { left: 140, top: 520, right: 262, bottom: 780 }
};

describe("REQ-SCREEN-001 mobile screen inventory and composition", () => {
  it("AC1 reaches every required screen and overlay through the documented state machine", () => {
    expect(getReachableScreens()).toEqual(REQUIRED_GAME_SCREENS);
  });

  it("AC2 keeps active gameplay controls inside the Phaser canvas instead of DOM overlays", () => {
    const activeScreens = ["aiming", "drawing", "shot_commit", "ball_flight"] as const;

    expect(activeScreens.map(getScreenComposition)).toEqual([
      {
        screen: "aiming",
        activeGameplay: true,
        controlsSurface: "phaser_canvas",
        domOverlayRole: "none",
        restartActions: []
      },
      {
        screen: "drawing",
        activeGameplay: true,
        controlsSurface: "phaser_canvas",
        domOverlayRole: "none",
        restartActions: []
      },
      {
        screen: "shot_commit",
        activeGameplay: true,
        controlsSurface: "phaser_canvas",
        domOverlayRole: "none",
        restartActions: []
      },
      {
        screen: "ball_flight",
        activeGameplay: true,
        controlsSurface: "phaser_canvas",
        domOverlayRole: "none",
        restartActions: []
      }
    ]);
  });

  it("AC3 keeps UI panels off shot zone goal corners goalkeeper area and drawing path", () => {
    expect(getOutcomeUi(context).safeLayout).toBe(true);
  });

  it("AC4 enters first aiming state immediately after critical assets load", () => {
    expect(getFirstPlayableScreenAfterCriticalAssets()).toBe("aiming");
  });

  it("AC5 exposes exactly one restart action from match end", () => {
    expect(getScreenComposition("match_end").restartActions).toEqual(["restart"]);
  });
});
