import { describe, expect, it } from "vitest";
import {
  BUNDLE_BUDGETS,
  getFirstPlayableAssetRoles,
  getFirstPlayableAssets,
  getOptionalPolishAssets,
  getOversizedCriticalAssets,
  getTextureMemoryBudget
} from "../../core/assets";

describe("NFR-BUNDLE-001 bundle texture and first-play budgets", () => {
  it("AC1 loads only critical first-play gameplay assets before aiming", () => {
    expect(getFirstPlayableAssets().map((asset) => asset.role)).toEqual(getFirstPlayableAssetRoles());
    expect(getFirstPlayableAssets().every((asset) => asset.critical)).toBe(true);
  });

  it("AC2 keeps critical and active texture memory inside mobile targets", () => {
    const budget = getTextureMemoryBudget();

    expect(budget.criticalMb).toBeGreaterThanOrEqual(BUNDLE_BUDGETS.minCriticalTextureMb);
    expect(budget.criticalMb).toBeLessThanOrEqual(BUNDLE_BUDGETS.maxCriticalTextureMb);
    expect(budget.activeMb).toBeLessThan(BUNDLE_BUDGETS.maxActiveTextureMb);
  });

  it("AC3 caps device pixel ratio at 2.0 for the first-play budget", () => {
    expect(BUNDLE_BUDGETS.maxDevicePixelRatio).toBe(2);
  });

  it("AC4 reports asset sizes and flags oversized critical assets", () => {
    expect(getFirstPlayableAssets().every((asset) => asset.compressedSizeKb > 0)).toBe(true);
    expect(getOversizedCriticalAssets()).toEqual([]);
  });

  it("AC5 delays optional stadium polish cinematic fx and cosmetics until after first playable state", () => {
    expect(getOptionalPolishAssets().every((asset) => !asset.critical && asset.loadPriority === "optional")).toBe(true);
  });

  it("AC6 uses texture atlases for keeper goal ui and fx groups where practical", () => {
    expect(Object.fromEntries(getFirstPlayableAssets().map((asset) => [asset.role, asset.atlas]))).toMatchObject({
      keeper_core: "gameplay",
      goal: "gameplay",
      ui_essential: "ui",
      basic_fx: "fx"
    });
  });
});
