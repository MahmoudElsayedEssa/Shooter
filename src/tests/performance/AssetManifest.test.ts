import { describe, expect, it } from "vitest";
import {
  ASSET_MANIFEST,
  canCompleteMatchWithoutOptionalAssets,
  getAudioFallback,
  getCriticalFirstPlayAssets,
  getOptionalPolishAssets
} from "../../core/assets";

describe("REQ-ASSET-001 asset and audio manifest for mobile production", () => {
  it("AC1 lists file group dimensions compressed size priority and critical status", () => {
    expect(
      ASSET_MANIFEST.every(
        (asset) =>
          asset.fileName.length > 0 &&
          asset.group.length > 0 &&
          asset.compressedSizeKb > 0 &&
          (asset.dimensions === null || asset.dimensions.every((value) => value > 0)) &&
          (asset.loadPriority === "critical") === asset.critical
      )
    ).toBe(true);
  });

  it("AC2 separates critical first-play assets from optional polish assets", () => {
    expect(getCriticalFirstPlayAssets().map((asset) => asset.fileName)).toEqual([
      "gameplay-atlas.webp",
      "ui-atlas.webp"
    ]);
    expect(getOptionalPolishAssets().map((asset) => asset.fileName)).toEqual([
      "match-audio.ogg",
      "cinematic-polish.webp"
    ]);
  });

  it("AC3 uses texture atlases for gameplay sprites where practical", () => {
    expect(getCriticalFirstPlayAssets().filter((asset) => asset.group !== "audio").every((asset) => asset.atlas !== null)).toBe(true);
  });

  it("AC4 gives audio a silent fallback if unlock or playback fails", () => {
    expect(getAudioFallback("match-audio.ogg")).toBe("silent");
    expect(getAudioFallback("missing-audio.ogg")).toBe("silent");
  });

  it("AC5 allows a complete five-shot match without optional polish assets", () => {
    expect(canCompleteMatchWithoutOptionalAssets(["gameplay-atlas.webp", "ui-atlas.webp"])).toBe(true);
    expect(canCompleteMatchWithoutOptionalAssets(["ui-atlas.webp"])).toBe(false);
  });
});
