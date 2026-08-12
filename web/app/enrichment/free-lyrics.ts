import type { EnrichmentQuery, FreeFetcher, LyricsEvidence } from "./types";

interface LrcLibResponse {
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

export async function findFreeLyrics(
  query: EnrichmentQuery,
  fetcher: FreeFetcher,
): Promise<LyricsEvidence | null> {
  const url = new URL("https://lrclib.net/api/get");
  url.searchParams.set("track_name", query.title);
  url.searchParams.set("artist_name", query.artist);
  url.searchParams.set("duration", String(Math.round(query.durationMs / 1000)));
  const response = await fetcher(url, { headers: { "User-Agent": "MoonlitRecords/0.2 (private piano arranger)" } });
  if (!response.ok) return null;
  const payload = await response.json() as LrcLibResponse;
  if (!payload.plainLyrics && !payload.syncedLyrics) return null;
  return {
    plain: payload.plainLyrics ?? null,
    synced: payload.syncedLyrics ?? null,
    provider: "LRCLIB",
    persistence: "session-only",
  };
}
