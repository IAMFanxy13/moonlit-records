import { isPerformanceInputCode } from "../lib/keyboard";
import type { LyricToken, Phrase, SongEvent, SongPackage } from "../lib/song";
import { normalizeSongPackage } from "../lib/song-normalizer";
import type { PrivateSongRecord } from "./types";

export interface PrivateLibrary {
  list(): Promise<PrivateSongRecord[]>;
  get(id: string): Promise<PrivateSongRecord | null>;
  put(record: PrivateSongRecord): Promise<PrivateSongRecord>;
  remove(id: string): Promise<void>;
}

const PIANO_VOICES = new Set(["warm", "concert", "bright", "upright"]);
const ARRANGEMENT_QUALITIES = new Set(["clear", "usable", "sketch"]);
const LYRIC_LANGUAGES = new Set(["zh-CN", "en"]);
const NOTE_NAME = /^[A-G](?:#|b)?-?\d+$/u;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isOptionalNonNegativeNumber(value: unknown): boolean {
  return value === undefined || (isFiniteNumber(value) && value >= 0);
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function isNullableIndex(value: unknown): boolean {
  return value === null || (Number.isInteger(value) && Number(value) >= 0);
}

function isPhrase(value: unknown, eventCount: number): value is Phrase {
  if (!isObject(value)) return false;
  return isNonEmptyString(value.id)
    && typeof value.text === "string"
    && Number.isInteger(value.startEvent)
    && Number.isInteger(value.endEvent)
    && Number(value.startEvent) >= 0
    && Number(value.startEvent) <= Number(value.endEvent)
    && Number(value.endEvent) < eventCount;
}

function isSongEvent(value: unknown, phrases: Phrase[], eventIndex: number): value is SongEvent {
  if (!isObject(value)) return false;
  const phraseIndex = Number(value.phraseIndex);
  const phrase = phrases[phraseIndex];
  if (
    !Number.isInteger(value.phraseIndex)
    || !phrase
    || eventIndex < phrase.startEvent
    || eventIndex > phrase.endEvent
  ) return false;
  if (
    !Array.isArray(value.notes)
    || value.notes.length === 0
    || !value.notes.every((note) => typeof note === "string" && NOTE_NAME.test(note))
  ) return false;
  if (
    !isNonEmptyString(value.id)
    || !isNullableIndex(value.tokenIndex)
    || !isNullableString(value.token)
    || !isNonEmptyString(value.targetCode)
    || (!isPerformanceInputCode(value.targetCode)
      && !/^(?:Digit\d|Enter|NumpadEnter|ShiftLeft|ShiftRight)$/u.test(value.targetCode))
    || !isNonEmptyString(value.note)
    || !NOTE_NAME.test(value.note)
    || !isFiniteNumber(value.velocity)
    || value.velocity < 0
    || value.velocity > 127
    || !["tap", "hold"].includes(String(value.kind))
    || !isOptionalNonNegativeNumber(value.holdMs)
    || !isOptionalNonNegativeNumber(value.restBeforeMs)
    || !isOptionalNonNegativeNumber(value.sourceStartMs)
    || !isOptionalNonNegativeNumber(value.sourceEndMs)
    || !isFiniteNumber(value.confidence)
    || value.confidence < 0
    || value.confidence > 1
    || !isStringArray(value.provenance)
  ) return false;
  if (
    isFiniteNumber(value.sourceStartMs)
    && isFiniteNumber(value.sourceEndMs)
    && value.sourceEndMs < value.sourceStartMs
  ) return false;
  return (value.lyricTokenId === undefined || isNullableString(value.lyricTokenId))
    && (value.lyricSubIndex === undefined || isNullableIndex(value.lyricSubIndex))
    && (value.lyricSubCount === undefined || isNullableIndex(value.lyricSubCount));
}

function isLyricToken(value: unknown, phrases: Phrase[], eventCount: number): value is LyricToken {
  if (!isObject(value)) return false;
  const phraseIndex = Number(value.phraseIndex);
  const phrase = phrases[phraseIndex];
  return isNonEmptyString(value.id)
    && Number.isInteger(value.phraseIndex)
    && Boolean(phrase)
    && Number.isInteger(value.tokenIndex)
    && Number(value.tokenIndex) >= 0
    && isNonEmptyString(value.text)
    && Number.isInteger(value.startEvent)
    && Number.isInteger(value.endEvent)
    && Number(value.startEvent) >= (phrase?.startEvent ?? eventCount)
    && Number(value.startEvent) <= Number(value.endEvent)
    && Number(value.endEvent) <= (phrase?.endEvent ?? -1)
    && Number(value.endEvent) < eventCount;
}

function isSongPackage(value: unknown): value is SongPackage {
  if (!isObject(value) || !Array.isArray(value.events) || value.events.length === 0) return false;
  if (!Array.isArray(value.phrases) || value.phrases.length === 0) return false;
  const events = value.events;
  const phrases = value.phrases;
  if (!phrases.every((phrase) => isPhrase(phrase, events.length))) return false;
  const typedPhrases = phrases as Phrase[];
  const rangesCoverEvents = typedPhrases.every((phrase, index) =>
    phrase.startEvent === (index === 0 ? 0 : typedPhrases[index - 1].endEvent + 1),
  ) && typedPhrases.at(-1)?.endEvent === events.length - 1;
  if (!rangesCoverEvents) return false;
  if (!events.every((event, eventIndex) => isSongEvent(event, typedPhrases, eventIndex))) return false;
  if (
    value.lyricTokens !== undefined
    && (!Array.isArray(value.lyricTokens)
      || !value.lyricTokens.every((token) => isLyricToken(token, typedPhrases, events.length)))
  ) return false;
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.title)
    && isNonEmptyString(value.artist)
    && isNonEmptyString(value.version)
    && isStringArray(value.searchAliases)
    && LYRIC_LANGUAGES.has(String(value.lyricLanguage))
    && isNonEmptyString(value.durationLabel)
    && (value.tempoBpm === undefined || (isFiniteNumber(value.tempoBpm) && value.tempoBpm > 0))
    && PIANO_VOICES.has(String(value.recommendedPiano))
    && ARRANGEMENT_QUALITIES.has(String(value.quality))
    && isStringArray(value.provenance);
}

function normalizePrivateSongRecord(value: unknown): PrivateSongRecord | null {
  if (!isObject(value) || !isObject(value.metadata) || !isSongPackage(value.song)) return null;
  if (
    !isNonEmptyString(value.id)
    || !isNonEmptyString(value.checksum)
    || !isNonEmptyString(value.sourceName)
    || !isNonEmptyString(value.createdAt)
    || !isNonEmptyString(value.metadata.title)
    || !isNonEmptyString(value.metadata.artist)
    || !isStringArray(value.warnings)
  ) return null;
  const record = structuredClone(value) as unknown as PrivateSongRecord;
  record.song = normalizeSongPackage(record.song);
  return record;
}

function requirePrivateSongRecord(value: unknown): PrivateSongRecord {
  const record = normalizePrivateSongRecord(value);
  if (!record) throw new Error("Invalid private song record.");
  return record;
}

function newestFirst(records: PrivateSongRecord[]): PrivateSongRecord[] {
  return records.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function createMemoryPrivateLibrary(initial: unknown[] = []): PrivateLibrary {
  const records = new Map(
    initial
      .map(normalizePrivateSongRecord)
      .filter((record): record is PrivateSongRecord => record !== null)
      .map((record) => [record.id, record]),
  );

  return {
    async list() {
      return newestFirst([...records.values()].map((record) => structuredClone(record)));
    },
    async get(id) {
      const record = records.get(id);
      return record ? structuredClone(record) : null;
    },
    async put(record) {
      const normalized = requirePrivateSongRecord(record);
      const existing = [...records.values()].find((item) => item.checksum === normalized.checksum);
      if (existing && existing.id !== normalized.id) records.delete(existing.id);
      records.set(normalized.id, normalized);
      return structuredClone(normalized);
    },
    async remove(id) {
      records.delete(id);
    },
  };
}

const DB_NAME = "moonlit-records-private-library";
const STORE_NAME = "arrangements";
const DB_VERSION = 1;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Private library request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Private library transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Private library transaction was cancelled."));
  });
}

async function openLibraryDb(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) throw new Error("Private browser storage is unavailable.");
  const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
    store.createIndex("checksum", "checksum", { unique: true });
    store.createIndex("createdAt", "createdAt");
  };
  return requestResult(request);
}

export function createIndexedDbPrivateLibrary(): PrivateLibrary {
  return {
    async list() {
      const database = await openLibraryDb();
      try {
        const values = await requestResult(database.transaction(STORE_NAME).objectStore(STORE_NAME).getAll());
        return newestFirst(values
          .map(normalizePrivateSongRecord)
          .filter((record): record is PrivateSongRecord => record !== null));
      } finally {
        database.close();
      }
    },
    async get(id) {
      const database = await openLibraryDb();
      try {
        const value = await requestResult(database.transaction(STORE_NAME).objectStore(STORE_NAME).get(id));
        return normalizePrivateSongRecord(value);
      } finally {
        database.close();
      }
    },
    async put(record) {
      const normalized = requirePrivateSongRecord(record);
      const database = await openLibraryDb();
      try {
        const readTransaction = database.transaction(STORE_NAME);
        const existing = normalizePrivateSongRecord(await requestResult(
          readTransaction.objectStore(STORE_NAME).index("checksum").get(normalized.checksum),
        ));
        const transaction = database.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        if (existing && existing.id !== normalized.id) store.delete(existing.id);
        store.put(normalized);
        await transactionComplete(transaction);
        return normalized;
      } finally {
        database.close();
      }
    },
    async remove(id) {
      const database = await openLibraryDb();
      try {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).delete(id);
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
    },
  };
}
