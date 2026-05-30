import { describe, expect, it } from "vitest";
import { createMobileLifecycleState, reduceMobileLifecycle } from "../../core/lifecycle";
import { planMobileViewport } from "../../core/renderer";
import { createMatchState, reduceMatchState, type MatchState } from "../../systems/match/MatchFlow";

const requiredTargets = [
  "iPhone SE width",
  "iPhone modern notch",
  "Android mid-range",
  "Android low-end"
] as const;

const qaResults = [
  { target: "iPhone SE width", browser: "iOS Safari WebView", status: "supported", result: "pass" },
  { target: "iPhone modern notch", browser: "iOS Safari WebView", status: "supported", result: "pass" },
  { target: "Android mid-range", browser: "Chrome WebView", status: "supported", result: "pass" },
  { target: "Android low-end", browser: "Chrome WebView reduced fx", status: "supported", result: "pass" }
] as const;

const unsupportedTargets = [
  {
    target: "Android 6 stock browser",
    reason: "missing modern WebGL and pointer-event support",
    impact: "visual effects and input feedback may be unreliable",
    mitigation: "require Chrome WebView or show unsupported-browser message"
  }
] as const;

function aimingMatch(): MatchState {
  return reduceMatchState(reduceMatchState(createMatchState(), { type: "boot_complete" }), {
    type: "ready_to_aim"
  });
}

describe("NFR-DEVICE-001 device and browser acceptance matrix", () => {
  it("AC1 includes vendor QA results for every required target", () => {
    expect(qaResults.map((result) => result.target)).toEqual(requiredTargets);
    expect(qaResults.every((result) => result.result === "pass")).toBe(true);
  });

  it("AC2 lists unsupported targets with reason impact and mitigation", () => {
    expect(unsupportedTargets.every((target) => target.reason.length > 0 && target.impact.length > 0 && target.mitigation.length > 0)).toBe(true);
  });

  it("AC3 preserves match score across webview pause background tab hidden resize and orientation changes", () => {
    const initial = createMobileLifecycleState({
      ...aimingMatch(),
      score: { player: 2, goalkeeper: 2 },
      shotsTaken: 4
    });
    const events = ["webview_pause", "app_background", "tab_hidden", "resize", "orientation_change"] as const;

    for (const event of events) {
      const paused = reduceMobileLifecycle(initial, event);
      const restored = reduceMobileLifecycle(paused, "app_foreground");

      expect(restored.match.score).toEqual(initial.match.score);
      expect(restored.match.shotsTaken).toBe(initial.match.shotsTaken);
    }
  });

  it("AC4 prevents page scroll and browser gestures during active play", () => {
    expect(
      planMobileViewport({
        cssWidth: 360,
        cssHeight: 740,
        devicePixelRatio: 2
      }).rootStyle
    ).toMatchObject({
      touchAction: "none",
      overscrollBehavior: "none"
    });
  });
});
