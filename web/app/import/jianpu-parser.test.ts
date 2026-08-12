import { describe, expect, test } from "vitest";

import {
  parseJianpuHeader,
  parseJianpuPages,
  parseJianpuToken,
} from "./jianpu-parser";
import type { RecognizedScorePage } from "./jianpu-types";

describe("parseJianpuToken", () => {
  test("preserves the printed rhythm marks instead of flattening every note to one beat", () => {
    expect(parseJianpuToken("1__.")).toMatchObject({
      degree: 1,
      beats: 0.375,
      rest: false,
    });
    expect(parseJianpuToken("5--")).toMatchObject({ degree: 5, beats: 3 });
  });

  test("keeps zero as a timed silent rest", () => {
    expect(parseJianpuToken("0-")).toMatchObject({
      degree: 0,
      beats: 2,
      rest: true,
    });
  });

  test("reads upper and lower octave marks without changing scale degree", () => {
    expect(parseJianpuToken("^1")).toMatchObject({ degree: 1, octave: 1 });
    expect(parseJianpuToken(",7")).toMatchObject({ degree: 7, octave: -1 });
  });
});

describe("parseJianpuHeader", () => {
  test("uses the score key, meter, and tempo when printed", () => {
    expect(parseJianpuHeader(["花海", "1 = F", "4/4", "♩ = 96"])).toEqual({
      tonic: "F",
      meter: "4/4",
      tempoBpm: 96,
      warnings: [],
    });
  });

  test("falls back deterministically when optional metadata is absent", () => {
    expect(parseJianpuHeader(["3 3 2 1"])).toEqual({
      tonic: "C",
      meter: "4/4",
      tempoBpm: 72,
      warnings: ["TONIC_ESTIMATED", "METER_ESTIMATED", "TEMPO_ESTIMATED"],
    });
  });
});

describe("parseJianpuPages", () => {
  const overlappingPages: RecognizedScorePage[] = [
    {
      id: "page-1",
      width: 1000,
      height: 1400,
      lines: [
        { text: "花海", role: "title", top: 40, confidence: 0.99 },
        { text: "周杰伦 作曲", role: "metadata", top: 90, confidence: 0.9 },
        { text: "1=F 4/4", role: "metadata", top: 120, confidence: 0.98 },
        { text: "3 3 2 1", role: "notation", top: 300, confidence: 0.92 },
        { text: "静 止 了", role: "lyrics", top: 340, confidence: 0.94 },
        { text: "1_ 1_ 5-", role: "notation", top: 440, confidence: 0.88 },
        { text: "你 喜欢", role: "lyrics", top: 480, confidence: 0.9 },
      ],
    },
    {
      id: "page-2",
      width: 1000,
      height: 1400,
      lines: [
        { text: "1_ 1_ 5-", role: "notation", top: 100, confidence: 0.88 },
        { text: "你 喜欢", role: "lyrics", top: 140, confidence: 0.9 },
        { text: "0 6 5", role: "notation", top: 260, confidence: 0.83 },
      ],
    },
  ];

  test("matches lyrics below notation and removes overlap between screenshots", () => {
    const parsed = parseJianpuPages(overlappingPages, { fallbackTitle: "scan" });

    expect(parsed.title).toBe("花海");
    expect(parsed.artist).toBe("周杰伦");
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows.map((row) => row.notes.map((note) => note.degree))).toEqual([
      [3, 3, 2, 1],
      [1, 1, 5],
      [0, 6, 5],
    ]);
    expect(parsed.rows[0].notes.map((note) => note.lyric)).toEqual(["静", "止", "了", "了"]);
    expect(parsed.rows[1].notes.map((note) => note.lyric)).toEqual(["你", "喜欢", "喜欢"]);
  });

  test("keeps usable notes and marks the score estimated when lyrics or rhythm are incomplete", () => {
    const parsed = parseJianpuPages(overlappingPages, { fallbackTitle: "scan" });

    expect(parsed.quality).toBe("estimated");
    expect(parsed.warnings).toContain("TEMPO_ESTIMATED");
    expect(parsed.warnings).toContain("LYRICS_INCOMPLETE");
    expect(parsed.rows[2].notes[1].beats).toBe(1);
  });
});
