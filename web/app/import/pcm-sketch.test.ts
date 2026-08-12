import { describe, expect, it } from "vitest";

import { analyzePcmToSketch } from "./pcm-sketch";
import { ImportMediaError } from "./types";

function sine(frequency: number, seconds: number, sampleRate = 8_000): Float32Array {
  return Float32Array.from(
    { length: seconds * sampleRate },
    (_, index) => Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 0.45,
  );
}

describe("PCM piano sketch", () => {
  it("turns audible PCM into a bounded deterministic piano event path", () => {
    const input = { samples: sine(440, 3), sampleRate: 8_000 };
    const first = analyzePcmToSketch(input);
    const second = analyzePcmToSketch(input);

    expect(first).toEqual(second);
    expect(first.events.length).toBeGreaterThanOrEqual(8);
    expect(first.events.length).toBeLessThanOrEqual(512);
    expect(first.events.every((event) => event.notes.every((note) => /^([A-G])#?[3-5]$/.test(note)))).toBe(true);
    expect(first.quality).toBe("sketch");
    expect(first.warnings).toContain("ON_DEVICE_SKETCH");
  });

  it("tracks pulse spacing as a usable tempo hint", () => {
    const sampleRate = 8_000;
    const samples = new Float32Array(sampleRate * 4);
    for (let beat = 0; beat < 8; beat += 1) {
      const start = beat * sampleRate * 0.5;
      for (let index = 0; index < 700; index += 1) samples[start + index] = Math.sin(index / 5) * 0.8;
    }

    const result = analyzePcmToSketch({ samples, sampleRate });
    expect(result.tempo).toBeGreaterThanOrEqual(80);
    expect(result.tempo).toBeLessThanOrEqual(160);
  });

  it("rejects silent PCM instead of fabricating a song", () => {
    expect(() => analyzePcmToSketch({ samples: new Float32Array(16_000), sampleRate: 8_000 }))
      .toThrowError(expect.objectContaining<Partial<ImportMediaError>>({ code: "NO_AUDIBLE_AUDIO" }));
  });
});
