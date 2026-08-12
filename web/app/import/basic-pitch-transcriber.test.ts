import { describe, expect, it } from "vitest";

import { basicPitchNotesToEvidence, resamplePcm } from "./basic-pitch-transcriber";

describe("Basic Pitch transcription boundary", () => {
  it("groups near-simultaneous notes into one reduced chord and preserves the longest duration", () => {
    const evidence = basicPitchNotesToEvidence([
      { startTimeSeconds: 1, durationSeconds: 0.9, pitchMidi: 60, amplitude: 0.9 },
      { startTimeSeconds: 1.04, durationSeconds: 0.4, pitchMidi: 64, amplitude: 0.8 },
      { startTimeSeconds: 1.06, durationSeconds: 0.3, pitchMidi: 67, amplitude: 0.7 },
      { startTimeSeconds: 1.07, durationSeconds: 0.2, pitchMidi: 72, amplitude: 0.2 },
      { startTimeSeconds: 2, durationSeconds: 0.25, pitchMidi: 62, amplitude: 0.65 },
    ], 3_000);

    expect(evidence.quality).toBe("usable");
    expect(evidence.events).toHaveLength(2);
    expect(evidence.events[0]).toMatchObject({
      startMs: 1_000,
      durationMs: 900,
      notes: ["C4", "E4", "G4"],
    });
    expect(evidence.events[1]).toMatchObject({
      startMs: 2_000,
      durationMs: 250,
      notes: ["D4"],
    });
  });

  it("resamples PCM to the model rate without changing its duration", () => {
    const source = Float32Array.from([0, 0.5, 1, 0.5]);
    const result = resamplePcm(source, 4, 8);

    expect(result).toHaveLength(8);
    expect(result[0]).toBeCloseTo(0);
    expect(result[2]).toBeCloseTo(0.5);
    expect(result[4]).toBeCloseTo(1);
  });
});
