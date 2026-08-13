import { describe, expect, it } from "vitest";

import type { SongEvent, SongPackage } from "./song";
import { normalizeSongPackage } from "./song-normalizer";

function event(id: string, token: string | null, targetCode = "KeyA"): SongEvent {
  return {
    id,
    phraseIndex: 0,
    tokenIndex: token ? 0 : null,
    token,
    targetCode,
    notes: ["C4"],
    note: "C4",
    velocity: 82,
    kind: "hold",
    holdMs: 500,
    confidence: 1,
    provenance: ["test"],
  };
}

function song(text: string, events: SongEvent[]): SongPackage {
  return {
    id: `song-${text}`,
    title: text,
    artist: "Test",
    version: "Legacy",
    searchAliases: [],
    lyricLanguage: "zh-CN",
    durationLabel: "00:01",
    recommendedPiano: "warm",
    quality: "clear",
    provenance: ["test"],
    phrases: [{ id: "phrase-0", text, startEvent: 0, endEvent: events.length - 1 }],
    events,
  };
}

describe("normalizeSongPackage", () => {
  it("turns three legacy notes for one lyric character into initial then Space continuations", () => {
    const source = song("爱", [event("a-1", "爱"), event("a-2", "爱"), event("a-3", "爱")]);

    const normalized = normalizeSongPackage(source);

    expect(normalized.lyricTokens).toEqual([{
      id: "phrase-0-token-0",
      phraseIndex: 0,
      tokenIndex: 0,
      text: "爱",
      startEvent: 0,
      endEvent: 2,
    }]);
    expect(normalized.events.map((item) => item.targetCode)).toEqual(["KeyA", "Space", "Space"]);
    expect(normalized.events.map((item) => [item.lyricSubIndex, item.lyricSubCount])).toEqual([
      [0, 3], [1, 3], [2, 3],
    ]);
    expect(source.events.map((item) => item.targetCode)).toEqual(["KeyA", "KeyA", "KeyA"]);
  });

  it("keeps three real repeated lyric characters as three independent initial presses", () => {
    const normalized = normalizeSongPackage(song("爱爱爱", [
      event("a-1", "爱"), event("a-2", "爱"), event("a-3", "爱"),
    ]));

    expect(normalized.lyricTokens?.map((token) => token.text)).toEqual(["爱", "爱", "爱"]);
    expect(normalized.lyricTokens?.map((token) => [token.startEvent, token.endEvent])).toEqual([
      [0, 0], [1, 1], [2, 2],
    ]);
    expect(normalized.events.map((item) => item.targetCode)).toEqual(["KeyA", "KeyA", "KeyA"]);
  });

  it("is idempotent and leaves instrumental digit events unowned", () => {
    const source = song("Instrumental", [event("one", null, "Digit1"), event("two", null, "Digit2")]);
    const once = normalizeSongPackage(source);
    const twice = normalizeSongPackage(once);

    expect(twice).toEqual(once);
    expect(once.lyricTokens).toEqual([]);
    expect(once.events.map((item) => item.targetCode)).toEqual(["Digit1", "Digit2"]);
    expect(once.events.every((item) => item.lyricTokenId == null)).toBe(true);
  });
});
