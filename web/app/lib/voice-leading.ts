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

function candidatesFor(pitchClass: number, low: number, high: number): number[] {
  const result: number[] = [];
  for (let midi = low; midi <= high; midi += 1) {
    if (((midi % 12) + 12) % 12 === ((pitchClass % 12) + 12) % 12) result.push(midi);
  }
  return result;
}

export function nearestVoicing(
  pitchClasses: readonly number[],
  previousNotes: readonly string[],
  range: { low: number; high: number },
): string[] {
  const previous = previousNotes.map(midiFor).filter((midi): midi is number => midi !== null);
  const chosen: number[] = [];

  pitchClasses.forEach((pitchClass, index) => {
    const lowerBound = chosen.length > 0 ? chosen[chosen.length - 1] + 1 : range.low;
    const candidates = candidatesFor(pitchClass, lowerBound, range.high);
    if (candidates.length === 0) return;
    const reference = previous[index] ?? lowerBound;
    chosen.push(candidates.reduce((best, candidate) => (
      Math.abs(candidate - reference) < Math.abs(best - reference) ? candidate : best
    )));
  });

  return chosen.map(noteForMidi);
}
