export type ScoreLineRole = "title" | "metadata" | "notation" | "lyrics" | "unknown";

export interface RecognizedScoreLine {
  text: string;
  role: ScoreLineRole;
  top: number;
  confidence: number;
}

export interface RecognizedScorePage {
  id: string;
  width: number;
  height: number;
  lines: RecognizedScoreLine[];
}

export type JianpuWarning =
  | "TONIC_ESTIMATED"
  | "METER_ESTIMATED"
  | "TEMPO_ESTIMATED"
  | "LYRICS_INCOMPLETE"
  | "RHYTHM_ESTIMATED"
  | "METADATA_ESTIMATED";

export interface ParsedJianpuNote {
  raw: string;
  degree: number;
  octave: number;
  beats: number;
  rest: boolean;
  lyric: string | null;
  confidence: number;
}

export interface ParsedJianpuRow {
  id: string;
  notationText: string;
  lyricText: string;
  notes: ParsedJianpuNote[];
  confidence: number;
}

export interface ParsedJianpuHeader {
  tonic: string;
  meter: string;
  tempoBpm: number;
  warnings: JianpuWarning[];
}

export interface ParsedJianpuScore extends ParsedJianpuHeader {
  title: string;
  artist: string;
  rows: ParsedJianpuRow[];
  quality: "clear" | "estimated";
  confidence: number;
}

