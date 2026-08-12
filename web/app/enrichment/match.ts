import type { EnrichmentQuery, RecordingCandidate } from "./types";

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(normalize(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normalize(right).split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return (2 * intersection) / (leftTokens.size + rightTokens.size);
}

export function scoreRecordingMatch(query: EnrichmentQuery, candidate: RecordingCandidate): number {
  const title = tokenSimilarity(query.title, candidate.title);
  const artistKnown = normalize(query.artist) !== "unknown artist";
  const artist = artistKnown ? tokenSimilarity(query.artist, candidate.artist) : 0.15;
  const difference = candidate.durationMs === undefined ? 30_000 : Math.abs(query.durationMs - candidate.durationMs);
  const duration = difference <= 2_000 ? 1 : difference <= 10_000 ? 0.6 : difference <= 30_000 ? 0.2 : 0;
  const versionText = `${candidate.title} ${candidate.disambiguation ?? ""}`.toLocaleLowerCase();
  const sourceText = query.title.toLocaleLowerCase();
  const versionWords = ["live", "remix", "cover", "karaoke", "instrumental", "acoustic"];
  const mismatch = versionWords.some((word) => versionText.includes(word) && !sourceText.includes(word));
  const exactBonus = normalize(query.title) === normalize(candidate.title) ? 0.05 : 0;
  return Math.max(0, Math.min(1, title * 0.45 + artist * 0.3 + duration * 0.2 + exactBonus - (mismatch ? 0.35 : 0)));
}
