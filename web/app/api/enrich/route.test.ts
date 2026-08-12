import { describe, expect, it, vi } from "vitest";

import { enrichTrack } from "../../enrichment/musicbrainz";

describe("free online enrichment", () => {
  it("returns empty optional evidence when every provider is unavailable", async () => {
    const result = await enrichTrack(
      { title: "Evening Song", artist: "Artist", durationMs: 180_000 },
      vi.fn().mockRejectedValue(new Error("offline")),
    );

    expect(result).toEqual({ fields: {}, lyrics: null, warnings: ["ONLINE_ENRICHMENT_UNAVAILABLE"] });
  });

  it("accepts an exact MusicBrainz recording and keeps field provenance", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("musicbrainz.org")) {
        return new Response(JSON.stringify({ recordings: [{
          id: "mbid-1",
          title: "Evening Song",
          length: 180_100,
          "artist-credit": [{ name: "Artist" }],
          releases: [{ id: "release-1", title: "Night Album", date: "2020-01-01" }],
          disambiguation: "",
        }] }), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    });

    const result = await enrichTrack({ title: "Evening Song", artist: "Artist", durationMs: 180_000 }, fetcher);
    expect(result.fields.title).toMatchObject({ value: "Evening Song", provider: "MusicBrainz", recordId: "mbid-1" });
    expect(result.fields.album?.value).toBe("Night Album");
  });
});
