import { describe, expect, it } from "vitest";
import { MoonlitScoreCodeError } from "./moonlit-score-code";
import { compileMoonlitScoreV2 } from "./moonlit-score-v2";

const score = (events: unknown[]) => `MOONLIT-SCORE/2\n${JSON.stringify({
  meta: { title: "Gesture Study", artist: "Moonlit", key: "G", mode: "major", meter: "4/4", tempo: 68, voice: "concert" },
  phrases: [{ text: "爱你", section: "verse", energy: 2, events }],
})}`;

const note = (pitch: string, velocity = 0.72, durationBeats = 1) => ({ pitch, velocity, durationBeats });

describe("MOONLIT-SCORE/2", () => {
  it("compiles independent simultaneous right and left piano gestures", () => {
    const record = compileMoonlitScoreV2(score([{
      beat: 0,
      lyric: { id: "love", text: "爱", subIndex: 0 },
      right: { trigger: "KeyA", notes: [note("B4", 0.55), note("E5", 0.78)], articulation: "legato", harmonyId: "Em7", pedalIntent: "hold", role: "melody-voicing" },
      left: { trigger: "Space", notes: [note("E2", 0.48, 3), note("B2", 0.42, 3)], harmonyId: "Em7", pedalIntent: "hold", role: "left-open-voicing" },
    }, {
      beat: 1,
      lyric: { id: "love", text: "爱", subIndex: 1 },
      right: { trigger: "KeyA", notes: [note("G5")], harmonyId: "Em7", role: "melody" },
    }, {
      beat: 2,
      lyric: { id: "you", text: "你", subIndex: 0 },
      right: { trigger: "KeyN", notes: [note("A5")], harmonyId: "C", role: "melody" },
    }]));

    expect(record.song.version).toBe("Moonlit Score 2");
    expect(record.song.events[0].parts).toHaveLength(2);
    expect(record.song.events[0].parts?.[0]).toMatchObject({ hand: "right", targetCode: "KeyA", notes: ["B4", "E5"], velocities: [0.55, 0.78] });
    expect(record.song.events[0].parts?.[1]).toMatchObject({ hand: "left", targetCode: "Space", notes: ["E2", "B2"], durationsMs: expect.any(Array) });
    expect(record.song.events.map((event) => event.targetCode)).toEqual(["KeyA", "KeyA", "KeyN"]);
    expect(record.song.lyricTokens?.map((token) => [token.text, token.startEvent, token.endEvent])).toEqual([["爱", 0, 1], ["你", 2, 2]]);
  });

  it("rejects Digit1 for the first gesture of a lyric token", () => {
    expect(() => compileMoonlitScoreV2(score([{
      beat: 0,
      lyric: { id: "love", text: "爱", subIndex: 0 },
      right: { trigger: "Digit1", notes: [note("E5")] },
    }]))).toThrow(MoonlitScoreCodeError);
  });

  it("accepts the repeated lyric initial for a continuation", () => {
    const record = compileMoonlitScoreV2(score([{
      beat: 0,
      lyric: { id: "love", text: "爱", subIndex: 0 },
      right: { trigger: "KeyA", notes: [note("E5")] },
    }, {
      beat: 1,
      lyric: { id: "love", text: "爱", subIndex: 1 },
      right: { trigger: "KeyA", notes: [note("G5")] },
    }]));

    expect(record.song.events.map((event) => event.targetCode)).toEqual(["KeyA", "KeyA"]);
  });

  it("accepts legacy Enter as a score alias and normalizes it to the lyric initial", () => {
    const record = compileMoonlitScoreV2(score([{
      beat: 0,
      lyric: { id: "love", text: "爱", subIndex: 0 },
      right: { trigger: "KeyA", notes: [note("E5")] },
    }, {
      beat: 1,
      lyric: { id: "love", text: "爱", subIndex: 1 },
      right: { trigger: "Enter", notes: [note("G5")] },
    }]));

    expect(record.song.events.map((event) => event.targetCode)).toEqual(["KeyA", "KeyA"]);
  });

  it("keeps an interleaved left-hand Space outside the lyric melisma", () => {
    const record = compileMoonlitScoreV2(score([{
      beat: 0,
      lyric: { id: "love", text: "爱", subIndex: 0 },
      right: { trigger: "KeyA", notes: [note("E5")] },
    }, {
      beat: 0.5,
      left: { trigger: "Space", notes: [note("E2"), note("B2")] },
    }, {
      beat: 1,
      lyric: { id: "love", text: "爱", subIndex: 1 },
      right: { trigger: "Digit1", notes: [note("G5")] },
    }]));

    expect(record.song.events.map((event) => event.targetCode)).toEqual(["KeyA", "Space", "KeyA"]);
    expect(record.song.events.map((event) => event.lyricSubIndex)).toEqual([0, null, 1]);
    expect(record.song.events.map((event) => event.lyricSubCount)).toEqual([2, null, 2]);
  });

  it("validates lyric continuation order independently of multiple interleaved Space events", () => {
    const record = compileMoonlitScoreV2(score([{
      beat: 0,
      lyric: { id: "love", text: "爱", subIndex: 0 },
      right: { trigger: "KeyA", notes: [note("E5")] },
    }, {
      beat: 0.25,
      left: { trigger: "Space", notes: [note("E2")] },
    }, {
      beat: 0.5,
      lyric: { id: "love", text: "爱", subIndex: 1 },
      right: { trigger: "KeyA", notes: [note("F5")] },
    }, {
      beat: 0.75,
      left: { trigger: "Space", notes: [note("B2")] },
    }, {
      beat: 1,
      lyric: { id: "love", text: "爱", subIndex: 2 },
      right: { trigger: "KeyA", notes: [note("G5")] },
    }]));

    expect(record.song.events.map((event) => event.targetCode)).toEqual(["KeyA", "Space", "KeyA", "Space", "KeyA"]);
    expect(record.song.events.map((event) => event.lyricSubIndex)).toEqual([0, null, 1, null, 2]);
    expect(record.song.events.map((event) => event.lyricSubCount)).toEqual([3, null, 3, null, 3]);
  });

  it("never accepts executable script in place of declarative JSON", () => {
    expect(() => compileMoonlitScoreV2("MOONLIT-SCORE/2\n(()=>alert(1))()"))
      .toThrow(/JSON/u);
  });

  it("keeps beat positions monotonic when each phrase restarts at beat zero", () => {
    const source = `MOONLIT-SCORE/2\n${JSON.stringify({
      meta: { title: "Two lines", artist: "Moonlit", key: "C", mode: "major", meter: "4/4", tempo: 60, voice: "felt" },
      phrases: ["Now", "Here"].map((word, index) => ({ text: word, events: [{ beat: 0, lyric: { id: `t${index}`, text: word, subIndex: 0 }, right: { trigger: `Key${word[0]}`, notes: [note(index ? "D4" : "C4")] } }] })),
    })}`;
    const events = compileMoonlitScoreV2(source).song.events;
    expect(events[1].sourceStartMs).toBeGreaterThan(events[0].sourceStartMs ?? -1);
  });
});
