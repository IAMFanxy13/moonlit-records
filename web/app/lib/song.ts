export type PianoVoice = "warm" | "concert" | "bright" | "upright";

export type ArrangementQuality = "clear" | "usable" | "sketch";

export interface SongEvent {
  id: string;
  phraseIndex: number;
  tokenIndex: number | null;
  token: string | null;
  targetCode: string;
  notes: string[];
  /** @deprecated Read `notes`; retained while calibrated V1 packages migrate. */
  note: string;
  velocity: number;
  kind: "tap" | "hold";
  holdMs?: number;
  sourceStartMs?: number;
  sourceEndMs?: number;
  confidence: number;
  provenance: string[];
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
  recommendedPiano: PianoVoice;
  quality: ArrangementQuality;
  provenance: string[];
  phrases: Phrase[];
  events: SongEvent[];
}

export type CatalogSong = SongPackage & { status: "ready" };
