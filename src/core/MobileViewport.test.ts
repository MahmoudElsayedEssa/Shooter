import { describe, expect, it } from "vitest";
import {
  getCanvasSafeAreaInsets,
  isPortraitViewport,
  PORTRAIT_GAME_SIZE
} from "./MobileViewport";

describe("MobileViewport", () => {
  it("uses portrait game size", () => {
    expect(PORTRAIT_GAME_SIZE).toEqual({ width: 540, height: 960 });
  });

  it("detects portrait and landscape viewports", () => {
    expect(isPortraitViewport(390, 844)).toBe(true);
    expect(isPortraitViewport(844, 390)).toBe(false);
  });

  it("converts CSS safe areas to logical game pixels", () => {
    const previous = document.documentElement.style.cssText;
    document.documentElement.style.setProperty("--safe-top", "20px");
    document.documentElement.style.setProperty("--safe-right", "10px");
    document.documentElement.style.setProperty("--safe-bottom", "34px");
    document.documentElement.style.setProperty("--safe-left", "4px");

    const canvas = {
      getBoundingClientRect: () => ({
        width: 270,
        height: 480
      })
    } as HTMLCanvasElement;

    expect(getCanvasSafeAreaInsets(canvas)).toEqual({
      top: 40,
      right: 20,
      bottom: 68,
      left: 8
    });

    document.documentElement.style.cssText = previous;
  });
});
