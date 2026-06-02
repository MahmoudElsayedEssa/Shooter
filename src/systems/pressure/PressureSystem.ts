import { clamp } from "../../core/math";

export type ResolvedOutcome = "goal" | "save" | "miss";

export interface PressureContext {
  readonly shotIndex: number;
  readonly maxShots: number;
  readonly playerScore: number;
  readonly goalkeeperScore: number;
  readonly matchPoint: boolean;
  readonly finalShot: boolean;
  readonly alreadyDecided: boolean;
  readonly resolvedOutcome: ResolvedOutcome;
}

export interface PressureState {
  readonly pressure: number;
  readonly escalationFloor: number;
  readonly presentation: PressurePresentation;
  readonly resolvedOutcome: ResolvedOutcome;
}

export interface PressurePresentation {
  readonly moodIntensity: number;
  readonly cameraZoom: number;
  readonly fxIntensity: number;
  readonly audioTension: number;
  readonly trailBrightness: number;
  readonly uiUrgency: number;
}

export const PRESSURE_LIMITS = {
  shotWeight: 0.55,
  scoreWeight: 0.25,
  matchPointBonus: 0.14,
  finalShotBonus: 0.16,
  decidedMultiplier: 0.3,
  closeMultiplier: 1,
  escalationFloors: [0.1, 0.18, 0.3, 0.45, 0.5],
  maxCameraZoom: 1.12
} as const;

export function calculatePressure(context: PressureContext): PressureState {
  const shotProgress = clamp((context.shotIndex + 1) / context.maxShots, 0, 1);
  const scoreTension = clamp(1 - Math.abs(context.playerScore - context.goalkeeperScore) / context.maxShots, 0, 1);
  const rawPressure =
    shotProgress * PRESSURE_LIMITS.shotWeight +
    scoreTension * PRESSURE_LIMITS.scoreWeight +
    (context.matchPoint ? PRESSURE_LIMITS.matchPointBonus : 0) +
    (context.finalShot ? PRESSURE_LIMITS.finalShotBonus : 0);
  const floor = getEscalationFloor(context);
  const pressure = Math.max(clamp(rawPressure, 0, 1), floor);

  return {
    pressure,
    escalationFloor: floor,
    presentation: getPressurePresentation(pressure),
    resolvedOutcome: context.resolvedOutcome
  };
}

export function getEscalationFloor(context: PressureContext): number {
  const baseFloor = PRESSURE_LIMITS.escalationFloors[
    Math.min(context.shotIndex, PRESSURE_LIMITS.escalationFloors.length - 1)
  ];
  const multiplier = context.alreadyDecided ? PRESSURE_LIMITS.decidedMultiplier : PRESSURE_LIMITS.closeMultiplier;
  return baseFloor * multiplier;
}

function getPressurePresentation(pressure: number): PressurePresentation {
  return {
    moodIntensity: pressure,
    cameraZoom: 1 + (PRESSURE_LIMITS.maxCameraZoom - 1) * pressure,
    fxIntensity: pressure,
    audioTension: pressure,
    trailBrightness: 0.6 + pressure * 0.4,
    uiUrgency: pressure
  };
}
