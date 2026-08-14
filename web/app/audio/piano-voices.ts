import type { PianoVoice } from "../lib/song";

export interface PianoVoiceProfile {
  name: string;
  description: string;
  cutoff: number;
  /** Short physical-damper fade after keyup; the room tail is modelled separately. */
  damperRelease: number;
  reverbDecay: number;
  preDelay: number;
  wet: number;
  tailMs: number;
  /** Linear gain after the room stage, leaving headroom for overlap and chords. */
  outputTrim: number;
  /** Relative size of the short virtual-damper connection window. */
  legato: number;
  /** Key-release fade used while another melody note is expected. */
  connectedRelease: number;
  /** Key-release fade after a deliberately long score note. */
  longRelease: number;
  /** Key-release fade at a phrase boundary. */
  phraseRelease: number;
  /** Prompt damper fade before printed silence. */
  restRelease: number;
  /** Maximum pre-release resonance for a long note. */
  longNoteGraceMs: number;
  /** Maximum pre-release resonance at the end of a phrase. */
  phraseTailMs: number;
}

export const PIANO_VOICE_ORDER: PianoVoice[] = ["warm", "bright", "upright", "concert"];

const PIANO_VOICE_PROFILES: Record<PianoVoice, PianoVoiceProfile> = {
  warm: {
    name: "Felt Grand",
    description: "Intimate, softened and lyrical",
    cutoff: 3600,
    damperRelease: 0.42,
    reverbDecay: 4.8,
    preDelay: 0.018,
    wet: 0.26,
    tailMs: 5900,
    outputTrim: 0.74,
    legato: 1.08,
    connectedRelease: 0.34,
    longRelease: 0.43,
    phraseRelease: 0.5,
    restRelease: 0.16,
    longNoteGraceMs: 420,
    phraseTailMs: 820,
  },
  bright: {
    name: "Studio Grand",
    description: "Clear, articulate and close",
    cutoff: 6200,
    damperRelease: 0.28,
    reverbDecay: 3.5,
    preDelay: 0.014,
    wet: 0.2,
    tailMs: 4500,
    outputTrim: 0.78,
    legato: 1,
    connectedRelease: 0.26,
    longRelease: 0.34,
    phraseRelease: 0.42,
    restRelease: 0.13,
    longNoteGraceMs: 340,
    phraseTailMs: 680,
  },
  upright: {
    name: "Vintage Upright",
    description: "Dry, characterful and nostalgic",
    cutoff: 4200,
    damperRelease: 0.22,
    reverbDecay: 2.7,
    preDelay: 0.012,
    wet: 0.16,
    tailMs: 3500,
    outputTrim: 0.8,
    legato: 0.86,
    connectedRelease: 0.2,
    longRelease: 0.28,
    phraseRelease: 0.34,
    restRelease: 0.11,
    longNoteGraceMs: 270,
    phraseTailMs: 520,
  },
  concert: {
    name: "Concert Grand",
    description: "Open, resonant and hall-sized",
    cutoff: 5600,
    damperRelease: 0.48,
    reverbDecay: 6,
    preDelay: 0.028,
    wet: 0.32,
    tailMs: 7200,
    outputTrim: 0.7,
    legato: 1.12,
    connectedRelease: 0.38,
    longRelease: 0.48,
    phraseRelease: 0.58,
    restRelease: 0.17,
    longNoteGraceMs: 480,
    phraseTailMs: 940,
  },
};

export function getPianoVoiceProfile(voice: PianoVoice): PianoVoiceProfile {
  return PIANO_VOICE_PROFILES[voice];
}
