import type { AnalysisEvidence } from "./types";
import type { PcmInput } from "./pcm-sketch";

const MODEL_SAMPLE_RATE = 22_050;
const CHORD_WINDOW_SECONDS = 0.08;
const MAX_CHORD_NOTES = 3;
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export interface BasicPitchNote {
  startTimeSeconds: number;
  durationSeconds: number;
  pitchMidi: number;
  amplitude: number;
}

type BasicPitchModule = typeof import("@spotify/basic-pitch");
type BasicPitchEngine = InstanceType<BasicPitchModule["BasicPitch"]>;

let runtimePromise: Promise<{ engine: BasicPitchEngine; library: BasicPitchModule }> | null = null;

function midiToNote(midi: number): string {
  const bounded = Math.max(48, Math.min(83, Math.round(midi)));
  return `${NOTE_NAMES[bounded % 12]}${Math.floor(bounded / 12) - 1}`;
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

export function resamplePcm(samples: Float32Array, sourceRate: number, targetRate = MODEL_SAMPLE_RATE): Float32Array {
  if (sourceRate === targetRate) return samples.slice();
  const targetLength = Math.max(1, Math.round((samples.length * targetRate) / sourceRate));
  const output = new Float32Array(targetLength);
  for (let index = 0; index < targetLength; index += 1) {
    const sourcePosition = (index * sourceRate) / targetRate;
    const left = Math.min(samples.length - 1, Math.floor(sourcePosition));
    const right = Math.min(samples.length - 1, left + 1);
    const mix = sourcePosition - left;
    output[index] = (samples[left] ?? 0) * (1 - mix) + (samples[right] ?? 0) * mix;
  }
  return output;
}

export function basicPitchNotesToEvidence(notes: BasicPitchNote[], durationMs: number): AnalysisEvidence {
  const stableNotes = notes
    .filter((note) => Number.isFinite(note.startTimeSeconds)
      && Number.isFinite(note.durationSeconds)
      && Number.isFinite(note.pitchMidi)
      && note.durationSeconds > 0)
    .sort((left, right) => left.startTimeSeconds - right.startTimeSeconds);

  const groups: BasicPitchNote[][] = [];
  for (const note of stableNotes) {
    const current = groups.at(-1);
    if (current && note.startTimeSeconds - current[0].startTimeSeconds <= CHORD_WINDOW_SECONDS) {
      current.push(note);
    } else {
      groups.push([note]);
    }
  }

  const events = groups.map((group) => {
    const groupStart = group[0].startTimeSeconds;
    const strongest = [...group]
      .sort((left, right) => right.amplitude - left.amplitude)
      .slice(0, MAX_CHORD_NOTES)
      .sort((left, right) => left.pitchMidi - right.pitchMidi);
    const groupEnd = Math.max(...group.map((note) => note.startTimeSeconds + note.durationSeconds));
    const amplitude = Math.max(...strongest.map((note) => note.amplitude));
    return {
      startMs: Math.max(0, Math.round(groupStart * 1000)),
      durationMs: Math.max(80, Math.round((groupEnd - groupStart) * 1000)),
      notes: [...new Set(strongest.map((note) => midiToNote(note.pitchMidi)))],
      velocity: Math.round(Math.max(48, Math.min(112, 48 + amplitude * 64))),
      confidence: Math.max(0.45, Math.min(0.95, amplitude)),
    };
  });

  const intervals = events
    .slice(1)
    .map((event, index) => event.startMs - events[index].startMs)
    .filter((value) => value >= 200 && value <= 1500);
  const medianInterval = median(intervals);
  const pitchClasses = new Map<string, number>();
  for (const event of events) {
    for (const note of event.notes) {
      const pitchClass = note.replace(/\d+$/u, "");
      pitchClasses.set(pitchClass, (pitchClasses.get(pitchClass) ?? 0) + 1);
    }
  }

  return {
    durationMs,
    tempo: medianInterval ? Math.round(Math.max(40, Math.min(200, 60_000 / medianInterval))) : undefined,
    musicalKey: [...pitchClasses.entries()].sort((left, right) => right[1] - left[1])[0]?.[0],
    events,
    warnings: [],
    quality: "usable",
  };
}

async function loadRuntime(): Promise<{ engine: BasicPitchEngine; library: BasicPitchModule }> {
  runtimePromise ??= import("@spotify/basic-pitch").then((library) => ({
    engine: new library.BasicPitch("/models/basic-pitch/model.json"),
    library,
  }));
  try {
    return await runtimePromise;
  } catch (error) {
    runtimePromise = null;
    throw error;
  }
}

export async function transcribeWithBasicPitch(
  input: PcmInput,
  onProgress: (fraction: number) => void,
): Promise<AnalysisEvidence> {
  const { engine, library } = await loadRuntime();
  const frames: number[][] = [];
  const onsets: number[][] = [];
  const samples = resamplePcm(input.samples, input.sampleRate);
  onProgress(0);
  await engine.evaluateModel(
    samples,
    (nextFrames, nextOnsets) => {
      frames.push(...nextFrames);
      onsets.push(...nextOnsets);
    },
    onProgress,
  );
  const noteFrames = library.outputToNotesPoly(frames, onsets, 0.5, 0.3, 5);
  const notes = library.noteFramesToTime(noteFrames);
  const durationMs = Math.round((input.samples.length / input.sampleRate) * 1000);
  const evidence = basicPitchNotesToEvidence(notes, durationMs);
  if (evidence.events.length === 0) throw new Error("Basic Pitch found no stable notes.");
  return evidence;
}
