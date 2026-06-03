export interface LogicalSize {
  readonly width: number;
  readonly height: number;
}

import type { SafeAreaInsets } from "./types";

export const PORTRAIT_GAME_SIZE: LogicalSize = Object.freeze({
  width: 540,
  height: 960
});

export function isPortraitViewport(width: number, height: number): boolean {
  return height >= width;
}

export function getCanvasSafeAreaInsets(
  canvas: HTMLCanvasElement | null,
  logicalSize: LogicalSize = PORTRAIT_GAME_SIZE
): SafeAreaInsets {
  const cssInsets = getCssSafeAreaInsets();

  if (canvas === null) {
    return cssInsets;
  }

  const rect = canvas.getBoundingClientRect();
  const scaleX = logicalSize.width / Math.max(1, rect.width);
  const scaleY = logicalSize.height / Math.max(1, rect.height);

  return {
    top: Math.round(cssInsets.top * scaleY),
    right: Math.round(cssInsets.right * scaleX),
    bottom: Math.round(cssInsets.bottom * scaleY),
    left: Math.round(cssInsets.left * scaleX)
  };
}

function getCssSafeAreaInsets(): SafeAreaInsets {
  if (typeof window === "undefined") {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const style = getComputedStyle(document.documentElement);
  return {
    top: readCssPx(style, "--safe-top"),
    right: readCssPx(style, "--safe-right"),
    bottom: readCssPx(style, "--safe-bottom"),
    left: readCssPx(style, "--safe-left")
  };
}

function readCssPx(style: CSSStyleDeclaration, property: string): number {
  const value = style.getPropertyValue(property).trim();
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
