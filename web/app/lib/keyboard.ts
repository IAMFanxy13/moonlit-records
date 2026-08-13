export interface KeyboardKey {
  code: string;
  label: string;
  width?: number;
  disabled?: boolean;
}

const letterKeys = (letters: string): KeyboardKey[] =>
  letters.split("").map((letter) => ({ code: `Key${letter}`, label: letter }));

export const KEYBOARD_ROWS: KeyboardKey[][] = [
  "1234567890".split("").map((digit) => ({ code: `Digit${digit}`, label: digit })),
  letterKeys("QWERTYUIOP"),
  letterKeys("ASDFGHJKL"),
  letterKeys("ZXCVBNM"),
];

export const PERFORMANCE_CODES = KEYBOARD_ROWS.flat().map((item) => item.code);
export const LYRIC_CONTINUATION_CODE = "Space";

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
  return code === LYRIC_CONTINUATION_CODE || isPlayableCode(code);
}

export function defaultNoteFor(code: string): string {
  const note = DEFAULT_NOTES.get(code);
  if (!note) throw new Error(`Unsupported piano key: ${code}`);
  return note;
}

export function labelForCode(code: string): string {
  if (code === LYRIC_CONTINUATION_CODE) return "SPACE";
  return KEYBOARD_ROWS.flat().find((item) => item.code === code)?.label ?? code;
}
