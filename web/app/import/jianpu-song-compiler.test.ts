import { describe, expect, test } from "vitest";

import { compileJianpuSong } from "./jianpu-song-compiler";
import type { ParsedJianpuScore } from "./jianpu-types";

function scoreFixture(): ParsedJianpuScore {
  return {
    title: "花海",
    artist: "周杰伦",
    tonic: "F",
    meter: "4/4",
    tempoBpm: 72,
    warnings: ["TEMPO_ESTIMATED"],
    quality: "estimated",
    confidence: 0.84,
    rows: [
      {
        id: "row-1",
        notationText: "1 0 2_ 3",
        lyricText: "你 你 Love",
        confidence: 0.9,
        notes: [
          { raw: "1", degree: 1, octave: 0, beats: 1, rest: false, lyric: "你", confidence: 0.9 },
          { raw: "0", degree: 0, octave: 0, beats: 1, rest: true, lyric: null, confidence: 0.9 },
          { raw: "2_", degree: 2, octave: 0, beats: 0.5, rest: false, lyric: "你", confidence: 0.9 },
          { raw: "3", degree: 3, octave: 1, beats: 1, rest: false, lyric: "Love", confidence: 0.9 },
        ],
      },
      {
        id: "row-2",
        notationText: "5 6",
        lyricText: "",
        confidence: 0.7,
        notes: [
          { raw: "5", degree: 5, octave: 0, beats: 1, rest: false, lyric: null, confidence: 0.7 },
          { raw: "6", degree: 6, octave: 0, beats: 1, rest: false, lyric: null, confidence: 0.7 },
        ],
      },
    ],
  };
}

describe("compileJianpuSong", () => {
  test("maps relative scale degrees, lyric initials, rests, and fallback digits into real player events", () => {
    const song = compileJianpuSong(scoreFixture(), "private-flower-sea");

    expect(song.tempoBpm).toBe(72);
    expect(song.title).toBe("花海");
    expect(song.events.map((event) => event.targetCode)).toEqual([
      "KeyN",
      "KeyN",
      "KeyL",
      "Digit1",
      "Digit2",
    ]);
    expect(song.events[0]).toMatchObject({ note: "F4", kind: "hold", holdMs: 833 });
    expect(song.events[1]).toMatchObject({ note: "G4", kind: "hold", holdMs: 417, restBeforeMs: 833 });
    expect(song.events[2].note).toBe("A5");
    expect(song.events[0].token).toBe("你");
    expect(song.events[1].token).toBe("你");
  });

  test("keeps source timing continuous so the highway can show literal durations", () => {
    const song = compileJianpuSong(scoreFixture(), "private-flower-sea");

    expect(song.events.map((event) => [event.sourceStartMs, event.sourceEndMs])).toEqual([
      [0, 833],
      [1666, 2083],
      [2083, 2916],
      [2916, 3749],
      [3749, 4582],
    ]);
    expect(song.durationLabel).toBe("00:05");
    expect(song.quality).toBe("sketch");
    expect(song.provenance).toContain("offline-jianpu-recognition");
  });
});

