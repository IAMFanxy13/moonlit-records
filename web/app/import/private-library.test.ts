import { describe, expect, it } from "vitest";

import { builtinSongs } from "../lib/songs";
import { createMemoryPrivateLibrary } from "./private-library";
import type { PrivateSongRecord } from "./types";

function record(id: string, checksum: string, createdAt: string): PrivateSongRecord {
  return {
    id,
    checksum,
    sourceName: `${id}.mp3`,
    createdAt,
    metadata: { title: id, artist: "Artist" },
    song: { ...builtinSongs[0], id, title: id },
    warnings: [],
  };
}

describe("private arrangement library", () => {
  it("stores, reads, lists newest first, and removes generated packages", async () => {
    const library = createMemoryPrivateLibrary();
    await library.put(record("older", "a", "2026-01-01T00:00:00.000Z"));
    await library.put(record("newer", "b", "2026-02-01T00:00:00.000Z"));

    expect((await library.list()).map((item) => item.id)).toEqual(["newer", "older"]);
    expect((await library.get("older"))?.checksum).toBe("a");
    await library.remove("older");
    expect(await library.get("older")).toBeNull();
  });

  it("replaces an older analysis when the same recording is imported again", async () => {
    const library = createMemoryPrivateLibrary();
    const original = record("first", "same", "2026-01-01T00:00:00.000Z");
    await library.put(original);
    const stored = await library.put(record("duplicate", "same", "2026-02-01T00:00:00.000Z"));

    expect(stored.id).toBe("duplicate");
    expect(await library.list()).toHaveLength(1);
    expect((await library.list())[0].id).toBe("duplicate");
  });

  it("skips corrupt records instead of breaking the whole library", async () => {
    const library = createMemoryPrivateLibrary([
      record("valid", "ok", "2026-01-01T00:00:00.000Z"),
      { id: "broken" },
    ]);
    expect((await library.list()).map((item) => item.id)).toEqual(["valid"]);
  });

  it("normalizes a legitimate legacy package when it crosses the storage boundary", async () => {
    const legacy = record("legacy", "legacy-checksum", "2026-01-01T00:00:00.000Z");
    delete legacy.song.lyricTokens;
    legacy.song.events = legacy.song.events.map((event) => {
      const normalizedFields: Partial<typeof event> = { ...event };
      delete normalizedFields.lyricTokenId;
      delete normalizedFields.lyricSubIndex;
      delete normalizedFields.lyricSubCount;
      return normalizedFields as typeof event;
    });

    const restored = await createMemoryPrivateLibrary([legacy]).get(legacy.id);

    expect(restored?.song.lyricTokens?.length).toBeGreaterThan(0);
    expect(restored?.song.events[0].lyricTokenId).toEqual(expect.any(String));
    expect(legacy.song.lyricTokens).toBeUndefined();
  });

  it.each([
    ["an empty package", (valid: PrivateSongRecord) => ({
      ...valid,
      song: { ...valid.song, phrases: [], events: [] },
    })],
    ["a malformed event", (valid: PrivateSongRecord) => ({
      ...valid,
      song: {
        ...valid.song,
        events: [{ ...valid.song.events[0], velocity: "loud" }, ...valid.song.events.slice(1)],
      },
    })],
    ["an empty notes array", (valid: PrivateSongRecord) => ({
      ...valid,
      song: {
        ...valid.song,
        events: [{ ...valid.song.events[0], notes: [] }, ...valid.song.events.slice(1)],
      },
    })],
    ["an invalid piano note", (valid: PrivateSongRecord) => ({
      ...valid,
      song: {
        ...valid.song,
        events: [{ ...valid.song.events[0], notes: ["moonbeam"] }, ...valid.song.events.slice(1)],
      },
    })],
    ["an unknown piano voice", (valid: PrivateSongRecord) => ({
      ...valid,
      song: { ...valid.song, recommendedPiano: "organ" },
    })],
    ["an out-of-range event phrase index", (valid: PrivateSongRecord) => ({
      ...valid,
      song: {
        ...valid.song,
        events: [{ ...valid.song.events[0], phraseIndex: 99 }, ...valid.song.events.slice(1)],
      },
    })],
    ["an out-of-range phrase", (valid: PrivateSongRecord) => ({
      ...valid,
      song: {
        ...valid.song,
        phrases: [
          { ...valid.song.phrases[0], endEvent: valid.song.events.length },
          ...valid.song.phrases.slice(1),
        ],
      },
    })],
  ])("skips a partially corrupt record with %s", async (_name, corrupt) => {
    const library = createMemoryPrivateLibrary([
      corrupt(record("corrupt", "bad", "2026-01-01T00:00:00.000Z")),
    ]);

    expect(await library.list()).toEqual([]);
  });

  it("rejects a malformed record on write", async () => {
    const library = createMemoryPrivateLibrary();
    const invalid = record("empty", "empty", "2026-01-01T00:00:00.000Z");
    invalid.song = { ...invalid.song, phrases: [], events: [] };

    await expect(library.put(invalid)).rejects.toThrow("Invalid private song record");
    expect(await library.list()).toEqual([]);
  });
});
