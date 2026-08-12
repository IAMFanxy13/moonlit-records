import { describe, expect, it } from "vitest";
import {
  defaultNoteFor,
  isPlayableCode,
  KEYBOARD_ROWS,
  PLAYABLE_CODES,
} from "./keyboard";

describe("keyboard mapping", () => {
  it("keeps ordinary QWERTY keys playable and browser-reserved keys disabled", () => {
    expect(isPlayableCode("KeyN")).toBe(true);
    expect(isPlayableCode("Digit1")).toBe(true);
    expect(isPlayableCode("Space")).toBe(true);
    expect(isPlayableCode("Escape")).toBe(false);
    expect(isPlayableCode("F1")).toBe(false);
    expect(isPlayableCode("Tab")).toBe(false);
  });

  it("gives every playable key one stable piano note", () => {
    expect(new Set(PLAYABLE_CODES).size).toBe(PLAYABLE_CODES.length);
    expect(PLAYABLE_CODES.every((code) => /^([A-G])(#|b)?[2-6]$/.test(defaultNoteFor(code)))).toBe(true);
    expect(new Set(PLAYABLE_CODES.map(defaultNoteFor)).size).toBe(PLAYABLE_CODES.length);
  });

  it("renders the function row as disabled instead of silently omitting it", () => {
    const functionRow = KEYBOARD_ROWS[0];
    expect(functionRow[0]).toMatchObject({ code: "Escape", disabled: true });
    expect(functionRow.filter((key) => key.disabled)).toHaveLength(13);
  });
});
