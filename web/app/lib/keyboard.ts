export interface KeyboardKey {
  code: string;
  label: string;
  width?: number;
  disabled?: boolean;
}

const key = (code: string, label: string, width = 1, disabled = false): KeyboardKey => ({
  code,
  label,
  width,
  disabled,
});

export const KEYBOARD_ROWS: KeyboardKey[][] = [
  [
    key("Escape", "esc", 1.35, true),
    ...Array.from({ length: 12 }, (_, index) => key(`F${index + 1}`, `F${index + 1}`, 1, true)),
  ],
  [
    key("Backquote", "·"),
    ...Array.from({ length: 10 }, (_, index) => key(`Digit${(index + 1) % 10}`, `${(index + 1) % 10}`)),
    key("Minus", "−"),
    key("Equal", "="),
  ],
  [
    ..."QWERTYUIOP".split("").map((letter) => key(`Key${letter}`, letter)),
    key("BracketLeft", "["),
    key("BracketRight", "]"),
    key("Backslash", "\\", 1.35),
  ],
  [
    ..."ASDFGHJKL".split("").map((letter) => key(`Key${letter}`, letter)),
    key("Semicolon", ";"),
    key("Quote", "'", 1.25),
  ],
  [
    ..."ZXCVBNM".split("").map((letter) => key(`Key${letter}`, letter)),
    key("Comma", ","),
    key("Period", "."),
    key("Slash", "/", 1.3),
  ],
  [key("Space", "SPACE", 7.2)],
];

export const PLAYABLE_CODES = KEYBOARD_ROWS.flat()
  .filter((item) => !item.disabled)
  .map((item) => item.code);

const CHROMATIC_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteForMidi(midi: number): string {
  const name = CHROMATIC_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

const DEFAULT_NOTES = new Map(
  PLAYABLE_CODES.map((code, index) => [code, noteForMidi(40 + index)]),
);

export function isPlayableCode(code: string): boolean {
  return DEFAULT_NOTES.has(code);
}

export function defaultNoteFor(code: string): string {
  const note = DEFAULT_NOTES.get(code);
  if (!note) throw new Error(`Unsupported piano key: ${code}`);
  return note;
}

export function labelForCode(code: string): string {
  return KEYBOARD_ROWS.flat().find((item) => item.code === code)?.label ?? code;
}
