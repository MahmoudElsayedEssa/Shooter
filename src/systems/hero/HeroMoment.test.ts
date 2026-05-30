import { describe, expect, it } from "vitest";
import { HERO_LIMITS, detectHeroMoments, type HeroMomentContext } from "./HeroMoment";

const baseContext: HeroMomentContext = {
  finalShot: false,
  scoreDiff: 2,
  outcome: "goal",
  ballDistanceFromKeeperReachPx: 40,
  keeperReachPx: 100,
  saveContactReachRatio: 0.5,
  curve: 0.2,
  postContact: false,
  keeperDoveCorrectDirection: false,
  ballCurvedAwayFromKeeper: false
};

describe("REQ-PRESSURE-001 hero moments", () => {
  it("AC4 detects all documented hero moment types", () => {
    expect(detectHeroMoments({ ...baseContext, finalShot: true, scoreDiff: 1 }).moments).toContain("final_decider");
    expect(detectHeroMoments({ ...baseContext, ballDistanceFromKeeperReachPx: 5 }).moments).toContain("near_save_goal");
    expect(detectHeroMoments({ ...baseContext, outcome: "save", saveContactReachRatio: 0.9 }).moments).toContain(
      "fingertip_save"
    );
    expect(detectHeroMoments({ ...baseContext, curve: 0.9 }).moments).toContain("extreme_curve_goal");
    expect(detectHeroMoments({ ...baseContext, postContact: true }).moments).toContain("post_and_in");
    expect(
      detectHeroMoments({
        ...baseContext,
        curve: -0.7,
        keeperDoveCorrectDirection: true,
        ballCurvedAwayFromKeeper: true
      }).moments
    ).toContain("wrong_foot_curve");
  });

  it("AC5 enhances camera, FX, and audio without changing resolved outcome", () => {
    const normal = detectHeroMoments(baseContext);
    const hero = detectHeroMoments({ ...baseContext, finalShot: true, scoreDiff: 0 });

    expect(hero.presentation.cameraIntensity).toBeGreaterThan(normal.presentation.cameraIntensity);
    expect(hero.presentation.fxIntensity).toBeGreaterThan(normal.presentation.fxIntensity);
    expect(hero.presentation.audioIntensity).toBeGreaterThan(normal.presentation.audioIntensity);
    expect(hero.resolvedOutcome).toBe(baseContext.outcome);
  });

  it("AC6 keeps hero result display between 1000-1500ms and normal between 600-1200ms", () => {
    const normal = detectHeroMoments(baseContext);
    const hero = detectHeroMoments({ ...baseContext, finalShot: true, scoreDiff: 0 });

    expect(normal.presentation.resultDisplayMs).toBe(HERO_LIMITS.normalDisplayMs);
    expect(hero.presentation.resultDisplayMs).toBe(HERO_LIMITS.heroDisplayMs);
    expect(normal.presentation.resultDisplayMs).toBeGreaterThanOrEqual(600);
    expect(normal.presentation.resultDisplayMs).toBeLessThanOrEqual(1200);
    expect(hero.presentation.resultDisplayMs).toBeGreaterThanOrEqual(1000);
    expect(hero.presentation.resultDisplayMs).toBeLessThanOrEqual(1500);
  });
});
