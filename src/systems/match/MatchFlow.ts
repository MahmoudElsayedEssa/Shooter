export type MatchPhase =
  | "boot"
  | "ready"
  | "aiming"
  | "drawing"
  | "shot_commit"
  | "ball_flight"
  | "resolution"
  | "reset"
  | "match_end"
  | "pause";

export type ShotOutcome = "goal" | "save" | "miss";

export interface MatchScore {
  readonly player: number;
  readonly goalkeeper: number;
}

export interface MatchTimers {
  readonly shotCommitMs: number;
  readonly resolutionMs: number;
  readonly resetMs: number;
}

export interface MatchState {
  readonly phase: MatchPhase;
  readonly previousSafePhase: Exclude<MatchPhase, "pause"> | null;
  readonly shotsTaken: number;
  readonly score: MatchScore;
  readonly timers: MatchTimers;
  readonly pendingOutcome: ShotOutcome | null;
}

export type MatchAction =
  | { readonly type: "boot_complete" }
  | { readonly type: "ready_to_aim" }
  | { readonly type: "begin_drawing" }
  | { readonly type: "invalid_gesture" }
  | { readonly type: "commit_shot"; readonly outcome: ShotOutcome }
  | { readonly type: "resolve_shot"; readonly outcome: ShotOutcome }
  | { readonly type: "advance"; readonly elapsedMs: number }
  | { readonly type: "visibility_lost" }
  | { readonly type: "visibility_restored" }
  | { readonly type: "restart" };

const SRS_MATCH_ACTION_TYPES: ReadonlySet<MatchAction["type"]> = new Set([
  "boot_complete",
  "ready_to_aim",
  "begin_drawing",
  "invalid_gesture",
  "commit_shot",
  "resolve_shot",
  "advance",
  "visibility_lost",
  "visibility_restored",
  "restart"
]);

export const MATCH_LIMITS = {
  maxShots: 5,
  shotCommitMs: 100,
  resolutionMs: 600,
  resetMs: 300,
  nextShotBudgetMs: 1800
} as const;

export function createMatchState(): MatchState {
  return {
    phase: "boot",
    previousSafePhase: null,
    shotsTaken: 0,
    score: { player: 0, goalkeeper: 0 },
    timers: { shotCommitMs: 0, resolutionMs: 0, resetMs: 0 },
    pendingOutcome: null
  };
}

export function reduceMatchState(state: MatchState, action: MatchAction): MatchState {
  if (!SRS_MATCH_ACTION_TYPES.has(action.type)) {
    throw new Error(`Unsupported SRS match action: ${String(action.type)}`);
  }

  switch (action.type) {
    case "boot_complete":
      return state.phase === "boot" ? transition(state, "ready") : state;
    case "ready_to_aim":
      return state.phase === "ready" || state.phase === "reset" ? transition(state, "aiming") : state;
    case "begin_drawing":
      return state.phase === "aiming" ? transition(state, "drawing") : state;
    case "invalid_gesture":
      return state.phase === "drawing" ? transition(state, "aiming") : state;
    case "commit_shot":
      return state.phase === "drawing"
        ? { ...transition(state, "shot_commit"), pendingOutcome: action.outcome }
        : state;
    case "resolve_shot": {
      // Explicit shot resolution: immediately update score and advance.
      // Accepts from any active-play phase. The scene manages visual phases
      // independently, so MatchState may still be in "aiming" when this fires.
      const terminalPhases: ReadonlySet<MatchPhase> = new Set(["boot", "ready", "match_end", "pause"]);
      if (terminalPhases.has(state.phase)) return state;
      const newScore = scoreShot(state.score, action.outcome);
      const newShotsTaken = state.shotsTaken + 1;
      const nextPhase = isMatchDecided(newScore, newShotsTaken) ? "match_end" : "reset";
      return {
        ...state,
        phase: nextPhase,
        previousSafePhase: null,
        score: newScore,
        shotsTaken: newShotsTaken,
        pendingOutcome: null,
        timers: { shotCommitMs: 0, resolutionMs: 0, resetMs: 0 }
      };
    }
    case "advance":
      return advanceTimedState(state, action.elapsedMs);
    case "visibility_lost":
      return state.phase === "pause"
        ? state
        : { ...state, phase: "pause", previousSafePhase: safeRestorePhase(state.phase) };
    case "visibility_restored":
      return state.phase === "pause" && state.previousSafePhase !== null
        ? { ...state, phase: state.previousSafePhase, previousSafePhase: null }
        : state;
    case "restart":
      return state.phase === "match_end" ? transition(createMatchState(), "aiming") : state;
  }
}

export function isMatchDecided(_score: MatchScore, shotsTaken: number): boolean {
  // Always play all 5 shots — match ends only after all shots are taken
  return shotsTaken >= MATCH_LIMITS.maxShots;
}

/**
 * Score a shot outcome. Both "save" and "miss" award the goalkeeper a point.
 * This is intentional: in this game format, any non-goal benefits the keeper.
 */
export function scoreShot(score: MatchScore, outcome: ShotOutcome): MatchScore {
  return outcome === "goal"
    ? { ...score, player: score.player + 1 }
    : { ...score, goalkeeper: score.goalkeeper + 1 };
}

function advanceTimedState(state: MatchState, elapsedMs: number): MatchState {
  if (elapsedMs < 0) {
    return state;
  }

  if (state.phase === "shot_commit") {
    const shotCommitMs = state.timers.shotCommitMs + elapsedMs;
    return shotCommitMs >= MATCH_LIMITS.shotCommitMs
      ? { ...transition(state, "ball_flight"), timers: { ...state.timers, shotCommitMs } }
      : { ...state, timers: { ...state.timers, shotCommitMs } };
  }

  if (state.phase === "ball_flight") {
    return transition(state, "resolution");
  }

  if (state.phase === "resolution") {
    const resolutionMs = state.timers.resolutionMs + elapsedMs;
    if (resolutionMs < MATCH_LIMITS.resolutionMs) {
      return { ...state, timers: { ...state.timers, resolutionMs } };
    }

    const phase = isMatchDecided(state.score, state.shotsTaken) ? "match_end" : "reset";
    return {
      ...transition(state, phase),
      pendingOutcome: null,
      timers: { ...state.timers, resolutionMs }
    };
  }

  if (state.phase === "reset") {
    const resetMs = state.timers.resetMs + elapsedMs;
    return resetMs >= MATCH_LIMITS.resetMs
      ? transition({ ...state, timers: { ...state.timers, resetMs } }, "aiming")
      : { ...state, timers: { ...state.timers, resetMs } };
  }

  return state;
}

function transition(state: MatchState, phase: MatchPhase): MatchState {
  return {
    ...state,
    phase,
    previousSafePhase: phase === "pause" ? state.previousSafePhase : null,
    timers:
      phase === "shot_commit" || phase === "resolution" || phase === "reset"
        ? { shotCommitMs: 0, resolutionMs: 0, resetMs: 0 }
        : state.timers
  };
}

function safeRestorePhase(phase: MatchPhase): Exclude<MatchPhase, "pause"> {
  if (
    phase === "pause" ||
    phase === "shot_commit" ||
    phase === "ball_flight" ||
    phase === "resolution" ||
    phase === "reset"
  ) {
    return "aiming";
  }

  return phase;
}
