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
  it("turns three legacy notes for one lyric character into three fresh initial presses", () => {
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
    expect(normalized.events.map((item) => item.targetCode)).toEqual(["KeyA", "KeyA", "KeyA"]);
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

  it("does not count an interleaved left-hand-only event as a lyric note", () => {
    const source = {
      ...song("爱", [
        {
          ...event("a-1", "爱"),
          parts: [{ hand: "right" as const, targetCode: "KeyA", notes: ["C4"] }],
        },
        {
          ...event("space", null, "Space"),
          parts: [{ hand: "left" as const, targetCode: "Space", notes: ["C2", "G2"] }],
        },
        {
          ...event("a-2", "爱", "Digit1"),
          parts: [{ hand: "right" as const, targetCode: "Digit1", notes: ["D4"] }],
        },
      ]),
      lyricTokens: [{
        id: "love",
        phraseIndex: 0,
        tokenIndex: 0,
        text: "爱",
        startEvent: 0,
        endEvent: 2,
      }],
    };

    const normalized = normalizeSongPackage(source);

    expect(normalized.events.map((item) => ({
      targetCode: item.targetCode,
      lyricTokenId: item.lyricTokenId,
      lyricSubIndex: item.lyricSubIndex,
      lyricSubCount: item.lyricSubCount,
    }))).toEqual([
      { targetCode: "KeyA", lyricTokenId: "love", lyricSubIndex: 0, lyricSubCount: 2 },
      { targetCode: "Space", lyricTokenId: null, lyricSubIndex: null, lyricSubCount: null },
      { targetCode: "KeyA", lyricTokenId: "love", lyricSubIndex: 1, lyricSubCount: 2 },
    ]);
  });

  it("does not absorb an interleaved lyric-free right-hand event into a lyric token", () => {
    const source = {
      ...song("爱", [
        {
          ...event("a-1", "爱"),
          parts: [{ hand: "right" as const, targetCode: "KeyA", notes: ["C4"] }],
        },
        {
          ...event("instrumental", null, "Digit2"),
          parts: [{ hand: "right" as const, targetCode: "Digit2", notes: ["G4"] }],
        },
        {
          ...event("a-2", "爱", "Digit1"),
          parts: [{ hand: "right" as const, targetCode: "Digit1", notes: ["D4"] }],
        },
      ]),
      lyricTokens: [{
        id: "love",
        phraseIndex: 0,
        tokenIndex: 0,
        text: "爱",
        startEvent: 0,
        endEvent: 2,
      }],
    };

    const normalized = normalizeSongPackage(source);

    expect(normalized.events.map((item) => item.targetCode)).toEqual(["KeyA", "Shift", "KeyA"]);
    expect(normalized.events.map((item) => item.lyricTokenId)).toEqual(["love", null, "love"]);
    expect(normalized.events.map((item) => item.lyricSubIndex)).toEqual([0, null, 1]);
    expect(normalized.events.map((item) => item.lyricSubCount)).toEqual([2, null, 2]);
  });

  it("is idempotent and upgrades instrumental digit events to Shift", () => {
    const source = song("Instrumental", [event("one", null, "Digit1"), event("two", null, "Digit2")]);
    const once = normalizeSongPackage(source);
    const twice = normalizeSongPackage(once);

    expect(twice).toEqual(once);
    expect(once.lyricTokens).toEqual([]);
    expect(once.events.map((item) => item.targetCode)).toEqual(["Shift", "Shift"]);
    expect(once.events.every((item) => item.lyricTokenId == null)).toBe(true);
  });

  it("migrates legacy Enter and Shift targets in memory", () => {
    const source = song("Legacy controls", [
      event("continuation", null, "Enter"),
      event("instrumental", null, "ShiftLeft"),
    ]);

    const normalized = normalizeSongPackage(source);

    expect(normalized.events.map((item) => item.targetCode)).toEqual(["Shift", "Shift"]);
    expect(source.events.map((item) => item.targetCode)).toEqual(["Enter", "ShiftLeft"]);
  });
});
