import { describe, expect, test } from "vitest";

import { analyzeScoreFiles } from "./browser-score-analyzer";
import type { RecognizedScorePage } from "./jianpu-types";
import type { ImportProgress } from "./types";

const recognizedPage: RecognizedScorePage = {
  id: "source-1-page-1",
  width: 1000,
  height: 1400,
  lines: [
    { text: "花海", role: "title", top: 50, confidence: 0.98 },
    { text: "周杰伦 作曲", role: "metadata", top: 100, confidence: 0.91 },
    { text: "1=F 4/4", role: "metadata", top: 140, confidence: 0.95 },
    { text: "3 0 2_ 1", role: "notation", top: 300, confidence: 0.86 },
    { text: "静 止 了", role: "lyrics", top: 345, confidence: 0.9 },
  ],
};

describe("analyzeScoreFiles", () => {
  test("runs every honest local stage and returns the recognized score rather than a filename sketch", async () => {
    const progress: ImportProgress[] = [];
    const file = new File(["score"], "phone capture.png", { type: "image/png", lastModified: 42 });

    const record = await analyzeScoreFiles([file], (value) => progress.push(value), {
      checksum: async () => "facefeed1234",
      loadPages: async () => [
        {
          id: "source-1-page-1",
          sourceName: file.name,
          sourceIndex: 0,
          pageNumber: 1,
          blob: file,
          width: 1000,
          height: 1400,
        },
      ],
      recognizePages: async (_pages, onPage) => {
        onPage?.(1, 1);
        return [recognizedPage];
      },
    });

    expect(progress.map((item) => item.stage)).toEqual([
      "preparing",
      "rendering",
      "recognizing",
      "recognizing",
      "interpreting",
      "arranging",
      "ready",
    ]);
    expect(record.id).toBe("score-facefeed1234");
    expect(record.metadata).toMatchObject({ title: "花海", artist: "周杰伦" });
    expect(record.song.events.map((event) => event.note)).toEqual(["A4", "G4", "F4"]);
    expect(record.song.events[1].restBeforeMs).toBe(833);
  });

  test("uses a readable filename and Unknown Artist when the score has no metadata", async () => {
    const file = new File(["score"], "my-night-score.jpg", { type: "image/jpeg" });
    const record = await analyzeScoreFiles([file], () => undefined, {
      checksum: async () => "aa11",
      loadPages: async () => [],
      recognizePages: async () => [{
        id: "page",
        width: 800,
        height: 1200,
        lines: [{ text: "1 2 3 4", role: "notation", top: 200, confidence: 0.6 }],
      }],
    });

    expect(record.metadata.title).toBe("my night score");
    expect(record.metadata.artist).toBe("Unknown Artist");
    expect(record.warnings).toContain("METADATA_ESTIMATED");
    expect(record.song.quality).toBe("sketch");
  });

  test("blocks only when no recognizable Jianpu digit remains", async () => {
    const file = new File(["score"], "blank.png", { type: "image/png" });

    await expect(analyzeScoreFiles([file], () => undefined, {
      checksum: async () => "blank",
      loadPages: async () => [],
      recognizePages: async () => [{
        id: "blank",
        width: 500,
        height: 500,
        lines: [{ text: "nothing musical", role: "unknown", top: 20, confidence: 0.9 }],
      }],
    })).rejects.toEqual(expect.objectContaining({ code: "NO_JIANPU" }));
  });
});

