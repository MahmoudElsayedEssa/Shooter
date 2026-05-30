import { reduceMatchState, type MatchState } from "../systems/match/MatchFlow";

export type MobileLifecycleEvent =
  | "tab_hidden"
  | "webview_pause"
  | "app_background"
  | "orientation_change"
  | "resize"
  | "tab_visible"
  | "webview_resume"
  | "app_foreground";

export interface MobileLifecycleState {
  readonly match: MatchState;
  readonly paused: boolean;
  readonly layoutDirty: boolean;
  readonly lastEvent: MobileLifecycleEvent | null;
}

export function createMobileLifecycleState(match: MatchState): MobileLifecycleState {
  return {
    match,
    paused: false,
    layoutDirty: false,
    lastEvent: null
  };
}

export function reduceMobileLifecycle(
  state: MobileLifecycleState,
  event: MobileLifecycleEvent
): MobileLifecycleState {
  if (event === "orientation_change" || event === "resize") {
    return pauseForLayout(state, event);
  }

  if (event === "tab_hidden" || event === "webview_pause" || event === "app_background") {
    return {
      ...state,
      match: reduceMatchState(state.match, { type: "visibility_lost" }),
      paused: true,
      lastEvent: event
    };
  }

  return {
    match: reduceMatchState(state.match, { type: "visibility_restored" }),
    paused: false,
    layoutDirty: false,
    lastEvent: event
  };
}

function pauseForLayout(
  state: MobileLifecycleState,
  event: Extract<MobileLifecycleEvent, "orientation_change" | "resize">
): MobileLifecycleState {
  return {
    ...state,
    match: reduceMatchState(state.match, { type: "visibility_lost" }),
    paused: true,
    layoutDirty: true,
    lastEvent: event
  };
}
