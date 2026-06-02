import { clamp, mix } from "../../core/math";

export type AudioOutcome = "goal" | "save" | "miss" | "none";
export type AudioEventType =
  | "kick"
  | "ball_whoosh"
  | "curve_air"
  | "goal_net_impact"
  | "save_impact"
  | "post_impact"
  | "crowd_reaction"
  | "tension_swell";

export interface AudioContext {
  readonly userInteracted: boolean;
  readonly audioInitFailed: boolean;
  readonly shotCommitted: boolean;
  readonly pressure: number;
  readonly finalShot: boolean;
  readonly curve: number;
  readonly outcome: AudioOutcome;
  readonly postImpact: boolean;
}

export interface AudioEvent {
  readonly type: AudioEventType;
  readonly startMs: number;
  readonly intensity: number;
  readonly pitch: number;
}

export interface AudioPlan {
  readonly initState: "waiting_for_user" | "ready" | "failed_non_blocking";
  readonly playable: true;
  readonly blocksInput: false;
  readonly blocksRendering: false;
  readonly blocksMatchProgression: false;
  readonly events: readonly AudioEvent[];
  readonly tensionLoop: {
    readonly active: boolean;
    readonly fadeInMs: number;
    readonly fadeOutMs: number;
    readonly restartsAbruptly: false;
  };
  readonly resetDelayMs: 0;
}

export const AUDIO_LIMITS = {
  ambienceLow: 0.18,
  crowdLow: 0.25,
  crowdHigh: 0.9,
  whooshLow: 0.35,
  whooshHigh: 0.95,
  impactLow: 0.45,
  impactHigh: 1,
  curveThreshold: 0.18,
  tensionFadeMs: 240
} as const;

export function planAdaptiveAudio(context: AudioContext): AudioPlan {
  const pressure = clamp(context.pressure, 0, 1);
  const initialized = context.userInteracted && !context.audioInitFailed;

  return {
    initState: getInitState(context),
    playable: true,
    blocksInput: false,
    blocksRendering: false,
    blocksMatchProgression: false,
    events: initialized ? getAudioEvents(context, pressure) : [],
    tensionLoop: {
      active: initialized && (pressure > 0.2 || context.finalShot),
      fadeInMs: AUDIO_LIMITS.tensionFadeMs,
      fadeOutMs: AUDIO_LIMITS.tensionFadeMs,
      restartsAbruptly: false
    },
    resetDelayMs: 0
  };
}

function getInitState(context: AudioContext): AudioPlan["initState"] {
  if (!context.userInteracted) {
    return "waiting_for_user";
  }
  return context.audioInitFailed ? "failed_non_blocking" : "ready";
}

function getAudioEvents(context: AudioContext, pressure: number): readonly AudioEvent[] {
  const events: AudioEvent[] = [];

  if (context.shotCommitted) {
    events.push(makeEvent("kick", 0, 0.85, 1));
    events.push(makeEvent("ball_whoosh", 12, mix(AUDIO_LIMITS.whooshLow, AUDIO_LIMITS.whooshHigh, pressure), 1 + pressure * 0.08));
  }
  if (Math.abs(context.curve) >= AUDIO_LIMITS.curveThreshold) {
    events.push(makeEvent("curve_air", 35, 0.35 + Math.abs(context.curve) * 0.45, 1.04));
  }
  if (context.finalShot) {
    events.push(makeEvent("tension_swell", 0, 0.75 + pressure * 0.25, 1));
  }

  if (context.outcome === "goal") {
    events.push(makeEvent("goal_net_impact", 0, mix(AUDIO_LIMITS.impactLow, AUDIO_LIMITS.impactHigh, pressure), 1.02));
    events.push(makeEvent("crowd_reaction", 80, mix(AUDIO_LIMITS.crowdLow, AUDIO_LIMITS.crowdHigh, pressure), 1));
  } else if (context.outcome === "save") {
    events.push(makeEvent("save_impact", 0, mix(AUDIO_LIMITS.impactLow, AUDIO_LIMITS.impactHigh, pressure), 0.96));
    events.push(makeEvent("crowd_reaction", 90, 0.35 + pressure * 0.4, 0.98));
  } else if (context.postImpact) {
    events.push(makeEvent("post_impact", 0, 0.75 + pressure * 0.2, 1.08));
  }

  return events;
}

function makeEvent(type: AudioEventType, startMs: number, intensity: number, pitch: number): AudioEvent {
  return {
    type,
    startMs,
    intensity,
    pitch
  };
}
