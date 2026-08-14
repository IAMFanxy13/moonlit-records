export type PianoVoice = "warm" | "concert" | "bright" | "upright";

export type ArrangementQuality = "clear" | "usable" | "sketch";

export type PianoHand = "right" | "left";

export type PianoArticulation = "legato" | "connected" | "normal" | "staccato" | "tenuto";
export type PianoPedalIntent = "hold" | "repedal" | "release" | "none";
export type PianoGestureType = "block" | "softRollUp" | "rollUp" | "rollDown" | "grace" | "octave";
export type PianoGestureRole =
  | "melody"
  | "melody-voicing"
  | "inner-voice"
  | "left-bass"
  | "left-open-voicing"
  | "instrumental";

export interface SongEventPart {
  hand: PianoHand;
  targetCode: string;
  notes: string[];
  /** Per-note normalized dynamics. The melody is normally the strongest right-hand note. */
  velocities?: number[];
  /** Per-note musical lifetime in milliseconds; no entry may create a future attack. */
  durationsMs?: number[];
  velocity?: number;
  articulation?: PianoArticulation;
  harmonyId?: string;
  pedalIntent?: PianoPedalIntent;
  role?: PianoGestureRole;
  origin?: string;
  confidence?: number;
  /** A stable performance template; the audio engine derives bounded attack offsets. */
  gestureType?: PianoGestureType;
}

/** A named alias used by Score/2 authoring; SongEventPart remains the V1-compatible field. */
export type PianoGesture = SongEventPart;

export interface SongEvent {
  id: string;
  phraseIndex: number;
  tokenIndex: number | null;
  token: string | null;
  /** Stable display-token ownership. Added after V1; absent in older saved packages. */
  lyricTokenId?: string | null;
  /** Zero-based note position inside one displayed lyric token. */
  lyricSubIndex?: number | null;
  /** Total score events owned by one displayed lyric token. */
  lyricSubCount?: number | null;
  targetCode: string;
  notes: string[];
  /** Independent user-triggered voices that together complete this score event. */
  parts?: SongEventPart[];
  /** @deprecated Read `notes`; retained while calibrated V1 packages migrate. */
  note: string;
  velocity: number;
  kind: "tap" | "hold";
  holdMs?: number;
  /** Silent time that must elapse before this gesture becomes the active target. */
  restBeforeMs?: number;
  sourceStartMs?: number;
  sourceEndMs?: number;
  confidence: number;
  provenance: string[];
}

export interface LyricToken {
  id: string;
  phraseIndex: number;
  tokenIndex: number;
  text: string;
  startEvent: number;
  endEvent: number;
}

export interface Phrase {
  id: string;
  text: string;
  startEvent: number;
  endEvent: number;
  section?: string;
  energy?: number;
}

export interface SongPackage {
  id: string;
  title: string;
  artist: string;
  version: string;
  searchAliases: string[];
  lyricLanguage: "zh-CN" | "en";
  durationLabel: string;
  /** Authoring tempo. Older saved packages omit this and play at the 72 BPM default. */
  tempoBpm?: number;
  /** Optional structured meter; legacy packages continue to derive 4/4 behavior. */
  meter?: { beatsPerBar: number; beatUnit: number };
  keySignature?: { tonic: string; mode: "major" | "minor"; changes?: Array<{ eventIndex: number; tonic: string; mode: "major" | "minor" }> };
  recommendedPiano: PianoVoice;
  quality: ArrangementQuality;
  provenance: string[];
  phrases: Phrase[];
  /** Optional for persistence compatibility; playback normalizes older packages. */
  lyricTokens?: LyricToken[];
  events: SongEvent[];
}

export type CatalogSong = SongPackage & { status: "ready" };
