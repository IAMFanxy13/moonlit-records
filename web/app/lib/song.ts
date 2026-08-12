export type PianoVoice = "warm" | "concert" | "bright" | "upright";

export interface SongEvent {
  id: string;
  phraseIndex: number;
  tokenIndex: number;
  token: string;
  targetCode: string;
  note: string;
  velocity: number;
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
  durationLabel: string;
  recommendedPiano: PianoVoice;
  phrases: Phrase[];
  events: SongEvent[];
}

export type CatalogSong = SongPackage & { status: "ready" };
