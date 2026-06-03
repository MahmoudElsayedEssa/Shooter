/**
 * KeeperPuppet — Phaser presentation layer for body-driven keeper saves.
 *
 * Key principles:
 * - Body sprite is primary (existing keeper textures, no new assets)
 * - NO floating glove dots during idle/aiming/flight
 * - Contact marker appears ONLY during save_contact phase
 * - Contact marker is clamped to MAX_VISUAL_ARM_REACH_PX from shoulder
 * - Body moves close to contact lane so marker stays attached
 * - Reach line only shown at save_contact if it improves readability
 */

import Phaser from "phaser";
import type { Point2D } from "../../core/types";
import { smoothStep } from "../../core/math";
import { setImageDisplayHeight } from "../../core/phaser-helpers";
import {
  type PuppetPhase,
  type PuppetMood,
  type PuppetPlan,
  type PuppetDebugState,
  type GloveSide,
  MAX_VISUAL_ARM_REACH_PX,
  CONTACT_MARKER,
  computePuppetPhase,
} from "./KeeperPuppetTypes";

// Re-export types used by scene
export type { PuppetPhase, PuppetMood, PuppetPlan, PuppetDebugState, GloveSide };
export { planPuppetSave, getPhaseTiming, computePuppetPhase } from "./KeeperPuppetTypes";

// ─── Types used from scene constants (passed in via config) ───

export type KeeperPose = "idle" | "ready" | "diveLeft" | "diveRight" | "save" | "miss";

export interface KeeperPuppetConfig {
  readonly textureByPose: Readonly<Record<KeeperPose, string>>;
  readonly heightByPose: Readonly<Record<KeeperPose, number>>;
  readonly canonicalX: number;
  readonly canonicalY: number;
  readonly diveY: number;
  readonly maxStretch: number;
}



// ─── KeeperPuppet Class ───

export class KeeperPuppet {
  private readonly scene: Phaser.Scene;
  private readonly config: KeeperPuppetConfig;

  // Visual objects
  private readonly bodySprite: Phaser.GameObjects.Image;
  private readonly contactMarker: Phaser.GameObjects.Arc;        // only visible during save_contact
  private readonly contactReachLine: Phaser.GameObjects.Graphics; // subtle, only during save_contact
  private readonly shadowEllipse: Phaser.GameObjects.Ellipse;

  // State
  private phase: PuppetPhase = "idle";
  private mood: PuppetMood = "calm";
  private pose: KeeperPose = "idle";
  private activePlan: PuppetPlan | null = null;
  private contactT: number | null = null;
  private contactFlashTimer: number = 0;

  constructor(scene: Phaser.Scene, config: KeeperPuppetConfig) {
    this.scene = scene;
    this.config = config;

    // Shadow (below everything)
    this.shadowEllipse = scene.add.ellipse(
      config.canonicalX, config.canonicalY + 50,
      72, 14, 0x000000, 0.28
    );

    // Body sprite (existing keeper texture — primary visual)
    this.bodySprite = scene.add.image(
      config.canonicalX, config.canonicalY,
      config.textureByPose.idle
    );
    setImageDisplayHeight(this.bodySprite, config.heightByPose.idle);

    // Contact marker — small circle, HIDDEN by default.
    // Only shown during save_contact phase, at clamped position.
    this.contactMarker = scene.add.arc(
      0, 0, CONTACT_MARKER.radius,
      0, 360, false,
      CONTACT_MARKER.color, CONTACT_MARKER.alpha
    );
    this.contactMarker.setVisible(false);

    // Reach line graphics — very subtle, only during save_contact
    this.contactReachLine = scene.add.graphics();
  }

  // ─── Public API ───

  /** Get all managed display objects (for adding to a layer/container). */
  getDisplayObjects(): Phaser.GameObjects.GameObject[] {
    return [
      this.shadowEllipse,
      this.bodySprite,
      this.contactReachLine,
      this.contactMarker,
    ];
  }

  /** Set keeper body pose (texture + height). */
  setPose(pose: KeeperPose): void {
    if (this.pose !== pose) {
      this.bodySprite.setTexture(this.config.textureByPose[pose]);
      this.pose = pose;
      this.bodySprite.setFlipX(pose === "diveRight");
    }
    setImageDisplayHeight(this.bodySprite, this.config.heightByPose[pose]);
  }

  /** Set mood (affects timing). */
  setMood(mood: PuppetMood): void {
    this.mood = mood;
  }

  /** Apply mood tint to body. */
  applyMoodTint(tint: number | null): void {
    if (tint !== null) {
      this.bodySprite.setTint(tint);
    } else {
      this.bodySprite.clearTint();
    }
  }

  /** Set the active save plan and contactT for upcoming animation. */
  setPlan(plan: PuppetPlan, contactT: number | null): void {
    this.activePlan = plan;
    this.contactT = contactT;
  }

  /**
   * Per-frame update during ball flight.
   * Body-driven: body moves toward contact lane, contact marker only at save.
   */
  updatePhased(progress: number): void {
    if (!this.activePlan) return;

    const plan = this.activePlan;
    const newPhase = computePuppetPhase(progress, plan, this.contactT);
    this.phase = newPhase;

    const cx = this.config.canonicalX;
    const cy = this.config.canonicalY;
    const anticipationEnd = plan.timing.anticipationEnd;
    const diveEnd = this.contactT ?? 0.85;
    const diveDir = plan.diveDirection;
    const divePose: KeeperPose = diveDir === "left" ? "diveLeft"
      : diveDir === "right" ? "diveRight" : "ready";

    // Contact marker hidden by default each frame
    this.contactMarker.setVisible(false);
    this.contactReachLine.clear();

    switch (newPhase) {
      case "idle":
        this.setPose("ready");
        this.bodySprite.setPosition(cx, cy);
        break;

      case "anticipation": {
        this.setPose("ready");
        const leanProgress = progress / anticipationEnd;
        const leanX = diveDir === "left" ? -8 : diveDir === "right" ? 8 : 0;
        const leanY = -2 * Math.sin(smoothStep(leanProgress) * Math.PI * 0.5);

        this.bodySprite.setPosition(cx + leanX * smoothStep(leanProgress), cy + leanY);
        this.bodySprite.setRotation(0);
        break;
      }

      case "dive_travel": {
        this.setPose(divePose);
        const diveProgress = (progress - anticipationEnd) / Math.max(0.01, diveEnd - anticipationEnd);
        const easedDive = smoothStep(Math.min(1, diveProgress));

        // Body moves toward the CONTACT LANE (bodyTargetX/Y), not just 70%
        const diveArc = Math.sin(easedDive * Math.PI) * 6;
        this.bodySprite.setPosition(
          cx + (plan.bodyTargetX - cx) * easedDive,
          cy + (plan.bodyTargetY - cy) * easedDive - diveArc
        );

        // Rotation during dive
        const rotationPeak = diveDir === "left" ? -0.10 : diveDir === "right" ? 0.10 : 0;
        const rotationCurve = Math.sin(easedDive * Math.PI);
        this.bodySprite.setRotation(rotationPeak * rotationCurve);

        // Squash/stretch — capped at maxStretch
        const baseHeight = this.config.heightByPose[divePose];
        const baseWidth = (this.bodySprite.frame.width / this.bodySprite.frame.height) * baseHeight;
        const stretchX = 1 + rotationCurve * Math.min(0.03, this.config.maxStretch - 1);
        const stretchY = 1 - rotationCurve * 0.015;
        this.bodySprite.setDisplaySize(baseWidth * stretchX, baseHeight * stretchY);
        break;
      }

      case "save_contact": {
        // Body holds at target position, contact marker appears ATTACHED
        this.setPose(divePose);
        this.bodySprite.setPosition(plan.bodyTargetX, plan.bodyTargetY);

        const holdRotation = diveDir === "left" ? -0.06 : diveDir === "right" ? 0.06 : 0;
        this.bodySprite.setRotation(holdRotation);

        // Show contact marker at CLAMPED position (within arm reach)
        if (plan.allowed && plan.clampedContactWorld) {
          this.contactMarker.setPosition(
            plan.clampedContactWorld.x,
            plan.clampedContactWorld.y
          );
          this.contactMarker.setVisible(true);

          // Contact flash on first frame
          if (this.contactFlashTimer <= 0) {
            this.contactFlashTimer = CONTACT_MARKER.flashMs;
            this.contactMarker.setFillStyle(CONTACT_MARKER.color, 1.0);
          }

          // Draw very subtle reach line from shoulder to contact
          if (plan.shoulderAnchor && plan.visualArmDistance > 15) {
            this.contactReachLine.lineStyle(1.5, 0xcccccc, 0.15);
            this.contactReachLine.lineBetween(
              plan.shoulderAnchor.x, plan.shoulderAnchor.y,
              plan.clampedContactWorld.x, plan.clampedContactWorld.y
            );
          }

          // Log visual contact violation in dev
          if (!plan.validVisualContact) {
            console.warn(
              `[PUPPET VISUAL CONTACT VIOLATION] arm distance ${plan.visualArmDistance.toFixed(1)}px > max ${MAX_VISUAL_ARM_REACH_PX}px — contact clamped`
            );
          }
        }
        break;
      }

      case "recover": {
        const recoveryProgress = this.contactT !== null
          ? Math.min(1, (progress - (this.contactT + 0.15)) / 0.2)
          : Math.min(1, (progress - 0.85) / 0.15);
        const eased = smoothStep(Math.max(0, recoveryProgress));

        // Body eases back
        const currentX = plan.bodyTargetX + (cx - plan.bodyTargetX) * eased;
        const currentY = plan.bodyTargetY + (cy - plan.bodyTargetY) * eased;
        this.bodySprite.setPosition(currentX, currentY);

        // Rotation eases to 0
        const holdRotation = diveDir === "left" ? -0.06 : diveDir === "right" ? 0.06 : 0;
        this.bodySprite.setRotation(holdRotation * (1 - eased));
        break;
      }
    }

    // Decrement contact flash timer
    if (this.contactFlashTimer > 0) {
      this.contactFlashTimer -= 16;
      if (this.contactFlashTimer <= 0) {
        this.contactMarker.setFillStyle(CONTACT_MARKER.color, CONTACT_MARKER.alpha);
      }
    }

    // Update shadow
    this.updateShadow();
  }

  /**
   * Execute save contact — called from presentOutcome.
   * Shows contact marker at clamped position near body.
   */
  executeSaveContact(contactPoint: Point2D, _diveDirection: "left" | "center" | "right"): void {
    if (!contactPoint) return;
    if (!this.activePlan || !this.activePlan.allowed) return;

    const plan = this.activePlan;
    if (plan.clampedContactWorld) {
      this.contactMarker.setPosition(
        plan.clampedContactWorld.x,
        plan.clampedContactWorld.y
      );
      this.contactMarker.setVisible(true);
      this.contactMarker.setFillStyle(CONTACT_MARKER.color, 1.0);
      this.contactFlashTimer = CONTACT_MARKER.flashMs;

      // Subtle reach line
      if (plan.shoulderAnchor && plan.visualArmDistance > 15) {
        this.contactReachLine.lineStyle(1.5, 0x4ade80, 0.25);
        this.contactReachLine.lineBetween(
          plan.shoulderAnchor.x, plan.shoulderAnchor.y,
          plan.clampedContactWorld.x, plan.clampedContactWorld.y
        );
      }
    }
  }

  /** Reset puppet to canonical state between shots. */
  resetToCanonical(): void {
    const cx = this.config.canonicalX;
    const cy = this.config.canonicalY;

    this.scene.tweens.killTweensOf(this.bodySprite);

    // Reset body
    this.pose = "idle";
    this.bodySprite.setTexture(this.config.textureByPose.idle);
    this.bodySprite.setFlipX(false);
    this.bodySprite.setPosition(cx, cy);
    this.bodySprite.setRotation(0);
    this.bodySprite.setAlpha(1);
    this.bodySprite.clearTint();
    setImageDisplayHeight(this.bodySprite, this.config.heightByPose.idle);

    // Hide contact marker (no glove dots during idle)
    this.contactMarker.setVisible(false);
    this.contactReachLine.clear();

    // Reset shadow
    this.shadowEllipse.setPosition(cx, cy + 50);
    this.shadowEllipse.setScale(1, 1);
    this.shadowEllipse.setAlpha(0.28);

    // Reset state
    this.phase = "idle";
    this.activePlan = null;
    this.contactT = null;
    this.contactFlashTimer = 0;
  }

  // ─── Collision-safe API ───

  /** Get body world position for collision state and HUD. */
  getBodyWorldPosition(): Point2D {
    return { x: this.bodySprite.x, y: this.bodySprite.y };
  }

  /** Get body display bounds for HUD goalkeeperBody. */
  getBodyBounds(): { left: number; top: number; right: number; bottom: number } {
    return {
      left: this.bodySprite.x - this.bodySprite.displayWidth / 2,
      top: this.bodySprite.y - this.bodySprite.displayHeight / 2,
      right: this.bodySprite.x + this.bodySprite.displayWidth / 2,
      bottom: this.bodySprite.y + this.bodySprite.displayHeight / 2,
    };
  }

  /** Get the raw body sprite (for tweens in presentOutcome). */
  getBodySprite(): Phaser.GameObjects.Image {
    return this.bodySprite;
  }

  /** Get current pose. */
  getPose(): KeeperPose {
    return this.pose;
  }

  /** Get debug state for overlay. */
  getDebugState(): PuppetDebugState {
    return {
      phase: this.phase,
      mood: this.mood,
      bodyX: this.bodySprite.x,
      bodyY: this.bodySprite.y,
      bodyHeight: this.bodySprite.displayHeight,
      shoulderAnchor: this.activePlan?.shoulderAnchor ?? null,
      contactPoint: this.activePlan?.rawContactPoint ?? null,
      clampedContact: this.activePlan?.clampedContactWorld ?? null,
      visualArmDistance: this.activePlan?.visualArmDistance ?? 0,
      maxArmReach: MAX_VISUAL_ARM_REACH_PX,
      validVisualContact: this.activePlan?.validVisualContact ?? false,
      saveContactAllowed: this.activePlan?.allowed ?? false,
      selectedGlove: this.activePlan?.selectedGlove ?? null,
    };
  }

  /** Destroy all managed objects. */
  destroy(): void {
    this.bodySprite.destroy();
    this.contactMarker.destroy();
    this.contactReachLine.destroy();
    this.shadowEllipse.destroy();
  }

  // ─── Private: Shadow ───

  private updateShadow(): void {
    const bx = this.bodySprite.x;
    const poseHeight = this.config.heightByPose[this.pose];
    const shadowY = this.bodySprite.y + poseHeight * 0.44;
    this.shadowEllipse.setPosition(Math.round(bx), Math.round(shadowY));

    const isDiving = this.pose === "diveLeft" || this.pose === "diveRight";
    const shadowWidthScale = isDiving ? 1.3 : 1.0;
    const shadowAlpha = isDiving ? 0.28 * 0.7 : 0.28;
    this.shadowEllipse.setScale(shadowWidthScale, 1).setAlpha(shadowAlpha);
  }
}
