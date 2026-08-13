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
  },
};

export function getPianoVoiceProfile(voice: PianoVoice): PianoVoiceProfile {
  return PIANO_VOICE_PROFILES[voice];
}
