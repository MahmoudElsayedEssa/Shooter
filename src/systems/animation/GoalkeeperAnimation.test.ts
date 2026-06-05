import { describe, expect, it } from "vitest";
import {
  createKeeperPoseManifest,
  getKeeperPoseSequence,
  planKeeperPresentation,
  type KeeperAnimationDirectorInput,
  type KeeperAnimationLayout,
  type KeeperPoseManifest,
  type KeeperTextureKeys
} from "./GoalkeeperAnimation";

const TEXTURES: KeeperTextureKeys = {
  idle: "keeper-idle",
  ready: "keeper-ready",
  readyWide: "keeper-ready-wide",
  anticipateLeft: "keeper-anticipate-left",
  anticipateRight: "keeper-anticipate-right",
  diveLeftLow: "keeper-dive-left-low",
  diveLeftMid: "keeper-dive-left-mid",
  diveLeftHigh: "keeper-dive-left-high",
  diveRightLow: "keeper-dive-right-low",
  diveRightMid: "keeper-dive-right-mid",
  diveRightHigh: "keeper-dive-right-high",
  centerBlock: "keeper-center-block",
  miss: "keeper-miss",
  recover: "keeper-recover",
  celebrate: "keeper-celebrate",
  saveCelebrate: "keeper-save-celebrate"
};

const LAYOUT: KeeperAnimationLayout = {
  centerX: 480,
  keeperY: 250,
  diveY: 258,
  leftDiveX: 355,
  rightDiveX: 605,
  goalTopY: 95,
  highCornerY: 167
};

const MANIFEST = createKeeperPoseManifest(TEXTURES);
const AVAILABLE = Object.values(TEXTURES);

function baseInput(overrides: Partial<KeeperAnimationDirectorInput> = {}): KeeperAnimationDirectorInput {
  return {
    mood: "calm",
    pressure: 0.4,
    diveDirection: "left",
    outcome: "save",
    contactPoint: { x: 350, y: 220 },
    contactT: 0.68,
    reactionMs: 150,
    predictedTarget: { x: 350, y: 180 },
    shotIndex: 1,
    progress: 0,
    flightDurationMs: 900,
    layout: LAYOUT,
    manifest: MANIFEST,
    availableTextureKeys: AVAILABLE,
    ...overrides
  };
}

function requestedSequence(overrides: Partial<KeeperAnimationDirectorInput> = {}): readonly string[] {
  return getKeeperPoseSequence(
    baseInput(overrides),
    [0.05, 0.4, 0.69, 0.9]
  ).map((frame) => frame.requestedPose);
}

function framesUntilContact(overrides: Partial<KeeperAnimationDirectorInput> = {}) {
  return getKeeperPoseSequence(
    baseInput(overrides),
    [0, 0.05, 0.14, 0.22, 0.34, 0.48, 0.62, 0.68]
  );
}

function expectMonotonic(values: readonly number[], direction: "increasing" | "decreasing"): void {
  for (let i = 1; i < values.length; i++) {
    if (direction === "increasing") {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1] - 0.001);
    } else {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1] + 0.001);
    }
  }
}

describe("GoalkeeperAnimation director", () => {
  it("save_left maps through anticipation, dive, contact, and recover", () => {
    expect(requestedSequence()).toEqual([
      "anticipate_left",
      "dive_left",
      "save_left_contact",
      "recover"
    ]);
  });

  it("right save body X is monotonic increasing from launch to contact", () => {
    const frames = framesUntilContact({
      diveDirection: "right",
      contactPoint: { x: 610, y: 220 },
      predictedTarget: { x: 610, y: 180 }
    });
    expectMonotonic(frames.map((frame) => frame.x), "increasing");
    expect(frames.every((frame) => frame.x >= LAYOUT.centerX)).toBe(true);
  });

  it("left save body X is monotonic decreasing from launch to contact", () => {
    const frames = framesUntilContact();
    expectMonotonic(frames.map((frame) => frame.x), "decreasing");
    expect(frames.every((frame) => frame.x <= LAYOUT.centerX)).toBe(true);
  });

  it("center save stays centered on its own path", () => {
    const frames = framesUntilContact({
      diveDirection: "center",
      contactPoint: { x: 480, y: 220 },
      predictedTarget: { x: 480, y: 180 }
    });
    for (const frame of frames) {
      expect(frame.x).toBe(LAYOUT.centerX);
    }
  });

  it("save_right maps through the right-side poses", () => {
    const frames = getKeeperPoseSequence(baseInput({
      diveDirection: "right",
      contactPoint: { x: 610, y: 220 },
      predictedTarget: { x: 610, y: 180 }
    }), [0.05, 0.4, 0.69, 0.9]);

    expect(frames.map((frame) => frame.requestedPose)).toEqual([
      "anticipate_right",
      "dive_right",
      "save_right_contact",
      "recover"
    ]);
    expect(frames[1].flipX).toBe(false);
    expect(frames[2].flipX).toBe(false);
    expect(frames[1].textureKey).toBe(TEXTURES.diveRightMid);
    expect(frames[2].textureKey).toBe(TEXTURES.diveRightMid);
  });

  it("left-side saves use the texture that visually leads left", () => {
    const frames = getKeeperPoseSequence(baseInput(), [0.4, 0.69]);

    expect(frames.map((frame) => frame.requestedPose)).toEqual([
      "dive_left",
      "save_left_contact"
    ]);
    expect(frames.every((frame) => !frame.flipX)).toBe(true);
    expect(frames[0].textureKey).toBe(TEXTURES.diveLeftMid);
    expect(frames[1].textureKey).toBe(TEXTURES.diveLeftMid);
  });

  it("save_center maps through center poses", () => {
    expect(requestedSequence({
      diveDirection: "center",
      contactPoint: { x: 480, y: 220 },
      predictedTarget: { x: 480, y: 180 }
    })).toEqual([
      "anticipate_center",
      "dive_center",
      "save_center_contact",
      "recover"
    ]);
  });

  it("goal maps to goal_conceded", () => {
    const frame = planKeeperPresentation(baseInput({
      outcome: "goal",
      contactPoint: null,
      contactT: null,
      progress: 1
    }));
    expect(frame.phase).toBe("goal_conceded");
    expect(frame.requestedPose).toBe("goal_conceded");
  });

  it("miss maps to miss_reaction", () => {
    const frame = planKeeperPresentation(baseInput({
      outcome: "miss",
      contactPoint: null,
      contactT: null,
      progress: 1
    }));
    expect(frame.phase).toBe("miss_reaction");
    expect(frame.requestedPose).toBe("miss_reaction");
  });

  it("missing pose textures fall back safely", () => {
    const manifestWithMissingDive: KeeperPoseManifest = createKeeperPoseManifest({
      ...TEXTURES,
      diveLeftMid: "missing-dive-left-mid"
    });
    const frame = planKeeperPresentation(baseInput({
      manifest: manifestWithMissingDive,
      availableTextureKeys: AVAILABLE,
      progress: 0.4
    }));
    expect(frame.requestedPose).toBe("dive_left");
    expect(frame.selectedPose).toBe("ready");
    expect(frame.fallbackPoseUsed).toBe("ready");
    expect(frame.textureKey).toBe(TEXTURES.ready);
  });

  it("high-corner side save stays visually trusted with the mirrored side pose", () => {
    const frame = planKeeperPresentation(baseInput({
      contactPoint: { x: 325, y: 128 },
      progress: 0.69
    }));
    expect(frame.phase).toBe("contact");
    expect(frame.visualSaveTrusted).toBe(true);
    expect(frame.saveHeightLane).toBe("high");
    expect(frame.textureKey).toBe(TEXTURES.diveLeftHigh);
  });

  it("visual contact anchor error is computed", () => {
    const frame = planKeeperPresentation(baseInput({ progress: 0.69 }));
    expect(frame.phase).toBe("contact");
    expect(frame.contactAnchorWorld).not.toBeNull();
    expect(frame.contactAnchorDistancePx).not.toBeNull();
    expect(frame.contactAnchorDistancePx).toBeLessThanOrEqual(1);
  });

  it("high right save raises the body and rotates toward the high right lane", () => {
    const frame = planKeeperPresentation(baseInput({
      diveDirection: "right",
      contactPoint: { x: 610, y: 145 },
      predictedTarget: { x: 610, y: 145 },
      progress: 0.69
    }));

    expect(frame.phase).toBe("contact");
    expect(frame.visualSaveTrusted).toBe(true);
    expect(frame.saveHeightLane).toBe("high");
    expect(frame.y).toBeLessThan(LAYOUT.diveY);
    expect(frame.rotation).toBeLessThan(0);
    expect(frame.flipX).toBe(false);
    expect(frame.textureKey).toBe(TEXTURES.diveRightHigh);
  });

  it("high left save raises the body and mirrors the high right shape", () => {
    const frame = planKeeperPresentation(baseInput({
      diveDirection: "left",
      contactPoint: { x: 350, y: 145 },
      predictedTarget: { x: 350, y: 145 },
      progress: 0.69
    }));

    expect(frame.phase).toBe("contact");
    expect(frame.visualSaveTrusted).toBe(true);
    expect(frame.saveHeightLane).toBe("high");
    expect(frame.y).toBeLessThan(LAYOUT.diveY);
    expect(frame.rotation).toBeGreaterThan(0);
    expect(frame.textureKey).toBe(TEXTURES.diveLeftHigh);
  });

  it("impossible cross-body pose/contact combinations are not visually trusted", () => {
    const frame = planKeeperPresentation(baseInput({
      diveDirection: "right",
      contactPoint: { x: 350, y: 220 },
      predictedTarget: { x: 350, y: 180 },
      progress: 0.69
    }));
    expect(frame.visualSaveTrusted).toBe(false);
    expect(frame.phase).toBe("landing_recovery");
    expect(frame.x).toBeGreaterThanOrEqual(LAYOUT.centerX);
  });

  it("does not generate detached glove phases or poses", () => {
    const frames = getKeeperPoseSequence(baseInput(), [0, 0.05, 0.4, 0.69, 0.9]);
    for (const frame of frames) {
      expect(frame.phase).not.toContain("glove");
      expect(frame.requestedPose).not.toContain("glove");
      if (frame.phase === "contact") {
        expect(frame.contactAnchorDistancePx).toBeLessThanOrEqual(1);
      }
    }
  });

  it("scaling returns to canonical value after recovery", () => {
    const frame = planKeeperPresentation(baseInput({ progress: 1 }));
    expect(frame.phase).toBe("landing_recovery");
    expect(frame.scale).toBe(1);
  });

  it("reset returns canonical keeper presentation", () => {
    const frame = planKeeperPresentation(baseInput({
      mood: "calm",
      outcome: "miss",
      contactPoint: null,
      contactT: null,
      diveDirection: "center",
      progress: 0
    }));
    expect(frame.phase).toBe("idle");
    expect(frame.selectedPose).toBe("idle");
    expect(frame.x).toBe(LAYOUT.centerX);
    expect(frame.y).toBe(LAYOUT.keeperY);
    expect(frame.rotation).toBe(0);
    expect(frame.scale).toBe(1);
    expect(frame.tint).toBeNull();
  });

  it("mood changes selected idle and anticipation style", () => {
    const focusedIdle = planKeeperPresentation(baseInput({ mood: "focused", progress: 0 }));
    const nervousIdle = planKeeperPresentation(baseInput({ mood: "nervous", progress: 0 }));
    const focusedAnticipation = planKeeperPresentation(baseInput({ mood: "focused", progress: 0.05 }));
    const nervousAnticipation = planKeeperPresentation(baseInput({ mood: "nervous", progress: 0.05 }));

    expect(focusedIdle.selectedPose).toBe("focused_idle");
    expect(nervousIdle.selectedPose).toBe("nervous_idle");
    expect(focusedIdle.tint).not.toBe(nervousIdle.tint);
    expect(focusedAnticipation.x).not.toBe(nervousAnticipation.x);
    expect(focusedAnticipation.moodEffect.anticipationBiasMs).toBeLessThan(nervousAnticipation.moodEffect.anticipationBiasMs);
    expect(focusedAnticipation.moodEffect.launchCleanliness).toBeGreaterThan(nervousAnticipation.moodEffect.launchCleanliness);
  });
});
