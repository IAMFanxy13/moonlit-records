import { describe, expect, it } from "vitest";
import {
  defaultNoteFor,
  isPlayableCode,
  KEYBOARD_ROWS,
  PERFORMANCE_CODES,
} from "./keyboard";

describe("keyboard mapping", () => {
  it("exposes exactly the number row and alphabet as performance keys", () => {
    expect(PERFORMANCE_CODES).toEqual([
      "Digit1", "Digit2", "Digit3", "Digit4", "Digit5",
      "Digit6", "Digit7", "Digit8", "Digit9", "Digit0",
      ..."QWERTYUIOPASDFGHJKLZXCVBNM".split("").map((letter) => `Key${letter}`),
    ]);
    expect(PERFORMANCE_CODES).toHaveLength(36);
    for (const code of ["Space", "Escape", "Backquote", "Minus", "ArrowLeft", "F1", "Tab"]) {
      expect(isPlayableCode(code)).toBe(false);
    }
  });

  it("gives every playable key one stable piano note", () => {
    expect(new Set(PERFORMANCE_CODES).size).toBe(PERFORMANCE_CODES.length);
    expect(PERFORMANCE_CODES.every((code) => /^([A-G])#?[3-5]$/.test(defaultNoteFor(code)))).toBe(true);
    expect(new Set(PERFORMANCE_CODES.map(defaultNoteFor)).size).toBe(PERFORMANCE_CODES.length);
    expect(defaultNoteFor("Digit1")).toBe("C3");
    expect(defaultNoteFor("KeyM")).toBe("B5");
  });

  it("renders only the four familiar performance rows", () => {
    expect(KEYBOARD_ROWS).toHaveLength(4);
    expect(KEYBOARD_ROWS.map((row) => row.length)).toEqual([10, 10, 9, 7]);
    expect(KEYBOARD_ROWS.flat().some((key) => key.disabled)).toBe(false);
  });
});
