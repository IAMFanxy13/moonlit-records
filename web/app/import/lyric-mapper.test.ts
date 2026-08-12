import { describe, expect, it } from "vitest";

import { applyLyricsToSketch } from "./lyric-mapper";
import { builtinSongs } from "../lib/songs";

describe("online lyrics to piano sketch", () => {
  it("uses pinyin initials for Chinese lyrics and keeps KTV lines", () => {
    const result = applyLyricsToSketch(builtinSongs[2], "你好，月光\n照进心里");

    expect(result.lyricLanguage).toBe("zh-CN");
    expect(result.phrases.map((phrase) => phrase.text)).toEqual(["你好，月光", "照进心里"]);
    expect(result.events.slice(0, 4).map((event) => event.targetCode)).toEqual(["KeyN", "KeyH", "KeyY", "KeyG"]);
  });

  it("uses first letters for English words and ignores punctuation", () => {
    const result = applyLyricsToSketch(builtinSongs[2], "I love you\nUnder moonlight");
    expect(result.lyricLanguage).toBe("en");
    expect(result.events.map((event) => event.targetCode)).toEqual(["KeyI", "KeyL", "KeyY", "KeyU", "KeyM"]);
  });
});
