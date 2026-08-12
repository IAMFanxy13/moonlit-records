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

  it("reuses an existing private result with the same checksum", async () => {
    const library = createMemoryPrivateLibrary();
    const original = record("first", "same", "2026-01-01T00:00:00.000Z");
    await library.put(original);
    const stored = await library.put(record("duplicate", "same", "2026-02-01T00:00:00.000Z"));

    expect(stored.id).toBe("first");
    expect(await library.list()).toHaveLength(1);
  });

  it("skips corrupt records instead of breaking the whole library", async () => {
    const library = createMemoryPrivateLibrary([
      record("valid", "ok", "2026-01-01T00:00:00.000Z"),
      { id: "broken" },
    ]);
    expect((await library.list()).map((item) => item.id)).toEqual(["valid"]);
  });
});
