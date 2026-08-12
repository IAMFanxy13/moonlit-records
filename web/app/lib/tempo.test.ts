import { describe, expect, test } from "vitest";

import { scaleSongTempo } from "./tempo";
import { builtinSongs } from "./songs";

describe("scaleSongTempo", () => {
  test("rescales every authored duration and rest without changing key or pitch", () => {
    const base = builtinSongs[0];
    const song = {
      ...base,
      tempoBpm: 72,
      events: [{
        ...base.events[0],
        kind: "hold" as const,
        holdMs: 500,
        restBeforeMs: 250,
        sourceStartMs: 100,
        sourceEndMs: 600,
      }],
    };

    const scaled = scaleSongTempo(song, 60);

    expect(scaled.tempoBpm).toBe(60);
    expect(scaled.events[0]).toMatchObject({
      targetCode: song.events[0].targetCode,
      notes: song.events[0].notes,
      holdMs: 600,
      restBeforeMs: 300,
      sourceStartMs: 120,
      sourceEndMs: 720,
    });
    expect(song.events[0].holdMs).toBe(500);
  });

  test("clamps the recital control to the supported 50–120 BPM range", () => {
    const base = { ...builtinSongs[0], tempoBpm: 72 };
    expect(scaleSongTempo(base, 10).tempoBpm).toBe(50);
    expect(scaleSongTempo(base, 240).tempoBpm).toBe(120);
  });
});

