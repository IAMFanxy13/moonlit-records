import type { LyricToken, Phrase, SongEvent, SongPackage } from "./song";

const LYRIC_UNIT = /\p{Script=Han}|[A-Za-z]+(?:'[A-Za-z]+)?/gu;

interface LocalTokenRange {
  text: string;
  start: number;
  end: number;
}

function alignPhraseUnits(units: string[], events: SongEvent[]): LocalTokenRange[] | null {
  const memo = new Map<string, LocalTokenRange[] | null>();

  const visit = (unitIndex: number, eventIndex: number): LocalTokenRange[] | null => {
    const cacheKey = `${unitIndex}:${eventIndex}`;
    if (memo.has(cacheKey)) return memo.get(cacheKey) ?? null;
    if (unitIndex === units.length) {
      const result = eventIndex === events.length ? [] : null;
      memo.set(cacheKey, result);
      return result;
    }

    const unit = units[unitIndex];
    if (events[eventIndex]?.token !== unit) {
      memo.set(cacheKey, null);
      return null;
    }

    let matching = 0;
    while (events[eventIndex + matching]?.token === unit) matching += 1;
    for (let count = matching; count >= 1; count -= 1) {
      const remainder = visit(unitIndex + 1, eventIndex + count);
      if (remainder) {
        const result = [{ text: unit, start: eventIndex, end: eventIndex + count - 1 }, ...remainder];
        memo.set(cacheKey, result);
        return result;
      }
    }

    memo.set(cacheKey, null);
    return null;
  };

  return visit(0, 0);
}

function fallbackRanges(events: SongEvent[]): LocalTokenRange[] {
  return events.flatMap((event, index) => event.token
    ? [{ text: event.token, start: index, end: index }]
    : []);
}

function tokensForLegacyPhrase(phrase: Phrase, phraseIndex: number, events: SongEvent[]): LyricToken[] {
  if (events.every((event) => event.token == null)) return [];
  const units = phrase.text.match(LYRIC_UNIT) ?? [];
  const localRanges = alignPhraseUnits(units, events) ?? fallbackRanges(events);
  return localRanges.map((range, tokenIndex) => ({
    id: `${phrase.id}-token-${tokenIndex}`,
    phraseIndex,
    tokenIndex,
    text: range.text,
    startEvent: phrase.startEvent + range.start,
    endEvent: phrase.startEvent + range.end,
  }));
}

function deriveLegacyTokens(song: SongPackage, events: SongEvent[]): LyricToken[] {
  return song.phrases.flatMap((phrase, phraseIndex) => tokensForLegacyPhrase(
    phrase,
    phraseIndex,
    events.slice(phrase.startEvent, phrase.endEvent + 1),
  ));
}

export function normalizeSongPackage(song: SongPackage): SongPackage {
  const events = song.events.map((event) => ({ ...event }));
  const sourceTokens = song.lyricTokens?.map((token) => ({ ...token }))
    ?? deriveLegacyTokens(song, events);

  for (const event of events) {
    event.lyricTokenId = null;
    event.lyricSubIndex = null;
    event.lyricSubCount = null;
  }

  const lyricTokens = sourceTokens.map((token) => ({ ...token }));
  for (const token of lyricTokens) {
    const subCount = token.endEvent - token.startEvent + 1;
    for (let eventIndex = token.startEvent; eventIndex <= token.endEvent; eventIndex += 1) {
      const event = events[eventIndex];
      if (!event) continue;
      const subIndex = eventIndex - token.startEvent;
      event.phraseIndex = token.phraseIndex;
      event.tokenIndex = token.tokenIndex;
      event.token = token.text;
      event.lyricTokenId = token.id;
      event.lyricSubIndex = subIndex;
      event.lyricSubCount = subCount;
      if (subIndex > 0) event.targetCode = "Space";
    }
  }

  return {
    ...song,
    phrases: song.phrases.map((phrase) => ({ ...phrase })),
    lyricTokens,
    events,
  };
}
