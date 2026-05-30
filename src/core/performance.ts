import { getFxPerformanceBudget } from "../systems/fx/VisualEffects";

export type PerformanceWarningKind = "dropped_catch_up_steps" | "frame_time_threshold";

export interface PerformanceGateInput {
  readonly lowEndMode: boolean;
  readonly heroMoment: boolean;
  readonly frameTimesMs: readonly number[];
  readonly droppedCatchUpFrames: number;
}

export interface PerformanceGate {
  readonly targetFps: 60 | 45;
  readonly acceptedFps: number;
  readonly lowEndFallbackDocumented: boolean;
  readonly reductionsBeforeInput: readonly [
    "fx",
    "background_motion",
    "shake",
    "flash",
    "particle_density"
  ];
  readonly inputResponsivenessFrames: 0 | 1;
  readonly particleCount: number;
  readonly pooledResources: readonly ["trail_points", "particles", "impact_effects", "temporary_visual_markers"];
  readonly warnings: readonly PerformanceWarningKind[];
}

export const PERFORMANCE_LIMITS = {
  targetFps: 60,
  lowEndMinFps: 45,
  frameWarningMs: 1000 / 45,
  droppedCatchUpWarningFrames: 2,
  inputFeedbackMaxFrames: 1
} as const;

export function evaluatePerformanceGate(input: PerformanceGateInput): PerformanceGate {
  const budget = getFxPerformanceBudget(input.lowEndMode, input.heroMoment);
  const warnings: PerformanceWarningKind[] = [];

  if (input.droppedCatchUpFrames >= PERFORMANCE_LIMITS.droppedCatchUpWarningFrames) {
    warnings.push("dropped_catch_up_steps");
  }

  if (input.frameTimesMs.some((frameTime) => frameTime > PERFORMANCE_LIMITS.frameWarningMs)) {
    warnings.push("frame_time_threshold");
  }

  return {
    targetFps: input.lowEndMode ? PERFORMANCE_LIMITS.lowEndMinFps : PERFORMANCE_LIMITS.targetFps,
    acceptedFps: budget.estimatedActiveFps,
    lowEndFallbackDocumented: input.lowEndMode,
    reductionsBeforeInput: ["fx", "background_motion", "shake", "flash", "particle_density"],
    inputResponsivenessFrames: PERFORMANCE_LIMITS.inputFeedbackMaxFrames,
    particleCount: budget.particleCount,
    pooledResources: budget.pooledResources,
    warnings
  };
}

export function acceptsPerformanceGate(gate: PerformanceGate): boolean {
  return gate.acceptedFps >= gate.targetFps || gate.lowEndFallbackDocumented;
}
