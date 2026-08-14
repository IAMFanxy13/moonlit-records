import {
  canonicalScoreTargetCode,
  INSTRUMENTAL_MELODY_CODE,
  LEGACY_LYRIC_CONTINUATION_CODE,
  LEFT_HAND_CODE,
} from "../lib/keyboard";
import { lyricTargetCode } from "../lib/lyric-input";
import { normalizeSongPackage } from "../lib/song-normalizer";
import type { LyricToken, PianoArticulation, PianoGestureRole, PianoGestureType, PianoPedalIntent, PianoVoice, SongEvent, SongEventPart, SongPackage } from "../lib/song";
import { MoonlitScoreCodeError } from "./moonlit-score-code";
import type { PrivateSongRecord } from "./types";

const MAX_EVENTS = 5_000;
const NOTE = /^[A-G](?:#|b)?-?\d$/u;
const TOKEN = /^(?:\p{Script=Han}|[A-Za-z]+(?:'[A-Za-z]+)?)$/u;
const ARTICULATIONS = new Set<PianoArticulation>(["legato", "connected", "normal", "staccato", "tenuto"]);
const PEDALS = new Set<PianoPedalIntent>(["hold", "repedal", "release", "none"]);
const ROLES = new Set<PianoGestureRole>(["melody", "melody-voicing", "inner-voice", "left-bass", "left-open-voicing", "instrumental"]);
const GESTURE_TYPES = new Set<PianoGestureType>(["block", "softRollUp", "rollUp", "rollDown", "grace", "octave"]);
const VOICES: Record<string, PianoVoice> = { felt: "warm", concert: "concert", studio: "bright", upright: "upright" };

type Json = Record<string, unknown>;
interface V2Note { pitch: string; velocity: number; durationBeats: number }
interface V2Lyric { id: string; text: string; subIndex: number }

const object = (value: unknown, field: string): Json => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MoonlitScoreCodeError(`${field} must be an object.`, 2);
  return value as Json;
};
const text = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new MoonlitScoreCodeError(`${field} must be text.`, 2);
  return value.trim();
};
const number = (value: unknown, field: string, min: number, max: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new MoonlitScoreCodeError(`${field} must be from ${min} to ${max}.`, 2);
  return value;
};
const checksumFor = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, "0");
};
const durationLabel = (milliseconds: number): string => {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
};

function parseNote(value: unknown): V2Note {
  const item = object(value, "gesture note");
  const pitch = text(item.pitch, "note.pitch");
  if (!NOTE.test(pitch)) throw new MoonlitScoreCodeError(`Invalid absolute piano pitch ${pitch}.`, 2);
  return {
    pitch,
    velocity: number(item.velocity, "note.velocity", 0.05, 1),
    durationBeats: number(item.durationBeats, "note.durationBeats", 0.05, 16),
  };
}

function parseLyric(value: unknown): V2Lyric | null {
  if (value === undefined || value === null) return null;
  const item = object(value, "lyric");
  const lyric = { id: text(item.id, "lyric.id"), text: text(item.text, "lyric.text"), subIndex: number(item.subIndex, "lyric.subIndex", 0, 99) };
  if (!Number.isInteger(lyric.subIndex) || !TOKEN.test(lyric.text)) throw new MoonlitScoreCodeError("A lyric must be one Chinese character or one English word with an integer subIndex.", 2);
  return lyric;
}

function parseGesture(value: unknown, hand: "right" | "left", beatMs: number, lyric: V2Lyric | null): SongEventPart | null {
  if (value === undefined || value === null) return null;
  const item = object(value, `${hand} gesture`);
  const trigger = canonicalScoreTargetCode(text(item.trigger, `${hand}.trigger`));
  if (hand === "left" && trigger !== LEFT_HAND_CODE) throw new MoonlitScoreCodeError("Every left-hand gesture must use Space.", 2);
  if (hand === "right" && lyric) {
    const expected = lyricTargetCode(lyric.text);
    const legacyContinuation = lyric.subIndex > 0 && trigger === LEGACY_LYRIC_CONTINUATION_CODE;
    if (trigger !== expected && !legacyContinuation) {
      throw new MoonlitScoreCodeError(`Lyric ${lyric.text} subIndex ${lyric.subIndex} must use ${expected}.`, 2);
    }
  }
  if (hand === "right" && !lyric && trigger !== INSTRUMENTAL_MELODY_CODE) throw new MoonlitScoreCodeError("A lyric-free right-hand gesture must use Shift.", 2);
  if (!Array.isArray(item.notes) || item.notes.length < 1 || item.notes.length > 8) throw new MoonlitScoreCodeError("A gesture needs 1 to 8 simultaneous notes.", 2);
  const notes = item.notes.map(parseNote);
  const articulation = item.articulation === undefined ? "normal" : text(item.articulation, "articulation") as PianoArticulation;
  const pedalIntent = item.pedalIntent === undefined ? "none" : text(item.pedalIntent, "pedalIntent") as PianoPedalIntent;
  const role = item.role === undefined ? (hand === "left" ? "left-open-voicing" : lyric ? "melody" : "instrumental") : text(item.role, "role") as PianoGestureRole;
  const gestureType = item.gestureType === undefined ? undefined : text(item.gestureType, "gestureType") as PianoGestureType;
  if (!ARTICULATIONS.has(articulation) || !PEDALS.has(pedalIntent) || !ROLES.has(role) || (gestureType !== undefined && !GESTURE_TYPES.has(gestureType))) {
    throw new MoonlitScoreCodeError("Unknown articulation, pedalIntent, role, or gestureType.", 2);
  }
  return {
    hand,
    targetCode: trigger,
    notes: notes.map((note) => note.pitch),
    velocities: notes.map((note) => note.velocity),
    durationsMs: notes.map((note) => Math.round(note.durationBeats * beatMs)),
    velocity: Math.round(Math.max(...notes.map((note) => note.velocity)) * 127),
    articulation,
    harmonyId: item.harmonyId === undefined ? undefined : text(item.harmonyId, "harmonyId"),
    pedalIntent,
    role,
    origin: item.origin === undefined ? "gpt-arranged" : text(item.origin, "origin"),
    confidence: item.confidence === undefined ? 1 : number(item.confidence, "confidence", 0, 1),
    gestureType,
  };
}

export function compileMoonlitScoreV2(source: string, options: { now?: string } = {}): PrivateSongRecord {
  const normalized = source.replace(/\r\n?/gu, "\n").trim();
  if (!normalized.startsWith("MOONLIT-SCORE/2\n")) throw new MoonlitScoreCodeError("Expected MOONLIT-SCORE/2 followed by JSON.", 1);
  let root: Json;
  try { root = object(JSON.parse(normalized.slice(normalized.indexOf("\n") + 1)), "score"); }
  catch (error) { if (error instanceof MoonlitScoreCodeError) throw error; throw new MoonlitScoreCodeError("Score/2 body must be valid declarative JSON.", 2); }
  const meta = object(root.meta, "meta");
  const title = text(meta.title, "meta.title");
  const artist = text(meta.artist, "meta.artist");
  const tonic = text(meta.key, "meta.key");
  const mode = text(meta.mode, "meta.mode") as "major" | "minor";
  if (!/^[A-G](?:#|b)?$/u.test(tonic) || !["major", "minor"].includes(mode)) throw new MoonlitScoreCodeError("meta.key/mode must describe a major or minor key.", 2);
  const meter = text(meta.meter, "meta.meter");
  if (!/^[2-9]\/(?:2|4|8|16)$/u.test(meter)) throw new MoonlitScoreCodeError("meta.meter must look like 4/4 or 6/8.", 2);
  const tempo = number(meta.tempo, "meta.tempo", 30, 240);
  const beatMs = 60_000 / tempo;
  const voiceName = text(meta.voice, "meta.voice").toLowerCase();
  if (!VOICES[voiceName]) throw new MoonlitScoreCodeError("meta.voice must be felt, concert, studio, or upright.", 2);
  if (!Array.isArray(root.phrases) || root.phrases.length === 0) throw new MoonlitScoreCodeError("Score/2 needs at least one phrase.", 2);

  const checksum = `moonlit-v2-${checksumFor(normalized)}`;
  const id = `moonlit-code-${checksumFor(normalized)}`;
  const events: SongEvent[] = [];
  const phrases: SongPackage["phrases"] = [];
  const tokens = new Map<string, LyricToken>();
  const tokenSubCounts = new Map<string, number>();
  let totalMs = 0;
  let phraseOffsetMs = 0;

  root.phrases.forEach((rawPhrase, phraseIndex) => {
    const phrase = object(rawPhrase, "phrase");
    const phraseText = text(phrase.text, "phrase.text");
    if (!Array.isArray(phrase.events) || phrase.events.length === 0) throw new MoonlitScoreCodeError("Each phrase needs events.", 2);
    const startEvent = events.length;
    let phraseEndMs = 0;
    let phraseTokenCount = 0;
    phrase.events.forEach((rawEvent) => {
      if (events.length >= MAX_EVENTS) throw new MoonlitScoreCodeError(`A score may contain at most ${MAX_EVENTS} events.`, 2);
      const item = object(rawEvent, "event");
      const beat = number(item.beat, "event.beat", 0, 100_000);
      const lyric = parseLyric(item.lyric);
      const right = parseGesture(item.right, "right", beatMs, lyric);
      const left = parseGesture(item.left, "left", beatMs, null);
      const parts = [right, left].filter((part): part is SongEventPart => Boolean(part));
      if (parts.length === 0) throw new MoonlitScoreCodeError("Every event needs a right and/or left gesture.", 2);
      const primary = right ?? left!;
      const eventIndex = events.length;
      const localOnset = Math.round(beat * beatMs);
      const onset = phraseOffsetMs + localOnset;
      const duration = Math.max(...parts.flatMap((part) => part.durationsMs ?? [Math.round(beatMs)]));
      const lyricKey = lyric ? `${phraseIndex}:${lyric.id}` : null;
      const lyricToken = lyricKey ? tokens.get(lyricKey) : undefined;
      if (lyric && lyric.subIndex > 0 && !lyricToken) throw new MoonlitScoreCodeError("A lyric continuation must follow its first gesture.", 2);
      if (lyric && lyricToken && (lyricToken.text !== lyric.text || lyric.subIndex !== tokenSubCounts.get(lyricKey!))) throw new MoonlitScoreCodeError("Lyric continuation subIndex must be sequential and keep the same text.", 2);
      if (lyric && !lyricToken && lyric.subIndex !== 0) throw new MoonlitScoreCodeError("A lyric token must begin at subIndex 0.", 2);
      if (lyric) {
        if (lyricToken) {
          lyricToken.endEvent = eventIndex;
          tokenSubCounts.set(lyricKey!, (tokenSubCounts.get(lyricKey!) ?? 0) + 1);
        } else {
          tokens.set(lyricKey!, { id: `${id}-${phraseIndex}-${lyric.id}`, phraseIndex, tokenIndex: phraseTokenCount++, text: lyric.text, startEvent: eventIndex, endEvent: eventIndex });
          tokenSubCounts.set(lyricKey!, 1);
        }
      }
      events.push({
        id: `${id}-event-${eventIndex + 1}`, phraseIndex, tokenIndex: lyric ? tokens.get(`${phraseIndex}:${lyric.id}`)!.tokenIndex : null,
        token: lyric?.text ?? null, targetCode: primary.targetCode, notes: [...primary.notes], parts,
        note: primary.notes[0], velocity: primary.velocity ?? 88, kind: duration > 300 ? "hold" : "tap", holdMs: duration,
        sourceStartMs: onset, sourceEndMs: onset + duration, confidence: Math.min(...parts.map((part) => part.confidence ?? 1)), provenance: ["moonlit-score-v2"],
      });
      phraseEndMs = Math.max(phraseEndMs, localOnset + duration);
    });
    phrases.push({ id: `${id}-phrase-${phraseIndex + 1}`, text: phraseText, startEvent, endEvent: events.length - 1, section: phrase.section === undefined ? undefined : text(phrase.section, "phrase.section"), energy: phrase.energy === undefined ? undefined : number(phrase.energy, "phrase.energy", 1, 5) });
    phraseOffsetMs += phraseEndMs;
    totalMs = phraseOffsetMs;
  });
  const [beatsPerBar, beatUnit] = meter.split("/").map(Number);
  const song = normalizeSongPackage({
    id, title, artist, version: "Moonlit Score 2", searchAliases: [title, artist], lyricLanguage: events.some((event) => event.token && /^\p{Script=Han}$/u.test(event.token)) ? "zh-CN" : "en",
    durationLabel: durationLabel(totalMs), tempoBpm: tempo, meter: { beatsPerBar, beatUnit }, keySignature: { tonic, mode }, recommendedPiano: VOICES[voiceName], quality: "clear",
    provenance: ["moonlit-score-v2", `key-${tonic}-${mode}`, `meter-${meter}`], phrases, lyricTokens: [...tokens.values()], events,
  });
  return { id, checksum, sourceName: `${title}.moonlit-score.json`, createdAt: options.now ?? new Date().toISOString(), metadata: { title, artist, durationMs: totalMs, language: song.lyricLanguage }, song, warnings: [] };
}
