import { describe, expect, it, vi } from "vitest";

import { analyzeMediaFile } from "./browser-media-analyzer";
import type { AnalysisEvidence, ImportProgress } from "./types";

describe("browser media analyzer", () => {
  it("turns real transcription timing into playable tap and hold events", async () => {
    const progress: ImportProgress[] = [];
    const file = new File([new Uint8Array([1, 2, 3])], "Artist - Evening Song.mp3", { type: "audio/mpeg" });
    const samples = Float32Array.from({ length: 24_000 }, (_, index) => Math.sin(index / 12) * 0.4);
    const transcription: AnalysisEvidence = {
      durationMs: 3_000,
      events: [
        { startMs: 300, durationMs: 280, notes: ["C4"], velocity: 80, confidence: 0.8 },
        { startMs: 900, durationMs: 940, notes: ["D4", "F4"], velocity: 90, confidence: 0.9 },
      ],
      warnings: [],
      quality: "usable",
    };

    const record = await analyzeMediaFile(file, (item) => progress.push(item), {
      decode: vi.fn().mockResolvedValue({ samples, sampleRate: 8_000 }),
      checksum: vi.fn().mockResolvedValue("abc123"),
      transcribe: vi.fn(async (_pcm, onModelProgress) => {
        onModelProgress(0.25);
        onModelProgress(1);
        return transcription;
      }),
    });

    expect(progress.map((item) => item.stage)).toContain("transcribing");
    expect(progress.find((item) => item.stage === "transcribing" && item.fraction === 0.25)).toMatchObject({ method: "neural" });
    expect(record).toMatchObject({
      id: "import-abc123",
      checksum: "abc123",
      metadata: { title: "Evening Song", artist: "Artist" },
      song: { quality: "usable", recommendedPiano: "warm" },
    });
    expect(record.song.events).toHaveLength(2);
    expect(record.song.events[0]).toMatchObject({ kind: "tap", sourceStartMs: 300, sourceEndMs: 580 });
    expect(record.song.events[1]).toMatchObject({ kind: "hold", holdMs: 940, sourceStartMs: 900, sourceEndMs: 1840 });
    expect(record.song.events.every((event) => event.targetCode.startsWith("Digit"))).toBe(true);
  });

  it("labels the PCM sketch as a fallback when neural transcription fails", async () => {
    const progress: ImportProgress[] = [];
    const file = new File([new Uint8Array([1])], "Fallback.wav", { type: "audio/wav" });
    const samples = Float32Array.from({ length: 16_000 }, (_, index) => Math.sin(index / 8) * 0.4);

    const record = await analyzeMediaFile(file, (item) => progress.push(item), {
      decode: vi.fn().mockResolvedValue({ samples, sampleRate: 8_000 }),
      checksum: vi.fn().mockResolvedValue("fallback"),
      transcribe: vi.fn().mockRejectedValue(new Error("model unavailable")),
    });

    expect(record.song.quality).toBe("sketch");
    expect(record.warnings).toContain("NEURAL_TRANSCRIPTION_UNAVAILABLE");
    expect(progress).toContainEqual(expect.objectContaining({ stage: "transcribing", method: "fallback" }));
  });
});
