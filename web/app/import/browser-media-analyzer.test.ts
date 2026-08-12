import { describe, expect, it, vi } from "vitest";

import { analyzeMediaFile } from "./browser-media-analyzer";
import type { ImportProgress } from "./types";

describe("browser media analyzer", () => {
  it("always returns a playable private sketch after a successful local decode", async () => {
    const progress: ImportProgress[] = [];
    const file = new File([new Uint8Array([1, 2, 3])], "Artist - Evening Song.mp3", { type: "audio/mpeg" });
    const samples = Float32Array.from({ length: 24_000 }, (_, index) => Math.sin(index / 12) * 0.4);

    const record = await analyzeMediaFile(file, (item) => progress.push(item), {
      decode: vi.fn().mockResolvedValue({ samples, sampleRate: 8_000 }),
      checksum: vi.fn().mockResolvedValue("abc123"),
    });

    expect(progress.map((item) => item.stage)).toEqual([
      "preparing", "identifying", "separating", "lyrics", "melody", "arranging", "ready",
    ]);
    expect(record).toMatchObject({
      id: "import-abc123",
      checksum: "abc123",
      metadata: { title: "Evening Song", artist: "Artist" },
      song: { quality: "sketch", recommendedPiano: "warm" },
    });
    expect(record.song.events.length).toBeGreaterThan(0);
    expect(record.song.events.every((event) => event.targetCode.startsWith("Digit"))).toBe(true);
  });
});
