import type {
  JianpuWarning,
  ParsedJianpuHeader,
  ParsedJianpuNote,
  ParsedJianpuRow,
  ParsedJianpuScore,
  RecognizedScoreLine,
  RecognizedScorePage,
} from "./jianpu-types";

const JIANPU_TOKEN = /(?:[\^,·.]?[0-7](?:_{1,2})?(?:\.)?(?:-+)?)/gu;
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function uniqueWarnings(warnings: JianpuWarning[]): JianpuWarning[] {
  return [...new Set(warnings)];
}

function lyricTokens(text: string): string[] {
  const clean = text.replace(/[|｜]/gu, " ").trim();
  if (!clean) return [];
  return clean.match(/\p{Script=Han}|[A-Za-z]+(?:'[A-Za-z]+)?/gu) ?? [];
}

function octaveFor(raw: string): number {
  if (/^[\^·]/u.test(raw)) return 1;
  if (/^[,.]/u.test(raw) && !/^\.[0-7]/u.test(raw)) return -1;
  return 0;
}

export function parseJianpuToken(rawValue: string): ParsedJianpuNote {
  const raw = rawValue.trim();
  const degree = Number(raw.match(/[0-7]/u)?.[0] ?? "0");
  const underlineCount = Math.min(2, (raw.match(/_/gu) ?? []).length);
  const baseBeats = underlineCount === 0 ? 1 : underlineCount === 1 ? 0.5 : 0.25;
  const afterDigit = raw.slice(Math.max(0, raw.search(/[0-7]/u) + 1));
  const augmentation = afterDigit.includes(".") ? 1.5 : 1;
  const extensionBeats = (raw.match(/-/gu) ?? []).length;

  return {
    raw,
    degree,
    octave: octaveFor(raw),
    beats: baseBeats * augmentation + extensionBeats,
    rest: degree === 0,
    lyric: null,
    confidence: 1,
  };
}

export function parseJianpuHeader(lines: string[]): ParsedJianpuHeader {
  const joined = lines.join(" ");
  const tonic = joined.match(/1\s*=\s*([A-Ga-g](?:[#b])?)/u)?.[1]?.toUpperCase();
  const meterMatch = joined.match(/(?:^|\s)([2-9])\s*\/\s*([24816])(?:\s|$)/u);
  const tempoMatch = joined.match(/(?:♩|♪|BPM|TEMPO)\s*=?\s*(\d{2,3})/iu);
  const warnings: JianpuWarning[] = [];

  if (!tonic) warnings.push("TONIC_ESTIMATED");
  if (!meterMatch) warnings.push("METER_ESTIMATED");
  if (!tempoMatch) warnings.push("TEMPO_ESTIMATED");

  return {
    tonic: tonic ?? "C",
    meter: meterMatch ? `${meterMatch[1]}/${meterMatch[2]}` : "4/4",
    tempoBpm: tempoMatch ? clamp(Number(tempoMatch[1]), 50, 120) : 72,
    warnings,
  };
}

function notationTokens(text: string): string[] {
  return text.match(JIANPU_TOKEN) ?? [];
}

function rowSignature(notation: string, lyric: string): string {
  return `${notation.replace(/\s+/gu, "")}|${lyric.replace(/\s+/gu, "")}`;
}

function nearestLyricLine(lines: RecognizedScoreLine[], notationIndex: number): RecognizedScoreLine | undefined {
  const current = lines[notationIndex];
  return lines
    .slice(notationIndex + 1)
    .find((line) => line.role === "lyrics" && line.top >= current.top);
}

function assignLyrics(notes: ParsedJianpuNote[], lyricText: string): ParsedJianpuNote[] {
  const tokens = lyricTokens(lyricText);
  const soundedCount = notes.filter((note) => !note.rest).length;
  let soundedIndex = 0;

  return notes.map((note) => {
    if (note.rest || tokens.length === 0) return { ...note, lyric: null };

    const tokenIndex = tokens.length >= soundedCount
      ? soundedIndex
      : Math.floor((soundedIndex * tokens.length) / soundedCount);
    soundedIndex += 1;
    return { ...note, lyric: tokens[Math.min(tokenIndex, tokens.length - 1)] };
  });
}

function parseRows(pages: RecognizedScorePage[]): { rows: ParsedJianpuRow[]; warnings: JianpuWarning[] } {
  const rows: ParsedJianpuRow[] = [];
  const signatures = new Set<string>();
  let missingLyrics = false;
  let estimatedRhythm = false;

  pages.forEach((page, pageIndex) => {
    const ordered = [...page.lines].sort((left, right) => left.top - right.top);
    ordered.forEach((line, lineIndex) => {
      if (line.role !== "notation") return;
      const rawTokens = notationTokens(line.text);
      if (rawTokens.length === 0) return;
      const lyricLine = nearestLyricLine(ordered, lineIndex);
      const lyricText = lyricLine?.text.trim() ?? "";
      const signature = rowSignature(rawTokens.join(" "), lyricText);
      if (signatures.has(signature)) return;
      signatures.add(signature);

      if (!lyricText) missingLyrics = true;
      if (rawTokens.every((token) => !/[_\-.]/u.test(token))) estimatedRhythm = true;

      const parsedNotes = rawTokens.map((token) => ({
        ...parseJianpuToken(token),
        confidence: line.confidence,
      }));
      rows.push({
        id: `page-${pageIndex + 1}-row-${lineIndex + 1}`,
        notationText: rawTokens.join(" "),
        lyricText,
        notes: assignLyrics(parsedNotes, lyricText),
        confidence: Math.min(line.confidence, lyricLine?.confidence ?? line.confidence),
      });
    });
  });

  return {
    rows,
    warnings: [
      ...(missingLyrics ? (["LYRICS_INCOMPLETE"] as const) : []),
      ...(estimatedRhythm ? (["RHYTHM_ESTIMATED"] as const) : []),
    ],
  };
}

function titleAndArtist(pages: RecognizedScorePage[], fallbackTitle: string): {
  title: string;
  artist: string;
  warnings: JianpuWarning[];
} {
  const lines = pages.flatMap((page) => page.lines);
  const title = lines.find((line) => line.role === "title")?.text.trim();
  const metadata = lines.filter((line) => line.role === "metadata").map((line) => line.text);
  const artist = metadata
    .map((text) => text.match(/^\s*([^·|｜]{1,30}?)\s*(?:作曲|作词|词|曲)/u)?.[1]?.trim())
    .find(Boolean);
  return {
    title: title || fallbackTitle || "Untitled Score",
    artist: artist || "Unknown Artist",
    warnings: title && artist ? [] : ["METADATA_ESTIMATED"],
  };
}

export function parseJianpuPages(
  pages: RecognizedScorePage[],
  options: { fallbackTitle?: string } = {},
): ParsedJianpuScore {
  const allText = pages.flatMap((page) => page.lines.map((line) => line.text));
  const header = parseJianpuHeader(allText);
  const parsedRows = parseRows(pages);
  const metadata = titleAndArtist(pages, options.fallbackTitle ?? "Untitled Score");
  const warnings = uniqueWarnings([...header.warnings, ...parsedRows.warnings, ...metadata.warnings]);
  const confidences = parsedRows.rows.map((row) => row.confidence);
  const confidence = confidences.length === 0
    ? 0
    : confidences.reduce((sum, value) => sum + value, 0) / confidences.length;

  return {
    ...header,
    warnings,
    title: metadata.title,
    artist: metadata.artist,
    rows: parsedRows.rows,
    quality: warnings.length > 0 || confidence < 0.82 ? "estimated" : "clear",
    confidence,
  };
}
