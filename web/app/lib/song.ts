export type PianoVoice = "warm" | "concert" | "bright" | "upright";

export type ArrangementQuality = "clear" | "usable" | "sketch";

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
  recommendedPiano: PianoVoice;
  quality: ArrangementQuality;
  provenance: string[];
  phrases: Phrase[];
  /** Optional for persistence compatibility; playback normalizes older packages. */
  lyricTokens?: LyricToken[];
  events: SongEvent[];
}

export type CatalogSong = SongPackage & { status: "ready" };
