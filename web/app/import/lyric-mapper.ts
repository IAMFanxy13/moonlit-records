import { pinyin } from "pinyin-pro";

import type { Phrase, SongEvent, SongPackage } from "../lib/song";

const HAN = /\p{Script=Han}/u;

function tokensForLine(line: string, chinese: boolean): string[] {
  return chinese
    ? line.match(/\p{Script=Han}|[A-Za-z]+/gu) ?? []
    : line.match(/[\p{L}\p{N}']+/gu) ?? [];
}

function initialFor(token: string, chinese: boolean): string {
  if (chinese && HAN.test(token)) {
    const initial = pinyin(token, { pattern: "first", toneType: "none", type: "array" })[0];
    return initial?.slice(0, 1).toUpperCase() || "A";
  }
  return token.match(/[A-Za-z]/)?.[0]?.toUpperCase() ?? "A";
}

export function applyLyricsToSketch(sketch: SongPackage, lyrics: string): SongPackage {
  const lines = lyrics.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  const chinese = HAN.test(lyrics);
  const tokenLines = lines.map((line) => tokensForLine(line, chinese));
  const totalTokens = tokenLines.reduce((sum, tokens) => sum + tokens.length, 0);
  if (totalTokens === 0 || sketch.events.length === 0) return sketch;

  const phrases: Phrase[] = [];
  const events: SongEvent[] = [];
  let globalTokenIndex = 0;

  tokenLines.forEach((tokens, phraseIndex) => {
    const startEvent = events.length;
    tokens.forEach((token, tokenIndex) => {
      const sourceIndex = Math.min(
        sketch.events.length - 1,
        Math.floor((globalTokenIndex / Math.max(1, totalTokens - 1)) * (sketch.events.length - 1)),
      );
      const source = sketch.events[sourceIndex];
      events.push({
        ...source,
        id: `${sketch.id}-lyric-${events.length}`,
        phraseIndex,
        tokenIndex,
        token,
        targetCode: `Key${initialFor(token, chinese)}`,
        confidence: Math.min(source.confidence, 0.72),
        provenance: [...source.provenance, "free-online-lyrics"],
      });
      globalTokenIndex += 1;
    });
    if (events.length > startEvent) {
      phrases.push({
        id: `${sketch.id}-phrase-${phraseIndex}`,
        text: lines[phraseIndex],
        startEvent,
        endEvent: events.length - 1,
      });
    }
  });

  return {
    ...sketch,
    lyricLanguage: chinese ? "zh-CN" : "en",
    quality: "usable",
    provenance: [...sketch.provenance, "free-online-lyrics"],
    phrases,
    events,
  };
}
