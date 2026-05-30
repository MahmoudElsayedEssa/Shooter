import { describe, expect, it } from "vitest";
import {
  GOALKEEPER_ANIMATION_NAMES,
  GOALKEEPER_FACE_BY_MOOD,
  getGoalkeeperAnimation,
  isReadableDuration,
  type GoalkeeperAnimationName
} from "./GoalkeeperAnimation";
import type { DiveDirection, GoalkeeperMood } from "../goalkeeper/GoalkeeperAI";

describe("REQ-ANIM-001 goalkeeper animation", () => {
  it("AC1 supports every required goalkeeper animation state", () => {
    const produced = new Set<GoalkeeperAnimationName>([
      getGoalkeeperAnimation("calm", "idle", "center", null).name,
      getGoalkeeperAnimation("focused", "focus", "center", null).name,
      getGoalkeeperAnimation("nervous", "nervous", "center", null).name,
      getGoalkeeperAnimation("calm", "anticipate", "center", null).name,
      getGoalkeeperAnimation("calm", "dive", "left", null).name,
      getGoalkeeperAnimation("calm", "dive", "right", null).name,
      getGoalkeeperAnimation("calm", "dive", "center", null).name,
      getGoalkeeperAnimation("calm", "result", "center", "save").name,
      getGoalkeeperAnimation("calm", "result", "center", "miss").name,
      getGoalkeeperAnimation("calm", "result", "center", "goal").name,
      getGoalkeeperAnimation("calm", "reset", "center", null).name
    ]);

    expect([...produced].sort()).toEqual([...GOALKEEPER_ANIMATION_NAMES].sort());
  });

  it("AC2 changes eyes, brow, mouth, and body tension for each mood", () => {
    const moods: readonly GoalkeeperMood[] = ["calm", "focused", "nervous", "aggressive", "desperate"];
    const expressions = moods.map((mood) => getGoalkeeperAnimation(mood, "focus", "center", null).facialExpression);

    expect(expressions).toEqual(moods.map((mood) => GOALKEEPER_FACE_BY_MOOD[mood]));
    expect(new Set(expressions.map((expression) => expression.eyeShape)).size).toBe(5);
    expect(new Set(expressions.map((expression) => expression.browAngleDeg)).size).toBe(5);
    expect(new Set(expressions.map((expression) => expression.mouth)).size).toBe(5);
    expect(new Set(expressions.map((expression) => expression.bodyTension)).size).toBe(5);
  });

  it("AC3 aligns dive peak with reach timing and result animation with collision outcome", () => {
    const diveDirections: readonly DiveDirection[] = ["left", "center", "right"];

    for (const direction of diveDirections) {
      const state = getGoalkeeperAnimation("focused", "dive", direction, null);
      expect(state.reachPeakMs).toBe(state.durationMs / 2);
      expect(state.name).toBe(direction === "left" ? "dive_left" : direction === "right" ? "dive_right" : "dive_center");
    }

    expect(getGoalkeeperAnimation("focused", "result", "center", "save").name).toBe("save_contact");
    expect(getGoalkeeperAnimation("focused", "result", "center", "goal").name).toBe("goal_conceded");
    expect(getGoalkeeperAnimation("focused", "result", "center", "miss").name).toBe("miss_reaction");
  });

  it("AC4 keeps normal-flow animations short and readable", () => {
    for (const name of GOALKEEPER_ANIMATION_NAMES) {
      const state = getGoalkeeperAnimation(
        "calm",
        name === "reset" ? "reset" : name.startsWith("dive_") ? "dive" : "result",
        "center",
        name === "save_contact" ? "save" : name === "goal_conceded" ? "goal" : "miss"
      );
      expect(isReadableDuration(state)).toBe(true);
      expect(state.durationMs).toBeLessThanOrEqual(600);
    }
  });

  it("AC5 uses lightweight body rig and procedural face and dive impact overlays", () => {
    const state = getGoalkeeperAnimation("desperate", "dive", "right", null);

    expect(state.bodyRig).toBe("lightweight-rig");
    expect(state.faceOverlay).toBe("procedural");
    expect(state.diveImpact).toBe("procedural-squash-stretch");
    expect(state.impactScale).toBe(1.1);
  });
});
