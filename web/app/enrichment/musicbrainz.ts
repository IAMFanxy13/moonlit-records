import type { EnrichedField } from "../import/types";
import { findFreeLyrics } from "./free-lyrics";
import { scoreRecordingMatch } from "./match";
import type { EnrichmentQuery, FreeFetcher, RecordingCandidate, TrackEnrichment } from "./types";

interface MusicBrainzRecording {
  id: string;
  title: string;
  length?: number;
  disambiguation?: string;
  "artist-credit"?: Array<{ name: string }>;
  releases?: Array<{ id: string; title: string; date?: string }>;
}

interface MusicBrainzResponse {
  recordings?: MusicBrainzRecording[];
}

function field<T>(value: T, recordId: string, confidence: number): EnrichedField<T> {
  return {
    value,
    provider: "MusicBrainz",
    recordId,
    retrievedAt: new Date().toISOString(),
    confidence,
    persistence: "allowed",
  };
}

export async function enrichTrack(query: EnrichmentQuery, fetcher: FreeFetcher = fetch): Promise<TrackEnrichment> {
  try {
    const search = new URL("https://musicbrainz.org/ws/2/recording");
    const artistQuery = query.artist === "Unknown Artist" ? "" : ` AND artist:\"${query.artist}\"`;
    search.searchParams.set("query", `recording:\"${query.title}\"${artistQuery}`);
    search.searchParams.set("fmt", "json");
    search.searchParams.set("limit", "8");
    const response = await fetcher(search, {
      headers: { "User-Agent": "MoonlitRecords/0.2 (private piano arranger)" },
    });
    if (!response.ok) throw new Error(`MusicBrainz ${response.status}`);
    const payload = await response.json() as MusicBrainzResponse;
    const ranked = (payload.recordings ?? []).map((recording) => {
      const candidate: RecordingCandidate = {
        title: recording.title,
        artist: recording["artist-credit"]?.map((artist) => artist.name).join(", ") ?? "Unknown Artist",
        durationMs: recording.length,
        disambiguation: recording.disambiguation,
      };
      return { recording, candidate, score: scoreRecordingMatch(query, candidate) };
    }).sort((left, right) => right.score - left.score);
    const best = ranked[0];
    if (!best || best.score < 0.78) return { fields: {}, lyrics: null, warnings: ["NO_CONFIDENT_ONLINE_MATCH"] };

    const release = best.recording.releases?.[0];
    const fields: TrackEnrichment["fields"] = {
      title: field(best.recording.title, best.recording.id, best.score),
      artist: field(best.candidate.artist, best.recording.id, best.score),
    };
    if (release?.title) fields.album = field(release.title, release.id, best.score);
    if (release?.date) fields.releaseDate = field(release.date, release.id, best.score);
    if (release?.id) {
      fields.coverUrl = field(
        `https://coverartarchive.org/release/${release.id}/front-500`,
        release.id,
        best.score,
      );
    }

    let lyrics = null;
    try {
      lyrics = await findFreeLyrics({ ...query, title: best.recording.title, artist: best.candidate.artist }, fetcher);
    } catch {
      // Lyrics are optional evidence; the local arrangement remains valid.
    }
    return { fields, lyrics, warnings: lyrics ? [] : ["FREE_LYRICS_NOT_FOUND"] };
  } catch {
    return { fields: {}, lyrics: null, warnings: ["ONLINE_ENRICHMENT_UNAVAILABLE"] };
  }
}
