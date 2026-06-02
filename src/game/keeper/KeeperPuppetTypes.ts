/**
 * KeeperPuppetTypes — Pure types and planning logic for the Keeper Puppet.
 * Zero Phaser dependency. Fully testable.
 *
 * Key rule: Body leads the save. Contact marker must stay within
 * MAX_VISUAL_ARM_REACH_PX of the body's shoulder anchor. No detached gloves.
 */

// ─── Types ───

export type PuppetPhase = "idle" | "anticipation" | "dive_travel" | "save_contact" | "recover";
export type PuppetMood = "calm" | "focused" | "nervous" | "aggressive" | "desperate";
export type GloveSide = "left" | "right";

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface PuppetPhaseTiming {
  /** Duration of anticipation phase as fraction of total flight [0,1] */
  readonly anticipationEnd: number;
  /** Small jitter amplitude for nervous/desperate moods (px) */
  readonly jitterAmplitude: number;
}

export interface PuppetPlan {
  /** Whether save_contact phase is allowed */
  readonly allowed: boolean;
  /** Whether visual contact is plausible (contact marker within arm reach of body) */
  readonly validVisualContact: boolean;
  /** Reason if not allowed */
  readonly rejectReason: string | null;
  /** Selected glove side for contact (null if not allowed) */
  readonly selectedGlove: GloveSide | null;
  /** Where the contact marker should appear (clamped to arm reach) */
  readonly clampedContactWorld: Point2D | null;
  /** Original contact point from collision system */
  readonly rawContactPoint: Point2D | null;
  /** Body target X — body moves to contact lane (close to contactPoint) */
  readonly bodyTargetX: number;
  /** Body target Y */
  readonly bodyTargetY: number;
  /** Shoulder anchor (world position where arm attaches to body at target) */
  readonly shoulderAnchor: Point2D | null;
  /** Visual arm distance from shoulder to clamped contact */
  readonly visualArmDistance: number;
  /** Dive direction */
  readonly diveDirection: "left" | "center" | "right";
  /** Phase timing config based on mood */
  readonly timing: PuppetPhaseTiming;
}

export interface PuppetDebugState {
  readonly phase: PuppetPhase;
  readonly mood: PuppetMood;
  readonly bodyX: number;
  readonly bodyY: number;
  readonly bodyHeight: number;
  readonly shoulderAnchor: Point2D | null;
  readonly contactPoint: Point2D | null;
  readonly clampedContact: Point2D | null;
  readonly visualArmDistance: number;
  readonly maxArmReach: number;
  readonly validVisualContact: boolean;
  readonly saveContactAllowed: boolean;
  readonly selectedGlove: GloveSide | null;
}

// ─── Constants ───

/**
 * Maximum distance from shoulder anchor to contact marker (px).
 * If contact is farther, body repositions closer. Contact marker is
 * always clamped within this radius. Prevents detached gloves.
 */
export const MAX_VISUAL_ARM_REACH_PX = 45;

/** Shoulder offset from body center (local coordinates) */
export const SHOULDER_OFFSET: Readonly<Record<GloveSide, Point2D>> = {
  left: { x: -18, y: -20 },
  right: { x: 18, y: -20 },
};

/** Contact marker visual config */
export const CONTACT_MARKER = {
  radius: 8,
  color: 0x4ade80,      // green
  alpha: 0.7,
  flashMs: 150,
} as const;

/** Mood-specific timing configurations */
export const PUPPET_MOOD_TIMING: Readonly<Record<PuppetMood, PuppetPhaseTiming>> = {
  calm:       { anticipationEnd: 0.14, jitterAmplitude: 0 },
  focused:    { anticipationEnd: 0.10, jitterAmplitude: 0 },
  nervous:    { anticipationEnd: 0.18, jitterAmplitude: 1.5 },
  aggressive: { anticipationEnd: 0.08, jitterAmplitude: 0 },
  desperate:  { anticipationEnd: 0.12, jitterAmplitude: 1.0 },
};

// ─── Pure Planning Functions ───

/**
 * Select which glove should contact the ball based on contact point
 * relative to body center.
 */
export function selectGlove(contactPoint: Point2D, bodyCenter: Point2D): GloveSide {
  return contactPoint.x <= bodyCenter.x ? "left" : "right";
}

/**
 * Get phase timing for a given mood.
 */
export function getPhaseTiming(mood: PuppetMood): PuppetPhaseTiming {
  return PUPPET_MOOD_TIMING[mood];
}

/**
 * Plan a puppet save. Body-driven: body moves close enough to contact
 * that the contact marker stays within MAX_VISUAL_ARM_REACH_PX.
 *
 * Rules:
 * - outcome must be "save" and contactPoint non-null
 * - body moves toward the contact lane (not just 70% of dive)
 * - contact marker is clamped to arm reach from shoulder
 * - if even after body repositioning the distance is too far, flag validVisualContact=false
 */
export function planPuppetSave(
  outcome: "goal" | "save" | "miss",
  contactPoint: Point2D | null,
  diveDirection: "left" | "center" | "right",
  bodyCenter: Point2D,
  diveTargetX: number,
  diveTargetY: number,
  mood: PuppetMood
): PuppetPlan {
  const timing = getPhaseTiming(mood);

  // Not a save → no save_contact
  if (outcome !== "save") {
    return {
      allowed: false,
      validVisualContact: false,
      rejectReason: `outcome is ${outcome}, not save`,
      selectedGlove: null,
      clampedContactWorld: null,
      rawContactPoint: null,
      bodyTargetX: diveTargetX,
      bodyTargetY: diveTargetY,
      shoulderAnchor: null,
      visualArmDistance: 0,
      diveDirection,
      timing,
    };
  }

  // Save but no contact point → rejected
  if (contactPoint === null) {
    return {
      allowed: false,
      validVisualContact: false,
      rejectReason: "contactPoint is null",
      selectedGlove: null,
      clampedContactWorld: null,
      rawContactPoint: null,
      bodyTargetX: diveTargetX,
      bodyTargetY: diveTargetY,
      shoulderAnchor: null,
      visualArmDistance: 0,
      diveDirection,
      timing,
    };
  }

  const glove = selectGlove(contactPoint, bodyCenter);
  const shoulderLocal = SHOULDER_OFFSET[glove];

  // Body target: move body CLOSE to the contact point.
  // Body X goes toward contact X, constrained by the dive lane.
  // Body Y goes toward contact Y (but not past dive Y).
  const bodyTargetX = contactPoint.x - shoulderLocal.x; // position body so shoulder is near contact
  const bodyTargetY = Math.max(diveTargetY, contactPoint.y - shoulderLocal.y * 0.5);

  // Shoulder anchor at body target
  const shoulderAnchor: Point2D = {
    x: bodyTargetX + shoulderLocal.x,
    y: bodyTargetY + shoulderLocal.y,
  };

  // Distance from shoulder to contact
  const armDist = Math.hypot(
    contactPoint.x - shoulderAnchor.x,
    contactPoint.y - shoulderAnchor.y
  );

  // Clamp contact marker to arm reach
  let clampedContact: Point2D;
  if (armDist <= MAX_VISUAL_ARM_REACH_PX) {
    clampedContact = contactPoint;
  } else {
    // Clamp along the vector from shoulder to contact
    const scale = MAX_VISUAL_ARM_REACH_PX / armDist;
    clampedContact = {
      x: shoulderAnchor.x + (contactPoint.x - shoulderAnchor.x) * scale,
      y: shoulderAnchor.y + (contactPoint.y - shoulderAnchor.y) * scale,
    };
  }

  const clampedDist = Math.hypot(
    clampedContact.x - shoulderAnchor.x,
    clampedContact.y - shoulderAnchor.y
  );

  return {
    allowed: true,
    validVisualContact: armDist <= MAX_VISUAL_ARM_REACH_PX,
    rejectReason: null,
    selectedGlove: glove,
    clampedContactWorld: clampedContact,
    rawContactPoint: contactPoint,
    bodyTargetX,
    bodyTargetY,
    shoulderAnchor,
    visualArmDistance: clampedDist,
    diveDirection,
    timing,
  };
}

/**
 * Compute puppet phase from flight progress.
 */
export function computePuppetPhase(
  progress: number,
  plan: PuppetPlan,
  contactT: number | null
): PuppetPhase {
  if (progress <= 0) return "idle";

  const anticipationEnd = plan.timing.anticipationEnd;

  if (progress < anticipationEnd) {
    return "anticipation";
  }

  if (plan.allowed && contactT !== null) {
    if (progress < contactT) {
      return "dive_travel";
    }
    if (progress < contactT + 0.15) {
      return "save_contact";
    }
    return "recover";
  }

  // No save_contact: just dive and recover
  if (progress < 0.85) {
    return "dive_travel";
  }
  return "recover";
}
