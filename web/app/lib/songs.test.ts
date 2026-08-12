import { describe, expect, it } from "vitest";

import { builtinSongs } from "./songs";

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
});
