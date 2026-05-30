export type AssetGroup = "gameplay" | "ui" | "audio" | "polish";
export type LoadPriority = "critical" | "optional";

export interface AssetManifestEntry {
  readonly fileName: string;
  readonly group: AssetGroup;
  readonly role: "ball" | "goal" | "keeper_core" | "ui_essential" | "basic_fx" | "audio" | "polish";
  readonly dimensions: readonly [number, number] | null;
  readonly compressedSizeKb: number;
  readonly textureMemoryMb: number;
  readonly loadPriority: LoadPriority;
  readonly critical: boolean;
  readonly atlas: string | null;
  readonly fallback: "silent" | "skip_optional" | "required";
}

export const ASSET_MANIFEST: readonly AssetManifestEntry[] = [
  {
    fileName: "ball-atlas.webp",
    group: "gameplay",
    role: "ball",
    dimensions: [512, 512],
    compressedSizeKb: 180,
    textureMemoryMb: 4,
    loadPriority: "critical",
    critical: true,
    atlas: "gameplay",
    fallback: "required"
  },
  {
    fileName: "goal-atlas.webp",
    group: "gameplay",
    role: "goal",
    dimensions: [512, 512],
    compressedSizeKb: 220,
    textureMemoryMb: 4,
    loadPriority: "critical",
    critical: true,
    atlas: "gameplay",
    fallback: "required"
  },
  {
    fileName: "keeper-core-atlas.webp",
    group: "gameplay",
    role: "keeper_core",
    dimensions: [1024, 1024],
    compressedSizeKb: 420,
    textureMemoryMb: 12,
    loadPriority: "critical",
    critical: true,
    atlas: "gameplay",
    fallback: "required"
  },
  {
    fileName: "ui-atlas.webp",
    group: "ui",
    role: "ui_essential",
    dimensions: [512, 512],
    compressedSizeKb: 120,
    textureMemoryMb: 4,
    loadPriority: "critical",
    critical: true,
    atlas: "ui",
    fallback: "required"
  },
  {
    fileName: "basic-fx-atlas.webp",
    group: "gameplay",
    role: "basic_fx",
    dimensions: [512, 512],
    compressedSizeKb: 160,
    textureMemoryMb: 4,
    loadPriority: "critical",
    critical: true,
    atlas: "fx",
    fallback: "required"
  },
  {
    fileName: "match-audio.ogg",
    group: "audio",
    role: "audio",
    dimensions: null,
    compressedSizeKb: 180,
    textureMemoryMb: 0,
    loadPriority: "optional",
    critical: false,
    atlas: null,
    fallback: "silent"
  },
  {
    fileName: "cinematic-polish.webp",
    group: "polish",
    role: "polish",
    dimensions: [512, 512],
    compressedSizeKb: 96,
    textureMemoryMb: 4,
    loadPriority: "optional",
    critical: false,
    atlas: "polish",
    fallback: "skip_optional"
  }
] as const;

export const BUNDLE_BUDGETS = {
  minCriticalTextureMb: 16,
  maxCriticalTextureMb: 32,
  maxActiveTextureMb: 64,
  maxDevicePixelRatio: 2,
  maxCriticalAssetKb: 512
} as const;

export function getCriticalFirstPlayAssets(): readonly AssetManifestEntry[] {
  return ASSET_MANIFEST.filter((asset) => asset.critical);
}

export function getOptionalPolishAssets(): readonly AssetManifestEntry[] {
  return ASSET_MANIFEST.filter((asset) => !asset.critical);
}

export function canCompleteMatchWithoutOptionalAssets(availableFiles: readonly string[]): boolean {
  const available = new Set(availableFiles);
  return getCriticalFirstPlayAssets().every((asset) => available.has(asset.fileName));
}

export function getAudioFallback(fileName: string): AssetManifestEntry["fallback"] {
  return ASSET_MANIFEST.find((asset) => asset.fileName === fileName)?.fallback ?? "silent";
}

export function getFirstPlayableAssetRoles(): readonly AssetManifestEntry["role"][] {
  return ["ball", "goal", "keeper_core", "ui_essential", "basic_fx"];
}

export function getFirstPlayableAssets(): readonly AssetManifestEntry[] {
  return getCriticalFirstPlayAssets();
}

export function getTextureMemoryBudget(): { readonly criticalMb: number; readonly activeMb: number } {
  return {
    criticalMb: getCriticalFirstPlayAssets().reduce((total, asset) => total + asset.textureMemoryMb, 0),
    activeMb: ASSET_MANIFEST.reduce((total, asset) => total + asset.textureMemoryMb, 0)
  };
}

export function getOversizedCriticalAssets(): readonly AssetManifestEntry[] {
  return getCriticalFirstPlayAssets().filter((asset) => asset.compressedSizeKb > BUNDLE_BUDGETS.maxCriticalAssetKb);
}
