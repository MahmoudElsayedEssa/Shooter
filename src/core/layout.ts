export type GameScreenId =
  | "critical_assets"
  | "aiming"
  | "drawing"
  | "shot_commit"
  | "ball_flight"
  | "resolution"
  | "match_end"
  | "pause";

export type ScreenEvent =
  | "critical_assets_loaded"
  | "begin_drawing"
  | "commit_shot"
  | "flight_complete"
  | "resolution_complete"
  | "next_shot"
  | "match_decided"
  | "pause"
  | "resume"
  | "restart";

export interface ScreenTransition {
  readonly event: ScreenEvent;
  readonly to: GameScreenId;
}

export interface ScreenComposition {
  readonly screen: GameScreenId;
  readonly activeGameplay: boolean;
  readonly controlsSurface: "phaser_canvas" | "none";
  readonly domOverlayRole: "none" | "shell_only";
  readonly restartActions: readonly "restart"[];
}

export const REQUIRED_GAME_SCREENS: readonly GameScreenId[] = [
  "critical_assets",
  "aiming",
  "drawing",
  "shot_commit",
  "ball_flight",
  "resolution",
  "match_end",
  "pause"
] as const;

export const SCREEN_STATE_MACHINE: Readonly<Record<GameScreenId, readonly ScreenTransition[]>> = {
  critical_assets: [{ event: "critical_assets_loaded", to: "aiming" }],
  aiming: [
    { event: "begin_drawing", to: "drawing" },
    { event: "pause", to: "pause" }
  ],
  drawing: [
    { event: "commit_shot", to: "shot_commit" },
    { event: "pause", to: "pause" }
  ],
  shot_commit: [{ event: "flight_complete", to: "ball_flight" }],
  ball_flight: [{ event: "flight_complete", to: "resolution" }],
  resolution: [
    { event: "next_shot", to: "aiming" },
    { event: "match_decided", to: "match_end" }
  ],
  match_end: [{ event: "restart", to: "aiming" }],
  pause: [{ event: "resume", to: "aiming" }]
};

export function getReachableScreens(start: GameScreenId = "critical_assets"): readonly GameScreenId[] {
  const seen = new Set<GameScreenId>();
  const pending: GameScreenId[] = [start];

  while (pending.length > 0) {
    const screen = pending.shift();
    if (screen === undefined || seen.has(screen)) {
      continue;
    }
    seen.add(screen);
    for (const transition of SCREEN_STATE_MACHINE[screen]) {
      pending.push(transition.to);
    }
  }

  return REQUIRED_GAME_SCREENS.filter((screen) => seen.has(screen));
}

export function getFirstPlayableScreenAfterCriticalAssets(): GameScreenId {
  const transition = SCREEN_STATE_MACHINE.critical_assets.find(
    (candidate) => candidate.event === "critical_assets_loaded"
  );
  return transition?.to ?? "critical_assets";
}

export function getScreenComposition(screen: GameScreenId): ScreenComposition {
  const activeGameplay = screen === "aiming" || screen === "drawing" || screen === "shot_commit" || screen === "ball_flight";
  return {
    screen,
    activeGameplay,
    controlsSurface: activeGameplay ? "phaser_canvas" : "none",
    domOverlayRole: activeGameplay ? "none" : "shell_only",
    restartActions: screen === "match_end" ? ["restart"] : []
  };
}
