import { strict as assert } from "node:assert";
import {
  SYSTEM_EXECUTION_ORDER,
  createRenderSnapshot,
  type SimulationState
} from "./GameLoop";

function verifyRenderSnapshotIsolation(): true {
  const authoritativeState: SimulationState = {
    tick: 3,
    elapsedSeconds: 0.05,
    droppedTimeSeconds: 0,
    lastExecutedSystems: SYSTEM_EXECUTION_ORDER
  };

  const presentationSnapshot = createRenderSnapshot(authoritativeState);

  assert.notEqual(presentationSnapshot, authoritativeState);
  assert.equal(Object.isFrozen(presentationSnapshot), true);
  assert.equal(Object.isFrozen(presentationSnapshot.lastExecutedSystems), true);
  assert.deepEqual(presentationSnapshot.lastExecutedSystems, authoritativeState.lastExecutedSystems);

  assert.throws(() => {
    (presentationSnapshot as unknown as { tick: number }).tick = 999;
  }, TypeError);

  assert.throws(() => {
    (presentationSnapshot.lastExecutedSystems as string[]).push("render");
  }, TypeError);

  assert.equal(authoritativeState.tick, 3);
  assert.deepEqual(authoritativeState.lastExecutedSystems, SYSTEM_EXECUTION_ORDER);
  return true;
}

if (typeof describe === "function") {
  describe("METHOD-DETERMINISM-001 render snapshot unit behavior", () => {
    it("creates immutable presentation snapshots without mutating authoritative state", () => {
      expect(verifyRenderSnapshotIsolation()).toBe(true);
    });
  });
} else {
  const { default: test } = await import("node:test");
  test("METHOD-DETERMINISM-001 creates immutable presentation snapshots without mutating authoritative state", () => {
    assert.equal(verifyRenderSnapshotIsolation(), true);
  });
}
