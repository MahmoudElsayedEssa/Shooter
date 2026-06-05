import { describe, it, expect } from "vitest";
import type { Point2D } from "../../core/types";
import {
  planPuppetSave,
  selectGlove,
  getPhaseTiming,
  computePuppetPhase,
  MAX_VISUAL_ARM_REACH_PX,
  PUPPET_MOOD_TIMING,
  type PuppetPlan,
  type PuppetMood
} from "./KeeperPuppetTypes";

// ─── Helpers ───

const BODY_CENTER: Point2D = { x: 480, y: 250 };
const DIVE_TARGET_LEFT: Point2D = { x: 340, y: 258 };
const DIVE_TARGET_RIGHT: Point2D = { x: 620, y: 258 };

function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// ─── Tests ───

describe("KeeperPuppetTypes — Body-Driven", () => {
  describe("planPuppetSave", () => {
    it("save with contactPoint creates allowed plan", () => {
      const plan = planPuppetSave(
        "save", { x: 350, y: 200 }, "left",
        BODY_CENTER, DIVE_TARGET_LEFT.x, DIVE_TARGET_LEFT.y, "calm"
      );
      expect(plan.allowed).toBe(true);
      expect(plan.rejectReason).toBeNull();
      expect(plan.clampedContactWorld).not.toBeNull();
      expect(plan.rawContactPoint).toEqual({ x: 350, y: 200 });
    });

    it("save without contactPoint is rejected", () => {
      const plan = planPuppetSave(
        "save", null, "left",
        BODY_CENTER, DIVE_TARGET_LEFT.x, DIVE_TARGET_LEFT.y, "calm"
      );
      expect(plan.allowed).toBe(false);
      expect(plan.rejectReason).toBe("contactPoint is null");
      expect(plan.clampedContactWorld).toBeNull();
      expect(plan.selectedGlove).toBeNull();
    });

    it("goal outcome never creates save_contact", () => {
      const plan = planPuppetSave(
        "goal", { x: 400, y: 190 }, "left",
        BODY_CENTER, DIVE_TARGET_LEFT.x, DIVE_TARGET_LEFT.y, "calm"
      );
      expect(plan.allowed).toBe(false);
      expect(plan.rejectReason).toContain("goal");
      expect(plan.selectedGlove).toBeNull();
      expect(plan.clampedContactWorld).toBeNull();
    });

    it("miss outcome never creates save_contact", () => {
      const plan = planPuppetSave(
        "miss", null, "right",
        BODY_CENTER, DIVE_TARGET_RIGHT.x, DIVE_TARGET_RIGHT.y, "calm"
      );
      expect(plan.allowed).toBe(false);
      expect(plan.selectedGlove).toBeNull();
    });

    it("no glove marker for goal", () => {
      const plan = planPuppetSave(
        "goal", { x: 400, y: 190 }, "right",
        BODY_CENTER, DIVE_TARGET_RIGHT.x, DIVE_TARGET_RIGHT.y, "calm"
      );
      expect(plan.clampedContactWorld).toBeNull();
      expect(plan.shoulderAnchor).toBeNull();
    });

    it("no glove marker for miss", () => {
      const plan = planPuppetSave(
        "miss", null, "left",
        BODY_CENTER, DIVE_TARGET_LEFT.x, DIVE_TARGET_LEFT.y, "calm"
      );
      expect(plan.clampedContactWorld).toBeNull();
      expect(plan.shoulderAnchor).toBeNull();
    });
  });

  describe("visual arm reach constraint", () => {
    it("contact within arm reach: clampedContact equals raw contact", () => {
      // Place contact very close to where body will be
      const nearContact: Point2D = { x: 350, y: 230 };
      const plan = planPuppetSave(
        "save", nearContact, "left",
        BODY_CENTER, DIVE_TARGET_LEFT.x, DIVE_TARGET_LEFT.y, "calm"
      );
      expect(plan.allowed).toBe(true);
      expect(plan.validVisualContact).toBe(true);
      expect(plan.clampedContactWorld).toEqual(nearContact);
    });

    it("clamped contact never exceeds MAX_VISUAL_ARM_REACH_PX from shoulder", () => {
      // Far contact that would exceed arm reach
      const farContact: Point2D = { x: 280, y: 120 };
      const plan = planPuppetSave(
        "save", farContact, "left",
        BODY_CENTER, DIVE_TARGET_LEFT.x, DIVE_TARGET_LEFT.y, "calm"
      );
      expect(plan.allowed).toBe(true);
      expect(plan.shoulderAnchor).not.toBeNull();
      if (plan.shoulderAnchor && plan.clampedContactWorld) {
        const armDist = dist(plan.shoulderAnchor, plan.clampedContactWorld);
        expect(armDist).toBeLessThanOrEqual(MAX_VISUAL_ARM_REACH_PX + 0.01);
      }
    });

    it("far contact requires body repositioning (body moves to contact lane)", () => {
      const plan = planPuppetSave(
        "save", { x: 300, y: 180 }, "left",
        BODY_CENTER, DIVE_TARGET_LEFT.x, DIVE_TARGET_LEFT.y, "calm"
      );
      // Body should NOT stay at center — it should move toward contact
      expect(plan.bodyTargetX).toBeLessThan(BODY_CENTER.x);
    });

    it("left save keeps contact attached to left side of body", () => {
      const plan = planPuppetSave(
        "save", { x: 350, y: 220 }, "left",
        BODY_CENTER, DIVE_TARGET_LEFT.x, DIVE_TARGET_LEFT.y, "calm"
      );
      expect(plan.selectedGlove).toBe("left");
      expect(plan.shoulderAnchor).not.toBeNull();
      // Shoulder should be on the left side of body
      if (plan.shoulderAnchor) {
        expect(plan.shoulderAnchor.x).toBeLessThan(plan.bodyTargetX);
      }
    });

    it("right save keeps contact attached to right side of body", () => {
      const plan = planPuppetSave(
        "save", { x: 600, y: 220 }, "right",
        BODY_CENTER, DIVE_TARGET_RIGHT.x, DIVE_TARGET_RIGHT.y, "calm"
      );
      expect(plan.selectedGlove).toBe("right");
      expect(plan.shoulderAnchor).not.toBeNull();
      // Shoulder should be on the right side of body
      if (plan.shoulderAnchor) {
        expect(plan.shoulderAnchor.x).toBeGreaterThan(plan.bodyTargetX);
      }
    });

    it("impossible visual contact is flagged but plan is still allowed", () => {
      // Extremely far contact
      const veryFar: Point2D = { x: 100, y: 50 };
      const plan = planPuppetSave(
        "save", veryFar, "left",
        BODY_CENTER, DIVE_TARGET_LEFT.x, DIVE_TARGET_LEFT.y, "calm"
      );
      expect(plan.allowed).toBe(true); // collision says save
      // But contact is clamped, so distance is valid
      if (plan.shoulderAnchor && plan.clampedContactWorld) {
        const armDist = dist(plan.shoulderAnchor, plan.clampedContactWorld);
        expect(armDist).toBeLessThanOrEqual(MAX_VISUAL_ARM_REACH_PX + 0.01);
      }
    });
  });

  describe("selectGlove", () => {
    it("left contact selects left glove", () => {
      expect(selectGlove({ x: 350, y: 200 }, BODY_CENTER)).toBe("left");
    });

    it("right contact selects right glove", () => {
      expect(selectGlove({ x: 620, y: 200 }, BODY_CENTER)).toBe("right");
    });

    it("center contact selects left (≤ center)", () => {
      expect(selectGlove({ x: 480, y: 200 }, BODY_CENTER)).toBe("left");
    });
  });

  describe("getPhaseTiming", () => {
    it("returns timing for each mood", () => {
      const moods: PuppetMood[] = ["calm", "focused", "nervous", "aggressive", "desperate"];
      for (const mood of moods) {
        const timing = getPhaseTiming(mood);
        expect(timing.anticipationEnd).toBeGreaterThan(0);
        expect(timing.anticipationEnd).toBeLessThanOrEqual(0.25);
      }
    });

    it("focused has faster anticipation than nervous", () => {
      expect(getPhaseTiming("focused").anticipationEnd).toBeLessThan(
        getPhaseTiming("nervous").anticipationEnd
      );
    });

    it("nervous has jitter, calm does not", () => {
      expect(PUPPET_MOOD_TIMING.nervous.jitterAmplitude).toBeGreaterThan(0);
      expect(PUPPET_MOOD_TIMING.calm.jitterAmplitude).toBe(0);
    });
  });

  describe("computePuppetPhase", () => {
    const basePlan: PuppetPlan = {
      allowed: true,
      validVisualContact: true,
      rejectReason: null,
      selectedGlove: "left",
      clampedContactWorld: { x: 350, y: 200 },
      rawContactPoint: { x: 350, y: 200 },
      bodyTargetX: 370,
      bodyTargetY: 245,
      shoulderAnchor: { x: 352, y: 225 },
      visualArmDistance: 25,
      diveDirection: "left",
      timing: PUPPET_MOOD_TIMING.calm,
      outcome: "save"
    };

    it("returns idle at progress 0", () => {
      expect(computePuppetPhase(0, basePlan, 0.73)).toBe("idle");
    });

    it("returns anticipation at early progress", () => {
      expect(computePuppetPhase(0.05, basePlan, 0.73)).toBe("anticipation");
    });

    it("returns dive_travel between anticipation and contactT", () => {
      expect(computePuppetPhase(0.4, basePlan, 0.73)).toBe("dive_travel");
    });

    it("returns save_contact at contactT", () => {
      expect(computePuppetPhase(0.73, basePlan, 0.73)).toBe("save_contact");
    });

    it("returns recover well after contactT", () => {
      expect(computePuppetPhase(0.95, basePlan, 0.73)).toBe("recover");
    });

    it("without save allowed, no save_contact phase ever", () => {
      const noSavePlan: PuppetPlan = {
        ...basePlan,
        allowed: false,
        validVisualContact: false,
        selectedGlove: null,
        clampedContactWorld: null,
        rawContactPoint: null,
        shoulderAnchor: null,
        visualArmDistance: 0,
      };
      for (let t = 0; t <= 1.0; t += 0.05) {
        expect(computePuppetPhase(t, noSavePlan, null)).not.toBe("save_contact");
      }
    });

    it("wrong-side dive (goal outcome) never enters save_contact", () => {
      const wrongSidePlan = planPuppetSave(
        "goal", null, "right",
        BODY_CENTER, DIVE_TARGET_RIGHT.x, DIVE_TARGET_RIGHT.y, "calm"
      );
      for (let t = 0; t <= 1.0; t += 0.05) {
        expect(computePuppetPhase(t, wrongSidePlan, null)).not.toBe("save_contact");
      }
    });
  });

  describe("reset hides markers", () => {
    it("rejected plan has no contact markers", () => {
      const plan = planPuppetSave(
        "goal", { x: 400, y: 200 }, "left",
        BODY_CENTER, DIVE_TARGET_LEFT.x, DIVE_TARGET_LEFT.y, "calm"
      );
      expect(plan.clampedContactWorld).toBeNull();
      expect(plan.shoulderAnchor).toBeNull();
      expect(plan.selectedGlove).toBeNull();
    });
  });
});
