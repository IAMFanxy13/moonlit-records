import { enrichTrack } from "../../enrichment/musicbrainz";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const title = url.searchParams.get("title")?.trim() || "Imported Track";
  const artist = url.searchParams.get("artist")?.trim() || "Unknown Artist";
  const durationMs = Number(url.searchParams.get("durationMs") ?? 0);
  const result = await enrichTrack({ title, artist, durationMs: Number.isFinite(durationMs) ? durationMs : 0 });
  return Response.json(result, {
    headers: { "Cache-Control": "private, max-age=3600" },
  });
}
