export type AssetGroup = "gameplay" | "ui" | "audio" | "polish";
export type LoadPriority = "critical" | "optional";

export interface AssetManifestEntry {
  readonly fileName: string;
  readonly group: AssetGroup;
  readonly dimensions: readonly [number, number] | null;
  readonly compressedSizeKb: number;
  readonly loadPriority: LoadPriority;
  readonly critical: boolean;
  readonly atlas: string | null;
  readonly fallback: "silent" | "skip_optional" | "required";
}

export const ASSET_MANIFEST: readonly AssetManifestEntry[] = [
  {
    fileName: "gameplay-atlas.webp",
    group: "gameplay",
    dimensions: [1024, 1024],
    compressedSizeKb: 480,
    loadPriority: "critical",
    critical: true,
    atlas: "gameplay",
    fallback: "required"
  },
  {
    fileName: "ui-atlas.webp",
    group: "ui",
    dimensions: [512, 512],
    compressedSizeKb: 120,
    loadPriority: "critical",
    critical: true,
    atlas: "ui",
    fallback: "required"
  },
  {
    fileName: "match-audio.ogg",
    group: "audio",
    dimensions: null,
    compressedSizeKb: 180,
    loadPriority: "optional",
    critical: false,
    atlas: null,
    fallback: "silent"
  },
  {
    fileName: "cinematic-polish.webp",
    group: "polish",
    dimensions: [512, 512],
    compressedSizeKb: 96,
    loadPriority: "optional",
    critical: false,
    atlas: "polish",
    fallback: "skip_optional"
  }
] as const;

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
