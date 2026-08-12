import { describe, expect, it } from "vitest";

import { scoreRecordingMatch } from "./match";

describe("recording match", () => {
  it("prefers the same title, artist, and duration", () => {
    const exact = scoreRecordingMatch(
      { title: "Fix You", artist: "Coldplay", durationMs: 295_000 },
      { title: "Fix You", artist: "Coldplay", durationMs: 294_900, disambiguation: "" },
    );
    const wrongVersion = scoreRecordingMatch(
      { title: "Fix You", artist: "Coldplay", durationMs: 295_000 },
      { title: "Fix You (Live)", artist: "Coldplay", durationMs: 340_000, disambiguation: "live" },
    );

    expect(exact).toBeGreaterThan(0.9);
    expect(wrongVersion).toBeLessThan(0.55);
  });

  it("does not trust a title-only result enough to replace identity", () => {
    expect(scoreRecordingMatch(
      { title: "Hello", artist: "Unknown Artist", durationMs: 200_000 },
      { title: "Hello", artist: "Adele", durationMs: 200_000, disambiguation: "" },
    )).toBeLessThan(0.75);
  });
});
