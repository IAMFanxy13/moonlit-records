import { pinyin } from "pinyin-pro";

import type { Phrase, SongEvent, SongPackage } from "../lib/song";
import type { ParsedJianpuNote, ParsedJianpuScore } from "./jianpu-types";

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const PITCH_CLASSES: Record<string, number> = {
  C: 0,
  "C#": 1,
  DB: 1,
  D: 2,
  "D#": 3,
  EB: 3,
  E: 4,
  F: 5,
  "F#": 6,
  GB: 6,
  G: 7,
  "G#": 8,
  AB: 8,
  A: 9,
  "A#": 10,
  BB: 10,
  B: 11,
};
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const HAN = /\p{Script=Han}/u;

function noteName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function pianoNote(note: ParsedJianpuNote, tonic: string): string {
  const tonicPitch = PITCH_CLASSES[tonic.toUpperCase()] ?? 0;
  const degreeOffset = MAJOR_SCALE[Math.max(0, Math.min(6, note.degree - 1))];
  return noteName(60 + tonicPitch + degreeOffset + note.octave * 12);
}

function lyricInitial(token: string): string {
  if (HAN.test(token)) {
    return pinyin(token, { pattern: "first", toneType: "none", type: "array" })[0]
      ?.slice(0, 1)
      .toUpperCase() || "A";
  }
  return token.match(/[A-Za-z]/u)?.[0]?.toUpperCase() ?? "A";
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function compileJianpuSong(score: ParsedJianpuScore, id: string): SongPackage {
  const beatMs = 60_000 / score.tempoBpm;
  const events: SongEvent[] = [];
  const phrases: Phrase[] = [];
  let timelineMs = 0;
  let pendingRestMs = 0;
  let fallbackIndex = 0;

  score.rows.forEach((row) => {
    const phraseIndex = phrases.length;
    const startEvent = events.length;
    let tokenIndex = 0;

    row.notes.forEach((parsedNote) => {
      const durationMs = Math.max(1, Math.round(parsedNote.beats * beatMs));
      if (parsedNote.rest) {
        timelineMs += durationMs;
        pendingRestMs += durationMs;
        return;
      }

      const token = parsedNote.lyric;
      const targetCode = token
        ? `Key${lyricInitial(token)}`
        : `Digit${((fallbackIndex++) % 10 + 1) % 10}`;
      const note = pianoNote(parsedNote, score.tonic);
      const eventStartMs = timelineMs;
      const event: SongEvent = {
        id: `${id}-event-${events.length + 1}`,
        phraseIndex,
        tokenIndex: token ? tokenIndex++ : null,
        token,
        targetCode,
        notes: [note],
        note,
        velocity: 82,
        kind: durationMs <= 300 ? "tap" : "hold",
        ...(durationMs > 300 ? { holdMs: durationMs } : {}),
        ...(pendingRestMs > 0 ? { restBeforeMs: pendingRestMs } : {}),
        sourceStartMs: eventStartMs,
        sourceEndMs: eventStartMs + durationMs,
        confidence: parsedNote.confidence,
        provenance: ["offline-jianpu-recognition", `key-${score.tonic}`],
      };
      events.push(event);
      pendingRestMs = 0;
      timelineMs += durationMs;
    });

    if (events.length > startEvent) {
      phrases.push({
        id: `${id}-phrase-${phrases.length + 1}`,
        text: row.lyricText || row.notationText,
        startEvent,
        endEvent: events.length - 1,
      });
    }
  });

  if (events.length === 0) {
    throw new Error("A Jianpu score must contain at least one playable note.");
  }

  const [beatsPerBar, beatUnit] = score.meter.split("/").map(Number);
  return {
    id,
    title: score.title,
    artist: score.artist,
    version: "Offline Jianpu",
    searchAliases: [score.title, score.artist],
    lyricLanguage: score.rows.some((row) => HAN.test(row.lyricText)) ? "zh-CN" : "en",
    durationLabel: formatDuration(timelineMs),
    tempoBpm: score.tempoBpm,
    meter: { beatsPerBar, beatUnit },
    recommendedPiano: score.quality === "clear" ? "concert" : "warm",
    quality: score.quality === "clear" ? "clear" : "sketch",
    provenance: ["offline-jianpu-recognition", `key-${score.tonic}`, ...score.warnings],
    phrases,
    events,
  };
}
