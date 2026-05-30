import { describe, expect, it } from "vitest";
import { getAccessibilityUi } from "../../ui/OutcomeUi";

describe("NFR-A11Y-001 accessibility and reduced motion", () => {
  it("AC1 keeps ui text contrast above accessible game-background threshold", () => {
    expect(getAccessibilityUi("en", false).textContrastRatio).toBeGreaterThanOrEqual(4.5);
  });

  it("AC2 uses mobile-sized touch zones and forgiving ball interaction", () => {
    const ui = getAccessibilityUi("en", false);

    expect(ui.minTouchZonePx).toBeGreaterThanOrEqual(44);
    expect(ui.ballInteractionZonePx).toBeGreaterThan(ui.minTouchZonePx);
  });

  it("AC3 lowers shake zoom slow-motion frequency and flash intensity in reduced-motion mode", () => {
    const full = getAccessibilityUi("en", false).reducedMotion;
    const reduced = getAccessibilityUi("en", true).reducedMotion;

    expect(reduced.shakeMultiplier).toBeLessThan(full.shakeMultiplier);
    expect(reduced.zoomPulseMultiplier).toBeLessThan(full.zoomPulseMultiplier);
    expect(reduced.slowMotionFrequencyMultiplier).toBeLessThan(full.slowMotionFrequencyMultiplier);
    expect(reduced.flashIntensityMultiplier).toBeLessThan(full.flashIntensityMultiplier);
  });

  it("AC4 exposes english and arabic ui strings with rtl layout direction", () => {
    expect(getAccessibilityUi("en", false)).toMatchObject({
      direction: "ltr",
      strings: {
        scoreLabel: "Score",
        shotLabel: "Shot",
        drawHint: "Draw your shot",
        restartLabel: "Restart"
      }
    });
    expect(getAccessibilityUi("ar", false)).toMatchObject({
      direction: "rtl",
      strings: {
        scoreLabel: "النتيجة",
        shotLabel: "التسديدة",
        drawHint: "ارسم التسديدة",
        restartLabel: "إعادة"
      }
    });
  });
});
