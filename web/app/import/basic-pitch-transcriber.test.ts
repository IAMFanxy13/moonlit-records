import { describe, expect, it } from "vitest";

import { basicPitchNotesToEvidence, resamplePcm, transcribePcmInChunks } from "./basic-pitch-transcriber";

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

  it("transcribes a multi-minute source in bounded overlapping segments", async () => {
    const detectorLengths: number[] = [];
    const progress: number[] = [];
    let call = 0;
    const evidence = await transcribePcmInChunks(
      { samples: new Float32Array(45 * 10), sampleRate: 10 },
      async (samples, onProgress) => {
        detectorLengths.push(samples.length);
        onProgress(0.5);
        const notes = call === 0
          ? [{ startTimeSeconds: 19.5, durationSeconds: 0.5, pitchMidi: 60, amplitude: 0.8 }]
          : call === 1
            ? [
                { startTimeSeconds: 0.5, durationSeconds: 0.7, pitchMidi: 60, amplitude: 0.9 },
                { startTimeSeconds: 10, durationSeconds: 0.4, pitchMidi: 62, amplitude: 0.7 },
              ]
            : [{ startTimeSeconds: 1, durationSeconds: 0.8, pitchMidi: 64, amplitude: 0.75 }];
        call += 1;
        return notes;
      },
      (fraction) => progress.push(fraction),
    );

    expect(detectorLengths).toHaveLength(3);
    expect(Math.max(...detectorLengths)).toBeLessThanOrEqual(20 * 22_050);
    expect(evidence.events.map((event) => event.startMs)).toEqual([19_500, 29_000, 39_000]);
    expect(evidence.events[0].durationMs).toBe(700);
    expect(progress.at(-1)).toBe(1);
    expect(progress.every((fraction, index) => index === 0 || fraction >= progress[index - 1])).toBe(true);
  });

  it("uses the longest member duration without inflating a chord by onset spread", () => {
    const evidence = basicPitchNotesToEvidence([
      { startTimeSeconds: 1, durationSeconds: 0.55, pitchMidi: 60, amplitude: 0.9 },
      { startTimeSeconds: 1.08, durationSeconds: 0.55, pitchMidi: 64, amplitude: 0.8 },
    ], 2_000);

    expect(evidence.events).toHaveLength(1);
    expect(evidence.events[0].durationMs).toBe(550);
  });
});
