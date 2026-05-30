export const FIXED_DT_SECONDS = 1 / 60;
export const MAX_CATCH_UP_STEPS = 3;

export type SimulationSystemName = "input" | "simulation" | "post-simulation";

export const SYSTEM_EXECUTION_ORDER: readonly SimulationSystemName[] = [
  "input",
  "simulation",
  "post-simulation"
] as const;

export interface SimulationState {
  readonly tick: number;
  readonly elapsedSeconds: number;
  readonly droppedTimeSeconds: number;
  readonly lastExecutedSystems: readonly SimulationSystemName[];
}

export type SimulationSystem = (state: SimulationState, fixedDtSeconds: number) => SimulationState;
export type RenderCallback = (state: SimulationState, alpha: number) => void;
export type RequestAnimationFrameLike = (callback: (timestampMs: number) => void) => number;
export type CancelAnimationFrameLike = (handle: number) => void;

export interface GameLoopOptions {
  readonly initialState?: SimulationState;
  readonly systems?: Partial<Record<SimulationSystemName, SimulationSystem>>;
  readonly render: RenderCallback;
  readonly requestAnimationFrame: RequestAnimationFrameLike;
  readonly cancelAnimationFrame?: CancelAnimationFrameLike;
}

export interface FrameStepResult {
  readonly state: SimulationState;
  readonly stepsExecuted: number;
  readonly droppedTimeSeconds: number;
  readonly interpolationAlpha: number;
}

export class GameLoop {
  private state: SimulationState;
  private accumulatorSeconds = 0;
  private previousTimestampMs: number | null = null;
  private frameHandle: number | null = null;
  private running = false;

  constructor(private readonly options: GameLoopOptions) {
    this.state =
      options.initialState ??
      Object.freeze({
        tick: 0,
        elapsedSeconds: 0,
        droppedTimeSeconds: 0,
        lastExecutedSystems: []
      });
  }

  get snapshot(): SimulationState {
    return this.state;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.frameHandle = this.options.requestAnimationFrame(this.onAnimationFrame);
  }

  stop(): void {
    this.running = false;
    if (this.frameHandle !== null && this.options.cancelAnimationFrame !== undefined) {
      this.options.cancelAnimationFrame(this.frameHandle);
    }
    this.frameHandle = null;
    this.previousTimestampMs = null;
  }

  stepFrame(deltaSeconds: number): FrameStepResult {
    this.accumulatorSeconds += Math.max(0, deltaSeconds);
    let stepsExecuted = 0;

    while (this.accumulatorSeconds >= FIXED_DT_SECONDS && stepsExecuted < MAX_CATCH_UP_STEPS) {
      this.state = this.runFixedStep(this.state);
      this.accumulatorSeconds -= FIXED_DT_SECONDS;
      stepsExecuted += 1;
    }

    let droppedTimeSeconds = 0;
    if (this.accumulatorSeconds >= FIXED_DT_SECONDS) {
      droppedTimeSeconds = this.accumulatorSeconds;
      this.accumulatorSeconds = 0;
      this.state = {
        ...this.state,
        droppedTimeSeconds: this.state.droppedTimeSeconds + droppedTimeSeconds
      };
    }

    const interpolationAlpha = this.accumulatorSeconds / FIXED_DT_SECONDS;

    return {
      state: this.state,
      stepsExecuted,
      droppedTimeSeconds,
      interpolationAlpha
    };
  }

  private readonly onAnimationFrame = (timestampMs: number): void => {
    if (!this.running) {
      return;
    }

    const deltaSeconds =
      this.previousTimestampMs === null ? 0 : (timestampMs - this.previousTimestampMs) / 1000;
    this.previousTimestampMs = timestampMs;

    const result = this.stepFrame(deltaSeconds);
    this.options.render(result.state, result.interpolationAlpha);
    this.frameHandle = this.options.requestAnimationFrame(this.onAnimationFrame);
  };

  private runFixedStep(current: SimulationState): SimulationState {
    let next: SimulationState = {
      ...current,
      tick: current.tick + 1,
      elapsedSeconds: current.elapsedSeconds + FIXED_DT_SECONDS,
      lastExecutedSystems: []
    };

    for (const systemName of SYSTEM_EXECUTION_ORDER) {
      const system = this.options.systems?.[systemName] ?? defaultSystem(systemName);
      next = system(next, FIXED_DT_SECONDS);
    }

    return next;
  }
}

function defaultSystem(systemName: SimulationSystemName): SimulationSystem {
  return (state) => ({
    ...state,
    lastExecutedSystems: [...state.lastExecutedSystems, systemName]
  });
}
