import { pinyin } from "pinyin-pro";

import type { PianoVoice, SongEvent, SongPackage } from "../lib/song";
import { normalizeSongPackage } from "../lib/song-normalizer";
import type { PrivateSongRecord } from "./types";
import { compileMoonlitScoreV2 } from "./moonlit-score-v2";

const MAX_CODE_LENGTH = 300_000;
const MAX_LINES = 1_000;
const MAX_EVENTS = 5_000;
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const PITCH_CLASSES: Record<string, number> = {
  C: 0, "C#": 1, DB: 1, D: 2, "D#": 3, EB: 3,
  E: 4, F: 5, "F#": 6, GB: 6, G: 7, "G#": 8,
  AB: 8, A: 9, "A#": 10, BB: 10, B: 11,
};
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const VOICES: Record<string, PianoVoice> = {
  felt: "warm",
  concert: "concert",
  studio: "bright",
  upright: "upright",
};
const REQUIRED_HEADERS = ["title", "artist", "key", "meter", "tempo", "voice"] as const;
const HEADER_NAMES = new Set<string>(REQUIRED_HEADERS);
const NOTE_AT = /\s*(0|(?:[\^,]?[1-7])(?:\+(?:[\^,]?[1-7]))*):(\d+(?:\.\d*)?|\.\d+)(?:\{([^{}\r\n]+)\})?/y;
const BARE_NOTE_AT = /\s*(0|(?:[\^,]?[1-7])(?:\+(?:[\^,]?[1-7]))*):(\d+(?:\.\d*)?|\.\d+)/y;
const CHINESE_TOKEN = /^\p{Script=Han}$/u;
const ENGLISH_TOKEN = /^[A-Za-z]+(?:'[A-Za-z]+)?$/u;

interface CodeNote {
  pitches: string[];
  beats: number;
  lyric: string | null;
  line: number;
}

interface CodePhrase {
  text: string;
  notes: CodeNote[];
}

interface ScoreHeaders {
  title: string;
  artist: string;
  key: string;
  meter: string;
  tempo: string;
  voice: string;
}

export interface CompileMoonlitScoreCodeOptions {
  now?: string;
}

export class MoonlitScoreCodeError extends Error {
  constructor(message: string, readonly line: number) {
    super(`Line ${line}: ${message}`);
    this.name = "MoonlitScoreCodeError";
  }
}

function normalise(source: string): string {
  return source.replace(/\r\n?/gu, "\n").trim();
}

function checksumFor(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function noteName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function pianoNote(raw: string, tonic: string): string {
  const octave = raw.startsWith("^") ? 1 : raw.startsWith(",") ? -1 : 0;
  const degree = Number(raw.match(/[1-7]/u)?.[0] ?? "1");
  return noteName(60 + PITCH_CLASSES[tonic] + MAJOR_SCALE[degree - 1] + octave * 12);
}

function lyricInitial(token: string): string {
  if (CHINESE_TOKEN.test(token)) {
    return pinyin(token, { pattern: "first", toneType: "none", type: "array" })[0]
      ?.slice(0, 1)
      .toUpperCase() || "A";
  }
  return token[0].toUpperCase();
}

function codeNote(pitchText: string, beatText: string, lyric: string | null, line: number): CodeNote {
    const pitches = pitchText === "0" ? [] : pitchText.split("+");
    const beats = Number(beatText);
    if (!Number.isFinite(beats) || beats <= 0 || beats > 16) {
      throw new MoonlitScoreCodeError("Beat length must be greater than 0 and no more than 16.", line);
    }
    if (pitches.length === 0 && lyric) {
      throw new MoonlitScoreCodeError("A rest cannot carry a lyric token.", line);
    }
    if (lyric && !CHINESE_TOKEN.test(lyric) && !ENGLISH_TOKEN.test(lyric)) {
      throw new MoonlitScoreCodeError("Lyrics must be one Chinese character or one English word per note.", line);
    }
    return { pitches, beats, lyric, line };
}

function parseGroupedNotes(value: string, line: number): { notes: CodeNote[]; consumed: number } {
  const close = value.indexOf("]");
  if (close < 0) throw new MoonlitScoreCodeError("A grouped lyric token needs a closing ].", line);
  const lyricMatch = value.slice(close + 1).match(/^\s*\{([^{}\r\n]+)\}/u);
  if (!lyricMatch) throw new MoonlitScoreCodeError("A grouped note list must be followed by one lyric token, such as [3:.5 4:1]{爱}.", line);
  const lyric = lyricMatch[1].trim();
  if (!CHINESE_TOKEN.test(lyric) && !ENGLISH_TOKEN.test(lyric)) {
    throw new MoonlitScoreCodeError("Lyrics must be one Chinese character or one English word per note group.", line);
  }

  const notes: CodeNote[] = [];
  const body = value.slice(1, close);
  let cursor = 0;
  while (cursor < body.length) {
    BARE_NOTE_AT.lastIndex = cursor;
    const match = BARE_NOTE_AT.exec(body);
    if (!match) throw new MoonlitScoreCodeError("Invalid grouped note. Use [3:.5 4:.5 5:1]{爱}.", line);
    const note = codeNote(match[1], match[2], lyric, line);
    if (note.pitches.length === 0) throw new MoonlitScoreCodeError("A lyric note group cannot contain a rest.", line);
    notes.push(note);
    cursor = BARE_NOTE_AT.lastIndex;
  }
  if (notes.length === 0) throw new MoonlitScoreCodeError("A lyric note group cannot be empty.", line);
  const consumed = close + 1 + lyricMatch[0].length;
  return { notes, consumed };
}

function parseNotes(value: string, line: number): CodeNote[] {
  const notes: CodeNote[] = [];
  let cursor = 0;
  while (cursor < value.length) {
    const remaining = value.slice(cursor);
    if (/^\s*\[/u.test(remaining)) {
      const leading = remaining.match(/^\s*/u)?.[0].length ?? 0;
      const grouped = parseGroupedNotes(remaining.slice(leading), line);
      notes.push(...grouped.notes);
      cursor += leading + grouped.consumed;
    } else {
      NOTE_AT.lastIndex = cursor;
      const match = NOTE_AT.exec(value);
      if (!match) throw new MoonlitScoreCodeError("Invalid note. Use pitch:beats{lyric}, for example 3:1{海}.", line);
      cursor = NOTE_AT.lastIndex;
      notes.push(codeNote(match[1], match[2], match[3]?.trim() || null, line));
    }
    if (notes.length > MAX_EVENTS) {
      throw new MoonlitScoreCodeError(`A score may contain at most ${MAX_EVENTS} notes.`, line);
    }
  }
  if (notes.length === 0) throw new MoonlitScoreCodeError("Add at least one note after notes:.", line);
  return notes;
}

function parseSource(source: string): { headers: ScoreHeaders; phrases: CodePhrase[]; normalised: string } {
  const normalised = normalise(source);
  if (!normalised) throw new MoonlitScoreCodeError("Paste a Moonlit Score Code block.", 1);
  if (normalised.length > MAX_CODE_LENGTH) throw new MoonlitScoreCodeError("This code block is too large.", 1);
  const lines = normalised.split("\n");
  if (lines.length > MAX_LINES) throw new MoonlitScoreCodeError(`A score may contain at most ${MAX_LINES} lines.`, 1);

  const firstContent = lines.findIndex((line) => line.trim().length > 0);
  if (firstContent < 0 || lines[firstContent].trim() !== "MOONLIT-SCORE/1") {
    throw new MoonlitScoreCodeError("Expected MOONLIT-SCORE/1.", Math.max(1, firstContent + 1));
  }

  const headerValues = new Map<string, string>();
  const phrases: CodePhrase[] = [];
  let pendingLine: { text: string; line: number } | null = null;
  let lastHeaderLine = firstContent + 1;

  for (let index = firstContent + 1; index < lines.length; index += 1) {
    const value = lines[index].trim();
    const lineNumber = index + 1;
    if (!value || value.startsWith("# ")) continue;

    if (value.startsWith("line:")) {
      if (pendingLine) throw new MoonlitScoreCodeError("The previous line: needs a notes: row.", lineNumber);
      const text = value.slice(5).trim();
      if (!text) throw new MoonlitScoreCodeError("line: must include the displayed lyric or Instrumental.", lineNumber);
      pendingLine = { text, line: lineNumber };
      continue;
    }

    if (value.startsWith("notes:")) {
      if (!pendingLine) throw new MoonlitScoreCodeError("notes: must follow a line: row.", lineNumber);
      phrases.push({ text: pendingLine.text, notes: parseNotes(value.slice(6).trim(), lineNumber) });
      pendingLine = null;
      continue;
    }

    const header = value.match(/^([a-z]+):\s*(.+)$/u);
    if (header && HEADER_NAMES.has(header[1])) {
      if (phrases.length > 0 || pendingLine) throw new MoonlitScoreCodeError("Metadata headers must appear before the first line: row.", lineNumber);
      if (headerValues.has(header[1])) throw new MoonlitScoreCodeError(`Duplicate ${header[1]} header.`, lineNumber);
      headerValues.set(header[1], header[2].trim());
      lastHeaderLine = lineNumber;
      continue;
    }

    throw new MoonlitScoreCodeError("Unknown statement. Only documented Moonlit Score Code fields are allowed.", lineNumber);
  }

  if (pendingLine) throw new MoonlitScoreCodeError("This line: needs a following notes: row.", pendingLine.line);
  const missing = REQUIRED_HEADERS.find((name) => !headerValues.get(name));
  if (missing) throw new MoonlitScoreCodeError(`Missing required ${missing}: header.`, lastHeaderLine);
  if (phrases.length === 0) throw new MoonlitScoreCodeError("Add at least one line: and notes: pair.", lines.length);

  const headers = Object.fromEntries(REQUIRED_HEADERS.map((name) => [name, headerValues.get(name)])) as unknown as ScoreHeaders;
  if (headers.title.length > 120 || headers.artist.length > 120) {
    throw new MoonlitScoreCodeError("Title and artist must be no more than 120 characters.", lastHeaderLine);
  }
  headers.key = headers.key.toUpperCase();
  if (!(headers.key in PITCH_CLASSES)) throw new MoonlitScoreCodeError("key: must be a supported major key such as C, F, Bb, or F#.", lastHeaderLine);
  if (!/^[2-9]\/(?:2|4|8|16)$/u.test(headers.meter)) throw new MoonlitScoreCodeError("meter: must look like 4/4 or 6/8.", lastHeaderLine);
  const tempo = Number(headers.tempo);
  if (!Number.isInteger(tempo) || tempo < 50 || tempo > 120) throw new MoonlitScoreCodeError("tempo: must be an integer from 50 to 120.", lastHeaderLine);
  if (!(headers.voice.toLowerCase() in VOICES)) throw new MoonlitScoreCodeError("voice: must be felt, concert, studio, or upright.", lastHeaderLine);

  return { headers, phrases, normalised };
}

function compileMoonlitScoreV1(
  source: string,
  options: CompileMoonlitScoreCodeOptions = {},
): PrivateSongRecord {
  const { headers, phrases: codePhrases, normalised } = parseSource(source);
  const checksum = `moonlit-v1-${checksumFor(normalised)}`;
  const id = `moonlit-code-${checksumFor(normalised)}`;
  const tempoBpm = Number(headers.tempo);
  const beatMs = 60_000 / tempoBpm;
  const events: SongEvent[] = [];
  const phrases: SongPackage["phrases"] = [];
  let timelineMs = 0;
  let pendingRestMs = 0;
  let fallbackIndex = 0;
  let hasChinese = false;

  codePhrases.forEach((codePhrase) => {
    const phraseIndex = phrases.length;
    const startEvent = events.length;
    let tokenIndex = 0;
    codePhrase.notes.forEach((codeNote) => {
      const durationMs = Math.max(1, Math.round(codeNote.beats * beatMs));
      if (codeNote.pitches.length === 0) {
        timelineMs += durationMs;
        pendingRestMs += durationMs;
        return;
      }
      if (codeNote.lyric && CHINESE_TOKEN.test(codeNote.lyric)) hasChinese = true;
      const targetCode = codeNote.lyric
        ? `Key${lyricInitial(codeNote.lyric)}`
        : `Digit${((fallbackIndex++) % 10 + 1) % 10}`;
      const notes = codeNote.pitches.map((pitch) => pianoNote(pitch, headers.key));
      const eventStartMs = timelineMs;
      events.push({
        id: `${id}-event-${events.length + 1}`,
        phraseIndex,
        tokenIndex: codeNote.lyric ? tokenIndex++ : null,
        token: codeNote.lyric,
        targetCode,
        notes,
        note: notes[0],
        velocity: 82,
        kind: durationMs <= 300 ? "tap" : "hold",
        ...(durationMs > 300 ? { holdMs: durationMs } : {}),
        ...(pendingRestMs > 0 ? { restBeforeMs: pendingRestMs } : {}),
        sourceStartMs: eventStartMs,
        sourceEndMs: eventStartMs + durationMs,
        confidence: 1,
        provenance: ["moonlit-score-code-v1"],
      });
      pendingRestMs = 0;
      timelineMs += durationMs;
    });
    if (events.length > startEvent) {
      phrases.push({
        id: `${id}-phrase-${phrases.length + 1}`,
        text: codePhrase.text,
        startEvent,
        endEvent: events.length - 1,
      });
    }
  });

  if (events.length === 0) throw new MoonlitScoreCodeError("The score contains only rests; add at least one playable note.", 1);
  if (events.length > MAX_EVENTS) throw new MoonlitScoreCodeError(`A score may contain at most ${MAX_EVENTS} playable notes.`, 1);
  const language = hasChinese ? "zh-CN" : "en";
  const [beatsPerBar, beatUnit] = headers.meter.split("/").map(Number);
  const song: SongPackage = normalizeSongPackage({
    id,
    title: headers.title,
    artist: headers.artist,
    version: "Moonlit Score Code 1",
    searchAliases: [headers.title, headers.artist],
    lyricLanguage: language,
    durationLabel: formatDuration(timelineMs),
    tempoBpm,
    meter: { beatsPerBar, beatUnit },
    recommendedPiano: VOICES[headers.voice.toLowerCase()],
    quality: "clear",
    provenance: ["moonlit-score-code-v1", `key-${headers.key}`, `meter-${headers.meter}`],
    phrases,
    events,
  });

  return {
    id,
    checksum,
    sourceName: `${headers.title}.moonlit-score.txt`,
    createdAt: options.now ?? new Date().toISOString(),
    metadata: { title: headers.title, artist: headers.artist, durationMs: timelineMs, language },
    song,
    warnings: [],
  };
}

export function compileMoonlitScoreCode(
  source: string,
  options: CompileMoonlitScoreCodeOptions = {},
): PrivateSongRecord {
  return normalise(source).split("\n", 1)[0] === "MOONLIT-SCORE/2"
    ? compileMoonlitScoreV2(source, options)
    : compileMoonlitScoreV1(source, options);
}
