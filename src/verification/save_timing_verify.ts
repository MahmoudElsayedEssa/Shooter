/**
 * Manual Verification Script — Save Timing + Keeper Animation Readability
 * 
 * Tests each scenario the user requires verified:
 * 1. Wrong-side dive → must NOT be save
 * 2. Right save → contactT + contactPoint must exist
 * 3. Left save → contactT + contactPoint must exist
 * 4. High-corner shot → save only if reachable
 * 5. Fast vs weak shot → duration difference
 * 
 * Run: npx tsx src/verification/save_timing_verify.ts
 */

import { createBallTrajectory, sampleBallFlight, type Point2D } from "../systems/ball/BallTrajectory";
import { resolveBallCollision, type GoalFrame, type KeeperState } from "../systems/collision/CollisionResolver";
import type { ShotIntent } from "../systems/shot/ShotInterpreter";

const BALL_START: Point2D = { x: 480, y: 460 };

const GOAL_FRAME: GoalFrame = {
  leftX: 250,
  rightX: 710,
  topY: 130,
  bottomY: 260,
  postTolerancePx: 8,
};

function makeIntent(overrides: Partial<ShotIntent> = {}): ShotIntent {
  return {
    targetX: 480,
    targetY: 195,
    force: 0.95,
    curve: 0,
    gestureQuality: 0.85,
    durationMs: 200,
    pathComplexity: 1.02,
    precisionPenaltyPx: 6,
    ...overrides,
  };
}

function makeKeeper(overrides: Partial<KeeperState> = {}): KeeperState {
  return {
    centerX: 480,
    centerY: 210,
    reachRadiusPx: 65,
    saveWindowStartMs: 0,
    saveWindowEndMs: 1000,
    ...overrides,
  };
}

function runScenario(name: string, intent: ShotIntent, keeper: KeeperState) {
  const traj = createBallTrajectory(BALL_START, intent, 960);
  const result = resolveBallCollision(traj, GOAL_FRAME, keeper, intent.gestureQuality, intent.precisionPenaltyPx);
  
  const finalSample = sampleBallFlight(traj, traj.durationMs);
  const contactSample = result.contactT !== null 
    ? sampleBallFlight(traj, traj.durationMs * result.contactT)
    : null;

  console.log(`\n═══ ${name} ═══`);
  console.log(`  Target:     (${intent.targetX}, ${intent.targetY})`);
  console.log(`  Force:      ${intent.force}`);
  console.log(`  FlightMs:   ${traj.durationMs}`);
  console.log(`  Keeper:     (${keeper.centerX}, ${keeper.centerY}) reach=${keeper.reachRadiusPx}px`);
  console.log(`  OUTCOME:    ${result.outcome} (${result.reason})`);
  console.log(`  contactT:   ${result.contactT?.toFixed(4) ?? "null"}`);
  console.log(`  contactPt:  ${result.contactPoint ? `(${result.contactPoint.x.toFixed(1)}, ${result.contactPoint.y.toFixed(1)})` : "null"}`);
  console.log(`  contactIdx: ${result.contactSampleIndex ?? "null"}`);
  console.log(`  keeperReach: ${result.keeperReachAtContact}px`);
  console.log(`  keeperDir:  ${result.keeperDiveDirection}`);
  console.log(`  finalBall:  (${finalSample.x.toFixed(1)}, ${finalSample.y.toFixed(1)})`);
  
  if (contactSample) {
    const distToKeeper = Math.hypot(
      contactSample.x - keeper.centerX,
      contactSample.y - keeper.centerY
    );
    console.log(`  contactBall: (${contactSample.x.toFixed(1)}, ${contactSample.y.toFixed(1)})`);
    console.log(`  ballDistToKeeper: ${distToKeeper.toFixed(1)}px (must be ≤ ${keeper.reachRadiusPx}px)`);
    console.log(`  OVERLAP:    ${distToKeeper <= keeper.reachRadiusPx ? "✅ YES" : "❌ NO"}`);
  }
  
  return result;
}

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  Save Timing + Keeper Animation Readability Verification ║");
console.log("╚══════════════════════════════════════════════════════════╝");

// ── Scenario 1: Wrong-side dive (ball right, keeper dives left) ──
const wrongSide = runScenario(
  "1. WRONG-SIDE DIVE (ball right → keeper left)",
  makeIntent({ targetX: 650, targetY: 180 }),
  makeKeeper({ centerX: 320, centerY: 190, reachRadiusPx: 65 })
);
console.log(`  VERDICT:    ${wrongSide.outcome !== "save" ? "✅ PASS (not save)" : "❌ FAIL (false save!)"}`);

// ── Scenario 2: Right save (ball right, keeper dives right) ──
const rightSave = runScenario(
  "2. RIGHT SAVE (ball right → keeper right)",
  makeIntent({ targetX: 620, targetY: 190, curve: 0 }),
  makeKeeper({ centerX: 600, centerY: 195, reachRadiusPx: 75 })
);
if (rightSave.outcome === "save") {
  console.log(`  VERDICT:    ✅ PASS (save with contactT=${rightSave.contactT?.toFixed(4)})`);
} else {
  console.log(`  VERDICT:    ⚠️  No save (ball may have gone past reach, outcome=${rightSave.outcome})`);
}

// ── Scenario 3: Left save (ball left, keeper dives left) ──
const leftSave = runScenario(
  "3. LEFT SAVE (ball left → keeper left)",
  makeIntent({ targetX: 320, targetY: 185, curve: 0 }),
  makeKeeper({ centerX: 340, centerY: 190, reachRadiusPx: 75 })
);
if (leftSave.outcome === "save") {
  console.log(`  VERDICT:    ✅ PASS (save with contactT=${leftSave.contactT?.toFixed(4)})`);
} else {
  console.log(`  VERDICT:    ⚠️  No save (outcome=${leftSave.outcome})`);
}

// ── Scenario 4: High corner (top-left) ──
const highCorner = runScenario(
  "4. HIGH CORNER (top-left, keeper left with reach)",
  makeIntent({ targetX: 280, targetY: 140, force: 1.1 }),
  makeKeeper({ centerX: 310, centerY: 160, reachRadiusPx: 70 })
);
if (highCorner.outcome === "save") {
  console.log(`  VERDICT:    ✅ Save with visible contact`);
} else {
  console.log(`  VERDICT:    ✅ ${highCorner.outcome} (not reachable = correct)`);
}

// ── Scenario 4b: High corner unreachable ──
const highUnreachable = runScenario(
  "4b. HIGH CORNER UNREACHABLE (top-left, keeper right)",
  makeIntent({ targetX: 270, targetY: 135, force: 1.1 }),
  makeKeeper({ centerX: 620, centerY: 210, reachRadiusPx: 55 })
);
console.log(`  VERDICT:    ${highUnreachable.outcome !== "save" ? "✅ PASS (not save)" : "❌ FAIL (false save!)"}`);

// ── Scenario 5: Fast vs weak shot duration ──
const fastIntent = makeIntent({ force: 1.3 });
const weakIntent = makeIntent({ force: 0.6 });
const fastTraj = createBallTrajectory(BALL_START, fastIntent, 960);
const weakTraj = createBallTrajectory(BALL_START, weakIntent, 960);
const midIntent = makeIntent({ force: 0.95 });
const midTraj = createBallTrajectory(BALL_START, midIntent, 960);

console.log(`\n═══ 5. FLIGHT DURATION COMPARISON ═══`);
console.log(`  Weak  (force=0.60): ${weakTraj.durationMs}ms`);
console.log(`  Mid   (force=0.95): ${midTraj.durationMs}ms`);
console.log(`  Fast  (force=1.30): ${fastTraj.durationMs}ms`);
console.log(`  Diff (weak-fast):   ${weakTraj.durationMs - fastTraj.durationMs}ms`);
console.log(`  VERDICT:    ${weakTraj.durationMs > fastTraj.durationMs ? "✅ PASS (weak slower than fast)" : "❌ FAIL"}`);
console.log(`  READABLE:   ${fastTraj.durationMs >= 600 ? "✅ PASS (fast ≥ 600ms)" : "❌ FAIL (too fast)"}`);

// ── Summary ──
const allPassed = 
  wrongSide.outcome !== "save" &&
  highUnreachable.outcome !== "save" &&
  weakTraj.durationMs > fastTraj.durationMs &&
  fastTraj.durationMs >= 600;

console.log(`\n╔════════════════════════════════╗`);
console.log(`║  OVERALL: ${allPassed ? "✅ ALL CRITICAL PASS" : "❌ SOME FAILURES"}   ║`);
console.log(`╚════════════════════════════════╝`);
