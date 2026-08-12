import type { AnalysisEventEvidence, AnalysisEvidence } from "./types";
import { ImportMediaError } from "./types";

export interface PcmInput {
  samples: Float32Array;
  sampleRate: number;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function midiToNote(midi: number): string {
  const bounded = Math.max(48, Math.min(83, midi));
  return `${NOTE_NAMES[bounded % 12]}${Math.floor(bounded / 12) - 1}`;
}

function rms(samples: Float32Array, start: number, length: number): number {
  let sum = 0;
  const end = Math.min(samples.length, start + length);
  for (let index = start; index < end; index += 1) sum += samples[index] * samples[index];
  return Math.sqrt(sum / Math.max(1, end - start));
}

function estimateFrequency(samples: Float32Array, start: number, length: number, sampleRate: number): number {
  const end = Math.min(samples.length, start + length);
  let crossings = 0;
  let previous = samples[start] ?? 0;
  for (let index = start + 1; index < end; index += 1) {
    const current = samples[index];
    if ((previous < 0 && current >= 0) || (previous >= 0 && current < 0)) crossings += 1;
    previous = current;
  }
  return (crossings * sampleRate) / (2 * Math.max(1, end - start));
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function analyzePcmToSketch(input: PcmInput): AnalysisEvidence {
  const { samples, sampleRate } = input;
  const durationMs = (samples.length / sampleRate) * 1000;
  const globalRms = rms(samples, 0, samples.length);
  if (!Number.isFinite(globalRms) || globalRms < 0.0025) {
    throw new ImportMediaError("NO_AUDIBLE_AUDIO", "No audible music was found in this recording.");
  }

  const frameLength = Math.max(256, Math.min(2048, Math.floor(sampleRate * 0.18)));
  const hop = Math.max(128, Math.floor(sampleRate * 0.125));
  const minimumEnergy = Math.max(0.005, globalRms * 0.16);
  const maximumGap = Math.floor(sampleRate * 0.42);
  const rawEvents: AnalysisEventEvidence[] = [];
  let previousEnergy = 0;
  let lastEventSample = -maximumGap;

  for (let start = 0; start + frameLength <= samples.length && rawEvents.length < 512; start += hop) {
    const energy = rms(samples, start, frameLength);
    const audible = energy >= minimumEnergy;
    const onset = audible && (previousEnergy < minimumEnergy || energy > previousEnergy * 1.5);
    const periodicGuide = audible && start - lastEventSample >= maximumGap;
    previousEnergy = energy;
    if (!onset && !periodicGuide) continue;

    const frequency = estimateFrequency(samples, start, frameLength, sampleRate);
    const midi = Number.isFinite(frequency) && frequency >= 55
      ? Math.round(69 + 12 * Math.log2(frequency / 440))
      : 60;
    rawEvents.push({
      startMs: Math.round((start / sampleRate) * 1000),
      durationMs: Math.round((maximumGap / sampleRate) * 1000),
      notes: [midiToNote(midi)],
      velocity: Math.round(Math.max(48, Math.min(112, 54 + (energy / globalRms) * 30))),
      confidence: Math.max(0.22, Math.min(0.62, 0.3 + energy / (globalRms * 8))),
    });
    lastEventSample = start;
  }

  const events = [...rawEvents];
  while (events.length > 0 && events.length < 8) {
    const source = events[events.length % rawEvents.length];
    events.push({ ...source, startMs: Math.round((durationMs * events.length) / 8) });
  }
  if (events.length === 0) {
    throw new ImportMediaError("NO_AUDIBLE_AUDIO", "No stable musical events could be found in this recording.");
  }
  events.sort((a, b) => a.startMs - b.startMs);

  const intervals = events.slice(1).map((event, index) => event.startMs - events[index].startMs).filter((value) => value >= 200 && value <= 1500);
  const medianInterval = median(intervals);
  const tempo = medianInterval ? Math.round(Math.max(40, Math.min(200, 60_000 / medianInterval))) : undefined;
  const pitchClasses = new Map<string, number>();
  for (const event of events) {
    const pitchClass = event.notes[0].replace(/\d+$/u, "");
    pitchClasses.set(pitchClass, (pitchClasses.get(pitchClass) ?? 0) + 1);
  }
  const musicalKey = [...pitchClasses.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  return {
    durationMs,
    tempo,
    musicalKey,
    events,
    warnings: ["ON_DEVICE_SKETCH"],
    quality: "sketch",
  };
}
