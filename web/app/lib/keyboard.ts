export interface KeyboardKey {
  code: string;
  label: string;
  width?: number;
  disabled?: boolean;
}

const letterKeys = (letters: string): KeyboardKey[] =>
  letters.split("").map((letter) => ({ code: `Key${letter}`, label: letter }));

export const KEYBOARD_ROWS: KeyboardKey[][] = [
  letterKeys("QWERTYUIOP"),
  letterKeys("ASDFGHJKL"),
  letterKeys("ZXCVBNM"),
];

export const SCREEN_KEYBOARD_ROWS: KeyboardKey[][] = [
  ...KEYBOARD_ROWS,
  [
    { code: "Shift", label: "SHIFT · INSTRUMENTAL", width: 2 },
    { code: "Space", label: "SPACE · LEFT HAND", width: 6 },
  ],
];

export const PERFORMANCE_CODES = KEYBOARD_ROWS.flat().map((item) => item.code);
export const LEGACY_LYRIC_CONTINUATION_CODE = "Digit1";
export const LEFT_HAND_CODE = "Space";
export const INSTRUMENTAL_MELODY_CODE = "Shift";

// Kept as a compatibility alias for older catalogue code.
export const PLAYABLE_CODES = PERFORMANCE_CODES;

const CHROMATIC_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteForMidi(midi: number): string {
  const name = CHROMATIC_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

const DEFAULT_NOTES = new Map(
  PERFORMANCE_CODES.map((code, index) => [code, noteForMidi(48 + index)]),
);

export function isPlayableCode(code: string): boolean {
  return DEFAULT_NOTES.has(code);
}

export function isPerformanceInputCode(code: string): boolean {
  const canonical = canonicalPerformanceCode(code);
  return canonical === LEFT_HAND_CODE
    || canonical === INSTRUMENTAL_MELODY_CODE
    || isPlayableCode(canonical);
}

export function canonicalPerformanceCode(code: string): string {
  if (code === "ShiftLeft" || code === "ShiftRight" || code === "Shift") return "Shift";
  return code;
}

export function canonicalScoreTargetCode(code: string): string {
  if (code === "Enter" || code === "NumpadEnter") return LEGACY_LYRIC_CONTINUATION_CODE;
  if (code === "Shift" || code === "ShiftLeft" || code === "ShiftRight") {
    return INSTRUMENTAL_MELODY_CODE;
  }
  if (/^Digit(?:[2-9]|0)$/u.test(code)) return INSTRUMENTAL_MELODY_CODE;
  return canonicalPerformanceCode(code);
}

export function defaultNoteFor(code: string): string {
  const note = DEFAULT_NOTES.get(code);
  if (!note) throw new Error(`Unsupported piano key: ${code}`);
  return note;
}

export function labelForCode(code: string): string {
  const canonical = canonicalPerformanceCode(code);
  if (canonical === LEFT_HAND_CODE) return "SPACE";
  if (canonical === INSTRUMENTAL_MELODY_CODE) return "SHIFT";
  return KEYBOARD_ROWS.flat().find((item) => item.code === canonical)?.label ?? canonical;
}

export function eventInputCodes(event: {
  targetCode: string;
  parts?: readonly { targetCode: string; hand?: unknown; notes?: unknown }[];
}): string[] {
  return (event.parts?.length ? event.parts : [{ targetCode: event.targetCode }])
    .map((part) => canonicalPerformanceCode(part.targetCode));
}

export function eventInputLabel(event: {
  targetCode: string;
  parts?: readonly { targetCode: string; hand?: unknown; notes?: unknown }[];
}): string {
  return eventInputCodes(event).map(labelForCode).join(" + ");
}

export function remainingEventInputLabel(
  event: { targetCode: string; parts?: readonly { targetCode: string; hand?: unknown; notes?: unknown }[] },
  completedCodes: readonly string[] = [],
): string {
  const remaining = eventInputCodes(event).filter((code) => !completedCodes.includes(code));
  return (remaining.length > 0 ? remaining : eventInputCodes(event)).map(labelForCode).join(" + ");
}
