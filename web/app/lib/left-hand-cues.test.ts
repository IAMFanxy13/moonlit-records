import { describe, expect, it } from "vitest";

import type { SongEvent, SongPackage } from "./song";
import { buildLeftHandCues, projectLeftHandCuePercent } from "./left-hand-cues";

function scoreEvent(
  id: string,
  sourceStartMs: number | undefined,
  token: string | null,
  parts: SongEvent["parts"],
): SongEvent {
  const primary = parts?.[0];
  return {
    id,
    phraseIndex: 0,
    tokenIndex: token ? 0 : null,
    token,
    targetCode: primary?.targetCode ?? "Space",
    notes: primary?.notes ?? ["C3"],
    parts,
    note: primary?.notes[0] ?? "C3",
    velocity: 80,
    kind: "hold",
    holdMs: 600,
    sourceStartMs,
    sourceEndMs: sourceStartMs === undefined ? undefined : sourceStartMs + 600,
    confidence: 1,
    provenance: ["test"],
  };
}

const left = (notes = ["C2", "G2", "C3"]) => ({
  hand: "left" as const,
  targetCode: "Space",
  notes,
});

const right = (targetCode: string, notes = ["C4"]) => ({
  hand: "right" as const,
  targetCode,
  notes,
});

function timedSong(): SongPackage {
  return {
    id: "cue-study",
    title: "Cue Study",
    artist: "Moonlit",
    version: "Test",
    searchAliases: [],
    lyricLanguage: "zh-CN",
    durationLabel: "00:04",
    tempoBpm: 60,
    recommendedPiano: "concert",
    quality: "clear",
    provenance: ["test"],
    phrases: [{ id: "line", text: "你好吗", startEvent: 0, endEvent: 5 }],
    lyricTokens: [
      { id: "you", phraseIndex: 0, tokenIndex: 0, text: "你", startEvent: 1, endEvent: 1 },
      { id: "good", phraseIndex: 0, tokenIndex: 1, text: "好", startEvent: 2, endEvent: 2 },
      { id: "question", phraseIndex: 0, tokenIndex: 2, text: "吗", startEvent: 4, endEvent: 4 },
    ],
    events: [
      scoreEvent("left-before", 0, null, [left()]),
      scoreEvent("you", 500, "你", [right("KeyN")]),
      scoreEvent("good-together", 1_500, "好", [right("KeyH"), left(["G2", "D3", "G3"])]),
      scoreEvent("left-between", 1_750, null, [left(["A2", "E3"])]),
      scoreEvent("question", 2_500, "吗", [right("KeyM")]),
      scoreEvent("left-after", 3_000, null, [left(["C2", "G2"])]),
    ],
  };
}

describe("buildLeftHandCues", () => {
  it("keeps Space at its authored position before, under, between, and after lyrics", () => {
    const cues = buildLeftHandCues(timedSong(), 0);

    expect(cues.map(({ position, ratio }) => ({ position, ratio }))).toEqual([
      { position: "before", ratio: 0 },
      { position: "under", ratio: 0 },
      { position: "between", ratio: 0.25 },
      { position: "after", ratio: 1 },
    ]);
    expect(cues[1]).toMatchObject({ underTokenId: "good", inferred: false });
    expect(cues[2]).toMatchObject({ beforeTokenId: "good", afterTokenId: "question" });
  });

  it("does not round a quarter-beat cue to the nearest lyric token", () => {
    const cue = buildLeftHandCues(timedSong(), 0).find((item) => item.id.includes("left-between"));

    expect(cue?.position).toBe("between");
    expect(cue?.ratio).toBeCloseTo(0.25, 5);
  });

  it("projects a between-lyric cue through measured token centres", () => {
    const cue = buildLeftHandCues(timedSong(), 0).find((item) => item.id.includes("left-between"));
    expect(cue).toBeDefined();

    const percent = projectLeftHandCuePercent(
      cue!,
      new Map([["good", 20], ["question", 80]]),
      ["you", "good", "question"],
    );

    expect(percent).toBe(50);
  });

  it("falls back to stable event order and marks the cue inferred when timing is missing", () => {
    const song = timedSong();
    song.events = song.events.map((event) => ({ ...event, sourceStartMs: undefined, sourceEndMs: undefined }));

    const cues = buildLeftHandCues(song, 0);

    expect(cues).toHaveLength(4);
    expect(cues.every((cue) => cue.inferred)).toBe(true);
    expect(cues[2]).toMatchObject({ position: "between", ratio: 0.5 });
  });
});
