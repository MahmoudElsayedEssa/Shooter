import { describe, expect, it } from "vitest";
import { planAdaptiveAudio, type AudioContext } from "./AdaptiveAudio";

const baseContext: AudioContext = {
  userInteracted: true,
  audioInitFailed: false,
  shotCommitted: true,
  pressure: 0.5,
  finalShot: false,
  curve: 0,
  outcome: "none",
  postImpact: false
};

function plan(overrides: Partial<AudioContext> = {}) {
  return planAdaptiveAudio({ ...baseContext, ...overrides });
}

describe("REQ-AUDIO-001 adaptive audio system", () => {
  it("AC1 emits the required gameplay audio event set", () => {
    const events = plan({ finalShot: true, curve: 0.7, outcome: "goal", pressure: 1 }).events.map((event) => event.type);
    const saveEvents = plan({ outcome: "save", pressure: 0.8 }).events.map((event) => event.type);
    const postEvents = plan({ outcome: "miss", postImpact: true }).events.map((event) => event.type);

    expect(events).toEqual(["kick", "ball_whoosh", "curve_air", "tension_swell", "goal_net_impact", "crowd_reaction"]);
    expect(saveEvents).toEqual(["kick", "ball_whoosh", "save_impact", "crowd_reaction"]);
    expect(postEvents).toEqual(["kick", "ball_whoosh", "post_impact"]);
  });

  it("AC2 scales intensity with pressure and adds final-shot anticipation", () => {
    const low = plan({ pressure: 0, outcome: "goal" });
    const high = plan({ pressure: 1, outcome: "goal", finalShot: true });

    expect(low.events.find((event) => event.type === "ball_whoosh")?.intensity).toBe(0.35);
    expect(high.events.find((event) => event.type === "ball_whoosh")?.intensity).toBe(0.95);
    expect(low.events.find((event) => event.type === "crowd_reaction")?.intensity).toBe(0.25);
    expect(high.events.find((event) => event.type === "crowd_reaction")?.intensity).toBe(0.9);
    expect(high.events.find((event) => event.type === "tension_swell")?.intensity).toBe(1);
  });

  it("AC3 initializes only after user interaction", () => {
    expect(plan({ userInteracted: false }).initState).toBe("waiting_for_user");
    expect(plan({ userInteracted: false }).events).toEqual([]);
    expect(plan({ userInteracted: true }).initState).toBe("ready");
  });

  it("AC4 remains playable when audio initialization fails", () => {
    expect(plan({ audioInitFailed: true })).toMatchObject({
      initState: "failed_non_blocking",
      playable: true,
      blocksInput: false,
      blocksRendering: false,
      blocksMatchProgression: false,
      events: []
    });
  });

  it("AC5 triggers kick immediately and fades tension loops without abrupt restart", () => {
    const audio = plan({ pressure: 0.8, shotCommitted: true });

    expect(audio.events[0]).toMatchObject({ type: "kick", startMs: 0 });
    expect(audio.tensionLoop).toEqual({
      active: true,
      fadeInMs: 240,
      fadeOutMs: 240,
      restartsAbruptly: false
    });
  });

  it("AC6 result sounds do not delay gameplay reset", () => {
    expect(plan({ outcome: "goal" }).resetDelayMs).toBe(0);
    expect(plan({ outcome: "save" }).resetDelayMs).toBe(0);
    expect(plan({ outcome: "miss", postImpact: true }).resetDelayMs).toBe(0);
  });
});
