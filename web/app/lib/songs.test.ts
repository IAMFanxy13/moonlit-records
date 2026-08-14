import { describe, expect, it } from "vitest";

import { builtinSongs, preparedBuiltinSongs } from "./songs";
import { buildLeftHandCues } from "./left-hand-cues";

describe("built-in repertoire", () => {
  it("includes the complete common Chinese Twinkle arrangement", () => {
    const twinkle = builtinSongs.find((song) => song.id === "little-star");

    expect(twinkle?.phrases.map((phrase) => phrase.text)).toEqual([
      "一闪一闪亮晶晶",
      "满天都是小星星",
      "挂在天上放光明",
      "好像许多小眼睛",
      "一闪一闪亮晶晶",
      "满天都是小星星",
    ]);
    expect(twinkle?.events).toHaveLength(42);
    expect(twinkle?.events.slice(0, 7).map((event) => event.targetCode)).toEqual([
      "KeyY", "KeyS", "KeyY", "KeyS", "KeyL", "KeyJ", "KeyJ",
    ]);
  });

  it("publishes every built-in through the same two-hand V1 migration boundary", () => {
    for (const song of preparedBuiltinSongs) {
      expect(song.provenance).toContain("two-hand-arrangement-v2-fallback");
      expect(song.events.every((event) => (event.parts?.length ?? 0) > 0)).toBe(true);
      expect(song.events.some((event) => event.parts?.some((part) => part.hand === "left"))).toBe(true);
      expect(song.events.every((event) => !["Enter", "ShiftLeft", "ShiftRight"].includes(event.targetCode) && !/^Digit\d$/u.test(event.targetCode))).toBe(true);
    }
  });

  it("never reserves Digit1 for later gestures of one lyric token in the built-ins", () => {
    for (const song of preparedBuiltinSongs) {
      for (const event of song.events) {
        if ((event.lyricSubIndex ?? 0) > 0) expect(event.targetCode).not.toBe("Digit1");
        if (event.lyricSubIndex === 0) expect(event.targetCode).not.toBe("Digit1");
      }
    }
  });

  it("gives lyric built-ins trustworthy timing for non-inferred Space placement", () => {
    for (const song of preparedBuiltinSongs.filter((candidate) => candidate.lyricTokens?.length)) {
      expect(song.events.every((event) => Number.isFinite(event.sourceStartMs))).toBe(true);
      const cues = song.phrases.flatMap((_, phraseIndex) => buildLeftHandCues(song, phraseIndex));
      expect(cues.length).toBeGreaterThan(0);
      expect(cues.every((cue) => cue.inferred === false)).toBe(true);
    }
  });
});
