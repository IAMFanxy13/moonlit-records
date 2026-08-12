import { describe, expect, it } from "vitest";

import { compileArrangement } from "./arrangement-compiler";

describe("arrangement compiler", () => {
  it("repeats a Chinese initial when one lyric token spans several musical events", () => {
    const song = compileArrangement({
      id: "fixture",
      title: "Fixture",
      lyricLanguage: "zh-CN",
      lyrics: [{ text: "爱", initial: "A", notes: [["C4"], ["E4", "G4"], ["A4"]] }],
      instrumental: [],
    });

    expect(song.events.map((event) => event.targetCode)).toEqual(["KeyA", "KeyA", "KeyA"]);
    expect(song.events[1].notes).toEqual(["E4", "G4"]);
    expect(song.events.every((event) => event.token === "爱")).toBe(true);
  });

  it("uses English word initials and ignores punctuation-only tokens", () => {
    const song = compileArrangement({
      id: "english",
      title: "English",
      lyricLanguage: "en",
      lyrics: [
        { text: "I", notes: [["C4"]] },
        { text: ",", notes: [["D4"]] },
        { text: "love", notes: [["E4"]] },
        { text: "you", notes: [["F4"]] },
      ],
      instrumental: [],
    });

    expect(song.events.map((event) => event.targetCode)).toEqual(["KeyI", "KeyL", "KeyY"]);
  });

  it("assigns one number key to each instrumental voicing", () => {
    const song = compileArrangement({
      id: "instrumental",
      title: "Instrumental",
      lyricLanguage: "en",
      lyrics: [],
      instrumental: Array.from({ length: 11 }, (_, index) => ({
        notes: index === 0 ? ["C4", "E4", "G4"] : ["C4"],
      })),
    });

    expect(song.events[0]).toMatchObject({
      targetCode: "Digit1",
      notes: ["C4", "E4", "G4"],
      token: null,
    });
    expect(song.events[9].targetCode).toBe("Digit0");
    expect(song.events[10].targetCode).toBe("Digit0");
  });
});
