import Phaser from "phaser";
import { createBallTrajectory, sampleBallFlight, type BallFlightSample } from "../systems/ball/BallTrajectory";
import { resolveBallCollision, type BallOutcome, type GoalFrame } from "../systems/collision/CollisionResolver";
import {
  decideGoalkeeperAction,
  type DiveDirection,
  type GoalkeeperDecision
} from "../systems/goalkeeper/GoalkeeperAI";
import {
  captureInputPoint,
  sampleGesturePoint,
  startsInsideShotZone,
  validateGesture,
  type GesturePoint
} from "../systems/input/DrawToShootInput";
import { MATCH_LIMITS, type MatchScore } from "../systems/match/MatchFlow";
import { interpretShotIntent, type ShotIntent } from "../systems/shot/ShotInterpreter";
import { getOutcomeUi } from "../ui/OutcomeUi";

export type PlayableOutcome = "goal" | "save" | "miss";

export interface PlayableShotPlan {
  readonly intent: ShotIntent;
  readonly outcome: PlayableOutcome;
  readonly ballSamples: readonly BallFlightSample[];
  readonly keeperDecision: GoalkeeperDecision;
  readonly score: MatchScore;
  readonly shotNumber: number;
  readonly matchEnded: boolean;
}

export interface PlayableMatchSnapshot {
  readonly score: MatchScore;
  readonly shotNumber: number;
  readonly maxShots: number;
  readonly phase: "aiming" | "drawing" | "ball_flight" | "result" | "match_end";
  readonly outcome: PlayableOutcome | "none";
}

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const BALL_START = Object.freeze({ x: 480, y: 460 });
const GOAL_FRAME: GoalFrame = Object.freeze({
  leftX: 300,
  rightX: 660,
  topY: 76,
  bottomY: 164,
  postTolerancePx: 10
});
const KEEPER_Y = 136;
const FLIGHT_SAMPLE_COUNT = 16;

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
  shotsTaken: number
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
    consecutiveGoalsAgainst: 0,
    consecutiveSaves: 0,
    matchPoint: shotsTaken >= MATCH_LIMITS.maxShots - 1,
    difficulty: 0.55,
    shotQuality: intent.gestureQuality,
    curve: intent.curve,
    targetX: intent.targetX,
    goalCenterX: getGoalCenterX(),
    shotHistory: [],
    difficultyPreset: "standard",
    shotIndex: shotsTaken,
    aiSeed: `playable-${shotsTaken}`
  });
  const collision = resolveBallCollision(
    trajectory,
    GOAL_FRAME,
    {
      centerX: getKeeperX(keeperDecision.tactical.diveDirection),
      centerY: KEEPER_Y,
      reachRadiusPx: keeperDecision.physical.handReachPx,
      saveWindowStartMs: Math.max(0, keeperDecision.physical.reactionMs),
      saveWindowEndMs: trajectory.durationMs
    },
    intent.gestureQuality,
    intent.precisionPenaltyPx
  );
  const outcome = normalizeOutcome(collision.outcome);
  const nextScore = outcome === "goal"
    ? { player: score.player + 1, goalkeeper: score.goalkeeper }
    : { player: score.player, goalkeeper: score.goalkeeper + 1 };
  const shotNumber = Math.min(MATCH_LIMITS.maxShots, shotsTaken + 1);

  return {
    intent,
    outcome,
    ballSamples: getBallSamples(trajectory),
    keeperDecision,
    score: nextScore,
    shotNumber,
    matchEnded: shotNumber >= MATCH_LIMITS.maxShots
  };
}

export class PlayablePenaltyScene extends Phaser.Scene {
  private score: MatchScore = { player: 0, goalkeeper: 0 };
  private shotsTaken = 0;
  private phase: PlayableMatchSnapshot["phase"] = "aiming";
  private outcome: PlayableOutcome | "none" = "none";
  private gesturePoints: readonly GesturePoint[] = [];
  private activePlan: PlayableShotPlan | null = null;
  private flightElapsedMs = 0;
  private field!: Phaser.GameObjects.Graphics;
  private trail!: Phaser.GameObjects.Graphics;
  private ball!: Phaser.GameObjects.Arc;
  private keeper!: Phaser.GameObjects.Rectangle;
  private scoreText!: Phaser.GameObjects.Text;
  private shotText!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  constructor() {
    super("PlayablePenaltyScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#10251b");
    this.field = this.add.graphics();
    this.trail = this.add.graphics();
    this.ball = this.add.circle(BALL_START.x, BALL_START.y, 14, 0xf8fafc).setStrokeStyle(3, 0x111827);
    this.keeper = this.add.rectangle(getGoalCenterX(), KEEPER_Y, 58, 70, 0x38bdf8).setStrokeStyle(3, 0x082f49);
    this.scoreText = this.add.text(24, 20, "", textStyle(24));
    this.shotText = this.add.text(760, 20, "", textStyle(22));
    this.resultText = this.add.text(0, 182, "", textStyle(38)).setOrigin(0.5, 0);
    this.hintText = this.add.text(0, 492, "Drag from the ball toward the goal", textStyle(20)).setOrigin(0.5, 0.5);
    this.resultText.setX(GAME_WIDTH / 2);
    this.hintText.setX(GAME_WIDTH / 2);
    this.input.on("pointerdown", this.onPointerDown, this);
    this.input.on("pointermove", this.onPointerMove, this);
    this.input.on("pointerup", this.onPointerUp, this);
    this.drawStaticField();
    this.renderHud();
  }

  override update(_: number, deltaMs: number): void {
    if (this.phase !== "ball_flight" || this.activePlan === null) {
      return;
    }

    this.flightElapsedMs += deltaMs;
    const sampleIndex = Math.min(
      this.activePlan.ballSamples.length - 1,
      Math.floor((this.flightElapsedMs / Math.max(1, this.activePlan.intent.durationMs)) * this.activePlan.ballSamples.length)
    );
    const sample = this.activePlan.ballSamples[sampleIndex];
    this.ball.setPosition(sample.x, sample.y);
    this.ball.setScale(sample.scale);
    this.moveKeeper(this.activePlan.keeperDecision.tactical.diveDirection, sample.progress);

    if (sample.progress >= 1 || sampleIndex === this.activePlan.ballSamples.length - 1) {
      this.finishShot();
    }
  }

  getSnapshot(): PlayableMatchSnapshot {
    return {
      score: this.score,
      shotNumber: Math.min(this.shotsTaken + 1, MATCH_LIMITS.maxShots),
      maxShots: MATCH_LIMITS.maxShots,
      phase: this.phase,
      outcome: this.outcome
    };
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.phase === "match_end") {
      this.resetMatch();
      return;
    }
    if (this.phase !== "aiming" && this.phase !== "result") {
      return;
    }

    const point = toGesturePoint(pointer);
    if (!startsInsideShotZone(point, {
      centerX: BALL_START.x,
      centerY: BALL_START.y,
      viewportWidth: GAME_WIDTH
    })) {
      return;
    }

    this.phase = "drawing";
    this.outcome = "none";
    this.gesturePoints = [point];
    this.activePlan = null;
    this.flightElapsedMs = 0;
    this.ball.setPosition(BALL_START.x, BALL_START.y).setScale(1);
    this.keeper.setPosition(getGoalCenterX(), KEEPER_Y);
    this.resultText.setText("");
    this.renderHud();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.phase !== "drawing") {
      return;
    }

    const result = sampleGesturePoint(this.gesturePoints, toGesturePoint(pointer));
    if (result.accepted) {
      this.gesturePoints = result.points;
      this.drawTrail();
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.phase !== "drawing") {
      return;
    }

    const result = sampleGesturePoint(this.gesturePoints, toGesturePoint(pointer));
    this.gesturePoints = result.points;

    if (!validateGesture(this.gesturePoints).valid) {
      this.phase = "aiming";
      this.gesturePoints = [];
      this.trail.clear();
      this.hintText.setText("Draw upward from the ball");
      this.renderHud();
      return;
    }

    this.activePlan = planPlayableShot(this.gesturePoints, this.score, this.shotsTaken);
    this.phase = "ball_flight";
    this.flightElapsedMs = 0;
    this.renderHud();
  }

  private finishShot(): void {
    if (this.activePlan === null) {
      return;
    }

    this.score = this.activePlan.score;
    this.shotsTaken += 1;
    this.outcome = this.activePlan.outcome;
    this.phase = this.shotsTaken >= MATCH_LIMITS.maxShots ? "match_end" : "result";
    this.gesturePoints = [];
    this.trail.clear();
    this.renderHud();
  }

  private resetMatch(): void {
    this.score = { player: 0, goalkeeper: 0 };
    this.shotsTaken = 0;
    this.phase = "aiming";
    this.outcome = "none";
    this.activePlan = null;
    this.flightElapsedMs = 0;
    this.ball.setPosition(BALL_START.x, BALL_START.y).setScale(1);
    this.keeper.setPosition(getGoalCenterX(), KEEPER_Y);
    this.trail.clear();
    this.renderHud();
  }

  private drawStaticField(): void {
    this.field.clear();
    this.field.fillStyle(0x14532d, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.field.lineStyle(4, 0xe5e7eb, 1);
    this.field.strokeRect(GOAL_FRAME.leftX, GOAL_FRAME.topY, GOAL_FRAME.rightX - GOAL_FRAME.leftX, GOAL_FRAME.bottomY - GOAL_FRAME.topY);
    this.field.lineStyle(2, 0x86efac, 0.8).strokeCircle(BALL_START.x, BALL_START.y, 56);
  }

  private drawTrail(): void {
    this.trail.clear();
    if (this.gesturePoints.length < 2) {
      return;
    }

    this.trail.lineStyle(4, 0xfacc15, 0.8);
    this.trail.beginPath();
    this.trail.moveTo(this.gesturePoints[0].x, this.gesturePoints[0].y);
    for (const point of this.gesturePoints.slice(1)) {
      this.trail.lineTo(point.x, point.y);
    }
    this.trail.strokePath();
  }

  private renderHud(): void {
    const ui = getOutcomeUi({
      playerScore: this.score.player,
      goalkeeperScore: this.score.goalkeeper,
      shotNumber: Math.min(this.shotsTaken + 1, MATCH_LIMITS.maxShots),
      maxShots: MATCH_LIMITS.maxShots,
      outcome: this.outcome,
      firstValidGestureSeen: this.shotsTaken > 0,
      viewportWidth: GAME_WIDTH,
      viewportHeight: GAME_HEIGHT,
      ballStartZone: { left: 424, top: 404, right: 536, bottom: 516 },
      goalCorners: [
        { left: GOAL_FRAME.leftX - 16, top: GOAL_FRAME.topY - 16, right: GOAL_FRAME.leftX + 16, bottom: GOAL_FRAME.topY + 16 },
        { left: GOAL_FRAME.rightX - 16, top: GOAL_FRAME.topY - 16, right: GOAL_FRAME.rightX + 16, bottom: GOAL_FRAME.topY + 16 }
      ],
      goalkeeperBody: {
        left: this.keeper.x - 36,
        top: this.keeper.y - 42,
        right: this.keeper.x + 36,
        bottom: this.keeper.y + 42
      },
      gesturePath: { left: 300, top: 180, right: 660, bottom: 470 }
    });
    const suffix = this.phase === "match_end" ? " - Match end, tap to restart" : "";
    this.scoreText.setText(ui.scoreText);
    this.shotText.setText(ui.shotText);
    this.resultText.setText(`${ui.resultText}${suffix}`);
    this.hintText.setText(this.phase === "drawing" ? "Release to shoot" : ui.firstUseHint ?? "Drag again for next shot");
  }

  private moveKeeper(direction: DiveDirection, progress: number): void {
    const targetX = getKeeperX(direction);
    this.keeper.setPosition(getGoalCenterX() + (targetX - getGoalCenterX()) * progress, KEEPER_Y);
    this.keeper.setRotation(direction === "left" ? -0.25 * progress : direction === "right" ? 0.25 * progress : 0);
  }
}

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
    return GOAL_FRAME.leftX + 74;
  }
  if (direction === "right") {
    return GOAL_FRAME.rightX - 74;
  }
  return getGoalCenterX();
}

function toGesturePoint(pointer: Phaser.Input.Pointer): GesturePoint {
  const captured = captureInputPoint({
    type: "pointer",
    clientX: pointer.x,
    clientY: pointer.y,
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
    fontFamily: "Arial, sans-serif",
    fontSize: `${fontSize}px`
  };
}
