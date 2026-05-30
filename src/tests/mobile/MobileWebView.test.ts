import { describe, expect, it } from "vitest";
import { createMobileLifecycleState, reduceMobileLifecycle } from "../../core/lifecycle";
import { clampDevicePixelRatio, planMobileViewport } from "../../core/renderer";
import { createMatchState, reduceMatchState, type MatchState } from "../../systems/match/MatchFlow";

function createAimingMatch(): MatchState {
  return reduceMatchState(reduceMatchState(createMatchState(), { type: "boot_complete" }), {
    type: "ready_to_aim"
  });
}

describe("NFR-MOBILE-001 Mobile WebView compatibility", () => {
  it("AC1 plans a portrait-first layout down to 320 css px", () => {
    const plan = planMobileViewport({
      cssWidth: 300,
      cssHeight: 568,
      devicePixelRatio: 1
    });

    expect(plan.orientation).toBe("portrait");
    expect(plan.layoutWidth).toBe(320);
    expect(plan.layoutHeight).toBe(568);
    expect(plan.playBounds).toEqual({ x: 0, y: 0, width: 320, height: 568 });
  });

  it("AC2 reserves safe-area insets for notches home indicators and gesture areas", () => {
    const plan = planMobileViewport({
      cssWidth: 390,
      cssHeight: 844,
      devicePixelRatio: 2,
      safeAreaInsets: { top: 47, right: 0, bottom: 34, left: 0 }
    });

    expect(plan.safeArea).toEqual({ top: 47, right: 0, bottom: 34, left: 0 });
    expect(plan.playBounds).toEqual({ x: 0, y: 47, width: 390, height: 763 });
  });

  it("AC3 caps device pixel ratio at 2.0 for mobile rendering", () => {
    expect(clampDevicePixelRatio(3)).toBe(2);
    expect(clampDevicePixelRatio(2)).toBe(2);
    expect(clampDevicePixelRatio(0)).toBe(1);

    expect(
      planMobileViewport({
        cssWidth: 390,
        cssHeight: 844,
        devicePixelRatio: 3
      })
    ).toMatchObject({
      devicePixelRatio: 2,
      renderWidth: 780,
      renderHeight: 1688
    });
  });

  it("AC4 prevents page scroll selection and browser gesture interference during play", () => {
    expect(
      planMobileViewport({
        cssWidth: 360,
        cssHeight: 740,
        devicePixelRatio: 1.5
      }).rootStyle
    ).toEqual({
      touchAction: "none",
      overscrollBehavior: "none",
      userSelect: "none",
      webkitUserSelect: "none"
    });
  });

  it("AC5 pauses and restores hidden tabs webview pause app background orientation and resize without score corruption", () => {
    const match = createAimingMatch();
    const initial = createMobileLifecycleState({
      ...match,
      score: { player: 2, goalkeeper: 1 },
      shotsTaken: 3
    });

    const events = ["tab_hidden", "webview_pause", "app_background", "orientation_change", "resize"] as const;

    for (const event of events) {
      const paused = reduceMobileLifecycle(initial, event);
      const restored = reduceMobileLifecycle(paused, "app_foreground");

      expect(paused.match.phase).toBe("pause");
      expect(paused.paused).toBe(true);
      expect(paused.match.score).toEqual(initial.match.score);
      expect(paused.match.shotsTaken).toBe(initial.match.shotsTaken);
      expect(restored.match.phase).toBe("aiming");
      expect(restored.match.score).toEqual(initial.match.score);
      expect(restored.match.shotsTaken).toBe(initial.match.shotsTaken);
    }
  });
});
