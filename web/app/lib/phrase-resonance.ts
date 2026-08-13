import type { PianoKeyHandle } from "../audio/piano-engine";
import type { SongEvent } from "./song";

export const MAX_RESONANT_GESTURES = 4;
export const MAX_RESONANCE_MS = 2_400;

export interface ResonantVoice {
  id: number;
  handle: PianoKeyHandle;
  phraseIndex: number;
  notes: readonly string[];
  releasedAt: number;
}

export interface PhraseResonanceState { voices: ResonantVoice[] }
export interface ResonanceTransition {
  state: PhraseResonanceState;
  release: PianoKeyHandle[];
}

function split(
  state: PhraseResonanceState,
  shouldRelease: (voice: ResonantVoice) => boolean,
): ResonanceTransition {
  const keep: ResonantVoice[] = [];
  const release: PianoKeyHandle[] = [];
  state.voices.forEach((voice) => {
    if (shouldRelease(voice)) release.push(voice.handle);
    else keep.push(voice);
  });
  return { state: { voices: keep }, release };
}

export function createPhraseResonanceState(): PhraseResonanceState {
  return { voices: [] };
}

export function deferVoice(state: PhraseResonanceState, voice: ResonantVoice): ResonanceTransition {
  const voices = [...state.voices, voice];
  const overflow = Math.max(0, voices.length - MAX_RESONANT_GESTURES);
  return {
    state: { voices: voices.slice(overflow) },
    release: voices.slice(0, overflow).map((item) => item.handle),
  };
}

export function prepareAttack(state: PhraseResonanceState, event: SongEvent): ResonanceTransition {
  const nextPitches = new Set(event.notes);
  return split(state, (voice) =>
    Boolean(event.restBeforeMs && event.restBeforeMs > 0) ||
    voice.phraseIndex !== event.phraseIndex ||
    voice.notes.some((note) => nextPitches.has(note)),
  );
}

export function expireVoice(state: PhraseResonanceState, handleId: number): ResonanceTransition {
  return split(state, (voice) => voice.id === handleId);
}

export function clearResonance(state: PhraseResonanceState): ResonanceTransition {
  return { state: createPhraseResonanceState(), release: state.voices.map((voice) => voice.handle) };
}
