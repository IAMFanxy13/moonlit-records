import { LEFT_HAND_CODE } from "./keyboard";
import { normalizeSongPackage } from "./song-normalizer";
import type { LyricToken, SongEvent, SongPackage } from "./song";

export type LeftHandCuePosition = "before" | "under" | "between" | "after";

export interface LeftHandCue {
  id: string;
  eventIndex: number;
  onsetMs: number;
  position: LeftHandCuePosition;
  beforeTokenId?: string;
  afterTokenId?: string;
  underTokenId?: string;
  ratio: number;
  inferred: boolean;
}

export function leftHandCuePositionLabel(position: LeftHandCuePosition): string {
  if (position === "before") return "BEFORE LINE";
  if (position === "under") return "WITH LYRIC";
  if (position === "between") return "BETWEEN LYRICS";
  return "AFTER LINE";
}

interface TokenAnchor {
  token: LyricToken;
  onset: number;
}

function leftPartIndexes(event: SongEvent): number[] {
  if (!event.parts?.length) {
    return event.targetCode === LEFT_HAND_CODE ? [0] : [];
  }
  return event.parts.flatMap((part, index) => (
    part.hand === "left" && part.targetCode === LEFT_HAND_CODE ? [index] : []
  ));
}

function clampRatio(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function fallbackTokenPercent(tokenId: string | undefined, tokenIds: readonly string[]): number | undefined {
  if (!tokenId) return undefined;
  const index = tokenIds.indexOf(tokenId);
  if (index < 0) return undefined;
  if (tokenIds.length <= 1) return 50;
  return (index / (tokenIds.length - 1)) * 100;
}

export function projectLeftHandCuePercent(
  cue: LeftHandCue,
  anchorPercentById: ReadonlyMap<string, number>,
  fallbackTokenIds: readonly string[],
): number {
  if (cue.position === "before") return 0;
  if (cue.position === "after") return 100;
  if (cue.position === "under") {
    return anchorPercentById.get(cue.underTokenId ?? "")
      ?? fallbackTokenPercent(cue.underTokenId, fallbackTokenIds)
      ?? 50;
  }

  const before = anchorPercentById.get(cue.beforeTokenId ?? "")
    ?? fallbackTokenPercent(cue.beforeTokenId, fallbackTokenIds);
  const after = anchorPercentById.get(cue.afterTokenId ?? "")
    ?? fallbackTokenPercent(cue.afterTokenId, fallbackTokenIds);
  if (before === undefined || after === undefined) return 50;
  return (before + after) / 2;
}

export function buildLeftHandCues(input: SongPackage, phraseIndex: number): LeftHandCue[] {
  const song = input.lyricTokens ? input : normalizeSongPackage(input);
  const phrase = song.phrases[phraseIndex];
  if (!phrase) return [];

  const tokens = (song.lyricTokens ?? [])
    .filter((token) => token.phraseIndex === phraseIndex)
    .sort((left, right) => left.tokenIndex - right.tokenIndex);
  if (tokens.length === 0) return [];

  const leftEvents = song.events.flatMap((event, eventIndex) => (
    event.phraseIndex !== phraseIndex
      ? []
      : leftPartIndexes(event).map((partIndex) => ({ event, eventIndex, partIndex }))
  ));
  if (leftEvents.length === 0) return [];

  const completeTiming = tokens.every((token) => Number.isFinite(song.events[token.startEvent]?.sourceStartMs))
    && leftEvents.every(({ event }) => Number.isFinite(event.sourceStartMs));
  const beatMs = 60_000 / (song.tempoBpm ?? 72);
  const tolerance = completeTiming ? Math.max(12, beatMs * 0.04) : 0;
  const eventOnset = (event: SongEvent, eventIndex: number) => (
    completeTiming ? event.sourceStartMs! : eventIndex
  );
  const tokenAnchors: TokenAnchor[] = tokens.map((token) => ({
    token,
    onset: completeTiming ? song.events[token.startEvent].sourceStartMs! : token.startEvent,
  }));

  return leftEvents.map(({ event, eventIndex, partIndex }) => {
    const onset = eventOnset(event, eventIndex);
    const exact = tokenAnchors.reduce<TokenAnchor | null>((closest, anchor) => {
      const distance = Math.abs(anchor.onset - onset);
      if (distance > tolerance) return closest;
      return !closest || distance < Math.abs(closest.onset - onset) ? anchor : closest;
    }, null);
    const base = {
      id: `${event.id}-left-${partIndex}`,
      eventIndex,
      onsetMs: event.sourceStartMs ?? Math.round(eventIndex * beatMs),
      inferred: !completeTiming,
    };

    if (exact) {
      return {
        ...base,
        position: "under" as const,
        underTokenId: exact.token.id,
        ratio: 0,
      };
    }

    const first = tokenAnchors[0];
    if (onset < first.onset - tolerance) {
      return {
        ...base,
        position: "before" as const,
        afterTokenId: first.token.id,
        ratio: 0,
      };
    }

    const last = tokenAnchors[tokenAnchors.length - 1];
    if (onset > last.onset + tolerance) {
      return {
        ...base,
        position: "after" as const,
        beforeTokenId: last.token.id,
        ratio: 1,
      };
    }

    const nextIndex = tokenAnchors.findIndex((anchor) => anchor.onset > onset);
    const before = tokenAnchors[Math.max(0, nextIndex - 1)];
    const after = tokenAnchors[Math.max(0, nextIndex)];
    const span = after.onset - before.onset;
    return {
      ...base,
      position: "between" as const,
      beforeTokenId: before.token.id,
      afterTokenId: after.token.id,
      ratio: span > 0 ? clampRatio((onset - before.onset) / span) : 0.5,
    };
  });
}
