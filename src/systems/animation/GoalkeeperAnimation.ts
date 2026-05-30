import type { DiveDirection, GoalkeeperMood } from "../goalkeeper/GoalkeeperAI";
import type { BallOutcome } from "../collision/CollisionResolver";

export type GoalkeeperAnimationName =
  | "idle"
  | "focus_stance"
  | "nervous_stance"
  | "pre_dive_anticipation"
  | "dive_left"
  | "dive_right"
  | "dive_center"
  | "save_contact"
  | "miss_reaction"
  | "goal_conceded"
  | "reset";

export interface FacialExpression {
  readonly eyeShape: "neutral" | "narrow" | "wide" | "glare" | "strained";
  readonly browAngleDeg: number;
  readonly mouth: "flat" | "tight" | "open" | "smirk" | "grimace";
  readonly bodyTension: number;
}

export interface GoalkeeperAnimationState {
  readonly name: GoalkeeperAnimationName;
  readonly durationMs: number;
  readonly facialExpression: FacialExpression;
  readonly reachPeakMs: number | null;
  readonly impactScale: number;
  readonly bodyRig: "lightweight-rig";
  readonly faceOverlay: "procedural";
  readonly diveImpact: "procedural-squash-stretch";
}

export const GOALKEEPER_ANIMATION_NAMES: readonly GoalkeeperAnimationName[] = [
  "idle",
  "focus_stance",
  "nervous_stance",
  "pre_dive_anticipation",
  "dive_left",
  "dive_right",
  "dive_center",
  "save_contact",
  "miss_reaction",
  "goal_conceded",
  "reset"
] as const;

export const GOALKEEPER_FACE_BY_MOOD: Readonly<Record<GoalkeeperMood, FacialExpression>> = {
  calm: { eyeShape: "neutral", browAngleDeg: 0, mouth: "flat", bodyTension: 0.2 },
  focused: { eyeShape: "narrow", browAngleDeg: -8, mouth: "tight", bodyTension: 0.46 },
  nervous: { eyeShape: "wide", browAngleDeg: 10, mouth: "open", bodyTension: 0.68 },
  aggressive: { eyeShape: "glare", browAngleDeg: -14, mouth: "smirk", bodyTension: 0.74 },
  desperate: { eyeShape: "strained", browAngleDeg: 16, mouth: "grimace", bodyTension: 0.92 }
} as const;

const ANIMATION_DURATIONS_MS: Readonly<Record<GoalkeeperAnimationName, number>> = {
  idle: 400,
  focus_stance: 360,
  nervous_stance: 360,
  pre_dive_anticipation: 140,
  dive_left: 420,
  dive_right: 420,
  dive_center: 360,
  save_contact: 220,
  miss_reaction: 300,
  goal_conceded: 420,
  reset: 260
} as const;

export function getGoalkeeperAnimation(
  mood: GoalkeeperMood,
  phase: "idle" | "focus" | "nervous" | "anticipate" | "dive" | "result" | "reset",
  diveDirection: DiveDirection,
  outcome: BallOutcome | null
): GoalkeeperAnimationState {
  const name = getAnimationName(mood, phase, diveDirection, outcome);
  const durationMs = ANIMATION_DURATIONS_MS[name];
  const reachPeakMs = name.startsWith("dive_") ? durationMs / 2 : null;
  const impactScale = name === "save_contact" ? 1.18 : name.startsWith("dive_") ? 1.1 : 1;

  return {
    name,
    durationMs,
    facialExpression: GOALKEEPER_FACE_BY_MOOD[mood],
    reachPeakMs,
    impactScale,
    bodyRig: "lightweight-rig",
    faceOverlay: "procedural",
    diveImpact: "procedural-squash-stretch"
  };
}

export function isReadableDuration(state: GoalkeeperAnimationState): boolean {
  return state.durationMs <= 600;
}

function getAnimationName(
  mood: GoalkeeperMood,
  phase: "idle" | "focus" | "nervous" | "anticipate" | "dive" | "result" | "reset",
  diveDirection: DiveDirection,
  outcome: BallOutcome | null
): GoalkeeperAnimationName {
  if (phase === "reset") {
    return "reset";
  }
  if (phase === "result") {
    if (outcome === "save") {
      return "save_contact";
    }
    return outcome === "goal" ? "goal_conceded" : "miss_reaction";
  }
  if (phase === "dive") {
    return diveDirection === "left" ? "dive_left" : diveDirection === "right" ? "dive_right" : "dive_center";
  }
  if (phase === "anticipate") {
    return "pre_dive_anticipation";
  }
  if (phase === "nervous" || mood === "nervous") {
    return "nervous_stance";
  }
  if (phase === "focus" || mood === "focused") {
    return "focus_stance";
  }
  return "idle";
}
