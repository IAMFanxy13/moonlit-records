import type { PianoKeyHandle } from "../audio/piano-engine";
import type { ReleasePlan } from "./piano-performance";
import type { PianoArticulation, PianoHand, PianoPedalIntent } from "./song";

export const MAX_RESONANT_GESTURES = 4;
/** Absolute safety ceiling; normal adaptive windows are substantially shorter. */
export const MAX_RESONANCE_MS = 1_100;

export interface ResonantVoice {
  id: number;
  handle: PianoKeyHandle;
  phraseIndex: number;
  notes: readonly string[];
  releasedAt: number;
  releasePlan: ReleasePlan;
  hand?: PianoHand;
  harmonyId?: string;
  pedalIntent?: PianoPedalIntent;
}

export interface PhraseResonanceState { voices: ResonantVoice[] }
export interface GestureAttackContext {
  phraseIndex: number;
  notes: readonly string[];
  articulation?: PianoArticulation;
}
export type ResonanceReleaseReason = "capacity" | "target" | "next-attack" | "clear";
export interface ResonanceTransition {
  state: PhraseResonanceState;
  release: ResonantVoice[];
  reason: ResonanceReleaseReason;
}

function split(
  state: PhraseResonanceState,
  shouldRelease: (voice: ResonantVoice) => boolean,
  reason: ResonanceReleaseReason,
): ResonanceTransition {
  const keep: ResonantVoice[] = [];
  const release: ResonantVoice[] = [];
  state.voices.forEach((voice) => {
    if (shouldRelease(voice)) release.push(voice);
    else keep.push(voice);
  });
  return { state: { voices: keep }, release, reason };
}

export function createPhraseResonanceState(): PhraseResonanceState {
  return { voices: [] };
}

export function deferVoice(state: PhraseResonanceState, voice: ResonantVoice): ResonanceTransition {
  const voices = [...state.voices, voice];
  const overflow = Math.max(0, voices.length - MAX_RESONANT_GESTURES);
  return {
    state: { voices: voices.slice(overflow) },
    release: voices.slice(0, overflow),
    reason: "capacity",
  };
}

export function prepareAttack(state: PhraseResonanceState): ResonanceTransition {
  return split(state, () => true, "next-attack");
}

/**
 * Transitions only the hand which received a new physical gesture. Right-hand
 * melody never damps a held left-hand harmony. A new left gesture owns the
 * harmonic transition and therefore replaces earlier left-hand resonance.
 */
export function prepareGestureAttack(
  state: PhraseResonanceState,
  gesture: { hand: PianoHand; harmonyId?: string; pedalIntent?: PianoPedalIntent },
  context?: GestureAttackContext,
): ResonanceTransition {
  if (gesture.pedalIntent === "release") return split(state, () => true, "next-attack");
  if (!context) return split(state, (voice) => (voice.hand ?? "right") === gesture.hand, "next-attack");

  const incomingNotes = new Set(context.notes);
  return split(state, (voice) => {
    if (voice.phraseIndex !== context.phraseIndex) return true;
    if ((voice.hand ?? "right") !== gesture.hand) return false;
    if (voice.notes.some((note) => incomingNotes.has(note))) return true;
    // Melody gestures crossfade into the next real attack; their release tail
    // creates legato without leaving a whole right-hand chord hanging.
    if (gesture.hand === "right") return true;
    // Left-hand harmony is the continuity bed. Keep it across a matching
    // harmony update and let the scheduled damper/reverb tail finish it.
    if (voice.harmonyId && gesture.harmonyId && voice.harmonyId !== gesture.harmonyId) return true;
    return false;
  }, "next-attack");
}

export function expireVoice(state: PhraseResonanceState, handleId: number): ResonanceTransition {
  return split(state, (voice) => voice.id === handleId, "target");
}

export function clearResonance(state: PhraseResonanceState): ResonanceTransition {
  return { state: createPhraseResonanceState(), release: state.voices, reason: "clear" };
}
