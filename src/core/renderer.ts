export interface SafeAreaInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface MobileViewportInput {
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly devicePixelRatio: number;
  readonly safeAreaInsets?: Partial<SafeAreaInsets>;
}

export interface MobileViewportPlan {
  readonly orientation: "portrait";
  readonly layoutWidth: number;
  readonly layoutHeight: number;
  readonly renderWidth: number;
  readonly renderHeight: number;
  readonly devicePixelRatio: number;
  readonly safeArea: SafeAreaInsets;
  readonly playBounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly rootStyle: {
    readonly touchAction: "none";
    readonly overscrollBehavior: "none";
    readonly userSelect: "none";
    readonly webkitUserSelect: "none";
  };
}

export const MOBILE_RENDER_LIMITS = {
  minPortraitWidth: 320,
  maxDevicePixelRatio: 2
} as const;

const ZERO_SAFE_AREA: SafeAreaInsets = Object.freeze({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0
});

export function planMobileViewport(input: MobileViewportInput): MobileViewportPlan {
  const safeArea = normalizeSafeArea(input.safeAreaInsets);
  const layoutWidth = Math.max(MOBILE_RENDER_LIMITS.minPortraitWidth, Math.floor(input.cssWidth));
  const layoutHeight = Math.max(layoutWidth, Math.floor(input.cssHeight));
  const devicePixelRatio = clampDevicePixelRatio(input.devicePixelRatio);
  const playBounds = {
    x: safeArea.left,
    y: safeArea.top,
    width: Math.max(0, layoutWidth - safeArea.left - safeArea.right),
    height: Math.max(0, layoutHeight - safeArea.top - safeArea.bottom)
  };

  return {
    orientation: "portrait",
    layoutWidth,
    layoutHeight,
    renderWidth: Math.round(layoutWidth * devicePixelRatio),
    renderHeight: Math.round(layoutHeight * devicePixelRatio),
    devicePixelRatio,
    safeArea,
    playBounds,
    rootStyle: {
      touchAction: "none",
      overscrollBehavior: "none",
      userSelect: "none",
      webkitUserSelect: "none"
    }
  };
}

export function clampDevicePixelRatio(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  return Math.min(MOBILE_RENDER_LIMITS.maxDevicePixelRatio, value);
}

function normalizeSafeArea(input: Partial<SafeAreaInsets> | undefined): SafeAreaInsets {
  return {
    top: positivePixel(input?.top ?? ZERO_SAFE_AREA.top),
    right: positivePixel(input?.right ?? ZERO_SAFE_AREA.right),
    bottom: positivePixel(input?.bottom ?? ZERO_SAFE_AREA.bottom),
    left: positivePixel(input?.left ?? ZERO_SAFE_AREA.left)
  };
}

function positivePixel(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
