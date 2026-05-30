import type { ResolvedOutcome } from "../pressure/PressureSystem";

export type HeroMomentType =
  | "final_decider"
  | "near_save_goal"
  | "fingertip_save"
  | "extreme_curve_goal"
  | "post_and_in"
  | "wrong_foot_curve";

export interface HeroMomentContext {
  readonly finalShot: boolean;
  readonly scoreDiff: number;
  readonly outcome: ResolvedOutcome;
  readonly ballDistanceFromKeeperReachPx: number;
  readonly keeperReachPx: number;
  readonly saveContactReachRatio: number;
  readonly curve: number;
  readonly postContact: boolean;
  readonly keeperDoveCorrectDirection: boolean;
  readonly ballCurvedAwayFromKeeper: boolean;
}

export interface HeroMomentResult {
  readonly moments: readonly HeroMomentType[];
  readonly resolvedOutcome: ResolvedOutcome;
  readonly presentation: HeroPresentation;
}

export interface HeroPresentation {
  readonly cameraIntensity: number;
  readonly fxIntensity: number;
  readonly audioIntensity: number;
  readonly resultDisplayMs: number;
}

export const HERO_LIMITS = {
  nearSaveGoalReachRatio: 0.05,
  fingertipOuterReachRatio: 0.85,
  extremeCurve: 0.85,
  normalDisplayMs: 900,
  heroDisplayMs: 1250
} as const;

export function detectHeroMoments(context: HeroMomentContext): HeroMomentResult {
  const moments: HeroMomentType[] = [];

  if (context.finalShot && Math.abs(context.scoreDiff) <= 1) {
    moments.push("final_decider");
  }
  if (
    context.outcome === "goal" &&
    context.ballDistanceFromKeeperReachPx <= context.keeperReachPx * HERO_LIMITS.nearSaveGoalReachRatio
  ) {
    moments.push("near_save_goal");
  }
  if (context.outcome === "save" && context.saveContactReachRatio >= HERO_LIMITS.fingertipOuterReachRatio) {
    moments.push("fingertip_save");
  }
  if (context.outcome === "goal" && Math.abs(context.curve) >= HERO_LIMITS.extremeCurve) {
    moments.push("extreme_curve_goal");
  }
  if (context.outcome === "goal" && context.postContact) {
    moments.push("post_and_in");
  }
  if (
    context.outcome === "goal" &&
    context.keeperDoveCorrectDirection &&
    context.ballCurvedAwayFromKeeper
  ) {
    moments.push("wrong_foot_curve");
  }

  return {
    moments,
    resolvedOutcome: context.outcome,
    presentation: getHeroPresentation(moments.length > 0)
  };
}

function getHeroPresentation(isHero: boolean): HeroPresentation {
  return {
    cameraIntensity: isHero ? 1 : 0.45,
    fxIntensity: isHero ? 1 : 0.5,
    audioIntensity: isHero ? 1 : 0.5,
    resultDisplayMs: isHero ? HERO_LIMITS.heroDisplayMs : HERO_LIMITS.normalDisplayMs
  };
}
