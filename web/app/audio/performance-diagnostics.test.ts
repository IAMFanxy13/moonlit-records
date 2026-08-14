import { describe, expect, it, vi } from "vitest";

import { createPerformanceDiagnostics } from "./performance-diagnostics";

const runtime = {
  state: "running",
  baseLatency: 0.012,
  outputLatency: 0.034,
  outputTimestamp: { contextTime: 8.5, performanceTime: 220 },
  currentTime: 8.7,
  lookAhead: 0.1,
  latencyHint: "interactive",
};

describe("development performance diagnostics", () => {
  it("records hold, inter-key gap, attack-call delta, context, and voice counts", () => {
    const sink = vi.fn();
    const diagnostics = createPerformanceDiagnostics({ enabled: true, sink });

    diagnostics.keyDown("KeyN", 100, {
      activePhysicalVoices: 1,
      activeResonanceVoices: 0,
      runtime,
    });
    diagnostics.audioAttack("KeyN", 101.5, {
      activePhysicalVoices: 1,
      activeResonanceVoices: 0,
      runtime,
    });
    diagnostics.keyUp("KeyN", 384, {
      activePhysicalVoices: 0,
      activeResonanceVoices: 1,
      runtime,
    });
    diagnostics.keyDown("KeyH", 521, {
      activePhysicalVoices: 1,
      activeResonanceVoices: 1,
      runtime,
    });

    expect(diagnostics.records()[0]).toMatchObject({
      code: "KeyN",
      keyDownAt: 100,
      keyUpAt: 384,
      holdMs: 284,
      attackCalledAt: 101.5,
      keyDownToAttackMs: 1.5,
      contextState: "running",
      baseLatency: 0.012,
      latencyHint: "interactive",
      outputLatency: 0.034,
      currentTime: 8.7,
      lookAhead: 0.1,
    });
    expect(diagnostics.records()[1]).toMatchObject({
      code: "KeyH",
      keyDownAt: 521,
      interKeyGapMs: 137,
      activePhysicalVoices: 1,
      activeResonanceVoices: 1,
    });
    expect(sink).toHaveBeenCalled();
  });

  it("does nothing when diagnostics are disabled", () => {
    const sink = vi.fn();
    const diagnostics = createPerformanceDiagnostics({ enabled: false, sink });

    diagnostics.keyDown("KeyN", 100, {
      activePhysicalVoices: 1,
      activeResonanceVoices: 0,
      runtime,
    });
    diagnostics.audioAttack("KeyN", 101, {
      activePhysicalVoices: 1,
      activeResonanceVoices: 0,
      runtime,
    });
    diagnostics.keyUp("KeyN", 200, {
      activePhysicalVoices: 0,
      activeResonanceVoices: 1,
      runtime,
    });

    expect(diagnostics.records()).toEqual([]);
    expect(sink).not.toHaveBeenCalled();
  });
});
