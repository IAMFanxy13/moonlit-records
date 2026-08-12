import type { SongPackage } from "../lib/song";

export type ImportStage =
  | "preparing"
  | "identifying"
  | "transcribing"
  | "arranging"
  | "enriching"
  | "ready";

export const IMPORT_STAGE_SEQUENCE: readonly ImportStage[] = [
  "preparing",
  "identifying",
  "transcribing",
  "arranging",
  "enriching",
  "ready",
];

export const IMPORT_STAGE_LABELS: Record<ImportStage, string> = {
  preparing: "PREPARING THE RECORDING",
  identifying: "IDENTIFYING THE SONG",
  transcribing: "TRANSCRIBING NOTES ON THIS DEVICE",
  arranging: "ARRANGING FOR PIANO",
  enriching: "CHECKING FREE SONG DETAILS",
  ready: "READY TO PERFORM",
};

export interface ImportProgress {
  stage: ImportStage;
  detail: string;
  fraction?: number;
  method?: "neural" | "fallback" | "online";
}

export interface ImportedMetadata {
  title: string;
  artist: string;
  album?: string;
  durationMs?: number;
  language?: string;
  coverUrl?: string;
}

export interface EnrichedField<T> {
  value: T;
  provider: string;
  recordId?: string;
  retrievedAt: string;
  confidence: number;
  persistence: "allowed" | "session-only";
}

export interface AnalysisEventEvidence {
  startMs: number;
  durationMs: number;
  notes: string[];
  velocity: number;
  confidence: number;
}

export interface AnalysisEvidence {
  durationMs: number;
  tempo?: number;
  musicalKey?: string;
  events: AnalysisEventEvidence[];
  warnings: string[];
  quality: "clear" | "usable" | "sketch";
}

export interface PrivateSongRecord {
  id: string;
  checksum: string;
  sourceName: string;
  createdAt: string;
  metadata: ImportedMetadata;
  song: SongPackage;
  warnings: string[];
}

export class ImportMediaError extends Error {
  constructor(
    readonly code: "UNSUPPORTED_MEDIA" | "NO_AUDIBLE_AUDIO" | "FILE_TOO_LARGE" | "MEDIA_TOO_LONG",
    message: string,
  ) {
    super(message);
    this.name = "ImportMediaError";
  }
}
