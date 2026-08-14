import type { PianoGestureType, SongEventPart } from "./song";

export interface PlannedPianoGesture {
  notes: string[];
  attackOffsetsMs: number[];
  sourceIndexes: number[];
  velocityScales: number[];
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function midiFor(note: string): number | null {
  const match = note.match(/^([A-G])(#|b)?(-?\d+)$/u);
  if (!match) return null;
  const natural = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1] as "A"];
  const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
  return (Number(match[3]) + 1) * 12 + natural + accidental;
}

function noteForMidi(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function defaultType(part: SongEventPart, instrumental: boolean): PianoGestureType {
  if (part.notes.length <= 1) return "block";
  if (instrumental || part.hand === "left") return "rollUp";
  return "softRollUp";
}

function evenlySpaced(count: number, spacingMs: number, maxMs: number): number[] {
  if (count <= 1) return [0];
  const spacing = Math.min(spacingMs, maxMs / (count - 1));
  return Array.from({ length: count }, (_, index) => Math.round(index * spacing));
}

export function planPianoGesture(part: SongEventPart, instrumental: boolean): PlannedPianoGesture {
  const type = part.gestureType ?? defaultType(part, instrumental);
  let notes = [...part.notes];
  let sourceIndexes = notes.map((_, index) => index);
  let velocityScales = notes.map(() => 1);
  let defaultExpansion: "right-octave" | "left-open" | null = null;

  if (part.gestureType === undefined && notes.length === 1) {
    const midi = midiFor(notes[0]);
    if (midi !== null && part.hand === "left") {
      notes = [notes[0], noteForMidi(midi + 7), noteForMidi(midi + 12)];
      sourceIndexes = [0, 0, 0];
      velocityScales = [1, 0.72, 0.56];
      defaultExpansion = "left-open";
    } else if (midi !== null && part.hand === "right") {
      notes = [notes[0], noteForMidi(midi <= 84 ? midi + 12 : midi - 12)];
      sourceIndexes = [0, 0];
      velocityScales = [1, 0.58];
      defaultExpansion = "right-octave";
    }
  }

  if (type === "octave" && notes.length === 1) {
    const midi = midiFor(notes[0]);
    if (midi !== null) {
      notes.push(noteForMidi(midi + 12));
      sourceIndexes.push(0);
      velocityScales.push(0.58);
    }
  }
  if (type === "rollDown") {
    notes = notes.reverse();
    sourceIndexes = sourceIndexes.reverse();
    velocityScales = velocityScales.reverse();
  }

  const maximum = instrumental ? 180 : 180;
  const attackOffsetsMs = defaultExpansion === "right-octave"
    ? [0, 18]
    : defaultExpansion === "left-open"
      ? [0, 32, 64]
      : type === "block" || type === "octave"
        ? notes.map(() => 0)
        : type === "softRollUp"
          ? evenlySpaced(notes.length, 25, maximum)
          : type === "grace"
            ? evenlySpaced(notes.length, 32, Math.min(80, maximum))
            : evenlySpaced(notes.length, 35, maximum);

  return { notes, attackOffsetsMs, sourceIndexes, velocityScales };
}

export function mapGestureValues<T>(plan: PlannedPianoGesture, values: readonly T[]): T[] {
  return plan.sourceIndexes.map((index) => values[index] ?? values.at(-1) as T);
}

export function mapGestureVelocities(
  plan: PlannedPianoGesture,
  values: number | readonly number[],
): number[] {
  const mapped = typeof values === "number"
    ? plan.sourceIndexes.map(() => values)
    : mapGestureValues(plan, values);
  return mapped.map((value, index) => Math.max(1, Math.round(value * (plan.velocityScales[index] ?? 1))));
}
