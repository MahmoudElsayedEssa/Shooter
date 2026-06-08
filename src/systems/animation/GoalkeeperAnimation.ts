import { clamp, lerp, smoothStep } from "../../core/math";
import type { Point2D } from "../../core/types";
import type { DiveDirection, GoalkeeperMood, ShotResult } from "../goalkeeper/GoalkeeperAI";

export type KeeperAnimationPhase =
  | "idle"
  | "mood_idle"
  | "anticipation"
  | "launch"
  | "flight_stretch"
  | "contact"
  | "goal_conceded"
  | "miss_reaction"
  | "landing_recovery"
  | "reset";

export type KeeperSaveHeightLane = "low" | "mid" | "high";

export type KeeperPoseId =
  | "idle"
  | "ready"
  | "focused_idle"
  | "nervous_idle"
  | "aggressive_idle"
  | "desperate_idle"
  | "anticipate_left"
  | "anticipate_right"
  | "anticipate_center"
  | "dive_left"
  | "dive_right"
  | "dive_center"
  | "save_left_contact"
  | "save_right_contact"
  | "save_center_contact"
  | "goal_conceded"
  | "miss_reaction"
  | "recover"
  | "celebrate"
  | "save_celebrate";

export interface KeeperTextureKeys {
  readonly idle: string;
  readonly ready: string;
  readonly readyWide: string;
  readonly anticipateLeft: string;
  readonly anticipateRight: string;
  readonly diveLeftLow: string;
  readonly diveLeftMid: string;
  readonly diveLeftHigh: string;
  readonly diveRightLow: string;
  readonly diveRightMid: string;
  readonly diveRightHigh: string;
  readonly centerBlock: string;
  readonly miss: string;
  readonly recover: string;
  readonly celebrate: string;
  readonly saveCelebrate: string;
}

export interface KeeperPoseDefinition {
  readonly id: KeeperPoseId;
  readonly textureKey: string;
  readonly textureByHeightLane: Readonly<Partial<Record<KeeperSaveHeightLane, string>>>;
  readonly fallbackTextureKey: string;
  readonly fallbackPoseId: KeeperPoseId;
  readonly displayHeight: number;
  readonly origin: Point2D;
  readonly contactAnchor: Point2D | null;
  readonly contactAnchorByHeightLane: Readonly<Partial<Record<KeeperSaveHeightLane, Point2D>>>;
  readonly allowedFlipX: boolean;
  readonly defaultRotation: number;
  readonly moodTintSupport: boolean;
  readonly lanes: readonly DiveDirection[];
  readonly side: DiveDirection | "any";
  readonly supportsHighCornerSave: boolean;
  readonly flipX: boolean;
}

export type KeeperPoseManifest = Readonly<Record<KeeperPoseId, KeeperPoseDefinition>>;

export interface KeeperAnimationLayout {
  readonly centerX: number;
  readonly keeperY: number;
  readonly diveY: number;
  readonly leftDiveX: number;
  readonly rightDiveX: number;
  readonly goalTopY: number;
  readonly highCornerY: number;
}

export interface KeeperAnimationDirectorInput {
  readonly mood: GoalkeeperMood;
  readonly pressure: number;
  readonly diveDirection: DiveDirection;
  readonly outcome: ShotResult;
  readonly contactPoint: Point2D | null;
  readonly contactT: number | null;
  readonly reactionMs: number;
  readonly predictedTarget: Point2D;
  readonly shotIndex: number;
  readonly progress: number;
  readonly flightDurationMs: number;
  readonly layout: KeeperAnimationLayout;
  readonly manifest: KeeperPoseManifest;
  readonly availableTextureKeys?: ReadonlySet<string> | readonly string[];
}

export interface KeeperPresentationFrame {
  readonly phase: KeeperAnimationPhase;
  readonly selectedPose: KeeperPoseId;
  readonly requestedPose: KeeperPoseId;
  readonly fallbackPoseUsed: KeeperPoseId | null;
  readonly textureKey: string;
  readonly x: number;
  readonly y: number;
  readonly displayHeight: number;
  readonly origin: Point2D;
  readonly rotation: number;
  readonly scale: number;
  readonly flipX: boolean;
  readonly tint: number | null;
  readonly shadowWidthScale: number;
  readonly shadowAlpha: number;
  readonly shadowOffsetY: number;
  readonly saveHeightLane: KeeperSaveHeightLane;
  readonly moodEffect: KeeperMoodEffect;
  readonly visualSaveTrusted: boolean;
  readonly contactAnchorLocal: Point2D | null;
  readonly contactAnchorWorld: Point2D | null;
  readonly contactAnchorDistancePx: number | null;
  readonly shotIndex: number;
  readonly pressure: number;
  readonly diveDirection: DiveDirection;
  readonly outcome: ShotResult;
}

export interface KeeperMoodEffect {
  readonly mood: GoalkeeperMood;
  readonly tint: number | null;
  readonly anticipationBiasMs: number;
  readonly jitterPx: number;
  readonly leanPx: number;
  readonly riskScale: number;
  readonly launchCleanliness: number;
  readonly recoveryMessPx: number;
}

export const KEEPER_POSE_IDS: readonly KeeperPoseId[] = [
  "idle",
  "ready",
  "focused_idle",
  "nervous_idle",
  "aggressive_idle",
  "desperate_idle",
  "anticipate_left",
  "anticipate_right",
  "anticipate_center",
  "dive_left",
  "dive_right",
  "dive_center",
  "save_left_contact",
  "save_right_contact",
  "save_center_contact",
  "goal_conceded",
  "miss_reaction",
  "recover"
] as const;

const MOOD_EFFECTS: Readonly<Record<GoalkeeperMood, KeeperMoodEffect>> = {
  calm: {
    mood: "calm",
    tint: null,
    anticipationBiasMs: 0,
    jitterPx: 0,
    leanPx: 0,
    riskScale: 1,
    launchCleanliness: 1,
    recoveryMessPx: 0
  },
  focused: {
    mood: "focused",
    tint: 0xbbddff,
    anticipationBiasMs: -35,
    jitterPx: 0,
    leanPx: 3,
    riskScale: 0.92,
    launchCleanliness: 1.08,
    recoveryMessPx: 0
  },
  nervous: {
    mood: "nervous",
    tint: 0xffd8a8,
    anticipationBiasMs: 55,
    jitterPx: 2,
    leanPx: -2,
    riskScale: 0.86,
    launchCleanliness: 0.84,
    recoveryMessPx: 4
  },
  aggressive: {
    mood: "aggressive",
    tint: 0xddffbb,
    anticipationBiasMs: -60,
    jitterPx: 0,
    leanPx: 8,
    riskScale: 1.12,
    launchCleanliness: 0.94,
    recoveryMessPx: 2
  },
  desperate: {
    mood: "desperate",
    tint: 0xffbbbb,
    anticipationBiasMs: -20,
    jitterPx: 1,
    leanPx: 6,
    riskScale: 1.22,
    launchCleanliness: 0.78,
    recoveryMessPx: 7
  }
} as const;

const CONTACT_TRUST_MAX_DISTANCE_PX = 18;

export function createKeeperPoseManifest(textureKeys: KeeperTextureKeys): KeeperPoseManifest {
  const idle = textureKeys.idle;
  const ready = textureKeys.ready;
  const readyWide = textureKeys.readyWide;
  const anticipateLeft = textureKeys.anticipateLeft;
  const anticipateRight = textureKeys.anticipateRight;
  const centerBlock = textureKeys.centerBlock;
  const miss = textureKeys.miss;
  const recover = textureKeys.recover;
  const celebrate = textureKeys.celebrate;
  const saveCelebrate = textureKeys.saveCelebrate;
  const leftDiveTextures = {
    low: textureKeys.diveLeftLow,
    mid: textureKeys.diveLeftMid,
    high: textureKeys.diveLeftHigh
  } as const;
  const rightDiveTextures = {
    low: textureKeys.diveRightLow,
    mid: textureKeys.diveRightMid,
    high: textureKeys.diveRightHigh
  } as const;
  const leftDiveAnchors = {
    low: { x: -58, y: 8 },
    mid: { x: -60, y: -8 },
    high: { x: -54, y: -32 }
  } as const;
  const rightDiveAnchors = {
    low: { x: 58, y: 8 },
    mid: { x: 60, y: -8 },
    high: { x: 54, y: -32 }
  } as const;

  return {
    idle: pose("idle", idle, idle, "idle", 155, null, {}, {}, false, 0, ["center"], "center", true),
    ready: pose("ready", ready, idle, "idle", 155, null, {}, {}, false, 0, ["left", "center", "right"], "any", true),
    focused_idle: pose("focused_idle", readyWide, idle, "ready", 150, null, {}, {}, false, 0, ["center"], "center", true),
    nervous_idle: pose("nervous_idle", ready, idle, "ready", 155, null, {}, {}, false, 0, ["center"], "center", true),
    aggressive_idle: pose("aggressive_idle", readyWide, idle, "ready", 150, null, {}, {}, false, 0.02, ["center"], "center", true),
    desperate_idle: pose("desperate_idle", readyWide, idle, "ready", 152, null, {}, {}, false, 0, ["center"], "center", true),
    anticipate_left: pose("anticipate_left", anticipateLeft, ready, "ready", 150, null, {}, {}, false, -0.03, ["left"], "left", true),
    anticipate_right: pose("anticipate_right", anticipateRight, ready, "ready", 150, null, {}, {}, false, 0.03, ["right"], "right", true),
    anticipate_center: pose("anticipate_center", readyWide, ready, "ready", 150, null, {}, {}, false, 0, ["center"], "center", true),
    dive_left: pose("dive_left", textureKeys.diveLeftMid, ready, "ready", 120, leftDiveAnchors.mid, leftDiveTextures, leftDiveAnchors, false, 0.02, ["left"], "left", true),
    dive_right: pose("dive_right", textureKeys.diveRightMid, ready, "ready", 120, rightDiveAnchors.mid, rightDiveTextures, rightDiveAnchors, false, -0.02, ["right"], "right", true),
    dive_center: pose("dive_center", centerBlock, ready, "ready", 135, { x: 0, y: -40 }, {}, {}, false, 0, ["center"], "center", true),
    save_left_contact: pose("save_left_contact", textureKeys.diveLeftMid, textureKeys.diveLeftMid, "dive_left", 120, leftDiveAnchors.mid, leftDiveTextures, leftDiveAnchors, false, 0.02, ["left"], "left", true),
    save_right_contact: pose("save_right_contact", textureKeys.diveRightMid, textureKeys.diveRightMid, "dive_right", 120, rightDiveAnchors.mid, rightDiveTextures, rightDiveAnchors, false, -0.02, ["right"], "right", true),
    save_center_contact: pose("save_center_contact", centerBlock, ready, "dive_center", 135, { x: 0, y: -40 }, {}, {}, false, 0, ["center"], "center", true),
    goal_conceded: pose("goal_conceded", miss, ready, "ready", 152, null, {}, {}, false, 0.12, ["left", "center", "right"], "any", true),
    miss_reaction: pose("miss_reaction", miss, ready, "ready", 152, null, {}, {}, false, 0, ["left", "center", "right"], "any", true),
    recover: pose("recover", recover, idle, "ready", 150, null, {}, {}, false, 0, ["left", "center", "right"], "any", true),
    celebrate: pose("celebrate", celebrate, idle, "idle", 160, null, {}, {}, false, 0, ["center"], "center", true),
    save_celebrate: pose("save_celebrate", saveCelebrate, idle, "idle", 160, null, {}, {}, false, 0, ["center"], "center", true)
  } as const;
}

export function planKeeperPresentation(input: KeeperAnimationDirectorInput): KeeperPresentationFrame {
  const progress = clamp(input.progress, 0, 1);
  const moodEffect = MOOD_EFFECTS[input.mood];
  const phase = selectAnimationPhase(input, moodEffect, progress);
  const requestedPose = selectPoseForPhase(input, phase);
  const saveHeightLane = getSaveHeightLane(input);
  const visualSaveTrusted = isVisualSaveTrusted(input, requestedPose);
  const resolvedPose = resolveKeeperPose(input.manifest, requestedPose, input.availableTextureKeys, saveHeightLane);
  const target = getTargetPosition(input, requestedPose, visualSaveTrusted);
  const position = getFramePosition(input, phase, progress, target, moodEffect);
  const poseDef = input.manifest[resolvedPose.poseId];
  const scale = getFrameScale(input, phase, progress, moodEffect);
  const shadow = getFrameShadow(phase, scale, position.y - input.layout.keeperY, input.diveDirection, saveHeightLane);
  const contactAnchor = getPoseContactAnchor(poseDef, saveHeightLane);
  const anchorWorld = contactAnchor === null
    ? null
    : {
        x: position.x + contactAnchor.x,
        y: position.y + contactAnchor.y
      };
  const anchorDistance = anchorWorld !== null && input.contactPoint !== null
    ? Math.hypot(input.contactPoint.x - anchorWorld.x, input.contactPoint.y - anchorWorld.y)
    : null;

  return {
    phase,
    selectedPose: resolvedPose.poseId,
    requestedPose,
    fallbackPoseUsed: resolvedPose.fallbackPoseUsed,
    textureKey: resolvedPose.textureKey,
    x: position.x,
    y: position.y,
    displayHeight: poseDef.displayHeight,
    origin: poseDef.origin,
    rotation: getFrameRotation(input.diveDirection, phase, requestedPose, progress, poseDef.defaultRotation, saveHeightLane),
    scale,
    flipX: poseDef.flipX,
    tint: poseDef.moodTintSupport ? moodEffect.tint : null,
    shadowWidthScale: shadow.widthScale,
    shadowAlpha: shadow.alpha,
    shadowOffsetY: shadow.offsetY,
    saveHeightLane,
    moodEffect,
    visualSaveTrusted,
    contactAnchorLocal: contactAnchor,
    contactAnchorWorld: anchorWorld,
    contactAnchorDistancePx: anchorDistance,
    shotIndex: input.shotIndex,
    pressure: input.pressure,
    diveDirection: input.diveDirection,
    outcome: input.outcome
  };
}

export function getKeeperPoseSequence(
  input: Omit<KeeperAnimationDirectorInput, "progress">,
  samples: readonly number[]
): readonly KeeperPresentationFrame[] {
  return samples.map((progress) => planKeeperPresentation({ ...input, progress }));
}

function pose(
  id: KeeperPoseId,
  textureKey: string,
  fallbackTextureKey: string,
  fallbackPoseId: KeeperPoseId,
  displayHeight: number,
  contactAnchor: Point2D | null,
  textureByHeightLane: Readonly<Partial<Record<KeeperSaveHeightLane, string>>>,
  contactAnchorByHeightLane: Readonly<Partial<Record<KeeperSaveHeightLane, Point2D>>>,
  allowedFlipX: boolean,
  defaultRotation: number,
  lanes: readonly DiveDirection[],
  side: DiveDirection | "any",
  supportsHighCornerSave: boolean
): KeeperPoseDefinition {
  return {
    id,
    textureKey,
    textureByHeightLane,
    fallbackTextureKey,
    fallbackPoseId,
    displayHeight,
    origin: { x: 0.5, y: 0.5 },
    contactAnchor,
    contactAnchorByHeightLane,
    allowedFlipX,
    defaultRotation,
    moodTintSupport: true,
    lanes,
    side,
    supportsHighCornerSave,
    flipX: allowedFlipX
  };
}

function selectAnimationPhase(
  input: KeeperAnimationDirectorInput,
  moodEffect: KeeperMoodEffect,
  progress: number
): KeeperAnimationPhase {
  if (progress <= 0) {
    return input.mood === "calm" ? "idle" : "mood_idle";
  }

  const reactionT = getReactionProgress(input, moodEffect);
  const timing = getPhaseTiming(input, moodEffect);

  if (progress < reactionT) {
    return "anticipation";
  }

  if (input.outcome === "save" && input.contactT !== null) {
    if (progress < timing.launchEnd) {
      return "launch";
    }
    if (progress < input.contactT) {
      return "flight_stretch";
    }
    if (isVisualSaveTrusted(input, selectSavePose(input.diveDirection)) && progress < input.contactT + 0.14) {
      return "contact";
    }
    return "landing_recovery";
  }

  if (progress < timing.launchEnd) {
    return "launch";
  }

  if (progress < timing.flightEnd) {
    return "flight_stretch";
  }

  if (input.outcome === "goal") {
    return "goal_conceded";
  }

  // Player missed the goal — keeper is happy! Use landing_recovery (not the sad miss_reaction)
  return "landing_recovery";
}

function getReactionProgress(input: KeeperAnimationDirectorInput, moodEffect: KeeperMoodEffect): number {
  const adjustedMs = input.reactionMs + moodEffect.anticipationBiasMs;
  return clamp(adjustedMs / Math.max(1, input.flightDurationMs), 0.08, 0.24);
}

function getPhaseTiming(
  input: KeeperAnimationDirectorInput,
  moodEffect: KeeperMoodEffect
): { readonly reactionT: number; readonly launchEnd: number; readonly flightEnd: number } {
  const reactionT = getReactionProgress(input, moodEffect);
  const contactT = input.contactT ?? 0.82;
  const launchDuration = clamp(0.11 / moodEffect.launchCleanliness, 0.08, 0.16);
  const launchEnd = Math.min(contactT, reactionT + launchDuration);
  return {
    reactionT,
    launchEnd,
    flightEnd: contactT
  };
}

function selectPoseForPhase(input: KeeperAnimationDirectorInput, phase: KeeperAnimationPhase): KeeperPoseId {
  switch (phase) {
    case "idle":
      return "idle";
    case "mood_idle":
      return `${input.mood}_idle` as KeeperPoseId;
    case "anticipation":
      return input.diveDirection === "left"
        ? "anticipate_left"
        : input.diveDirection === "right"
          ? "anticipate_right"
          : "anticipate_center";
    case "launch":
    case "flight_stretch":
      return input.diveDirection === "left"
        ? "dive_left"
        : input.diveDirection === "right"
          ? "dive_right"
          : "dive_center";
    case "contact":
      return selectSavePose(input.diveDirection);
    case "goal_conceded":
      return "goal_conceded";
    case "miss_reaction":
      return "save_celebrate";
    case "landing_recovery":
      return "recover";
    case "reset":
      return "idle";
  }
}

function selectSavePose(direction: DiveDirection): KeeperPoseId {
  if (direction === "left") return "save_left_contact";
  if (direction === "right") return "save_right_contact";
  return "save_center_contact";
}

function resolveKeeperPose(
  manifest: KeeperPoseManifest,
  requestedPose: KeeperPoseId,
  availableTextureKeys: ReadonlySet<string> | readonly string[] | undefined,
  saveHeightLane: KeeperSaveHeightLane
): { readonly poseId: KeeperPoseId; readonly textureKey: string; readonly fallbackPoseUsed: KeeperPoseId | null } {
  const available = toAvailableTextureSet(availableTextureKeys);
  const requested = manifest[requestedPose];
  const requestedTextureKey = getPoseTextureKey(requested, saveHeightLane);

  if (textureExists(requestedTextureKey, available)) {
    return {
      poseId: requestedPose,
      textureKey: requestedTextureKey,
      fallbackPoseUsed: null
    };
  }

  const fallbackPose = manifest[requested.fallbackPoseId];
  const fallbackTextureKey = getPoseTextureKey(fallbackPose, saveHeightLane);
  if (textureExists(fallbackTextureKey, available)) {
    return {
      poseId: requested.fallbackPoseId,
      textureKey: fallbackTextureKey,
      fallbackPoseUsed: requested.fallbackPoseId
    };
  }

  return {
    poseId: "idle",
    textureKey: manifest.idle.textureKey,
    fallbackPoseUsed: "idle"
  };
}

function toAvailableTextureSet(
  availableTextureKeys: ReadonlySet<string> | readonly string[] | undefined
): ReadonlySet<string> | null {
  if (availableTextureKeys === undefined) {
    return null;
  }
  return "has" in availableTextureKeys
    ? availableTextureKeys
    : new Set(availableTextureKeys);
}

function textureExists(textureKey: string, availableTextureKeys: ReadonlySet<string> | null): boolean {
  return availableTextureKeys === null || availableTextureKeys.has(textureKey);
}

function getPoseTextureKey(poseDef: KeeperPoseDefinition, saveHeightLane: KeeperSaveHeightLane): string {
  return poseDef.textureByHeightLane[saveHeightLane] ?? poseDef.textureKey;
}

function getPoseContactAnchor(poseDef: KeeperPoseDefinition, saveHeightLane: KeeperSaveHeightLane): Point2D | null {
  return poseDef.contactAnchorByHeightLane[saveHeightLane] ?? poseDef.contactAnchor;
}

function isVisualSaveTrusted(input: KeeperAnimationDirectorInput, requestedPose: KeeperPoseId): boolean {
  if (input.outcome !== "save" || input.contactPoint === null || input.contactT === null) {
    return false;
  }

  const poseDef = input.manifest[requestedPose];
  if (!poseDef.lanes.includes(input.diveDirection)) {
    return false;
  }

  if (input.contactPoint.y <= input.layout.highCornerY && !poseDef.supportsHighCornerSave) {
    return false;
  }

  const laneOk = input.diveDirection === "center"
    ? Math.abs(input.contactPoint.x - input.layout.centerX) <= 90
    : input.diveDirection === "left"
      ? input.contactPoint.x <= input.layout.centerX + 30
      : input.contactPoint.x >= input.layout.centerX - 30;

  if (!laneOk) {
    return false;
  }

  const target = getTargetPosition(input, requestedPose, true);
  const saveHeightLane = getSaveHeightLane(input);
  const contactAnchor = getPoseContactAnchor(poseDef, saveHeightLane);
  const anchor = contactAnchor === null
    ? null
    : {
        x: target.x + contactAnchor.x,
        y: target.y + contactAnchor.y
      };

  if (anchor === null) {
    return false;
  }

  return Math.hypot(input.contactPoint.x - anchor.x, input.contactPoint.y - anchor.y) <= CONTACT_TRUST_MAX_DISTANCE_PX;
}

function getTargetPosition(
  input: KeeperAnimationDirectorInput,
  requestedPose: KeeperPoseId,
  visualSaveTrusted: boolean
): Point2D {
  if (input.outcome === "save" && input.contactPoint !== null && visualSaveTrusted) {
    const anchor = getPoseContactAnchor(input.manifest[requestedPose], getSaveHeightLane(input));
    if (anchor !== null) {
      const unclamped = {
        x: input.contactPoint.x - anchor.x,
        y: Math.max(input.layout.goalTopY + 38, input.contactPoint.y - anchor.y)
      };
      return enforceDirectionalTarget(input, unclamped);
    }
  }

  if (input.diveDirection === "left") {
    return { x: input.layout.leftDiveX, y: getFallbackDiveY(input) };
  }
  if (input.diveDirection === "right") {
    return { x: input.layout.rightDiveX, y: getFallbackDiveY(input) };
  }
  return { x: input.layout.centerX, y: getFallbackDiveY(input) - 6 };
}

function enforceDirectionalTarget(input: KeeperAnimationDirectorInput, target: Point2D): Point2D {
  if (input.diveDirection === "left") {
    return {
      x: Math.min(input.layout.centerX - 8, target.x),
      y: target.y
    };
  }
  if (input.diveDirection === "right") {
    return {
      x: Math.max(input.layout.centerX + 8, target.x),
      y: target.y
    };
  }
  return {
    x: input.layout.centerX,
    y: target.y
  };
}

function getFallbackDiveY(input: KeeperAnimationDirectorInput): number {
  const lane = getSaveHeightLane(input);
  if (lane === "high") {
    return input.layout.goalTopY + 62;
  }
  if (lane === "low") {
    return input.layout.diveY + 20;
  }
  return input.layout.diveY;
}

function getSaveHeightLane(input: KeeperAnimationDirectorInput): KeeperSaveHeightLane {
  const y = input.contactPoint?.y ?? input.predictedTarget.y;
  if (y <= input.layout.highCornerY + 10) {
    return "high";
  }
  if (y >= input.layout.diveY - 24) {
    return "low";
  }
  return "mid";
}

function getFramePosition(
  input: KeeperAnimationDirectorInput,
  phase: KeeperAnimationPhase,
  progress: number,
  target: Point2D,
  moodEffect: KeeperMoodEffect
): Point2D {
  const center = { x: input.layout.centerX, y: input.layout.keeperY };
  const timing = getPhaseTiming(input, moodEffect);
  const laneSign = input.diveDirection === "left" ? -1 : input.diveDirection === "right" ? 1 : 0;

  if (phase === "idle" || phase === "mood_idle" || phase === "reset") {
    const jitter = moodEffect.jitterPx === 0 ? 0 : Math.sin((input.shotIndex + 1) * 1.7) * moodEffect.jitterPx;
    return {
      x: center.x + laneSign * moodEffect.leanPx + jitter,
      y: center.y
    };
  }

  if (phase === "anticipation") {
    const t = smoothStep(progress / Math.max(0.01, timing.reactionT));
    const jitter = moodEffect.jitterPx === 0 ? 0 : Math.sin(progress * 24 + input.shotIndex) * moodEffect.jitterPx;
    return {
      x: center.x + laneSign * (8 + moodEffect.leanPx) * t + jitter,
      y: center.y - 2 * Math.sin(t * Math.PI * 0.5)
    };
  }

  if (phase === "launch") {
    const t = smoothStep((progress - timing.reactionT) / Math.max(0.01, timing.launchEnd - timing.reactionT));
    const launchX = lerp(center.x, target.x, 0.38 * t);
    const launchY = lerp(center.y, target.y, 0.28 * t) - 6 * Math.sin(t * Math.PI) * moodEffect.riskScale;
    return enforceDirectionalPosition(input, { x: launchX, y: launchY });
  }

  if (phase === "flight_stretch") {
    const t = smoothStep((progress - timing.launchEnd) / Math.max(0.01, timing.flightEnd - timing.launchEnd));
    const launchX = lerp(center.x, target.x, 0.38);
    const launchY = lerp(center.y, target.y, 0.28);
    const arc = Math.sin(t * Math.PI) * 12 * moodEffect.riskScale;
    const position = {
      x: lerp(launchX, target.x, t),
      y: lerp(launchY, target.y, t) - arc
    };
    return enforceDirectionalPosition(input, position);
  }

  if (phase === "contact") {
    return target;
  }

  if (phase === "landing_recovery") {
    const recoveryStart = input.contactT !== null ? input.contactT + 0.14 : timing.flightEnd;
    const t = smoothStep((progress - recoveryStart) / 0.18);
    const mess = moodEffect.recoveryMessPx === 0
      ? 0
      : Math.sin(progress * 20 + input.shotIndex) * moodEffect.recoveryMessPx * (1 - t);
    return {
      x: lerp(target.x, center.x, t) + mess * laneSign,
      y: lerp(target.y, center.y, t)
    };
  }

  return target;
}

function enforceDirectionalPosition(input: KeeperAnimationDirectorInput, position: Point2D): Point2D {
  if (input.diveDirection === "left") {
    return { ...position, x: Math.min(input.layout.centerX, position.x) };
  }
  if (input.diveDirection === "right") {
    return { ...position, x: Math.max(input.layout.centerX, position.x) };
  }
  return { ...position, x: input.layout.centerX };
}

function getFrameRotation(
  direction: DiveDirection,
  phase: KeeperAnimationPhase,
  requestedPose: KeeperPoseId,
  progress: number,
  defaultRotation: number,
  saveHeightLane: KeeperSaveHeightLane
): number {
  const sign = direction === "left" ? -1 : direction === "right" ? 1 : 0;
  const sideRotation = getSideRotation(sign, saveHeightLane);

  if (phase === "launch") {
    return sideRotation * 0.55 * smoothStep(progress / 0.3);
  }

  if (phase === "flight_stretch") {
    return sideRotation * Math.sin(progress * Math.PI);
  }

  if (phase === "contact") {
    return direction === "center" ? defaultRotation : sideRotation;
  }

  if (phase === "landing_recovery") {
    return defaultRotation * (1 - smoothStep((progress - 0.75) / 0.2));
  }

  if (requestedPose === "goal_conceded") {
    return sign === 0 ? 0.1 : sign * 0.12;
  }

  return defaultRotation;
}

function getSideRotation(sign: number, saveHeightLane: KeeperSaveHeightLane): number {
  if (sign === 0) {
    return 0;
  }

  if (saveHeightLane === "high") {
    return -sign * 0.06;
  }

  if (saveHeightLane === "low") {
    return sign * 0.04;
  }

  return -sign * 0.02;
}

function getFrameScale(
  input: KeeperAnimationDirectorInput,
  phase: KeeperAnimationPhase,
  progress: number,
  moodEffect: KeeperMoodEffect
): number {
  const timing = getPhaseTiming(input, moodEffect);

  if (phase === "anticipation") {
    const t = smoothStep(progress / Math.max(0.01, timing.reactionT));
    return lerp(1, 1.03, t);
  }

  if (phase === "launch") {
    const t = smoothStep((progress - timing.reactionT) / Math.max(0.01, timing.launchEnd - timing.reactionT));
    return lerp(1.03, 1.08, t) * (input.mood === "desperate" ? 1.015 : 1);
  }

  if (phase === "flight_stretch") {
    const t = smoothStep((progress - timing.launchEnd) / Math.max(0.01, timing.flightEnd - timing.launchEnd));
    return lerp(1.08, 1.05, t) * (input.mood === "desperate" ? 1.015 : 1);
  }

  if (phase === "contact") {
    return input.mood === "desperate" ? 1.06 : 1.05;
  }

  if (phase === "landing_recovery") {
    const recoveryStart = input.contactT !== null ? input.contactT + 0.14 : timing.flightEnd;
    const t = smoothStep((progress - recoveryStart) / 0.18);
    return lerp(1.05, 1, t);
  }

  return 1;
}

function getFrameShadow(
  phase: KeeperAnimationPhase,
  scale: number,
  yOffset: number,
  direction: DiveDirection,
  saveHeightLane: KeeperSaveHeightLane
): { readonly widthScale: number; readonly alpha: number; readonly offsetY: number } {
  const sideBoost = direction === "center" ? 0.1 : 0.32;
  const airborne = phase === "launch" || phase === "flight_stretch" || phase === "contact";
  const laneBoost = saveHeightLane === "high" ? 0.35 : saveHeightLane === "low" ? -0.12 : 0;
  const heightFactor = clamp(Math.abs(yOffset) / 56 + laneBoost, 0, 1);
  const stretchFactor = Math.max(0, scale - 1);

  return {
    widthScale: airborne ? 1 + sideBoost + stretchFactor * 6 + heightFactor * 0.35 : 1 + stretchFactor * 2,
    alpha: airborne ? clamp(0.28 - heightFactor * 0.12, 0.12, 0.28) : 0.28,
    offsetY: airborne ? 42 + heightFactor * 14 : 50
  };
}
