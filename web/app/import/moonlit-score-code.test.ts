import { describe, expect, it } from "vitest";

import { MoonlitScoreCodeError, compileMoonlitScoreCode } from "./moonlit-score-code";

const chineseCode = `MOONLIT-SCORE/1
title: 花海
artist: 周杰伦
key: F
meter: 4/4
tempo: 72
voice: felt

line: 静止
notes: 1:1{静} 0:.5 ^1+3+5:2{止}`;

describe("compileMoonlitScoreCode", () => {
  it("compiles one grouped lyric token into its initial followed by Space continuations", () => {
    const record = compileMoonlitScoreCode(`MOONLIT-SCORE/1
title: Melisma
artist: Moonlit
key: C
meter: 4/4
tempo: 72
voice: felt

line: 爱
notes: [3:.5 4:.5 5:1]{爱}`);

    expect(record.song.lyricTokens).toEqual([expect.objectContaining({
      text: "爱",
      startEvent: 0,
      endEvent: 2,
    })]);
    expect(record.song.events.map((event) => event.targetCode)).toEqual(["KeyA", "Space", "Space"]);
    expect(record.song.events.map((event) => event.notes[0])).toEqual(["E4", "F4", "G4"]);
  });

  it("keeps the old repeated-note syntax compatible while normalizing its lyric ownership", () => {
    const record = compileMoonlitScoreCode(`MOONLIT-SCORE/1
title: Legacy Melisma
artist: Moonlit
key: C
meter: 4/4
tempo: 72
voice: felt

line: 爱
notes: 3:.5{爱} 4:.5{爱} 5:1{爱}`);

    expect(record.song.events.map((event) => event.targetCode)).toEqual(["KeyA", "Space", "Space"]);
  });

  it("compiles Chinese initials, rests, octave marks, and one-key chords", () => {
    const record = compileMoonlitScoreCode(chineseCode, {
      now: "2026-08-12T12:00:00.000Z",
    });

    expect(record.metadata).toEqual({
      title: "花海",
      artist: "周杰伦",
      durationMs: 2917,
      language: "zh-CN",
    });
    expect(record.song).toMatchObject({
      title: "花海",
      artist: "周杰伦",
      tempoBpm: 72,
      recommendedPiano: "warm",
      lyricLanguage: "zh-CN",
      quality: "clear",
    });
    expect(record.song.events.map((event) => event.targetCode)).toEqual(["KeyJ", "KeyZ"]);
    expect(record.song.events[0]).toMatchObject({ notes: ["F4"], holdMs: 833, token: "静" });
    expect(record.song.events[1]).toMatchObject({
      notes: ["F5", "A4", "C5"],
      holdMs: 1667,
      restBeforeMs: 417,
      token: "止",
    });
    expect(record.song.phrases[0]).toMatchObject({ text: "静止", startEvent: 0, endEvent: 1 });
  });

  it("maps each English lyric word to its own initial and preserves short tap durations", () => {
    const record = compileMoonlitScoreCode(`MOONLIT-SCORE/1
title: Stay
artist: Moonlit
key: C
meter: 4/4
tempo: 120
voice: studio

line: You are mine
notes: 1:.25{You} 2:.25{are} 3:.25{mine}`);

    expect(record.song.lyricLanguage).toBe("en");
    expect(record.song.recommendedPiano).toBe("bright");
    expect(record.song.events.map((event) => event.targetCode)).toEqual(["KeyY", "KeyA", "KeyM"]);
    expect(record.song.events.every((event) => event.kind === "tap")).toBe(true);
  });

  it("uses the repeating 1 through 0 route for lyric-free notes", () => {
    const notes = Array.from({ length: 11 }, (_, index) => `${index % 7 + 1}:1`).join(" ");
    const record = compileMoonlitScoreCode(`MOONLIT-SCORE/1
title: Interlude
artist: Moonlit
key: C
meter: 4/4
tempo: 72
voice: concert

line: Instrumental
notes: ${notes}`);

    expect(record.song.events.map((event) => event.targetCode)).toEqual([
      "Digit1", "Digit2", "Digit3", "Digit4", "Digit5",
      "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Digit1",
    ]);
  });

  it("compacts phrase indexes around leading and middle rest-only rows", () => {
    const record = compileMoonlitScoreCode(`MOONLIT-SCORE/1
title: Rested Interlude
artist: Moonlit
key: C
meter: 4/4
tempo: 60
voice: upright

line: Opening rest
notes: 0:1
line: First sound
notes: 1:1
line: Middle rest
notes: 0:.5
line: Second sound
notes: 2:1`);

    expect(record.song.events.map((event) => event.phraseIndex)).toEqual([0, 1]);
    expect(record.song.phrases.map((phrase) => [phrase.startEvent, phrase.endEvent])).toEqual([
      [0, 0],
      [1, 1],
    ]);
    expect(record.song.events.map((event) => event.restBeforeMs)).toEqual([1_000, 500]);
  });

  it("rejects an all-rest score instead of creating an empty package", () => {
    expect(() => compileMoonlitScoreCode(`MOONLIT-SCORE/1
title: Silence
artist: Moonlit
key: C
meter: 4/4
tempo: 60
voice: felt

line: Rest
notes: 0:4`)).toThrow("only rests");
  });

  it("creates a deterministic identity from normalized code", () => {
    const first = compileMoonlitScoreCode(chineseCode, { now: "2026-08-12T12:00:00.000Z" });
    const second = compileMoonlitScoreCode(`${chineseCode}\n`, { now: "2026-08-12T13:00:00.000Z" });

    expect(second.id).toBe(first.id);
    expect(second.checksum).toBe(first.checksum);
  });

  it.each([
    ["unknown version", "MOONLIT-SCORE/2\ntitle: A", 1],
    ["missing header", "MOONLIT-SCORE/1\ntitle: A", 2],
    ["invalid note", `MOONLIT-SCORE/1\ntitle: A\nartist: B\nkey: C\nmeter: 4/4\ntempo: 72\nvoice: felt\nline: A\nnotes: 8:1{A}`, 9],
    ["script text", `MOONLIT-SCORE/1\ntitle: A\nartist: B\nkey: C\nmeter: 4/4\ntempo: 72\nvoice: felt\n<script>alert(1)</script>`, 8],
  ])("rejects %s with an actionable line number", (_name, source, line) => {
    expect(() => compileMoonlitScoreCode(source)).toThrow(MoonlitScoreCodeError);
    try {
      compileMoonlitScoreCode(source);
    } catch (reason) {
      expect(reason).toMatchObject({ line });
    }
  });
});
