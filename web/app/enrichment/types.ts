import type { EnrichedField } from "../import/types";

export interface EnrichmentQuery {
  title: string;
  artist: string;
  durationMs: number;
}

export interface RecordingCandidate {
  title: string;
  artist: string;
  durationMs?: number;
  disambiguation?: string;
}

export interface LyricsEvidence {
  plain: string | null;
  synced: string | null;
  provider: string;
  persistence: "session-only";
}

export interface TrackEnrichment {
  fields: {
    title?: EnrichedField<string>;
    artist?: EnrichedField<string>;
    album?: EnrichedField<string>;
    releaseDate?: EnrichedField<string>;
    coverUrl?: EnrichedField<string>;
  };
  lyrics: LyricsEvidence | null;
  warnings: string[];
}

export type FreeFetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
