import { describe, expect, it } from "vitest";
import {
  canonicalPerformanceCode,
  canonicalScoreTargetCode,
  defaultNoteFor,
  eventInputLabel,
  isPerformanceInputCode,
  remainingEventInputLabel,
  isPlayableCode,
  KEYBOARD_ROWS,
  PERFORMANCE_CODES,
} from "./keyboard";

describe("keyboard mapping", () => {
  it("exposes exactly the alphabet as free piano keys", () => {
    expect(PERFORMANCE_CODES).toEqual([
      ..."QWERTYUIOPASDFGHJKLZXCVBNM".split("").map((letter) => `Key${letter}`),
    ]);
    expect(PERFORMANCE_CODES).toHaveLength(26);
    for (const code of ["Digit1", "Digit2", "Space", "Escape", "Backquote", "Minus", "ArrowLeft", "F1", "Tab"]) {
      expect(isPlayableCode(code)).toBe(false);
    }
  });

  it("gives every playable key one stable piano note", () => {
    expect(new Set(PERFORMANCE_CODES).size).toBe(PERFORMANCE_CODES.length);
    expect(PERFORMANCE_CODES.every((code) => /^([A-G])#?[3-5]$/.test(defaultNoteFor(code)))).toBe(true);
    expect(new Set(PERFORMANCE_CODES.map(defaultNoteFor)).size).toBe(PERFORMANCE_CODES.length);
    expect(defaultNoteFor("KeyQ")).toBe("C3");
    expect(defaultNoteFor("KeyM")).toBe("C#5");
  });

  it("renders only the three familiar alphabet rows", () => {
    expect(KEYBOARD_ROWS).toHaveLength(3);
    expect(KEYBOARD_ROWS.map((row) => row.length)).toEqual([10, 9, 7]);
    expect(KEYBOARD_ROWS.flat().some((key) => key.disabled)).toBe(false);
  });

  it("uses physical Shift as the only instrumental action", () => {
    expect(canonicalPerformanceCode("ShiftLeft")).toBe("Shift");
    expect(canonicalPerformanceCode("ShiftRight")).toBe("Shift");
    expect(canonicalPerformanceCode("NumpadEnter")).toBe("NumpadEnter");
    expect(isPerformanceInputCode("ShiftLeft")).toBe(true);
    expect(isPerformanceInputCode("Enter")).toBe(false);
    expect(isPerformanceInputCode("Digit1")).toBe(false);
    expect(isPerformanceInputCode("Digit2")).toBe(false);
    expect(isPerformanceInputCode("Space")).toBe(true);
  });

  it("migrates legacy score targets without re-enabling their physical keys", () => {
    expect(canonicalScoreTargetCode("Enter")).toBe("Digit1");
    expect(canonicalScoreTargetCode("NumpadEnter")).toBe("Digit1");
    expect(canonicalScoreTargetCode("Shift")).toBe("Shift");
    expect(canonicalScoreTargetCode("ShiftLeft")).toBe("Shift");
    expect(canonicalScoreTargetCode("ShiftRight")).toBe("Shift");
    expect(canonicalScoreTargetCode("Digit2")).toBe("Shift");
    expect(canonicalScoreTargetCode("Space")).toBe("Space");
  });

  it("labels coordinated right and left hand parts together", () => {
    const event = {
      targetCode: "KeyA",
      parts: [
        { hand: "right", targetCode: "KeyA", notes: ["C4"] },
        { hand: "left", targetCode: "Space", notes: ["C2", "G2", "C3"] },
      ],
    };
    expect(eventInputLabel(event)).toBe("A + SPACE");
    expect(remainingEventInputLabel(event, ["KeyA"])).toBe("SPACE");
  });
});
