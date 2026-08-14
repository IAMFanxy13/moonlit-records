import { describe, expect, it } from "vitest";

import { builtinSongs } from "./songs";
import { buildLeftHandCues } from "./left-hand-cues";
import { arrangeTwoHandSong } from "./two-hand-arranger";

describe("arrangeTwoHandSong", () => {
  it("adds sparse user-triggered left-hand gestures and is idempotent", () => {
    const arranged = arrangeTwoHandSong(builtinSongs[1]);
    const leftParts = arranged.events.flatMap((event) => event.parts ?? [])
      .filter((part) => part.hand === "left");

    expect(leftParts.length).toBeGreaterThan(0);
    expect(leftParts.length).toBeLessThan(arranged.events.length);
    expect(leftParts.every((part) => part.targetCode === "Space")).toBe(true);
    expect(leftParts.every((part) => part.notes.length >= 2)).toBe(true);
    expect(leftParts.every((part) => part.notes.length <= 4)).toBe(true);
    expect(arrangeTwoHandSong(arranged)).toEqual(arranged);
  });

  it("adds restrained right-hand octave colour while keeping the melody stronger than harmony", () => {
    const arranged = arrangeTwoHandSong(builtinSongs[1]);
    const opening = arranged.events[arranged.phrases[0].startEvent];
    const right = opening.parts?.find((part) => part.hand === "right");
    const left = opening.parts?.find((part) => part.hand === "left");

    expect(right?.notes).toHaveLength(2);
    expect(right?.velocities).toHaveLength(2);
    expect(left?.velocities).toBeDefined();
    expect(Math.max(...right!.velocities!)).toBeGreaterThan(Math.max(...left!.velocities!));
    expect(right?.notes[0]).toBe(opening.note);
  });

  it("preserves an explicitly authored left-hand part", () => {
    const source = structuredClone(builtinSongs[0]);
    source.events[0].parts = [
      { hand: "right", targetCode: source.events[0].targetCode, notes: source.events[0].notes },
      { hand: "left", targetCode: "Space", notes: ["C2", "G2"] },
    ];

    expect(arrangeTwoHandSong(source).events[0].parts?.[1].notes).toEqual(["C2", "G2"]);
  });

  it("does not pretend that every four untimed melody events are a bar", () => {
    const untimed = {
      ...structuredClone(builtinSongs[1]),
      events: builtinSongs[1].events.map((event) => ({
        ...structuredClone(event),
        sourceStartMs: undefined,
        sourceEndMs: undefined,
      })),
    };
    const arranged = arrangeTwoHandSong(untimed);
    const leftEventIndexes = arranged.events.flatMap((event, index) =>
      event.parts?.some((part) => part.hand === "left") ? [index] : []);
    expect(leftEventIndexes).toEqual(arranged.phrases.map((phrase) => phrase.startEvent));
  });

  it("uses sparse before, simultaneous, between, and ending Space positions", () => {
    const arranged = arrangeTwoHandSong(builtinSongs[1]);
    const positions = new Set(arranged.phrases.flatMap((_, phraseIndex) => (
      buildLeftHandCues(arranged, phraseIndex).map((cue) => cue.position)
    )));

    expect(positions).toEqual(new Set(["before", "under", "between", "after"]));
  });

  it("keeps a between-lyrics Space independent from lyric-key gestures in that phrase", () => {
    const arranged = arrangeTwoHandSong(builtinSongs[1]);
    const betweenPhraseIndexes = arranged.phrases.flatMap((_, phraseIndex) => (
      buildLeftHandCues(arranged, phraseIndex).some((cue) => cue.position === "between")
        ? [phraseIndex]
        : []
    ));

    expect(betweenPhraseIndexes.length).toBeGreaterThan(0);
    for (const phraseIndex of betweenPhraseIndexes) {
      const phrase = arranged.phrases[phraseIndex];
      const phraseEvents = arranged.events.slice(phrase.startEvent, phrase.endEvent + 1);
      const combinedInputs = phraseEvents.filter((event) => (
        event.parts?.some((part) => part.hand === "right")
        && event.parts.some((part) => part.hand === "left")
      ));

      expect(combinedInputs).toHaveLength(0);
    }
  });

  it("gives automatically generated standalone Space events a four-note open harmony", () => {
    const arranged = arrangeTwoHandSong(builtinSongs[1]);
    const standaloneLeftParts = arranged.events
      .filter((event) => event.token == null && event.targetCode === "Space")
      .flatMap((event) => event.parts ?? [])
      .filter((part) => part.hand === "left");

    expect(standaloneLeftParts.length).toBeGreaterThan(0);
    standaloneLeftParts.forEach((part) => {
      expect(part.notes).toHaveLength(4);
      expect(new Set(part.notes.map((note) => note.replace(/-?\d+$/u, ""))).size).toBeGreaterThanOrEqual(3);
    });
  });
});
