import {
  FIXED_DT_SECONDS,
  GameLoop,
  MAX_CATCH_UP_STEPS,
  SYSTEM_EXECUTION_ORDER,
  type RenderCallback,
  type RequestAnimationFrameLike,
  type SimulationState,
  type SimulationSystem
} from "./GameLoop";

function createManualRaf(): {
  requestAnimationFrame: RequestAnimationFrameLike;
  tick: (timestampMs: number) => void;
  queuedCallbacks: () => number;
} {
  const callbacks: Array<(timestampMs: number) => void> = [];

  return {
    requestAnimationFrame: (callback) => {
      callbacks.push(callback);
      return callbacks.length;
    },
    tick: (timestampMs) => {
      const callback = callbacks.shift();
      if (callback === undefined) {
        throw new Error("No animation frame callback queued");
      }
      callback(timestampMs);
    },
    queuedCallbacks: () => callbacks.length
  };
}

if (typeof describe === "function") {
describe("ARCH-GAMELOOP-001 fixed-step simulation loop", () => {
  it("uses fixed dt = 1/60s", () => {
    const observedDts: number[] = [];
    const simulation: SimulationSystem = (state, fixedDtSeconds) => {
      observedDts.push(fixedDtSeconds);
      return {
        ...state,
        lastExecutedSystems: [...state.lastExecutedSystems, "simulation"]
      };
    };
    const loop = new GameLoop({
      systems: { simulation },
      render: () => undefined,
      requestAnimationFrame: () => 1
    });

    const result = loop.stepFrame(FIXED_DT_SECONDS * 2);

    expect(FIXED_DT_SECONDS).toBe(1 / 60);
    expect(result.stepsExecuted).toBe(2);
    expect(result.state.tick).toBe(2);
    expect(observedDts).toEqual([1 / 60, 1 / 60]);
  });

  it("renders state only via requestAnimationFrame", () => {
    const raf = createManualRaf();
    const renderedStates: SimulationState[] = [];
    const render: RenderCallback = (state) => {
      renderedStates.push(state);
    };
    const loop = new GameLoop({
      render,
      requestAnimationFrame: raf.requestAnimationFrame
    });

    expect(renderedStates).toEqual([]);

    loop.start();
    expect(raf.queuedCallbacks()).toBe(1);
    expect(renderedStates).toEqual([]);

    raf.tick(1000);
    raf.tick(1017);

    expect(renderedStates).toHaveLength(2);
    expect(renderedStates[0].tick).toBe(0);
    expect(renderedStates[1].tick).toBe(1);
    expect(raf.queuedCallbacks()).toBe(1);
  });

  it("limits catch-up work to three fixed steps and drops excess time", () => {
    const loop = new GameLoop({
      render: () => undefined,
      requestAnimationFrame: () => 1
    });

    const result = loop.stepFrame(FIXED_DT_SECONDS * 5);

    expect(MAX_CATCH_UP_STEPS).toBe(3);
    expect(result.stepsExecuted).toBe(3);
    expect(result.state.tick).toBe(3);
    expect(result.droppedTimeSeconds).toBeCloseTo(FIXED_DT_SECONDS * 2);
    expect(result.state.droppedTimeSeconds).toBeCloseTo(FIXED_DT_SECONDS * 2);
  });

  it("executes systems in documented order", () => {
    const observedOrder: string[] = [];
    const record =
      (name: string): SimulationSystem =>
      (state) => {
        observedOrder.push(name);
        return {
          ...state,
          lastExecutedSystems: [...state.lastExecutedSystems, name as never]
        };
      };
    const loop = new GameLoop({
      systems: {
        input: record("input"),
        simulation: record("simulation"),
        "post-simulation": record("post-simulation")
      },
      render: () => undefined,
      requestAnimationFrame: () => 1
    });

    const result = loop.stepFrame(FIXED_DT_SECONDS);

    expect(SYSTEM_EXECUTION_ORDER).toEqual(["input", "simulation", "post-simulation"]);
    expect(observedOrder).toEqual(SYSTEM_EXECUTION_ORDER);
    expect(result.state.lastExecutedSystems).toEqual(SYSTEM_EXECUTION_ORDER);
  });
});
} else {
  console.log("GameLoop Vitest suite skipped outside Vitest.");
}
