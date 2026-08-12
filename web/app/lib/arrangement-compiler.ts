import { instrumentalTarget } from "./instrumental-route";
import type { PianoVoice, SongEvent, SongPackage } from "./song";

export interface LyricEvidence {
  text: string;
  initial?: string;
  notes: string[][];
  kind?: "tap" | "hold";
  holdMs?: number;
  confidence?: number;
  provenance?: string[];
}

export interface InstrumentalEvidence {
  notes: string[];
  durationMs?: number;
  kind?: "tap" | "hold";
  holdMs?: number;
  velocity?: number;
  confidence?: number;
  provenance?: string[];
}

export interface ArrangementInput {
  id: string;
  title: string;
  artist?: string;
  version?: string;
  lyricLanguage: "zh-CN" | "en";
  lyrics: LyricEvidence[];
  instrumental: InstrumentalEvidence[];
  recommendedPiano?: PianoVoice;
}

function targetForLyric(item: LyricEvidence): string | null {
  const candidate = (item.initial ?? item.text).trim().match(/[A-Za-z]/)?.[0];
  return candidate ? `Key${candidate.toUpperCase()}` : null;
}

export function compileArrangement(input: ArrangementInput): SongPackage {
  const events: SongEvent[] = [];
  const lyricText: string[] = [];

  for (const item of input.lyrics) {
    const targetCode = targetForLyric(item);
    if (!targetCode) continue;
    lyricText.push(item.text);
    const tokenIndex = lyricText.length - 1;
    for (const notes of item.notes) {
      const stableNotes = notes.length > 0 ? notes : ["C4"];
      events.push({
        id: `${input.id}-${events.length}`,
        phraseIndex: 0,
        tokenIndex,
        token: item.text,
        targetCode,
        notes: stableNotes,
        note: stableNotes[0],
        velocity: 92,
        kind: item.kind ?? "tap",
        holdMs: item.holdMs,
        confidence: item.confidence ?? 0.75,
        provenance: item.provenance ?? ["arrangement-compiler"],
      });
    }
  }

  const instrumentalPhraseIndex = lyricText.length > 0 ? 1 : 0;
  for (const item of input.instrumental) {
    const stableNotes = item.notes.length > 0 ? item.notes : ["C4"];
    events.push({
      id: `${input.id}-${events.length}`,
      phraseIndex: instrumentalPhraseIndex,
      tokenIndex: null,
      token: null,
      targetCode: instrumentalTarget(events.filter((event) => event.token === null).length),
      notes: stableNotes,
      note: stableNotes[0],
      velocity: item.velocity ?? 88,
      kind: item.kind ?? "tap",
      holdMs: item.kind === "hold" ? item.holdMs ?? item.durationMs : undefined,
      confidence: item.confidence ?? 0.55,
      provenance: item.provenance ?? ["browser-sketch"],
    });
  }

  const lyricEnd = events.findLastIndex((event) => event.token !== null);
  const phrases = [];
  if (lyricEnd >= 0) {
    phrases.push({ id: `${input.id}-lyrics`, text: lyricText.join(" "), startEvent: 0, endEvent: lyricEnd });
  }
  if (events.length > lyricEnd + 1) {
    phrases.push({
      id: `${input.id}-instrumental`,
      text: "Instrumental passage",
      startEvent: lyricEnd + 1,
      endEvent: events.length - 1,
    });
  }

  return {
    id: input.id,
    title: input.title,
    artist: input.artist ?? "Unknown Artist",
    version: input.version ?? "Private Piano Arrangement",
    searchAliases: [],
    lyricLanguage: input.lyricLanguage,
    durationLabel: "--:--",
    recommendedPiano: input.recommendedPiano ?? "warm",
    quality: "usable",
    provenance: ["arrangement-compiler"],
    phrases,
    events,
  };
}
