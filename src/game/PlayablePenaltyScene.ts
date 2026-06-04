import Phaser from "phaser";
import { createBallTrajectory, sampleBallFlight, type BallFlightSample } from "../systems/ball/BallTrajectory";
import { resolveBallCollision, type BallOutcome, type CollisionReason, type GoalFrame, type KeeperState } from "../systems/collision/CollisionResolver";
import type { Point2D, SafeAreaInsets } from "../core/types";
import {
  decideGoalkeeperAction,
  type DiveDirection,
  type GoalkeeperDecision,
  type GoalkeeperMood
} from "../systems/goalkeeper/GoalkeeperAI";
import {
  captureInputPoint,
  sampleGesturePoint,
  startsInsideShotZone,
  validateGesture,
  type GesturePoint
} from "../systems/input/DrawToShootInput";
import {
  createMatchState,
  isMatchDecided,
  MATCH_LIMITS,
  reduceMatchState,
  type MatchState,
  type MatchScore
} from "../systems/match/MatchFlow";
import { interpretShotIntent, type ShotIntent } from "../systems/shot/ShotInterpreter";
import { getOutcomeUi } from "../ui/OutcomeUi";
import { createLogicalLayers, type RenderLayerMap } from "../render";
import { calculatePressure, type PressureState } from "../systems/pressure/PressureSystem";
import { detectHeroMoments, type HeroMomentResult } from "../systems/hero/HeroMoment";
import { KeeperPuppet, type PuppetMood, type KeeperPose as PuppetKeeperPose } from "./keeper/KeeperPuppet";
import {
  createKeeperPoseManifest,
  planKeeperPresentation,
  type KeeperAnimationLayout,
  type KeeperPoseId,
  type KeeperPoseManifest,
  type KeeperPresentationFrame
} from "../systems/animation/GoalkeeperAnimation";
import {
  getCanvasSafeAreaInsets,
  isPortraitViewport,
  PORTRAIT_GAME_SIZE
} from "../core/MobileViewport";

import { playKickSound, playGoalSound, playSaveSound, playMissSound, playWhooshSound, playPostHitSound, playCrowdGaspSound, playDiveGruntSound, playCrowdGroanSound, closeAudioContext } from "../systems/audio/ProceduralAudio";
import { ParticleEmitter } from "../systems/vfx/GameParticles";

// Note: planVisualEffects, planAdaptiveAudio, and getGoalkeeperAnimation
// are integrated through the scene's presentation methods rather than called
// directly as pure planners. Their design concepts (FX effects, audio events,
// animation states) are implemented in the scene's tween/audio code.
import { smoothStep } from "../core/math";
import { setImageDisplayHeight } from "../core/phaser-helpers";

export type PlayableOutcome = "goal" | "save" | "miss";

export interface PlayableShotPlan {
  readonly intent: ShotIntent;
  readonly outcome: PlayableOutcome;
  readonly ballSamples: readonly BallFlightSample[];
  readonly keeperDecision: GoalkeeperDecision;
  readonly score: MatchScore;
  readonly shotNumber: number;
  readonly matchEnded: boolean;
  // Collision details for synchronized save timing
  readonly contactPoint: Point2D | null;
  readonly collisionReason: CollisionReason;
  /** Normalized ball progress [0,1] at keeper contact. Null if not save. */
  readonly contactT: number | null;
  /** Sample index at which keeper contact first occurs. Null if not save. */
  readonly contactSampleIndex: number | null;
  /** Keeper reach at the time of contact. */
  readonly keeperReachAtContact: number;
  /** Keeper dive direction from collision. */
  readonly keeperDiveDirection: "left" | "center" | "right";
  /** Duration of ball flight in ms (from trajectory). */
  readonly flightDurationMs: number;
}

export interface PlayableMatchSnapshot {
  readonly score: MatchScore;
  readonly shotNumber: number;
  readonly maxShots: number;
  readonly phase: "aiming" | "drawing" | "ball_flight" | "result" | "match_end";
  readonly outcome: PlayableOutcome | "none";
}

export const GAME_WIDTH = PORTRAIT_GAME_SIZE.width;
export const GAME_HEIGHT = PORTRAIT_GAME_SIZE.height;
export const BALL_START = Object.freeze({ x: 270, y: 805 });
// The "inside" scoring area (between the posts, below crossbar):
export const GOAL_FRAME: GoalFrame = Object.freeze({
  leftX: 55,
  rightX: 485,
  topY: 165,
  bottomY: 390,
  postTolerancePx: 6
});
const KEEPER_Y = 300;
const FLIGHT_SAMPLE_COUNT = 24;
// Keeper feet at GOAL_FRAME.bottomY (390): centerY = 390 - idleHeight/2 = 390 - 60 = 330
const VISUAL_KEEPER_Y = 330;
const VISUAL_KEEPER_DIVE_Y = 345;
const VISUAL_GOAL_CENTER = Object.freeze({ x: 270, y: 278 });
const BALL_BASE_DISPLAY_SIZE = 48;
const FONT_FAMILY = "'Inter', 'Segoe UI', Arial, sans-serif";

// ─── HARD RESET: Camera effects disabled until gameplay is stable ───
const CAMERA_EFFECTS_ENABLED = false;

// ─── Keeper Puppet feature flag ───
const KEEPER_PUPPET_ENABLED = false;

// ─── Keeper Canonical Sizes (max allowed display height per pose) ───
const KEEPER_CANONICAL = {
  maxIdleHeight: 130,
  maxDiveHeight: 115,
  maxSaveHeight: 120,
  // Max allowed stretch factor during squash/stretch animation
  maxStretch: 1.03,
} as const;

// ─── Keeper Mood Tints (subtle color per mood state) ───
const KEEPER_MOOD_TINTS: Readonly<Record<string, number | null>> = {
  calm: null,           // no tint, natural colors
  focused: 0xbbddff,    // cool/blue tint
  nervous: 0xffd8a8,    // warm/orange tint
  aggressive: 0xddffbb, // slight forward/green tint
  desperate: 0xffbbbb,  // subtle red tint
} as const;

// ─── Visual Style & Tuning Config (Phase 1 + 1B + 2A) ───
const VISUAL_STYLE = {
  // Background treatment — lighter to show realistic stadium BG
  backgroundTint: 0xdddddd,
  darkOverlayAlpha: 0.10,
  sideVignetteAlpha: 0.20,

  // Goal interior shadow (blocks stadium light bleed behind net)
  goalInteriorColor: 0x0a0e1a,
  goalInteriorAlpha: 0.40,

  // Front frame
  goalFrameTint: 0xf0f0f0,

  // Goal post contact shadow
  goalPostShadowAlpha: 0.18,

  // Keeper shadow — proportional to reduced keeper size
  keeperShadowColor: 0x000000,
  keeperShadowAlpha: 0.28,
  keeperShadowWidth: 72,
  keeperShadowHeight: 16,

  // Ball shadow
  ballShadowAlpha: 0.30,

  // Drawing trail colors (player’s free gesture)
  trailCoreColor: 0xe00800,
  trailGlowColor: 0xe00800,
  trailShadowColor: 0x111827,

  // Ball flight trail (actual ball path after release) — Phase 2A
  flightTrailSegments: 10,
  flightTrailBaseWidth: 3,
  flightTrailMaxWidth: 5,
  flightTrailHeadAlpha: 0.55,
  flightTrailColor: 0xfbbf24,

  // Ball aiming pulse — Phase 2A
  ballPulseScale: 1.05,
  ballPulseDurationMs: 900,

  // Ball depth tint range (white at start → slight grey at goal)
  ballFlightTintStart: 0xffffff,
  ballFlightTintEnd: 0xcccccc,

  // UI pill backgrounds
  uiPillColor: 0x0a0e1a,
  uiPillAlpha: 0.50,
  uiPillRadius: 6,
} as const;

// ─── Camera & FX Config (Phase 4A) ───
const CAMERA_FX = {
  // Tension zoom during ball flight
  zoomEnabled: true,
  zoomBase: 1.0,
  zoomMax: 1.08,
  zoomDamping: 0.06,          // lerp factor per frame (lower = smoother)
  zoomResetDurationMs: 400,
  zoomCenterX: VISUAL_GOAL_CENTER.x,
  zoomCenterY: VISUAL_GOAL_CENTER.y + 40, // slightly below goal for better framing

  // Impact shake
  shakeGoalIntensity: 0.004,
  shakeGoalDurationMs: 180,
  shakeSaveIntensity: 0.005,
  shakeSaveDurationMs: 160,
  shakePostHitIntensity: 0.003,
  shakePostHitDurationMs: 80,
} as const;



// ─── Layout Anchors (portrait game-space 540×960) ───
const LAYOUT = {
  goalArea: { x: VISUAL_GOAL_CENTER.x, y: VISUAL_GOAL_CENTER.y },
  keeperCenter: { x: VISUAL_GOAL_CENTER.x, y: VISUAL_KEEPER_Y },
  ballStart: BALL_START,
  scoreUi: { x: 16, y: 16 },
  shotUi: { x: GAME_WIDTH - 16, y: 16 },
  resultText: { x: GAME_WIDTH / 2, y: 260 },
  hintText: { x: GAME_WIDTH / 2, y: 875 },
  shotDots: { y: 58 },
} as const;

// Vite injects import.meta.env at build time; typed via vite/client in tsconfig
const IS_DEV: boolean = import.meta.env?.DEV === true;

type PlayableAssetKey =
  | "background"
  | "goalBack"
  | "goalFront"
  | "ball"
  | "keeperIdle"
  | "keeperReady"
  | "keeperDiveLeft"
  | "keeperDiveRight"
  | "keeperSave"
  | "keeperMiss"
  | "keeperToyIdle"
  | "keeperToyReady"
  | "keeperToyReadyWide"
  | "keeperToyAnticipateLeft"
  | "keeperToyAnticipateRight"
  | "keeperToyDiveLeftLow"
  | "keeperToyDiveLeftMid"
  | "keeperToyDiveLeftHigh"
  | "keeperToyDiveRightLow"
  | "keeperToyDiveRightMid"
  | "keeperToyDiveRightHigh"
  | "keeperToyCenterBlock"
  | "keeperToyMiss"
  | "keeperToyRecover"
  | "saveBurst";
type KeeperPose = KeeperPoseId;

export interface PlayableGameplayAsset {
  readonly id: PlayableAssetKey;
  readonly key: string;
  readonly path: string;
}

export const PLAYABLE_GAMEPLAY_ASSETS: readonly PlayableGameplayAsset[] = [
  { id: "background", key: "playable-background-city-field", path: "assets/gameplay/background-city-field.png" },
  { id: "goalBack", key: "playable-goal-back-net", path: "assets/gameplay/goal-back-net.png" },
  { id: "goalFront", key: "playable-goal-front-frame", path: "assets/gameplay/goal-front-frame.png" },
  { id: "ball", key: "playable-ball", path: "assets/gameplay/ball.png" },
  { id: "keeperIdle", key: "playable-keeper-idle", path: "assets/gameplay/keeper-idle.png" },
  { id: "keeperReady", key: "playable-keeper-ready", path: "assets/gameplay/keeper-ready.png" },
  { id: "keeperDiveLeft", key: "playable-keeper-dive-left", path: "assets/gameplay/keeper-dive-left.png" },
  { id: "keeperDiveRight", key: "playable-keeper-dive-right", path: "assets/gameplay/keeper-dive-right.png" },
  { id: "keeperSave", key: "playable-keeper-save", path: "assets/gameplay/keeper-save.png" },
  { id: "keeperMiss", key: "playable-keeper-miss", path: "assets/gameplay/keeper-miss.png" },
  { id: "keeperToyIdle", key: "playable-keeper-toy-idle", path: "assets/gameplay/keeper-toy-idle.png" },
  { id: "keeperToyReady", key: "playable-keeper-toy-ready", path: "assets/gameplay/keeper-toy-ready.png" },
  { id: "keeperToyReadyWide", key: "playable-keeper-toy-ready-wide", path: "assets/gameplay/keeper-toy-ready-wide.png" },
  { id: "keeperToyAnticipateLeft", key: "playable-keeper-toy-anticipate-left", path: "assets/gameplay/keeper-toy-anticipate-left.png" },
  { id: "keeperToyAnticipateRight", key: "playable-keeper-toy-anticipate-right", path: "assets/gameplay/keeper-toy-anticipate-right.png" },
  { id: "keeperToyDiveLeftLow", key: "playable-keeper-toy-dive-left-low", path: "assets/gameplay/keeper-toy-dive-left-low.png" },
  { id: "keeperToyDiveLeftMid", key: "playable-keeper-toy-dive-left-mid", path: "assets/gameplay/keeper-toy-dive-left-mid.png" },
  { id: "keeperToyDiveLeftHigh", key: "playable-keeper-toy-dive-left-high", path: "assets/gameplay/keeper-toy-dive-left-high.png" },
  { id: "keeperToyDiveRightLow", key: "playable-keeper-toy-dive-right-low", path: "assets/gameplay/keeper-toy-dive-right-low.png" },
  { id: "keeperToyDiveRightMid", key: "playable-keeper-toy-dive-right-mid", path: "assets/gameplay/keeper-toy-dive-right-mid.png" },
  { id: "keeperToyDiveRightHigh", key: "playable-keeper-toy-dive-right-high", path: "assets/gameplay/keeper-toy-dive-right-high.png" },
  { id: "keeperToyCenterBlock", key: "playable-keeper-toy-center-block", path: "assets/gameplay/keeper-toy-center-block.png" },
  { id: "keeperToyMiss", key: "playable-keeper-toy-miss", path: "assets/gameplay/keeper-toy-miss.png" },
  { id: "keeperToyRecover", key: "playable-keeper-toy-recover", path: "assets/gameplay/keeper-toy-recover.png" },
  { id: "saveBurst", key: "playable-fx-save-burst", path: "assets/gameplay/fx-save-burst.png" }
] as const;

const PLAYABLE_ASSET_BY_ID: Readonly<Record<PlayableAssetKey, PlayableGameplayAsset>> =
  PLAYABLE_GAMEPLAY_ASSETS.reduce(
    (assets, asset) => ({
      ...assets,
      [asset.id]: asset
    }),
    {} as Record<PlayableAssetKey, PlayableGameplayAsset>
  );

const KEEPER_TEXTURE_BY_POSE: Readonly<Record<PuppetKeeperPose, string>> = {
  idle: PLAYABLE_ASSET_BY_ID.keeperIdle.key,
  ready: PLAYABLE_ASSET_BY_ID.keeperReady.key,
  diveLeft: PLAYABLE_ASSET_BY_ID.keeperDiveLeft.key,
  diveRight: PLAYABLE_ASSET_BY_ID.keeperDiveRight.key,
  save: PLAYABLE_ASSET_BY_ID.keeperSave.key,
  miss: PLAYABLE_ASSET_BY_ID.keeperMiss.key
};

// Keeper heights — sized to fit believably inside realistic background goal
const KEEPER_HEIGHT_BY_PUPPET_POSE: Readonly<Record<PuppetKeeperPose, number>> = {
  idle: 120,
  ready: 120,
  diveLeft: 95,
  diveRight: 95,
  save: 95,
  miss: 120
};

const KEEPER_POSE_MANIFEST: KeeperPoseManifest = createKeeperPoseManifest({
  idle: PLAYABLE_ASSET_BY_ID.keeperToyIdle.key,
  ready: PLAYABLE_ASSET_BY_ID.keeperToyReady.key,
  readyWide: PLAYABLE_ASSET_BY_ID.keeperToyReadyWide.key,
  anticipateLeft: PLAYABLE_ASSET_BY_ID.keeperToyAnticipateLeft.key,
  anticipateRight: PLAYABLE_ASSET_BY_ID.keeperToyAnticipateRight.key,
  diveLeftLow: PLAYABLE_ASSET_BY_ID.keeperToyDiveLeftLow.key,
  diveLeftMid: PLAYABLE_ASSET_BY_ID.keeperToyDiveLeftMid.key,
  diveLeftHigh: PLAYABLE_ASSET_BY_ID.keeperToyDiveLeftHigh.key,
  diveRightLow: PLAYABLE_ASSET_BY_ID.keeperToyDiveRightLow.key,
  diveRightMid: PLAYABLE_ASSET_BY_ID.keeperToyDiveRightMid.key,
  diveRightHigh: PLAYABLE_ASSET_BY_ID.keeperToyDiveRightHigh.key,
  centerBlock: PLAYABLE_ASSET_BY_ID.keeperToyCenterBlock.key,
  miss: PLAYABLE_ASSET_BY_ID.keeperToyMiss.key,
  recover: PLAYABLE_ASSET_BY_ID.keeperToyRecover.key
});

const KEEPER_ANIMATION_LAYOUT: KeeperAnimationLayout = {
  centerX: getGoalCenterX(),
  keeperY: VISUAL_KEEPER_Y,
  diveY: VISUAL_KEEPER_DIVE_Y,
  leftDiveX: GOAL_FRAME.leftX + 90,
  rightDiveX: GOAL_FRAME.rightX - 90,
  goalTopY: GOAL_FRAME.topY,
  highCornerY: GOAL_FRAME.topY + 72
};

export function createInitialPlayableSnapshot(): PlayableMatchSnapshot {
  return {
    score: { player: 0, goalkeeper: 0 },
    shotNumber: 1,
    maxShots: MATCH_LIMITS.maxShots,
    phase: "aiming",
    outcome: "none"
  };
}

export function planPlayableShot(
  points: readonly GesturePoint[],
  score: MatchScore,
  shotsTaken: number,
  shotHistory: readonly DiveDirection[] = [],
  consecutiveGoalsAgainst = 0,
  consecutiveSaves = 0
): PlayableShotPlan {
  const validation = validateGesture(points);
  if (!validation.valid) {
    throw new Error(`Cannot plan invalid playable shot: ${validation.reason}`);
  }

  const intent = interpretShotIntent(points, {
    viewportWidth: GAME_WIDTH,
    ballY: BALL_START.y,
    goalLeftX: GOAL_FRAME.leftX,
    goalRightX: GOAL_FRAME.rightX,
    goalTopY: GOAL_FRAME.topY,
    goalBottomY: GOAL_FRAME.bottomY
  });
  const trajectory = createBallTrajectory(BALL_START, intent, GAME_WIDTH);
  const keeperDecision = decideGoalkeeperAction({
    pressure: shotsTaken / MATCH_LIMITS.maxShots,
    playerScore: score.player,
    goalkeeperScore: score.goalkeeper,
    consecutiveGoalsAgainst,
    consecutiveSaves,
    matchPoint: shotsTaken >= MATCH_LIMITS.maxShots - 1,
    difficulty: 0.55,
    shotQuality: intent.gestureQuality,
    curve: intent.curve,
    targetX: intent.targetX,
    goalCenterX: getGoalCenterX(),
    shotHistory,
    difficultyPreset: "standard",
    shotIndex: shotsTaken,
    aiSeed: `playable-${shotsTaken}`
  });
  const collision = resolveBallCollision(
    trajectory,
    GOAL_FRAME,
    getKeeperCollisionState(keeperDecision, trajectory.durationMs),
    intent.gestureQuality,
    intent.precisionPenaltyPx
  );
  const outcome = normalizeOutcome(collision.outcome);
  const nextScore = outcome === "goal"
    ? { player: score.player + 1, goalkeeper: score.goalkeeper }
    : { player: score.player, goalkeeper: score.goalkeeper + 1 };
  const shotNumber = Math.min(MATCH_LIMITS.maxShots, shotsTaken + 1);
  const matchEnded = isMatchDecided(nextScore, shotNumber);

  return {
    intent,
    outcome,
    ballSamples: getBallSamples(trajectory),
    keeperDecision,
    score, // PRE-shot score (used for invariant checks)
    shotNumber,
    matchEnded,
    contactPoint: collision.contactPoint,
    collisionReason: collision.reason,
    contactT: collision.contactT,
    contactSampleIndex: collision.contactSampleIndex,
    keeperReachAtContact: collision.keeperReachAtContact,
    keeperDiveDirection: collision.keeperDiveDirection,
    flightDurationMs: trajectory.durationMs
  };
}


// ─── Scene ───
export class PlayablePenaltyScene extends Phaser.Scene {
  // State
  private matchState: MatchState = createMatchState();
  private phase: PlayableMatchSnapshot["phase"] = "aiming";
  private outcome: PlayableOutcome | "none" = "none";
  private gesturePoints: readonly GesturePoint[] = [];
  private activePlan: PlayableShotPlan | null = null;
  private shotDirectionHistory: DiveDirection[] = [];
  private flightElapsedMs = 0;
  private pressureState: PressureState | null = null;
  private heroResult: HeroMomentResult | null = null;
  private _userInteracted = false;
  private consecutiveGoalsAgainst = 0;
  private consecutiveSaves = 0;


  // Display objects
  private layers!: RenderLayerMap;
  private fieldGuides!: Phaser.GameObjects.Graphics;
  private trail!: Phaser.GameObjects.Graphics;
  private trailGlow!: Phaser.GameObjects.Graphics;
  private netPulse!: Phaser.GameObjects.Graphics;
  private ball!: Phaser.GameObjects.Image;
  private ballShadow!: Phaser.GameObjects.Ellipse;
  private keeper!: Phaser.GameObjects.Image;
  private saveBurst!: Phaser.GameObjects.Image;
  private scoreText!: Phaser.GameObjects.Text;
  private shotText!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private shotDots: Phaser.GameObjects.Graphics[] = [];
  private previewLabels: Phaser.GameObjects.Text[] = [];
  private keeperPose: KeeperPose = "idle";
  private keeperAvailableTextureKeys: ReadonlySet<string> = new Set();
  private lastKeeperPresentation: KeeperPresentationFrame | null = null;
  private fxGraphics!: Phaser.GameObjects.Graphics;
  private vignetteGraphics!: Phaser.GameObjects.Graphics;
  // Keeper Puppet (replaces direct keeper image manipulation when enabled)
  private puppet: KeeperPuppet | null = null;

  // Phase 1/1B: Visual cohesion display objects
  private darkOverlay!: Phaser.GameObjects.Graphics;
  private sideVignette!: Phaser.GameObjects.Graphics;
  private goalInterior!: Phaser.GameObjects.Graphics;

  // VFX: Particles + Flash overlay
  private particles!: ParticleEmitter;
  private flashOverlay!: Phaser.GameObjects.Rectangle;

  // Emergency Recovery: debug info for last shot
  private lastShotDebugInfo: {
    targetX: number; targetY: number; force: number; curve: number;
    gestureQuality: number; keeperDiveDir: string; keeperPredictedX: number;
    keeperReachPx: number; outcome: string; collisionReason: string;
    contactPoint: Point2D | null; scoreAfter: string; mood: string;
  } | null = null;
  private goalPostShadow!: Phaser.GameObjects.Graphics;
  private keeperShadow!: Phaser.GameObjects.Ellipse;
  private scorePill!: Phaser.GameObjects.Graphics;
  private shotPill!: Phaser.GameObjects.Graphics;
  private debugGraphics!: Phaser.GameObjects.Graphics;
  private debugLabels: Phaser.GameObjects.Text[] = [];
  private debugMode = false;
  private safeAreaInsets: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  private rotateOverlayBg!: Phaser.GameObjects.Graphics;
  private rotateOverlayText!: Phaser.GameObjects.Text;
  private isLandscapeBlocked = false;

  // Phase 2A: Ball feel display objects
  private ballTrailGraphics!: Phaser.GameObjects.Graphics;
  private flightTrailBuffer: Array<{ x: number; y: number }> = [];
  private ballPulseTween: Phaser.Tweens.Tween | null = null;

  // Phase 4A: Camera state
  private currentZoom = 1.0;
  private zoomTarget = 1.0;

  // HARD RESET: Dev debug controls
  private _devForceOutcome: "goal" | "save" | "miss" | null = null;
  private _devForceDive: "left" | "center" | "right" | null = null;

  // Loading screen
  private loadingBar!: Phaser.GameObjects.Graphics;
  private loadingText!: Phaser.GameObjects.Text;

  constructor() {
    super("PlayablePenaltyScene");
  }

  preload(): void {
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      console.warn(`[ASSET] Failed to load: ${file.key} (${file.url})`);
    });

    // Loading screen
    this.cameras.main.setBackgroundColor("#0a0e1a");
    this.loadingText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "PENALTY SHOOTER", {
      color: "#facc15",
      fontFamily: FONT_FAMILY,
      fontSize: "32px",
      fontStyle: "700"
    }).setOrigin(0.5);
    const subText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "Loading...", {
      color: "#94a3b8",
      fontFamily: FONT_FAMILY,
      fontSize: "16px"
    }).setOrigin(0.5);
    this.loadingBar = this.add.graphics();
    const barWidth = 300;
    const barHeight = 6;
    const barX = (GAME_WIDTH - barWidth) / 2;
    const barY = GAME_HEIGHT / 2 + 40;

    this.load.on("progress", (value: number) => {
      this.loadingBar.clear();
      this.loadingBar.fillStyle(0x1e293b, 1).fillRoundedRect(barX, barY, barWidth, barHeight, 3);
      this.loadingBar.fillStyle(0xe00800, 1).fillRoundedRect(barX, barY, barWidth * value, barHeight, 3);
    });

    this.load.on("complete", () => {
      this.loadingBar.destroy();
      this.loadingText.destroy();
      subText.destroy();
    });

    for (const asset of PLAYABLE_GAMEPLAY_ASSETS) {
      this.load.image(asset.key, asset.path);
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0f172a");
    this.layers = createLogicalLayers(this);
    this.updateSafeAreaInsets();

    // Init match state
    this.matchState = reduceMatchState(createMatchState(), { type: "boot_complete" });
    this.matchState = reduceMatchState(this.matchState, { type: "ready_to_aim" });

    // ── Background ──
    const bgHeight = 1200;
    const bgY = GAME_HEIGHT / 2;
    const background = this.add.image(GAME_WIDTH / 2, bgY, PLAYABLE_ASSET_BY_ID.background.key)
      .setDisplaySize(GAME_WIDTH, bgHeight)
      .setTint(0x99bb99);
    this.layers.field.add(background);

    // Dark overlay — reduces stadium brightness so gameplay sprites pop
    this.darkOverlay = this.add.graphics();
    this.darkOverlay.fillStyle(0x000000, VISUAL_STYLE.darkOverlayAlpha);
    this.darkOverlay.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.layers.field.add(this.darkOverlay);

    // Side vignette — darkens left/right margins to focus eye on portrait active area
    this.sideVignette = this.add.graphics();
    const svAlpha = VISUAL_STYLE.sideVignetteAlpha;
    // Left gradient: opaque at edge → transparent toward center
    for (let i = 0; i < 8; i++) {
      const a = svAlpha * (1 - i / 8);
      const stripW = 36 / 8;
      this.sideVignette.fillStyle(0x0a0e1a, a);
      this.sideVignette.fillRect(stripW * i, 0, stripW, GAME_HEIGHT);
    }
    // Right gradient: transparent toward center → opaque at edge
    for (let i = 0; i < 8; i++) {
      const a = svAlpha * (i / 8);
      const stripW = 36 / 8;
      const rightEdge = GAME_WIDTH - 36;
      this.sideVignette.fillStyle(0x0a0e1a, a);
      this.sideVignette.fillRect(rightEdge + stripW * i, 0, stripW, GAME_HEIGHT);
    }
    this.layers.field.add(this.sideVignette);

    this.fieldGuides = this.add.graphics();
    this.layers.field.add(this.fieldGuides);

    // Ball shadow on field
    this.ballShadow = this.add.ellipse(
      BALL_START.x, BALL_START.y + 16, 60, 16,
      0x000000, VISUAL_STYLE.ballShadowAlpha
    );
    this.layers.field.add(this.ballShadow);

    // ── Goal interior shadow — subtle darkening behind net area for depth ──
    this.goalInterior = this.add.graphics();
    this.goalInterior.fillStyle(VISUAL_STYLE.goalInteriorColor, 0.15);
    this.goalInterior.fillEllipse(
      VISUAL_GOAL_CENTER.x, VISUAL_GOAL_CENTER.y + 10,
      GOAL_FRAME.rightX - GOAL_FRAME.leftX - 30,
      GOAL_FRAME.bottomY - GOAL_FRAME.topY - 15
    );
    this.layers.backGoal.add(this.goalInterior);

    // ── Keeper ──
    // Keeper ground shadow (drawn before keeper so keeper is on top)
    this.keeperShadow = this.add.ellipse(
      getGoalCenterX(), GOAL_FRAME.bottomY + 4, // shadow at keeper's feet on goal line
      VISUAL_STYLE.keeperShadowWidth, VISUAL_STYLE.keeperShadowHeight,
      VISUAL_STYLE.keeperShadowColor, VISUAL_STYLE.keeperShadowAlpha
    );
    this.layers.keeper.add(this.keeperShadow);

    this.keeper = this.add.image(getGoalCenterX(), VISUAL_KEEPER_Y, KEEPER_TEXTURE_BY_POSE.idle)
      .setOrigin(0.5, 0.5);
    this.layers.keeper.add(this.keeper);
    this.keeperAvailableTextureKeys = new Set(
      PLAYABLE_GAMEPLAY_ASSETS
        .map((asset) => asset.key)
        .filter((textureKey) => this.textures.exists(textureKey))
    );
    this.setKeeperPose("idle");

    // ── Keeper Puppet (when enabled, replaces direct keeper manipulation) ──
    if (KEEPER_PUPPET_ENABLED) {
      this.puppet = new KeeperPuppet(this, {
        textureByPose: KEEPER_TEXTURE_BY_POSE,
        heightByPose: KEEPER_HEIGHT_BY_PUPPET_POSE,
        canonicalX: getGoalCenterX(),
        canonicalY: VISUAL_KEEPER_Y,
        diveY: VISUAL_KEEPER_DIVE_Y,
        maxStretch: KEEPER_CANONICAL.maxStretch,
      });
      // Add puppet objects to keeper layer
      for (const obj of this.puppet.getDisplayObjects()) {
        this.layers.keeper.add(obj);
      }
      // Hide old keeper and shadow — puppet manages its own
      this.keeper.setVisible(false);
      this.keeperShadow.setVisible(false);
    }

    // ── Ball ──
    this.ball = this.add.image(BALL_START.x, BALL_START.y, PLAYABLE_ASSET_BY_ID.ball.key)
      .setOrigin(0.5, 0.5);
    this.layers.ball.add(this.ball);
    this.setBallVisual(BALL_START.x, BALL_START.y, 1.0);

    // ── Goal scene — realistic goalpost+net+crowd image as back layer (behind keeper) ──
    // Image layout: crowd (0-30%), goal+net (30-65%), grass (65-100%)
    // Anchor at crossbar (30% from top) → place at GOAL_FRAME.topY
    const crossbarFraction = 0.30;
    const postBaseFraction = 0.65;
    const goalVisualHeight = GOAL_FRAME.bottomY - GOAL_FRAME.topY; // 225px
    const goalImgHeight = goalVisualHeight / (postBaseFraction - crossbarFraction); // ~643px
    const goalScene = this.add.image(GAME_WIDTH / 2, GOAL_FRAME.topY, PLAYABLE_ASSET_BY_ID.goalFront.key)
      .setDisplaySize(GAME_WIDTH, goalImgHeight)
      .setOrigin(0.5, crossbarFraction);
    this.layers.backGoal.add(goalScene);

    // Goal post contact shadow (ground shadow under the goal frame)
    this.goalPostShadow = this.add.graphics();
    this.goalPostShadow.fillStyle(0x000000, VISUAL_STYLE.goalPostShadowAlpha);
    this.goalPostShadow.fillEllipse(
      VISUAL_GOAL_CENTER.x,
      GOAL_FRAME.bottomY + 12,
      GOAL_FRAME.rightX - GOAL_FRAME.leftX + 10,
      24
    );
    this.layers.frontGoal.add(this.goalPostShadow);

    // ── FX layer ──
    this.trailGlow = this.add.graphics();
    this.trail = this.add.graphics();
    this.netPulse = this.add.graphics();
    this.fxGraphics = this.add.graphics();
    this.saveBurst = this.add.image(0, 0, PLAYABLE_ASSET_BY_ID.saveBurst.key)
      .setDisplaySize(126, 120)
      .setVisible(false)
      .setAlpha(0.95);
    // Dedicated ball flight trail — pre-allocated, behind ball (Phase 2A)
    this.ballTrailGraphics = this.add.graphics();
    this.layers.effects.add(this.trailGlow);
    this.layers.effects.add(this.trail);
    this.layers.effects.add(this.ballTrailGraphics);
    this.layers.effects.add(this.netPulse);
    this.layers.effects.add(this.fxGraphics);
    this.layers.effects.add(this.saveBurst);

    // VFX: Particle emitter (for grass kick, confetti, flight sparkles)
    this.particles = new ParticleEmitter(this, 150);
    this.particles.addToContainer(this.layers.effects);

    // Flash overlay (for goal/miss screen flash)
    this.flashOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0)
      .setDepth(200);
    this.layers.ui.add(this.flashOverlay);
    // Vignette overlay (UI layer, drawn last)
    this.vignetteGraphics = this.add.graphics();
    this.layers.ui.add(this.vignetteGraphics);

    // ── UI text — smaller, with dark pill backgrounds ──
    this.scorePill = this.add.graphics();
    this.layers.ui.add(this.scorePill);
    this.shotPill = this.add.graphics();
    this.layers.ui.add(this.shotPill);

    this.scoreText = this.add.text(this.getScoreUiX() + 10, this.getScoreUiY() + 5, "", textStyle(18)).setAlpha(0.95);
    this.shotText = this.add.text(this.getShotUiX() - 10, this.getScoreUiY() + 5, "", textStyle(14)).setOrigin(1, 0).setAlpha(0.85);
    this.resultText = this.add.text(LAYOUT.resultText.x, LAYOUT.resultText.y, "", resultTextStyle(44)).setOrigin(0.5, 0).setAlpha(0);
    this.hintText = this.add.text(LAYOUT.hintText.x, this.getHintY(), "Drag from the ball toward the goal", textStyle(14)).setOrigin(0.5, 0.5).setAlpha(0.6);
    this.layers.ui.add(this.scoreText);
    this.layers.ui.add(this.shotText);
    this.layers.ui.add(this.resultText);
    this.layers.ui.add(this.hintText);

    // Shot counter dots
    this.createShotDots();

    // Input
    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointermove", this.onPointerMove, this);
    this.input.on("pointerup", this.onPointerUp, this);

    // Debug overlay (DEV only — stripped in production)
    this.debugGraphics = this.add.graphics();
    this.layers.ui.add(this.debugGraphics);
    if (IS_DEV && this.input.keyboard) {
      this.input.keyboard.on("keydown-D", () => {
        this.debugMode = !this.debugMode;
        this.drawDebugOverlay();
      });
      // HARD RESET: Dev debug controls for forcing outcomes
      this.input.keyboard.on("keydown-G", () => { this._devForceOutcome = "goal"; });
      this.input.keyboard.on("keydown-V", () => { this._devForceOutcome = "save"; });
      this.input.keyboard.on("keydown-M", () => { this._devForceOutcome = "miss"; });
      this.input.keyboard.on("keydown-L", () => { this._devForceDive = "left"; });
      this.input.keyboard.on("keydown-C", () => { this._devForceDive = "center"; });
      this.input.keyboard.on("keydown-R", () => { this._devForceDive = "right"; });
    }

    this.createRotateOverlay();
    this.drawStaticField();
    this.renderHud();
    this.updateMobileViewportState();

    // Mobile lifecycle
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    window.addEventListener("resize", this.onWindowResize);
    window.addEventListener("orientationchange", this.onWindowResize);

    // Keeper idle bob
    this.startKeeperIdleBob();

    // Ball aiming pulse (Phase 2A)
    this.startBallPulse();

    // Emergency Recovery: initialize pressure for shot 1 (was null, causing keeper to always use default pressure 0)
    this.pressureState = calculatePressure({
      shotIndex: 0,
      maxShots: MATCH_LIMITS.maxShots,
      playerScore: 0,
      goalkeeperScore: 0,
      matchPoint: false,
      finalShot: false,
      alreadyDecided: false,
      resolvedOutcome: "miss"
    });

    this.events.on("shutdown", this.shutdown, this);
  }

  shutdown(): void {
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    window.removeEventListener("resize", this.onWindowResize);
    window.removeEventListener("orientationchange", this.onWindowResize);

    if (this.puppet) {
      this.puppet.destroy();
      this.puppet = null;
    }

    this.stopBallPulse();

    closeAudioContext();
  }

  override update(_: number, deltaMs: number): void {
    if (this.phase === "ball_flight" && this.activePlan !== null) {
      this.updateBallFlight(deltaMs);
    }
    // Keep keeper shadow in sync with keeper position every frame
    this.syncKeeperShadow();
    // Camera zoom only when effects enabled
    if (CAMERA_EFFECTS_ENABLED) {
      this.updateCameraZoom();
    }
    // VFX: Update particle system every frame
    this.particles.update(deltaMs / 1000);
    if (this.debugMode) {
      this.drawDebugOverlay();
    }
  }

  getSnapshot(): PlayableMatchSnapshot {
    return {
      score: this.matchState.score,
      shotNumber: Math.min(this.matchState.shotsTaken + 1, MATCH_LIMITS.maxShots),
      maxShots: MATCH_LIMITS.maxShots,
      phase: this.phase,
      outcome: this.outcome
    };
  }

  // ─── Input handlers ───

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.isLandscapeBlocked) {
      return;
    }

    this._userInteracted = true;

    if (this.phase === "match_end") {
      this.resetMatch();
      return;
    }
    if (this.phase !== "aiming" && this.phase !== "result") {
      return;
    }

    const point = toGesturePoint(pointer, this.cameras.main);
    if (!startsInsideShotZone(point, {
      centerX: BALL_START.x,
      centerY: BALL_START.y,
      viewportWidth: GAME_WIDTH
    })) {
      return;
    }

    // Kill ball aiming pulse immediately so it never fights with flight scaling
    this.stopBallPulse();

    this.phase = "drawing";
    this.outcome = "none";
    this.gesturePoints = [point];
    this.activePlan = null;
    this.flightElapsedMs = 0;
    this.clearOutcomeEffects();
    this.clearFlightTrail();
    // HARD RESET: canonical ball reset
    this.tweens.killTweensOf(this.ball);
    this.tweens.killTweensOf(this.ballShadow);
    this.setBallVisual(BALL_START.x, BALL_START.y, 1.0);
    this.ball.setTint(0xffffff);
    this.ball.setRotation(0);
    this.ball.setAlpha(1);
    this.ballShadow.setAlpha(VISUAL_STYLE.ballShadowAlpha);
    this.ballShadow.setPosition(BALL_START.x, BALL_START.y + 12).setScale(1, 0.3);
    // HARD RESET: canonical keeper reset, then set to ready
    this.resetKeeperToCanonical();
    this.setKeeperPose("ready");
    this.applyKeeperMoodTint();
    this.resultText.setAlpha(0).setY(LAYOUT.resultText.y);
    // Brighten shot zone during drawing (Phase 2A)
    this.drawStaticField(true);
    this.renderHud();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.isLandscapeBlocked) {
      return;
    }

    if (this.phase !== "drawing") {
      return;
    }

    const result = sampleGesturePoint(this.gesturePoints, toGesturePoint(pointer, this.cameras.main));
    if (result.accepted) {
      this.gesturePoints = result.points;
      this.drawTrail();
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.isLandscapeBlocked) {
      return;
    }

    if (this.phase !== "drawing") {
      return;
    }

    // Always include the final point (fix gesture race condition)
    const finalPoint = toGesturePoint(pointer, this.cameras.main);
    const result = sampleGesturePoint(this.gesturePoints, finalPoint);
    this.gesturePoints = result.accepted ? result.points : [...this.gesturePoints, finalPoint];

    if (!validateGesture(this.gesturePoints).valid) {
      this.phase = "aiming";
      this.gesturePoints = [];
      this.clearTrajectoryPreview();
      this.hintText.setText("Draw upward from the ball");
      this.setKeeperPose("idle");
      this.startKeeperIdleBob();
      // Phase 2A: visual nudge for invalid gesture (non-punishing)
      this.nudgeInvalidGesture();
      // Restore normal shot zone brightness and restart ball pulse
      this.drawStaticField(false);
      this.startBallPulse();
      this.renderHud();
      return;
    }

    this.activePlan = planPlayableShot(
      this.gesturePoints,
      this.matchState.score,
      this.matchState.shotsTaken,
      this.shotDirectionHistory,
      this.consecutiveGoalsAgainst,
      this.consecutiveSaves
    );

    // HARD RESET: Dev force outcome override
    if (IS_DEV && this._devForceOutcome !== null) {
      this.activePlan = { ...this.activePlan, outcome: this._devForceOutcome };
      console.log(`[DEV] Forced outcome: ${this._devForceOutcome}`);
      this._devForceOutcome = null;
    }
    if (IS_DEV && this._devForceDive !== null) {
      console.log(`[DEV] Forced keeper dive: ${this._devForceDive}`);
      this._devForceDive = null;
    }

    // Kill idle bob before flight so it doesn't fight with dive animation
    this.tweens.killTweensOf(this.keeper);
    this.phase = "ball_flight";
    this.flightElapsedMs = 0;
    this.flightTrailBuffer = [];
    this.clearTrajectoryPreview();
    this.setKeeperPose("ready");
    this.applyKeeperMoodTint();
    // Restore normal field guides on shot commit
    this.drawStaticField(false);

    // Audio: kick + whoosh + crowd gasp + keeper grunt (only after user interaction)
    if (this._userInteracted) {
      playKickSound();
      const pressure = this.pressureState?.pressure ?? 0;
      this.time.delayedCall(30, () => playWhooshSound(0.5 + pressure * 0.5));
      this.time.delayedCall(50, () => playCrowdGaspSound());
      // Keeper grunt when dive starts
      const reactionMs = this.activePlan?.keeperDecision?.physical?.reactionMs ?? 160;
      this.time.delayedCall(reactionMs, () => playDiveGruntSound());
    }

    // VFX: Grass particles spray from kick point
    if (this.activePlan) {
      const shotDirX = (this.activePlan.intent.targetX - BALL_START.x) / GAME_WIDTH;
      this.particles.emitGrassKick(BALL_START.x, BALL_START.y + 8, shotDirX);
    }

    // VFX: Screen shake on kick (subtle 2px for 100ms)
    this.cameras.main.shake(100, 0.003 + (this.activePlan?.intent.force ?? 0.7) * 0.002);

    this.renderHud();
  }

  // ─── Ball flight ───

  private updateBallFlight(deltaMs: number): void {
    if (this.activePlan === null) return;

    this.flightElapsedMs += deltaMs;
    const plan = this.activePlan;
    const flightDur = plan.flightDurationMs;

    // For saves: ball stops at contactT, not at the final target
    const effectiveEndT = (plan.outcome === "save" && plan.contactT !== null)
      ? plan.contactT
      : 1.0;
    const ballProgress = Math.min(effectiveEndT, this.flightElapsedMs / Math.max(1, flightDur));

    const sampleIndex = Math.min(
      plan.ballSamples.length - 1,
      Math.floor(ballProgress * plan.ballSamples.length)
    );
    const sample = plan.ballSamples[sampleIndex];
    this.setBallVisual(sample.x, sample.y, sample.scale);

    // Curve-direction spin: ball spins matching the curve direction
    const curveSign = plan.intent.curve >= 0 ? 1 : -1;
    const spinSpeed = 1.5 + plan.intent.force * 2.5 + Math.abs(plan.intent.curve) * 3;
    this.ball.setRotation(ballProgress * Math.PI * spinSpeed * curveSign);

    // Ball depth tint (non-linear — fast initial darkening, then gradual)
    const tintEased = Math.pow(ballProgress, 0.6) * 0.4;
    const rc = 0xff - Math.round(tintEased * (0xff - 0xcc));
    const tint = (rc << 16) | (rc << 8) | rc;
    this.ball.setTint(tint);

    // Ball shadow — tracks X position + non-linear depth scaling
    const shadowProgress = Math.pow(ballProgress, 0.7);
    const shadowScale = 1 - shadowProgress * 0.65;
    // Shadow follows ball X (lerp toward ball position as it flies)
    const shadowX = BALL_START.x + (sample.x - BALL_START.x) * Math.min(1, ballProgress * 1.5);
    const shadowY = BALL_START.y + 12 - shadowProgress * 50;
    this.ballShadow.setPosition(Math.round(shadowX), Math.round(shadowY));
    this.ballShadow.setScale(shadowScale, shadowScale * 0.25);
    this.ballShadow.setAlpha(VISUAL_STYLE.ballShadowAlpha * (1 - shadowProgress * 0.6));



    // Ball flight trail
    this.flightTrailBuffer.push({ x: sample.x, y: sample.y });
    if (this.flightTrailBuffer.length > VISUAL_STYLE.flightTrailSegments) {
      this.flightTrailBuffer.shift();
    }
    this.drawFlightTrail(plan.intent.force);

    // Keeper dive animation
    const keeperProgress = this.flightElapsedMs / Math.max(1, flightDur);

    this.applyKeeperPresentation(this.planKeeperFrame(plan, keeperProgress));

    // Finish shot when ball reaches effective end
    if (ballProgress >= effectiveEndT || sampleIndex >= plan.ballSamples.length - 1) {
      this.finishShot();
    }
  }


  // ─── Shot resolution ───

  private finishShot(): void {
    if (this.activePlan === null) return;

    const plan = this.activePlan;
    const outcomeForScoring: "goal" | "save" | "miss" =
      plan.outcome === "goal" ? "goal" : plan.outcome === "save" ? "save" : "miss";

    // HARD RESET: Use resolve_shot — immediate score update, no advance hacking
    this.matchState = reduceMatchState(this.matchState, {
      type: "resolve_shot",
      outcome: outcomeForScoring
    });

    // Track streaks for goalkeeper mood
    if (plan.outcome === "goal") {
      this.consecutiveGoalsAgainst += 1;
      this.consecutiveSaves = 0;
    } else if (plan.outcome === "save") {
      this.consecutiveSaves += 1;
      this.consecutiveGoalsAgainst = 0;
    } else {
      this.consecutiveGoalsAgainst = 0;
      this.consecutiveSaves = 0;
    }

    // Calculate pressure for next shot
    this.pressureState = calculatePressure({
      shotIndex: this.matchState.shotsTaken,
      maxShots: MATCH_LIMITS.maxShots,
      playerScore: this.matchState.score.player,
      goalkeeperScore: this.matchState.score.goalkeeper,
      matchPoint: this.matchState.shotsTaken >= MATCH_LIMITS.maxShots - 1,
      finalShot: this.matchState.shotsTaken >= MATCH_LIMITS.maxShots,
      alreadyDecided: isMatchDecided(this.matchState.score, this.matchState.shotsTaken),
      resolvedOutcome: plan.outcome
    });

    // Track dive direction for pattern memory
    this.shotDirectionHistory = [...this.shotDirectionHistory, plan.keeperDecision.tactical.diveDirection].slice(-5);

    // Compute actual distances for hero moment detection
    const keeperReach = plan.keeperDecision.physical.reachRadiusPx;
    const actualBallDistFromReach = plan.contactPoint !== null
      ? Math.max(0, Math.hypot(
          plan.ballSamples.at(-1)!.x - plan.contactPoint.x,
          plan.ballSamples.at(-1)!.y - plan.contactPoint.y
        ) - keeperReach)
      : keeperReach; // no contact = far from keeper
    const actualReachRatio = plan.contactT !== null && plan.contactPoint !== null
      ? Math.min(1, Math.hypot(
          plan.contactPoint.x - getGoalCenterX(),
          plan.contactPoint.y - KEEPER_Y
        ) / Math.max(1, keeperReach))
      : 0;
    const shotDir = plan.intent.targetX < getGoalCenterX() ? "left" : plan.intent.targetX > getGoalCenterX() ? "right" : "center";
    const keeperDoveCorrect = plan.keeperDecision.tactical.diveDirection === shotDir;
    const curvedAway = (plan.intent.curve > 0.3 && plan.keeperDecision.tactical.diveDirection === "left")
      || (plan.intent.curve < -0.3 && plan.keeperDecision.tactical.diveDirection === "right");

    this.heroResult = detectHeroMoments({
      finalShot: this.matchState.shotsTaken >= MATCH_LIMITS.maxShots,
      scoreDiff: this.matchState.score.player - this.matchState.score.goalkeeper,
      outcome: plan.outcome,
      ballDistanceFromKeeperReachPx: actualBallDistFromReach,
      keeperReachPx: plan.keeperDecision.physical.reachRadiusPx,
      saveContactReachRatio: actualReachRatio,
      curve: plan.intent.curve,
      postContact: plan.collisionReason === "post_hit",
      keeperDoveCorrectDirection: keeperDoveCorrect,
      ballCurvedAwayFromKeeper: curvedAway
    });

    this.outcome = plan.outcome;
    const isDecided = isMatchDecided(this.matchState.score, this.matchState.shotsTaken);
    this.phase = isDecided ? "match_end" : "result";
    this.gesturePoints = [];

    // HARD RESET: Runtime invariant — score MUST agree with outcome
    if (IS_DEV) {
      const scoreBefore = plan.score; // score before this shot (stored in plan)
      if (outcomeForScoring === "goal" && this.matchState.score.player <= scoreBefore.player) {
        console.error(`[INVARIANT VIOLATION] GOAL displayed but player score did not increase: ${scoreBefore.player} -> ${this.matchState.score.player}`);
      }
      if ((outcomeForScoring === "save" || outcomeForScoring === "miss") && this.matchState.score.goalkeeper <= scoreBefore.goalkeeper) {
        console.error(`[INVARIANT VIOLATION] ${outcomeForScoring.toUpperCase()} displayed but keeper score did not increase: ${scoreBefore.goalkeeper} -> ${this.matchState.score.goalkeeper}`);
      }

      this.lastShotDebugInfo = {
        targetX: Math.round(plan.intent.targetX),
        targetY: Math.round(plan.intent.targetY),
        force: Math.round(plan.intent.force * 100) / 100,
        curve: Math.round(plan.intent.curve * 100) / 100,
        gestureQuality: Math.round(plan.intent.gestureQuality * 100) / 100,
        keeperDiveDir: plan.keeperDecision.tactical.diveDirection,
        keeperPredictedX: Math.round(plan.keeperDecision.tactical.predictedX),
        keeperReachPx: Math.round(plan.keeperDecision.physical.reachRadiusPx),
        outcome: plan.outcome,
        collisionReason: plan.collisionReason,
        contactPoint: plan.contactPoint,
        scoreAfter: `P${this.matchState.score.player}-K${this.matchState.score.goalkeeper}`,
        mood: plan.keeperDecision.emotional.mood,
      };
      if (this.debugMode) this.drawDebugOverlay();
    }
    this.clearTrajectoryPreview();

    // IMPORTANT: renderHud BEFORE presentOutcome so score is visible immediately
    this.renderHud();
    this.updateShotDots();

    // Present outcome with effects
    this.presentOutcome(plan);

    // Camera shake disabled (HARD RESET)

    // Play outcome sound + enhanced audio
    if (plan.outcome === "goal") {
      playGoalSound();
    } else if (plan.outcome === "save") {
      playSaveSound();
      this.time.delayedCall(100, () => playCrowdGroanSound());
    } else {
      // Check if it was a post hit for metallic clang
      if (plan.collisionReason === "post_hit") {
        playPostHitSound();
      } else {
        playMissSound();
      }
      this.time.delayedCall(100, () => playCrowdGroanSound());
    }

    // ── VFX: Clean outcome effects ──

    // Subtle flash overlay
    this.playFlashOverlay(plan.outcome);

    // Post hit: screen shake
    if (plan.collisionReason === "post_hit") {
      this.cameras.main.shake(150, 0.008);
    }

    // Screen vignette flash
    this.flashVignette(plan.outcome);

    // Score pop animation
    this.animateScoreChange();

    // Result text animation
    this.animateResultText(plan.outcome);
  }

  private resetMatch(): void {
    this.matchState = reduceMatchState(createMatchState(), { type: "boot_complete" });
    this.matchState = reduceMatchState(this.matchState, { type: "ready_to_aim" });
    this.phase = "aiming";
    this.outcome = "none";
    this.activePlan = null;
    this.flightElapsedMs = 0;
    this.pressureState = calculatePressure({
      shotIndex: 0,
      maxShots: MATCH_LIMITS.maxShots,
      playerScore: 0,
      goalkeeperScore: 0,
      matchPoint: false,
      finalShot: false,
      alreadyDecided: false,
      resolvedOutcome: "miss"
    });
    this.heroResult = null;
    this.consecutiveGoalsAgainst = 0;
    this.consecutiveSaves = 0;
    this.shotDirectionHistory = [];
    // HARD RESET: canonical ball reset
    this.setBallVisual(BALL_START.x, BALL_START.y, 1.0);
    this.ball.setRotation(0);
    this.ball.setTint(0xffffff);
    this.ball.setAlpha(1);
    this.tweens.killTweensOf(this.ball);
    this.tweens.killTweensOf(this.ballShadow);
    this.ballShadow.setPosition(BALL_START.x, BALL_START.y + 12).setScale(1, 0.3).setAlpha(VISUAL_STYLE.ballShadowAlpha);
    this.keeperShadow.setPosition(getGoalCenterX(), VISUAL_KEEPER_Y + 50)
      .setScale(1, 1).setAlpha(VISUAL_STYLE.keeperShadowAlpha);
    // HARD RESET: canonical keeper reset
    this.resetKeeperToCanonical();
    this.startKeeperIdleBob();
    this.clearTrajectoryPreview();
    this.clearOutcomeEffects();
    this.clearFlightTrail();
    this.resultText.setAlpha(0).setY(LAYOUT.resultText.y);
    this.drawStaticField(false);
    this.startBallPulse();
    // Force camera to base state
    this.currentZoom = 1.0;
    this.zoomTarget = 1.0;
    this.cameras.main.setZoom(1.0);
    this.cameras.main.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    this.createShotDots();
    this.renderHud();
  }

  // ─── Rendering helpers ───

  private drawStaticField(drawingPhase = false): void {
    this.fieldGuides.clear();
    // Goalkeeper area shadow (subtle)
    this.fieldGuides.fillStyle(0x000000, 0.15).fillEllipse(
      VISUAL_GOAL_CENTER.x,
      GOAL_FRAME.bottomY + 12,
      GOAL_FRAME.rightX - GOAL_FRAME.leftX,
      36
    );
    // Shot zone circles around ball — brighter during drawing phase (Phase 2A)
    const outerAlpha = drawingPhase ? 0.8 : 0.5;
    const innerAlpha = drawingPhase ? 0.4 : 0.2;
    this.fieldGuides.lineStyle(2, 0x9ae6b4, outerAlpha).strokeCircle(BALL_START.x, BALL_START.y, 50);
    this.fieldGuides.lineStyle(1, 0xf8fafc, innerAlpha).strokeCircle(BALL_START.x, BALL_START.y, 32);
  }

  private drawTrail(): void {
    this.clearTrajectoryPreview();
    if (this.gesturePoints.length < 2) return;

    const pressure = this.pressureState?.pressure ?? 0;
    const brightness = 0.6 + pressure * 0.4;

    // Estimate power from current gesture length for color feedback
    const pathLen = this.gesturePoints.slice(1).reduce((sum, p, i) =>
      sum + Math.hypot(p.x - this.gesturePoints[i].x, p.y - this.gesturePoints[i].y), 0);
    const powerEstimate = Math.min(1, pathLen / 300);

    // Path simplification (Ramer-Douglas-Peucker)
    const simplified = this.simplifyTrailPath(this.gesturePoints, 2.5);
    if (simplified.length < 2) return;

    // Power-based color (hue: blue 200 to orange 40)
    const hue = Math.round(200 - powerEstimate * 160);
    const coreColor = this.hslToHex(hue, 90, 65);
    const glowColor = this.hslToHex(hue, 90, 55);

    // Layer 1: Outer glow
    this.trailGlow.lineStyle(18, glowColor, 0.12 * brightness);
    this.strokeSmooth(this.trailGlow, simplified);

    // Layer 2: Shadow
    this.trail.lineStyle(8, 0x111827, 0.45);
    this.strokeSmooth(this.trail, simplified);

    // Layer 3: Core line
    this.trail.lineStyle(4.5, coreColor, 0.88 * brightness);
    this.strokeSmooth(this.trail, simplified);

    // Layer 4: White highlight center
    this.trail.lineStyle(1.5, 0xffffff, 0.7 * brightness);
    this.strokeSmooth(this.trail, simplified);

    // Brush tip at the end
    if (simplified.length >= 2) {
      const tip = simplified[simplified.length - 1];
      this.trail.fillStyle(0xffffff, 0.85 * brightness);
      this.trail.fillCircle(tip.x, tip.y, 3 + powerEstimate * 3);
      this.trail.fillStyle(coreColor, 0.4 * brightness);
      this.trail.fillCircle(tip.x, tip.y, 5 + powerEstimate * 4);
    }
  }

  private simplifyTrailPath(
    points: readonly { x: number; y: number }[],
    epsilon: number
  ): Array<{ x: number; y: number }> {
    if (points.length <= 2) return points.map(p => ({ x: p.x, y: p.y }));
    const first = points[0];
    const last = points[points.length - 1];
    let maxDist = 0;
    let maxIdx = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const dx = last.x - first.x;
      const dy = last.y - first.y;
      const lenSq = dx * dx + dy * dy;
      let dist: number;
      if (lenSq === 0) {
        dist = Math.hypot(points[i].x - first.x, points[i].y - first.y);
      } else {
        dist = Math.abs(dy * points[i].x - dx * points[i].y + last.x * first.y - last.y * first.x) / Math.sqrt(lenSq);
      }
      if (dist > maxDist) { maxDist = dist; maxIdx = i; }
    }
    if (maxDist > epsilon) {
      const left = this.simplifyTrailPath(points.slice(0, maxIdx + 1), epsilon);
      const right = this.simplifyTrailPath(points.slice(maxIdx), epsilon);
      return [...left.slice(0, -1), ...right];
    }
    return [{ x: first.x, y: first.y }, { x: last.x, y: last.y }];
  }

  private strokeSmooth(
    gfx: Phaser.GameObjects.Graphics,
    points: Array<{ x: number; y: number }>
  ): void {
    if (points.length < 2) return;
    gfx.beginPath();
    gfx.moveTo(points[0].x, points[0].y);
    if (points.length === 2) {
      gfx.lineTo(points[1].x, points[1].y);
    } else {
      const mid0x = (points[0].x + points[1].x) / 2;
      const mid0y = (points[0].y + points[1].y) / 2;
      gfx.lineTo(mid0x, mid0y);
      for (let i = 1; i < points.length - 1; i++) {
        const curr = points[i];
        const next = points[i + 1];
        const midX = (curr.x + next.x) / 2;
        const midY = (curr.y + next.y) / 2;
        const prevMidX = (points[i - 1].x + curr.x) / 2;
        const prevMidY = (points[i - 1].y + curr.y) / 2;
        for (let t = 0.25; t <= 1; t += 0.25) {
          const inv = 1 - t;
          const bx = inv * inv * prevMidX + 2 * inv * t * curr.x + t * t * midX;
          const by = inv * inv * prevMidY + 2 * inv * t * curr.y + t * t * midY;
          gfx.lineTo(bx, by);
        }
      }
      const last = points[points.length - 1];
      gfx.lineTo(last.x, last.y);
    }
    gfx.strokePath();
  }

  private hslToHex(h: number, s: number, l: number): number {
    const sn = s / 100;
    const ln = l / 100;
    const a = sn * Math.min(ln, 1 - ln);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = ln - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color);
    };
    return (f(0) << 16) | (f(8) << 8) | f(4);
  }


  private renderHud(): void {
    const ui = getOutcomeUi({
      playerScore: this.matchState.score.player,
      goalkeeperScore: this.matchState.score.goalkeeper,
      shotNumber: Math.min(this.matchState.shotsTaken + 1, MATCH_LIMITS.maxShots),
      maxShots: MATCH_LIMITS.maxShots,
      outcome: this.outcome,
      firstValidGestureSeen: this.matchState.shotsTaken > 0,
      viewportWidth: GAME_WIDTH,
      viewportHeight: GAME_HEIGHT,
      ballStartZone: {
        left: BALL_START.x - 56,
        top: BALL_START.y - 56,
        right: BALL_START.x + 56,
        bottom: BALL_START.y + 56
      },
      goalCorners: [
        { left: GOAL_FRAME.leftX - 16, top: GOAL_FRAME.topY - 16, right: GOAL_FRAME.leftX + 16, bottom: GOAL_FRAME.topY + 16 },
        { left: GOAL_FRAME.rightX - 16, top: GOAL_FRAME.topY - 16, right: GOAL_FRAME.rightX + 16, bottom: GOAL_FRAME.topY + 16 }
      ],
      goalkeeperBody: (KEEPER_PUPPET_ENABLED && this.puppet)
        ? this.puppet.getBodyBounds()
        : {
          left: this.keeper.x - this.keeper.displayWidth / 2,
          top: this.keeper.y - this.keeper.displayHeight / 2,
          right: this.keeper.x + this.keeper.displayWidth / 2,
          bottom: this.keeper.y + this.keeper.displayHeight / 2
        },
      gesturePath: { left: 70, top: GOAL_FRAME.topY, right: GAME_WIDTH - 70, bottom: BALL_START.y }
    });

    this.scoreText.setText(ui.scoreText);
    this.shotText.setText(ui.shotText);

    this.positionHud();

    if (this.phase === "aiming" || this.phase === "drawing") {
      this.hintText.setAlpha(0.6);
      this.hintText.setText(this.phase === "drawing" ? "Release to shoot" : ui.firstUseHint ?? "Drag again for next shot");
    } else if (this.phase === "match_end") {
      const playerWon = this.matchState.score.player > this.matchState.score.goalkeeper;
      const matchEndText = playerWon
        ? "YOU WIN  ·  Tap to play again"
        : "YOU LOSE  ·  Tap to play again";
      this.hintText.setAlpha(0.85);
      this.hintText.setText(matchEndText);
    } else {
      this.hintText.setAlpha(0);
    }
  }

  /**
   * Phased keeper animation with 3D-feel enhancements:
   * 1. Anticipation (0 → reactionT): crouch + weight shift toward dive side
   * 2. Dive travel (reactionT → contactT or 0.85): leap with perspective scaling + depth tint
   * 3. Contact (near contactT): landing squash impact
   * 4. Recovery (after contactT): settle bounce + tint fade
   */
  protected moveKeeperPhased(
    direction: DiveDirection,
    progress: number,
    contactT: number | null,
    reactionT: number
  ): void {
    const targetX = getKeeperX(direction);
    const divePose: KeeperPose = direction === "left" ? "dive_left" : direction === "right" ? "dive_right" : "ready";
    const anticipationEnd = Math.max(0.08, Math.min(reactionT, 0.2));
    const diveEnd = contactT !== null ? contactT : 0.85;

    // How far from center the keeper goes (0=center, 1=full dive)
    const diveDistanceRatio = Math.abs(targetX - getGoalCenterX()) / ((GOAL_FRAME.rightX - GOAL_FRAME.leftX) / 2);

    if (progress < anticipationEnd) {
      // ── Phase 1: Anticipation (Crouch + Weight Shift) ──
      this.setKeeperPose("ready");
      const leanProgress = progress / anticipationEnd;
      const eased = smoothStep(leanProgress);

      // Lean toward dive direction
      const leanX = direction === "left" ? -12 : direction === "right" ? 12 : 0;
      // Crouch down slightly before leaping (squash effect)
      const crouchY = 4 * Math.sin(leanProgress * Math.PI * 0.5);
      this.keeper.setPosition(
        getGoalCenterX() + leanX * eased,
        VISUAL_KEEPER_Y + crouchY
      );
      this.keeper.setRotation(0);

      // Anticipation squash: slight Y compression before the leap
      const baseHeight = KEEPER_POSE_MANIFEST["ready"].displayHeight;
      const baseWidth = (this.keeper.frame.width / this.keeper.frame.height) * baseHeight;
      const squashY = 1 - eased * 0.05; // compress 5% at peak
      const squashX = 1 + eased * 0.03; // widen slightly
      this.keeper.setDisplaySize(baseWidth * squashX, baseHeight * squashY);

    } else if (progress < diveEnd) {
      // ── Phase 2: Dive Travel (Leap + Perspective) ──
      this.setKeeperPose(divePose);
      const diveProgress = (progress - anticipationEnd) / Math.max(0.01, diveEnd - anticipationEnd);
      const easedDive = smoothStep(Math.min(1, diveProgress));

      // Enhanced arc motion — higher peak, more dramatic leap
      const arcHeight = 16 + diveDistanceRatio * 8; // higher arc for wider dives
      const diveArc = Math.sin(easedDive * Math.PI) * arcHeight;

      this.keeper.setPosition(
        getGoalCenterX() + (targetX - getGoalCenterX()) * easedDive,
        VISUAL_KEEPER_Y + (VISUAL_KEEPER_DIVE_Y - VISUAL_KEEPER_Y) * easedDive - diveArc
      );

      // 3D Perspective scaling — keeper shrinks as they dive to edges
      const perspectiveScale = 1 - diveDistanceRatio * easedDive * 0.1; // up to 10% smaller at edges

      // Enhanced rotation during dive
      const rotationPeak = direction === "left" ? -0.18 : direction === "right" ? 0.18 : 0;
      const rotationCurve = Math.sin(easedDive * Math.PI);
      this.keeper.setRotation(rotationPeak * rotationCurve);

      // Squash/stretch with perspective: stretch during leap, squash on landing
      const baseHeight = KEEPER_POSE_MANIFEST[divePose].displayHeight;
      const baseWidth = (this.keeper.frame.width / this.keeper.frame.height) * baseHeight;
      const stretchPhase = easedDive < 0.5
        ? Math.sin(easedDive * Math.PI) // stretch during ascent
        : Math.sin(easedDive * Math.PI) * 0.6; // less stretch during descent
      const stretchX = 1 + stretchPhase * 0.04;
      const stretchY = 1 - stretchPhase * 0.02;
      this.keeper.setDisplaySize(
        baseWidth * stretchX * perspectiveScale,
        baseHeight * stretchY * perspectiveScale
      );

      // 3D Depth tinting — slightly darker when diving to edges
      const depthDarken = Math.round(diveDistanceRatio * easedDive * 30);
      const r = 0xff - depthDarken;
      const depthTint = (r << 16) | (r << 8) | r;
      this.keeper.setTint(depthTint);

    } else {
      // ── Phase 3/4: Contact + Recovery (Landing Impact) ──
      this.setKeeperPose(divePose);
      const recoveryProgress = Math.min(1, (progress - diveEnd) / 0.18);

      // Landing squash bounce
      const bouncePhase = Math.sin(recoveryProgress * Math.PI * 2) * Math.exp(-recoveryProgress * 4);
      const landingSquashX = 1 + bouncePhase * 0.06;
      const landingSquashY = 1 - bouncePhase * 0.04;

      // Perspective scale at final position
      const perspectiveScale = 1 - diveDistanceRatio * 0.1;

      const baseHeight = KEEPER_POSE_MANIFEST[divePose].displayHeight;
      const baseWidth = (this.keeper.frame.width / this.keeper.frame.height) * baseHeight;
      this.keeper.setDisplaySize(
        baseWidth * landingSquashX * perspectiveScale,
        baseHeight * landingSquashY * perspectiveScale
      );

      // Settle into final position
      this.keeper.setPosition(targetX, VISUAL_KEEPER_DIVE_Y + bouncePhase * 3);

      // Rotation eases back
      const rotationPeak = direction === "left" ? -0.1 : direction === "right" ? 0.1 : 0;
      this.keeper.setRotation(rotationPeak * (1 - smoothStep(recoveryProgress)));

      // Depth tint fades back toward normal
      const depthDarken = Math.round(diveDistanceRatio * (1 - recoveryProgress * 0.5) * 30);
      const r = 0xff - depthDarken;
      this.keeper.setTint((r << 16) | (r << 8) | r);
    }
  }

  private planKeeperFrame(plan: PlayableShotPlan, progress: number): KeeperPresentationFrame {
    const presentationDiveDirection = plan.outcome === "save"
      ? plan.keeperDiveDirection
      : plan.keeperDecision.tactical.diveDirection;

    return planKeeperPresentation({
      mood: plan.keeperDecision.emotional.mood,
      pressure: this.pressureState?.pressure ?? 0,
      diveDirection: presentationDiveDirection,
      outcome: plan.outcome,
      contactPoint: plan.contactPoint,
      contactT: plan.contactT,
      reactionMs: plan.keeperDecision.physical.reactionMs,
      predictedTarget: {
        x: plan.contactPoint?.x ?? plan.keeperDecision.tactical.predictedX,
        y: plan.contactPoint?.y ?? plan.intent.targetY
      },
      shotIndex: this.matchState.shotsTaken,
      progress,
      flightDurationMs: plan.flightDurationMs,
      layout: KEEPER_ANIMATION_LAYOUT,
      manifest: KEEPER_POSE_MANIFEST,
      availableTextureKeys: this.keeperAvailableTextureKeys
    });
  }

  private planIdleKeeperFrame(): KeeperPresentationFrame {
    const mood = this.getKeeperMoodFromState();
    return planKeeperPresentation({
      mood,
      pressure: this.pressureState?.pressure ?? 0,
      diveDirection: "center",
      outcome: "miss",
      contactPoint: null,
      contactT: null,
      reactionMs: 160,
      predictedTarget: VISUAL_GOAL_CENTER,
      shotIndex: this.matchState.shotsTaken,
      progress: 0,
      flightDurationMs: 900,
      layout: KEEPER_ANIMATION_LAYOUT,
      manifest: KEEPER_POSE_MANIFEST,
      availableTextureKeys: this.keeperAvailableTextureKeys
    });
  }

  private applyKeeperPresentation(frame: KeeperPresentationFrame): void {
    if (this.keeper.texture.key !== frame.textureKey) {
      this.keeper.setTexture(frame.textureKey);
    }
    this.keeperPose = frame.selectedPose;
    this.keeper
      .setOrigin(frame.origin.x, frame.origin.y)
      .setFlipX(frame.flipX)
      .setPosition(frame.x, frame.y)
      .setRotation(frame.rotation)
      .setAlpha(1);
    setImageDisplayHeight(this.keeper, frame.displayHeight * frame.scale);
    if (frame.tint !== null) {
      this.keeper.setTint(frame.tint);
    } else {
      this.keeper.clearTint();
    }
    this.lastKeeperPresentation = frame;

    if (IS_DEV) {
      const maxH = frame.selectedPose === "idle" || frame.selectedPose === "ready" || frame.selectedPose.endsWith("_idle")
        ? KEEPER_CANONICAL.maxIdleHeight
        : KEEPER_CANONICAL.maxSaveHeight;
      if (this.keeper.displayHeight > maxH * KEEPER_CANONICAL.maxStretch + 1) {
        console.warn(`[KEEPER SIZE WARN] pose=${frame.selectedPose} displayHeight=${this.keeper.displayHeight.toFixed(1)} > max=${maxH * KEEPER_CANONICAL.maxStretch}`);
      }
    }
  }

  private setKeeperPose(pose: KeeperPose): void {
    const poseDef = KEEPER_POSE_MANIFEST[pose];
    const primaryExists = this.keeperAvailableTextureKeys.size === 0 || this.keeperAvailableTextureKeys.has(poseDef.textureKey);
    const fallbackExists = this.keeperAvailableTextureKeys.size === 0 || this.keeperAvailableTextureKeys.has(poseDef.fallbackTextureKey);
    const textureKey = primaryExists
      ? poseDef.textureKey
      : fallbackExists
        ? poseDef.fallbackTextureKey
        : KEEPER_POSE_MANIFEST.idle.textureKey;
    const selectedPose = primaryExists ? pose : poseDef.fallbackPoseId;
    if (this.keeper.texture.key !== textureKey) {
      this.keeper.setTexture(textureKey);
    }
    this.keeperPose = selectedPose;
    this.keeper.setOrigin(poseDef.origin.x, poseDef.origin.y).setFlipX(false);
    setImageDisplayHeight(this.keeper, KEEPER_POSE_MANIFEST[selectedPose].displayHeight);
  }

  /** Canonical keeper reset. Restores every visual property to known state. */
  private resetKeeperToCanonical(): void {
    // Puppet reset
    if (KEEPER_PUPPET_ENABLED && this.puppet) {
      this.puppet.resetToCanonical();
    }

    // Keeper reset (always run for safety, even if hidden)
    this.tweens.killTweensOf(this.keeper);
    this.setKeeperPose("idle");
    this.keeper.setFlipX(false);
    this.keeper.setPosition(getGoalCenterX(), VISUAL_KEEPER_Y);
    this.keeper.setRotation(0);
    this.keeper.setAlpha(1);
    this.keeper.clearTint();
    this.lastKeeperPresentation = this.planIdleKeeperFrame();
  }

  /** Apply visible mood tint to keeper during aiming phase. */
  private applyKeeperMoodVisual(): void {
    const mood = this.pressureState?.presentation?.moodIntensity != null
      ? this.getKeeperMoodFromState()
      : "calm";

    // Puppet mood tint
    if (KEEPER_PUPPET_ENABLED && this.puppet) {
      const tint = KEEPER_MOOD_TINTS[mood];
      this.puppet.setMood(mood as PuppetMood);
      this.puppet.applyMoodTint(tint ?? null);
      return;
    }
    this.applyKeeperPresentation(this.planIdleKeeperFrame());
  }

  private applyKeeperMoodTint(): void {
    const tint = KEEPER_MOOD_TINTS[this.getKeeperMoodFromState()];
    if (tint != null) {
      this.keeper.setTint(tint);
    } else {
      this.keeper.clearTint();
    }
  }

  /** Derive mood label from current match state for visual wiring. */
  private getKeeperMoodFromState(): GoalkeeperMood {
    if (!this.pressureState) return "calm";
    const p = this.pressureState.pressure;
    const scoreDiff = this.matchState.score.player - this.matchState.score.goalkeeper;
    if (this.matchState.shotsTaken >= MATCH_LIMITS.maxShots - 1 && (scoreDiff > 0 || p >= 0.82)) return "desperate";
    if (this.consecutiveGoalsAgainst >= 2 || scoreDiff > 1) return "nervous";
    if (this.consecutiveSaves >= 2 || (p >= 0.55 && scoreDiff === 0)) return "focused";
    if (scoreDiff < 0 || (p >= 0.7 && this.matchState.shotsTaken < MATCH_LIMITS.maxShots - 1)) return "aggressive";
    return "calm";
  }

  private setBallVisual(x: number, y: number, scale: number): void {
    const size = BALL_BASE_DISPLAY_SIZE * scale;
    this.ball.setPosition(x, y).setDisplaySize(size, size);
  }

  private presentOutcome(plan: PlayableShotPlan): void {
    const finalSample = plan.ballSamples.at(-1) ?? { x: BALL_START.x, y: BALL_START.y, scale: 0.62, progress: 1 };
    const contactSample = plan.contactPoint !== null
      ? { x: plan.contactPoint.x, y: plan.contactPoint.y, scale: finalSample.scale }
      : finalSample;
    this.setBallVisual(
      plan.outcome === "save" ? contactSample.x : finalSample.x,
      plan.outcome === "save" ? contactSample.y : finalSample.y,
      plan.outcome === "save" ? contactSample.scale : finalSample.scale
    );
    // Clear flight trail on outcome
    this.clearFlightTrail();

    if (plan.outcome === "save") {
      // ── SAVE: movement + contact, NO size inflation ──
      const diveDir = plan.keeperDecision.tactical.diveDirection;
      const saveFrame = this.planKeeperFrame(plan, Math.min(1, (plan.contactT ?? 0.85) + 0.01));

      // Puppet save contact
      if (KEEPER_PUPPET_ENABLED && this.puppet) {
        const savePose: PuppetKeeperPose = diveDir === "left" ? "diveLeft" : diveDir === "right" ? "diveRight" : "save";
        this.puppet.setPose(savePose as PuppetKeeperPose);
        if (plan.contactPoint) {
          this.puppet.executeSaveContact(plan.contactPoint, diveDir);
        }
      } else {
        this.tweens.killTweensOf(this.keeper);
        this.applyKeeperPresentation(saveFrame);
        this.keeper.setTint(0xeeffee);
        this.time.delayedCall(100, () => this.keeper.clearTint());
      }

      // Save burst at contact point
      const burstX = plan.contactPoint?.x ?? contactSample.x;
      const burstY = plan.contactPoint?.y ?? contactSample.y;
      if (saveFrame.visualSaveTrusted) {
        this.saveBurst
          .setPosition(burstX, burstY)
          .setDisplaySize(0, 0)
          .setVisible(true)
          .setAlpha(1);
        this.tweens.add({
          targets: this.saveBurst,
          displayWidth: 100,
          displayHeight: 96,
          alpha: 0,
          duration: 300,
          ease: "Cubic.easeOut"
        });
      } else {
        this.saveBurst.setVisible(false);
      }

      // Ball deflection: ball bounces away from keeper after save
      const deflectX = diveDir === "left"
        ? contactSample.x + 40
        : diveDir === "right"
          ? contactSample.x - 40
          : contactSample.x + (this.matchState.shotsTaken % 2 === 0 ? 30 : -30);
      const deflectY = contactSample.y + 50;
      this.tweens.add({
        targets: this.ball,
        x: deflectX,
        y: deflectY,
        displayWidth: BALL_BASE_DISPLAY_SIZE * 0.5,
        displayHeight: BALL_BASE_DISPLAY_SIZE * 0.5,
        alpha: 0.4,
        duration: 450,
        ease: "Cubic.easeOut"
      });

      if (saveFrame.visualSaveTrusted) {
        this.drawImpactRing(burstX, burstY, 0xe00800, 50);
      }

    } else if (plan.outcome === "goal") {
      // ── GOAL: ball sinks into net ──
      if (KEEPER_PUPPET_ENABLED && this.puppet) {
        this.puppet.setPose("miss");
        const bodySprite = this.puppet.getBodySprite();
        this.tweens.killTweensOf(bodySprite);
        this.tweens.add({
          targets: bodySprite,
          y: VISUAL_KEEPER_Y + 50,
          rotation: plan.keeperDecision.tactical.diveDirection === "left" ? -0.15 : 0.15,
          alpha: 0.8,
          duration: 500,
          ease: "Sine.easeOut"
        });
      } else {
        this.tweens.killTweensOf(this.keeper);
        this.applyKeeperPresentation(this.planKeeperFrame(plan, 1));
        this.tweens.add({
          targets: this.keeper,
          y: VISUAL_KEEPER_Y + 50,
          rotation: plan.keeperDecision.tactical.diveDirection === "left" ? -0.15 : 0.15,
          alpha: 0.8,
          duration: 500,
          ease: "Sine.easeOut"
        });
      }

      // Ball sinks into net (moves deeper, scales down, fades slightly)
      this.tweens.add({
        targets: this.ball,
        y: finalSample.y + 20,
        displayWidth: BALL_BASE_DISPLAY_SIZE * finalSample.scale * 0.7,
        displayHeight: BALL_BASE_DISPLAY_SIZE * finalSample.scale * 0.7,
        alpha: 0.7,
        duration: 350,
        ease: "Cubic.easeOut"
      });

      // Hide ball shadow (ball is in net)
      this.tweens.add({
        targets: this.ballShadow,
        alpha: 0,
        duration: 200,
        ease: "Cubic.easeOut"
      });


    } else {
      // ── MISS: ball exits the scene ──
      if (KEEPER_PUPPET_ENABLED && this.puppet) {
        this.puppet.setPose("miss");
        const bodySprite = this.puppet.getBodySprite();
        this.tweens.killTweensOf(bodySprite);
        bodySprite.setPosition(
          getKeeperX(plan.keeperDecision.tactical.diveDirection),
          VISUAL_KEEPER_DIVE_Y
        ).setRotation(0);
      } else {
        this.tweens.killTweensOf(this.keeper);
        this.applyKeeperPresentation(this.planKeeperFrame(plan, 1));
      }

      // Determine exit direction based on where ball ended up
      const exitX = finalSample.x < getGoalCenterX()
        ? finalSample.x - 80
        : finalSample.x > getGoalCenterX()
          ? finalSample.x + 80
          : finalSample.x;
      const exitY = finalSample.y < GOAL_FRAME.topY
        ? finalSample.y - 60
        : finalSample.y;

      // Ball continues past frame and fades out
      this.tweens.add({
        targets: this.ball,
        x: exitX,
        y: exitY,
        displayWidth: BALL_BASE_DISPLAY_SIZE * finalSample.scale * 0.5,
        displayHeight: BALL_BASE_DISPLAY_SIZE * finalSample.scale * 0.5,
        alpha: 0,
        duration: 500,
        ease: "Cubic.easeOut"
      });

      // Ball shadow fades quickly
      this.tweens.add({
        targets: this.ballShadow,
        alpha: 0,
        duration: 300,
        ease: "Cubic.easeOut"
      });

      // Subtle miss wisp at exit point
      if (plan.collisionReason === "post_hit") {
        this.drawImpactRing(finalSample.x, finalSample.y, 0x636363, 40);
      }
    }
  }


  private drawImpactRing(x: number, y: number, color: number, maxRadius: number): void {
    const ring = { radius: 5, alpha: 0.8 };
    this.tweens.add({
      targets: ring,
      radius: maxRadius,
      alpha: 0,
      duration: 300,
      ease: "Cubic.easeOut",
      onUpdate: () => {
        this.fxGraphics.clear();
        this.fxGraphics.lineStyle(3, color, ring.alpha).strokeCircle(x, y, ring.radius);
        this.fxGraphics.lineStyle(1, 0xf8fafc, ring.alpha * 0.5).strokeCircle(x, y, ring.radius * 0.6);
      }
    });
  }

  private flashVignette(outcome: PlayableOutcome): void {
    // e& brand-aligned vignette: red accent for goal, muted for others
    const color = outcome === "goal" ? 0xe00800 : outcome === "save" ? 0x636363 : 0x4b0f1e;
    const maxAlpha = outcome === "goal" ? 0.10 : 0.05;
    const state = { alpha: maxAlpha };
    this.vignetteGraphics.clear();
    this.vignetteGraphics.fillStyle(color, state.alpha);
    this.vignetteGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.tweens.add({
      targets: state,
      alpha: 0,
      duration: 300,
      ease: "Cubic.easeOut",
      onUpdate: () => {
        this.vignetteGraphics.clear();
        this.vignetteGraphics.fillStyle(color, state.alpha);
        this.vignetteGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      },
      onComplete: () => {
        this.vignetteGraphics.clear();
      }
    });
  }

  private animateScoreChange(): void {
    this.tweens.add({
      targets: this.scoreText,
      scaleX: 1.25,
      scaleY: 1.25,
      duration: 150,
      yoyo: true,
      ease: "Back.easeOut"
    });
  }

  private animateResultText(outcome: PlayableOutcome): void {
    const displayMs = this.heroResult !== null && this.heroResult.moments.length > 0 ? 1250 : 900;
    const resultStr = outcome === "goal" ? "GOAL" : outcome === "save" ? "SAVED" : "MISS";
    this.resultText.setText(resultStr);
    this.resultText.setColor(getResultColor(outcome));
    this.resultText.setScale(0.6);
    this.resultText.setAlpha(0);

    // Clean, elegant scale-in with subtle fade
    this.tweens.add({
      targets: this.resultText,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 280,
      ease: "Cubic.easeOut",
      onComplete: () => {
        this.time.delayedCall(displayMs, () => {
          this.tweens.add({
            targets: this.resultText,
            alpha: 0,
            scaleY: 0.95,
            duration: 300,
            ease: "Cubic.easeIn"
          });
        });
      }
    });
  }

  /** Subtle flash overlay using e& brand tones */
  private playFlashOverlay(outcome: PlayableOutcome): void {
    // e& Red for goals, dark for save/miss
    const color = outcome === "goal" ? 0xe00800 : 0x000000;
    const alpha = outcome === "goal" ? 0.12 : 0.06;
    this.flashOverlay.setFillStyle(color, alpha);
    this.tweens.add({
      targets: this.flashOverlay,
      alpha: 0,
      duration: 350,
      ease: "Cubic.easeOut",
      onStart: () => { this.flashOverlay.setAlpha(1); },
      onComplete: () => { this.flashOverlay.setAlpha(0); }
    });
  }

  // ─── Shot counter dots ───

  private createShotDots(): void {
    for (const dot of this.shotDots) dot.destroy();
    this.shotDots = [];
    const dotSpacing = 14;
    const startX = GAME_WIDTH / 2 - (MATCH_LIMITS.maxShots - 1) * dotSpacing / 2;
    const y = this.getShotDotsY();
    for (let i = 0; i < MATCH_LIMITS.maxShots; i++) {
      const g = this.add.graphics();
      g.lineStyle(1.5, 0xf8fafc, 0.35).strokeCircle(startX + i * dotSpacing, y, 4);
      this.layers.ui.add(g);
      this.shotDots.push(g);
    }
  }

  private updateShotDots(): void {
    const dotSpacing = 14;
    const startX = GAME_WIDTH / 2 - (MATCH_LIMITS.maxShots - 1) * dotSpacing / 2;
    const y = this.getShotDotsY();
    for (let i = 0; i < this.shotDots.length; i++) {
      const g = this.shotDots[i];
      g.clear();
      if (i < this.matchState.shotsTaken) {
        const color = i < this.matchState.score.player ? 0xe00800 : 0x636363;
        g.fillStyle(color, 0.85).fillCircle(startX + i * dotSpacing, y, 4);
      } else {
        g.lineStyle(1.5, 0xf8fafc, 0.25).strokeCircle(startX + i * dotSpacing, y, 4);
      }
    }
  }

  // ─── Lifecycle ───

  private getCanvasElement(): HTMLCanvasElement | null {
    return this.game.canvas ?? null;
  }

  private updateSafeAreaInsets(): void {
    this.safeAreaInsets = getCanvasSafeAreaInsets(this.getCanvasElement(), PORTRAIT_GAME_SIZE);
  }

  private isPortraitDisplay(): boolean {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    return isPortraitViewport(viewportWidth, viewportHeight);
  }

  private getScoreUiX(): number {
    return LAYOUT.scoreUi.x + this.safeAreaInsets.left;
  }

  private getScoreUiY(): number {
    return LAYOUT.scoreUi.y + this.safeAreaInsets.top;
  }

  private getShotUiX(): number {
    return LAYOUT.shotUi.x - this.safeAreaInsets.right;
  }

  private getHintY(): number {
    return LAYOUT.hintText.y - this.safeAreaInsets.bottom;
  }

  private getShotDotsY(): number {
    return LAYOUT.shotDots.y + this.safeAreaInsets.top;
  }

  private createRotateOverlay(): void {
    this.rotateOverlayBg = this.add.graphics();
    this.rotateOverlayBg
      .setDepth(500)
      .fillStyle(0x020617, 0.88)
      .fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.rotateOverlayText = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      "Rotate device\nPortrait play only",
      {
        color: "#f8fafc",
        fontFamily: FONT_FAMILY,
        fontSize: "30px",
        align: "center",
        fontStyle: "700",
        stroke: "#0f172a",
        strokeThickness: 5,
        lineSpacing: 10
      }
    ).setOrigin(0.5).setDepth(501);

    this.layers.ui.add(this.rotateOverlayBg);
    this.layers.ui.add(this.rotateOverlayText);
    this.setRotateOverlayVisible(false);
  }

  private setRotateOverlayVisible(visible: boolean): void {
    if (this.rotateOverlayBg === undefined || this.rotateOverlayText === undefined) return;

    this.rotateOverlayBg.setVisible(visible);
    this.rotateOverlayText.setVisible(visible);
  }

  private updateMobileViewportState(): void {
    this.updateSafeAreaInsets();
    const blocked = !this.isPortraitDisplay();
    const wasBlocked = this.isLandscapeBlocked;

    this.isLandscapeBlocked = blocked;
    this.input.enabled = !blocked;

    if (blocked && !wasBlocked) {
      this.cancelUnsafeInputState();
    }

    if (blocked && this.phase === "ball_flight") {
      this.scene.pause();
    } else if (!blocked) {
      this.scene.resume();
    }

    this.positionHud();
    this.setRotateOverlayVisible(blocked);

    if (this.debugMode) {
      this.drawDebugOverlay();
    }
  }

  private cancelUnsafeInputState(): void {
    if (this.phase !== "drawing") return;

    this.phase = "aiming";
    this.gesturePoints = [];
    this.clearTrajectoryPreview();
    this.drawStaticField(false);
    this.startBallPulse();
    this.renderHud();
  }

  private positionHud(): void {
    if (this.scoreText === undefined || this.shotText === undefined || this.resultText === undefined || this.hintText === undefined) {
      return;
    }

    this.scoreText.setPosition(this.getScoreUiX() + 10, this.getScoreUiY() + 5);
    this.shotText.setPosition(this.getShotUiX() - 10, this.getScoreUiY() + 5);
    this.resultText.setPosition(LAYOUT.resultText.x, Math.max(LAYOUT.resultText.y, 150 + this.safeAreaInsets.top));
    this.hintText.setPosition(LAYOUT.hintText.x, this.getHintY());
    this.updateShotDots();
    this.drawUiPills();
  }

  private startKeeperIdleBob(): void {
    // Apply mood visual on each aiming phase start
    this.applyKeeperMoodVisual();

    // Nervous mood: add a tiny jitter variation
    const mood = this.getKeeperMoodFromState();
    const bobAmplitude = mood === "nervous" ? 4 : mood === "desperate" ? 3 : 2;
    const bobDuration = mood === "nervous" ? 800 : mood === "aggressive" ? 900 : 1200;

    // Vertical bob (weight shift up/down)
    this.tweens.add({
      targets: this.keeper,
      y: VISUAL_KEEPER_Y - bobAmplitude,
      duration: bobDuration,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });

    // Horizontal weight shift (subtle side-to-side sway)
    const swayAmount = mood === "nervous" ? 4 : 2;
    this.tweens.add({
      targets: this.keeper,
      x: getGoalCenterX() + swayAmount,
      duration: bobDuration * 1.6,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: bobDuration * 0.3
    });

    // Subtle rotation (shoulder tilt)
    this.tweens.add({
      targets: this.keeper,
      rotation: 0.015,
      duration: bobDuration * 2,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      delay: bobDuration * 0.5
    });
  }

  // ─── Phase 4A: Camera helpers ───

  private updateCameraZoom(): void {
    if (!CAMERA_FX.zoomEnabled) return;

    // Damped interpolation toward target (no per-frame allocation)
    const diff = this.zoomTarget - this.currentZoom;
    if (Math.abs(diff) < 0.001) {
      // Snap to target when close enough
      if (this.currentZoom !== this.zoomTarget) {
        this.currentZoom = this.zoomTarget;
        this.cameras.main.setZoom(this.currentZoom);
        // Re-center when returning to base zoom
        if (this.currentZoom === CAMERA_FX.zoomBase) {
          this.cameras.main.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
        }
      }
      return;
    }

    this.currentZoom += diff * CAMERA_FX.zoomDamping;
    this.cameras.main.setZoom(this.currentZoom);

    // Scroll toward goal center during zoom-in, recenter during zoom-out
    if (this.currentZoom > CAMERA_FX.zoomBase + 0.005) {
      const zoomProgress = (this.currentZoom - CAMERA_FX.zoomBase) / (CAMERA_FX.zoomMax - CAMERA_FX.zoomBase);
      const scrollX = GAME_WIDTH / 2 + (CAMERA_FX.zoomCenterX - GAME_WIDTH / 2) * zoomProgress * 0.3;
      const scrollY = GAME_HEIGHT / 2 + (CAMERA_FX.zoomCenterY - GAME_HEIGHT / 2) * zoomProgress * 0.3;
      this.cameras.main.centerOn(scrollX, scrollY);
    } else {
      this.cameras.main.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    }
  }

  // ─── Phase 2A: Ball feel helpers ───

  private startBallPulse(): void {
    this.stopBallPulse();
    this.ballPulseTween = this.tweens.add({
      targets: this.ball,
      scaleX: VISUAL_STYLE.ballPulseScale,
      scaleY: VISUAL_STYLE.ballPulseScale,
      duration: VISUAL_STYLE.ballPulseDurationMs,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }

  private stopBallPulse(): void {
    if (this.ballPulseTween !== null) {
      this.ballPulseTween.destroy();
      this.ballPulseTween = null;
    }
    // Reset ball scale to 1.0 so flight scaling owns it fully
    this.ball.setScale(1);
  }

  private drawFlightTrail(force: number): void {
    this.ballTrailGraphics.clear();
    const buf = this.flightTrailBuffer;
    if (buf.length < 2) return;

    const width = VISUAL_STYLE.flightTrailBaseWidth +
      (force / 1.35) * (VISUAL_STYLE.flightTrailMaxWidth - VISUAL_STYLE.flightTrailBaseWidth);

    for (let i = 1; i < buf.length; i++) {
      const alpha = VISUAL_STYLE.flightTrailHeadAlpha * (i / buf.length);
      const segWidth = width * (i / buf.length);
      this.ballTrailGraphics.lineStyle(segWidth, VISUAL_STYLE.flightTrailColor, alpha);
      this.ballTrailGraphics.beginPath();
      this.ballTrailGraphics.moveTo(buf[i - 1].x, buf[i - 1].y);
      this.ballTrailGraphics.lineTo(buf[i].x, buf[i].y);
      this.ballTrailGraphics.strokePath();
    }
  }

  private clearFlightTrail(): void {
    this.flightTrailBuffer = [];
    this.ballTrailGraphics.clear();
  }

  private nudgeInvalidGesture(): void {
    // Tiny ball shake — non-punishing, immediate return to aiming
    this.tweens.add({
      targets: this.ball,
      x: BALL_START.x + 3,
      duration: 40,
      yoyo: true,
      repeat: 1,
      ease: "Sine.easeInOut",
      onComplete: () => this.ball.setPosition(BALL_START.x, BALL_START.y)
    });
    // Hint text flash
    this.tweens.add({
      targets: this.hintText,
      alpha: 1.0,
      duration: 100,
      yoyo: true,
      ease: "Sine.easeInOut"
    });
  }

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.cancelUnsafeInputState();
      this.clearFlightTrail();
      if (this.phase === "ball_flight") {
        this.scene.pause();
      }
    } else {
      this.scene.resume();
      this.updateMobileViewportState();
    }
  };

  private readonly onWindowResize = (): void => {
    this.updateMobileViewportState();
  };

  private clearTrajectoryPreview(): void {
    this.trail.clear();
    this.trailGlow.clear();
    for (const label of this.previewLabels) {
      label.destroy();
    }
    this.previewLabels = [];
  }

  private clearOutcomeEffects(): void {
    this.saveBurst.setVisible(false);
    this.netPulse.clear();
    this.fxGraphics.clear();
    this.vignetteGraphics.clear();
  }

  // ─── Phase 1/1B: Visual cohesion helpers ───

  private syncKeeperShadow(): void {
    // Puppet manages its own shadow
    if (KEEPER_PUPPET_ENABLED && this.puppet) return;

    const keeperX = this.keeper.x;
    const poseHeight = KEEPER_POSE_MANIFEST[this.keeperPose].displayHeight;
    const frame = this.lastKeeperPresentation;
    const shadowY = frame !== null
      ? frame.y + frame.shadowOffsetY
      : this.keeper.y + poseHeight * 0.44;
    this.keeperShadow.setPosition(Math.round(keeperX), Math.round(shadowY));

    // Shadow stretches during dive, contracts at rest
    const isDiving = this.keeperPose === "dive_left" || this.keeperPose === "dive_right";
    const shadowWidthScale = frame?.shadowWidthScale ?? (isDiving ? 1.4 : 1.0);
    const shadowAlpha = frame?.shadowAlpha ?? (isDiving
      ? VISUAL_STYLE.keeperShadowAlpha * 0.7
      : VISUAL_STYLE.keeperShadowAlpha);
    this.keeperShadow.setScale(shadowWidthScale, 1).setAlpha(shadowAlpha);
  }

  private drawUiPills(): void {
    // Score pill
    this.scorePill.clear();
    const scoreW = this.scoreText.width + 20;
    const scoreH = this.scoreText.height + 10;
    this.scorePill.fillStyle(VISUAL_STYLE.uiPillColor, VISUAL_STYLE.uiPillAlpha);
    this.scorePill.fillRoundedRect(
      this.getScoreUiX(), this.getScoreUiY(),
      scoreW, scoreH, VISUAL_STYLE.uiPillRadius
    );

    // Shot count pill
    this.shotPill.clear();
    const shotW = this.shotText.width + 20;
    const shotH = this.shotText.height + 10;
    this.shotPill.fillStyle(VISUAL_STYLE.uiPillColor, VISUAL_STYLE.uiPillAlpha);
    this.shotPill.fillRoundedRect(
      this.getShotUiX() - shotW, this.getScoreUiY(),
      shotW, shotH, VISUAL_STYLE.uiPillRadius
    );
  }

  // ─── Debug overlay (DEV only, no gameplay impact) ───

  private drawDebugOverlay(): void {
    this.debugGraphics.clear();
    for (const label of this.debugLabels) label.destroy();
    this.debugLabels = [];

    if (!IS_DEV || !this.debugMode) return;

    const g = this.debugGraphics;
    g.setDepth(100);

    const mkLabel = (x: number, y: number, text: string, color: string): void => {
      const t = this.add.text(x, y, text, {
        color, fontSize: "10px", fontFamily: FONT_FAMILY
      }).setAlpha(0.6).setDepth(101);
      this.debugLabels.push(t);
    };

    // HARD RESET + Save Timing Fix: Live game state readout
    const stateX = 10 + this.safeAreaInsets.left;
    let stateY = 10 + this.safeAreaInsets.top;
    const stateRow = (text: string) => { mkLabel(stateX, stateY, text, "#22d3ee"); stateY += 13; };
    stateRow(`phase: ${this.phase}`);
    stateRow(`matchPhase: ${this.matchState.phase}`);
    stateRow(`score: P${this.matchState.score.player} - K${this.matchState.score.goalkeeper}`);
    stateRow(`shots: ${this.matchState.shotsTaken}/${MATCH_LIMITS.maxShots}`);
    stateRow(`outcome: ${this.outcome}`);
    stateRow(`portraitBlocked: ${this.isLandscapeBlocked ? "yes" : "no"}`);
    stateRow(`safe: t${this.safeAreaInsets.top} r${this.safeAreaInsets.right} b${this.safeAreaInsets.bottom} l${this.safeAreaInsets.left}`);
    // Keeper + mood info
    const mood = this.getKeeperMoodFromState();
    const pressure = this.pressureState?.pressure ?? 0;
    stateRow(`pressure: ${pressure.toFixed(2)} | mood: ${mood}`);
    stateRow(`keeper pose: ${this.keeperPose}`);
    const canonH = KEEPER_POSE_MANIFEST[this.keeperPose].displayHeight;
    stateRow(`keeper canonical H: ${canonH} | actual H: ${this.keeper.displayHeight.toFixed(1)}`);
    stateRow(`keeper pos: (${this.keeper.x.toFixed(0)}, ${this.keeper.y.toFixed(0)}) rot: ${this.keeper.rotation.toFixed(2)}`);
    if (this.lastKeeperPresentation) {
      const frame = this.lastKeeperPresentation;
      stateRow(`anim phase: ${frame.phase}`);
      stateRow(`body: (${frame.x.toFixed(0)},${frame.y.toFixed(0)}) scale: ${frame.scale.toFixed(2)}`);
      stateRow(`shadow: w${frame.shadowWidthScale.toFixed(2)} a${frame.shadowAlpha.toFixed(2)} y+${frame.shadowOffsetY.toFixed(0)}`);
      stateRow(`lane: ${frame.saveHeightLane} | flipX: ${frame.flipX ? "yes" : "no"}`);
      stateRow(`selected pose: ${frame.selectedPose} | requested: ${frame.requestedPose}`);
      stateRow(`fallback pose: ${frame.fallbackPoseUsed ?? "none"}`);
      stateRow(`visualSaveTrusted: ${frame.visualSaveTrusted ? "yes" : "no"}`);
      stateRow(`pose anchor: ${frame.contactAnchorWorld ? `(${frame.contactAnchorWorld.x.toFixed(0)},${frame.contactAnchorWorld.y.toFixed(0)})` : "none"}`);
      stateRow(`anchorDist: ${frame.contactAnchorDistancePx !== null ? frame.contactAnchorDistancePx.toFixed(1) : "none"}`);
      stateRow(`shot index: ${frame.shotIndex}`);
    }

    // Puppet debug info
    if (KEEPER_PUPPET_ENABLED && this.puppet) {
      const pd = this.puppet.getDebugState();
      const puppetRow = (text: string) => { mkLabel(stateX, stateY, text, "#a78bfa"); stateY += 13; };
      puppetRow(`puppet: ${pd.phase} | glove: ${pd.selectedGlove ?? "none"}`);
      puppetRow(`body: (${pd.bodyX.toFixed(0)}, ${pd.bodyY.toFixed(0)}) H: ${pd.bodyHeight.toFixed(0)}`);
      if (pd.shoulderAnchor) {
        puppetRow(`shoulder: (${pd.shoulderAnchor.x.toFixed(0)}, ${pd.shoulderAnchor.y.toFixed(0)})`);
      }
      if (pd.contactPoint) {
        puppetRow(`contactPt: (${pd.contactPoint.x.toFixed(0)}, ${pd.contactPoint.y.toFixed(0)})`);
      }
      if (pd.clampedContact) {
        puppetRow(`clamped: (${pd.clampedContact.x.toFixed(0)}, ${pd.clampedContact.y.toFixed(0)})`);
      }
      puppetRow(`armDist: ${pd.visualArmDistance.toFixed(1)} / ${pd.maxArmReach}px`);
      puppetRow(`visualContact: ${pd.validVisualContact ? "✓ valid" : "✗ clamped"} | save: ${pd.saveContactAllowed ? "✓" : "✗"}`);
      puppetRow(`mood: ${pd.mood}`);
    }

    // Ball flight + collision info (during/after flight)
    if (this.activePlan) {
      const p = this.activePlan;
      const flightT = this.flightElapsedMs / Math.max(1, p.flightDurationMs);
      stateRow(`flightMs: ${p.flightDurationMs} | elapsed: ${this.flightElapsedMs.toFixed(0)} | t: ${flightT.toFixed(3)}`);
      stateRow(`contactT: ${p.contactT?.toFixed(3) ?? "none"} | contactPt: ${p.contactPoint ? `(${p.contactPoint.x.toFixed(0)},${p.contactPoint.y.toFixed(0)})` : "none"}`);
      stateRow(`keeperReach: ${p.keeperReachAtContact.toFixed(0)}px | diveDir: ${p.keeperDiveDirection}`);
      stateRow(`reactionMs: ${p.keeperDecision.physical.reactionMs.toFixed(0)} | predErr: ${p.keeperDecision.tactical.predictionErrorPx.toFixed(0)}px`);
      stateRow(`collision: ${p.collisionReason}`);

      // Draw keeper reach circle at contact point
      if (p.contactPoint && p.contactT !== null) {
        g.lineStyle(2, 0xe00800, 0.5);
        g.strokeCircle(p.contactPoint.x, p.contactPoint.y, p.keeperReachAtContact);
        mkLabel(p.contactPoint.x + p.keeperReachAtContact + 4, p.contactPoint.y - 6, `reach: ${p.keeperReachAtContact.toFixed(0)}px`, "#4ade80");
      }
    }
    stateRow(`keys: D=debug G=goal V=save M=miss L/C/R=dive`);

    // Portrait gameplay canvas (white)
    g.lineStyle(2, 0xf8fafc, 0.45);
    g.strokeRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    mkLabel(2, 2 + this.safeAreaInsets.top, "PORTRAIT CANVAS", "#f8fafc");

    // Ball start zone (green)
    g.lineStyle(2, 0x22c55e, 0.6);
    g.strokeCircle(BALL_START.x, BALL_START.y, 50);
    g.lineStyle(1, 0x22c55e, 0.3);
    g.strokeCircle(BALL_START.x, BALL_START.y, 32);
    mkLabel(BALL_START.x + 55, BALL_START.y - 8, "BALL START", "#22c55e");

    // Goal frame (yellow)
    g.lineStyle(2, 0xe00800, 0.6);
    g.strokeRect(
      GOAL_FRAME.leftX, GOAL_FRAME.topY,
      GOAL_FRAME.rightX - GOAL_FRAME.leftX,
      GOAL_FRAME.bottomY - GOAL_FRAME.topY
    );
    mkLabel(GOAL_FRAME.rightX + 5, GOAL_FRAME.topY, "GOAL BOUNDS", "#facc15");

    // Keeper anchor point + feet baseline (cyan)
    const keeperCX = getGoalCenterX();
    const keeperFeetY = VISUAL_KEEPER_Y + KEEPER_POSE_MANIFEST.idle.displayHeight * 0.5;
    g.lineStyle(1, 0x06b6d4, 0.5);
    g.strokeCircle(keeperCX, VISUAL_KEEPER_Y, 6); // anchor
    g.lineBetween(keeperCX - 50, keeperFeetY, keeperCX + 50, keeperFeetY); // feet baseline
    mkLabel(keeperCX + 55, VISUAL_KEEPER_Y - 8, "KEEPER ANCHOR", "#06b6d4");
    mkLabel(keeperCX + 55, keeperFeetY - 8, "KEEPER FEET", "#06b6d4");

    // Keeper reach per dive direction
    g.lineStyle(1, 0x06b6d4, 0.3);
    g.strokeCircle(getKeeperX("left"), KEEPER_Y, 75);
    g.strokeCircle(getKeeperX("right"), KEEPER_Y, 75);
    g.strokeCircle(keeperCX, KEEPER_Y, 50);

    // UI safe areas (grey)
    g.lineStyle(1, 0x94a3b8, 0.3);
    g.strokeRect(this.getScoreUiX(), this.getScoreUiY(), 180, 35);
    g.strokeRect(this.getShotUiX() - 120, this.getScoreUiY(), 120, 30);
    mkLabel(this.getScoreUiX(), this.getScoreUiY() + 37, "SCORE UI", "#94a3b8");

    // Result text zone (magenta)
    g.lineStyle(1, 0xd946ef, 0.35);
    g.strokeRect(LAYOUT.resultText.x - 140, LAYOUT.resultText.y, 280, 55);
    mkLabel(LAYOUT.resultText.x + 145, LAYOUT.resultText.y, "RESULT", "#d946ef");

    // Hint text zone
    g.lineStyle(1, 0xd946ef, 0.25);
    g.strokeRect(LAYOUT.hintText.x - 140, this.getHintY() - 12, 280, 24);

    // Emergency Recovery: Last shot outcome debug info
    if (this.lastShotDebugInfo) {
      const d = this.lastShotDebugInfo;
      const lx = 12 + this.safeAreaInsets.left;
      let ly = 360;
      const row = (label: string, value: string) => {
        mkLabel(lx, ly, `${label}: ${value}`, "#38bdf8");
        ly += 14;
      };
      row("target", `(${d.targetX}, ${d.targetY})`);
      row("force", `${d.force}`);
      row("curve", `${d.curve}`);
      row("quality", `${d.gestureQuality}`);
      row("keeper dive", d.keeperDiveDir);
      row("keeper predX", `${d.keeperPredictedX}`);
      row("keeper reach", `${d.keeperReachPx}px`);
      row("outcome", d.outcome);
      row("collision", d.collisionReason);
      row("contact", d.contactPoint ? `(${Math.round(d.contactPoint.x)},${Math.round(d.contactPoint.y)})` : "none");
      row("score", d.scoreAfter);
      row("mood", d.mood);
    }
  }
}

// ─── Pure helpers ───

function getBallSamples(trajectory: Parameters<typeof sampleBallFlight>[0]): readonly BallFlightSample[] {
  return Array.from({ length: FLIGHT_SAMPLE_COUNT + 1 }, (_, index) =>
    sampleBallFlight(trajectory, (trajectory.durationMs * index) / FLIGHT_SAMPLE_COUNT)
  );
}

function normalizeOutcome(outcome: BallOutcome): PlayableOutcome {
  return outcome === "goal" || outcome === "save" ? outcome : "miss";
}

function getGoalCenterX(): number {
  return (GOAL_FRAME.leftX + GOAL_FRAME.rightX) / 2;
}

function getKeeperX(direction: DiveDirection): number {
  if (direction === "left") {
    return GOAL_FRAME.leftX + 90;
  }
  if (direction === "right") {
    return GOAL_FRAME.rightX - 90;
  }
  return getGoalCenterX();
}

function getKeeperCollisionState(decision: GoalkeeperDecision, durationMs: number): KeeperState {
  const direction = decision.tactical.diveDirection;
  const wrongFootedReachPenalty = decision.physical.wrongFooted ? 0.78 : 1;

  return {
    centerX: getKeeperHandX(direction),
    centerY: direction === "center" ? KEEPER_Y + 6 : KEEPER_Y - 10,
    reachRadiusPx: getKeeperHandRadius(direction) * wrongFootedReachPenalty,
    // Fixed: was 0.9 (90% of flight) — now 0.55 (55%) giving keeper a real save window
    saveWindowStartMs: Math.max(decision.physical.reactionMs, durationMs * 0.55),
    saveWindowEndMs: durationMs
  };
}

function getKeeperHandX(direction: DiveDirection): number {
  if (direction === "left") {
    return GOAL_FRAME.leftX + 80;
  }
  if (direction === "right") {
    return GOAL_FRAME.rightX - 80;
  }
  return getGoalCenterX();
}

function getKeeperHandRadius(direction: DiveDirection): number {
  return direction === "center" ? 50 : 75;
}

function toGesturePoint(pointer: Phaser.Input.Pointer, camera: Phaser.Cameras.Scene2D.Camera): GesturePoint {
  const cameraPoint = pointer.positionToCamera(camera) as Phaser.Math.Vector2;
  const captured = captureInputPoint({
    type: "pointer",
    clientX: cameraPoint.x,
    clientY: cameraPoint.y,
    timeMs: pointer.event?.timeStamp ?? performance.now()
  });

  if (captured === null) {
    throw new Error("Pointer input was not captured");
  }

  return captured;
}

function textStyle(fontSize: number): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    color: "#f8fafc",
    fontFamily: FONT_FAMILY,
    fontSize: `${fontSize}px`,
    stroke: "#0f172a",
    strokeThickness: 4,
    shadow: {
      offsetX: 1,
      offsetY: 1,
      color: "#000000",
      blur: 4,
      fill: true
    }
  };
}

function resultTextStyle(fontSize: number): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    ...textStyle(fontSize),
    fontStyle: "700",
    strokeThickness: 6,
    shadow: {
      offsetX: 2,
      offsetY: 2,
      color: "#000000",
      blur: 8,
      fill: true
    }
  };
}

function getResultColor(outcome: PlayableOutcome | "none"): string {
  // e& brand palette: Red for goals, Grey for saves, Maroon for misses
  if (outcome === "goal") return "#E00800";
  if (outcome === "save") return "#9ca3af";
  if (outcome === "miss") return "#636363";
  return "#f8fafc";
}
