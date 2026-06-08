import { describe, expect, it } from "vitest";
import { getShotZoneRadius } from "../systems/input/DrawToShootInput";
import { BALL_START, GAME_HEIGHT, GAME_WIDTH, GOAL_FRAME } from "./PlayablePenaltyScene";

describe("PlayablePenaltyScene mobile portrait layout", () => {
  it("uses the canonical portrait game size", () => {
    expect(GAME_WIDTH).toBe(540);
    expect(GAME_HEIGHT).toBe(960);
  });

  it("keeps the ball inside the lower playable area", () => {
    expect(BALL_START.x).toBe(GAME_WIDTH / 2);
    expect(BALL_START.y).toBeGreaterThan(GAME_HEIGHT * 0.75);
    expect(BALL_START.y).toBeLessThan(GAME_HEIGHT - 80);
  });

  it("keeps the goal frame inside the portrait canvas", () => {
    expect(GOAL_FRAME.leftX).toBeGreaterThanOrEqual(0);
    expect(GOAL_FRAME.topY).toBeGreaterThanOrEqual(0);
    expect(GOAL_FRAME.rightX).toBeLessThanOrEqual(GAME_WIDTH);
    expect(GOAL_FRAME.bottomY).toBeLessThanOrEqual(GAME_HEIGHT);
    expect(GOAL_FRAME.rightX - GOAL_FRAME.leftX).toBeGreaterThan(400);
  });

  it("uses a finger-sized shot zone on mobile widths", () => {
    // 540 * 0.22 = 118.8, 320 * 0.22 = 70.4, 240 * 0.22 = 52.8 (but min is 52)
    expect(getShotZoneRadius(540)).toBeCloseTo(118.8);
    expect(getShotZoneRadius(320)).toBeCloseTo(70.4);
    expect(getShotZoneRadius(240)).toBeCloseTo(52.8);
  });
});
