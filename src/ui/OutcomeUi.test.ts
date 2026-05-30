import { describe, expect, it } from "vitest";
import { getOutcomeUi, type UiContext } from "./OutcomeUi";

const baseContext: UiContext = {
  playerScore: 2,
  goalkeeperScore: 1,
  shotNumber: 4,
  maxShots: 5,
  outcome: "none",
  firstValidGestureSeen: false,
  viewportWidth: 480,
  viewportHeight: 270,
  ballStartZone: { left: 216, top: 218, right: 264, bottom: 266 },
  goalCorners: [
    { left: 130, top: 36, right: 154, bottom: 60 },
    { left: 326, top: 36, right: 350, bottom: 60 }
  ],
  goalkeeperBody: { left: 214, top: 80, right: 266, bottom: 140 },
  gesturePath: { left: 176, top: 150, right: 304, bottom: 238 }
};

function ui(overrides: Partial<UiContext> = {}) {
  return getOutcomeUi({ ...baseContext, ...overrides });
}

describe("REQ-UI-001 in-game UI and outcome clarity", () => {
  it("AC1 displays score shot result and restart action", () => {
    expect(ui({ outcome: "goal" })).toMatchObject({
      scoreText: "Player 2 - Keeper 1",
      shotText: "Shot 4/5",
      resultText: "GOAL",
      restartAction: "restart"
    });
  });

  it("AC2 keeps panels out of protected gameplay zones", () => {
    expect(ui().safeLayout).toBe(true);
    expect(ui().panels).toEqual([
      { left: 12, top: 70, right: 132, bottom: 110 },
      { left: 348, top: 70, right: 468, bottom: 110 },
      { left: 12, top: 180, right: 132, bottom: 222 }
    ]);
  });

  it("AC3 makes goals clear within 500ms", () => {
    expect(ui({ outcome: "goal", playerScore: 3 }).clarityCues).toEqual([
      "ball_crossed_goal",
      "net_feedback",
      "positive_score_update"
    ]);
    expect(ui({ outcome: "goal" }).outcomeVisibleAfterMs).toBe(420);
  });

  it("AC4 makes saves distinct and contact-driven", () => {
    expect(ui({ outcome: "save" })).toMatchObject({
      resultText: "SAVE",
      clarityCues: ["keeper_contact", "ball_deflection", "save_feedback"],
      outcomeVisibleAfterMs: 420
    });
  });

  it("AC5 makes misses distinct from saves", () => {
    expect(ui({ outcome: "miss", missReason: "outside_frame" })).toMatchObject({
      resultText: "MISS",
      clarityCues: ["outside_frame", "miss_feedback_distinct_from_save"]
    });
    expect(ui({ outcome: "miss", missReason: "post_hit" }).resultText).toBe("POST HIT");
  });

  it("AC6 communicates every resolved outcome within 500ms", () => {
    expect({
      goal: ui({ outcome: "goal" }).outcomeVisibleAfterMs,
      save: ui({ outcome: "save" }).outcomeVisibleAfterMs,
      miss: ui({ outcome: "miss" }).outcomeVisibleAfterMs
    }).toEqual({ goal: 420, save: 420, miss: 420 });
  });

  it("AC7 shows first-use hint until the first valid gesture", () => {
    expect(ui({ firstValidGestureSeen: false }).firstUseHint).toBe("Draw your shot");
    expect(ui({ firstValidGestureSeen: true }).firstUseHint).toBeNull();
  });
});
