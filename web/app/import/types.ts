import type { SongPackage } from "../lib/song";

export type ImportStage =
  | "preparing"
  | "rendering"
  | "recognizing"
  | "interpreting"
  | "arranging"
  | "ready";

export const IMPORT_STAGE_SEQUENCE: readonly ImportStage[] = [
  "preparing",
  "rendering",
  "recognizing",
  "interpreting",
  "arranging",
  "ready",
];

export const IMPORT_STAGE_LABELS: Record<ImportStage, string> = {
  preparing: "CHECKING THE SCORE",
  rendering: "PREPARING EVERY PAGE",
  recognizing: "READING NOTATION & LYRICS LOCALLY",
  interpreting: "INTERPRETING JIANPU MARKS",
  arranging: "ARRANGING FOR PIANO",
  ready: "READY TO PERFORM",
};

export interface ImportProgress {
  stage: ImportStage;
  detail: string;
  fraction?: number;
  method?: "neural" | "fallback";
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

export interface PrivateSongRecord {
  id: string;
  checksum: string;
  sourceName: string;
  createdAt: string;
  metadata: ImportedMetadata;
  song: SongPackage;
  warnings: string[];
}

export class ImportScoreError extends Error {
  constructor(
    readonly code:
      | "UNSUPPORTED_SCORE"
      | "NO_SCORE_PAGES"
      | "FILE_TOO_LARGE"
      | "PAGE_LIMIT"
      | "NO_JIANPU",
    message: string,
  ) {
    super(message);
    this.name = "ImportScoreError";
  }
}
