import { describe, expect, it } from "vitest";

import type { SongPackage } from "./song";
import { createPlayerState, pressKey, releaseKey, startPlayer } from "./player-machine";

const duet: SongPackage = {
  id: "duet",
  title: "Duet",
  artist: "Test",
  version: "Test",
  searchAliases: [],
  lyricLanguage: "en",
  durationLabel: "00:02",
  recommendedPiano: "concert",
  quality: "clear",
  provenance: ["test"],
  phrases: [{ id: "line", text: "Now", startEvent: 0, endEvent: 1 }],
  events: [
    {
      id: "together", phraseIndex: 0, tokenIndex: 0, token: "Now",
      targetCode: "KeyN", notes: ["C4"], note: "C4", velocity: 82, kind: "hold",
      confidence: 1, provenance: ["test"],
      parts: [
        { hand: "right", targetCode: "KeyN", notes: ["C4"] },
        { hand: "left", targetCode: "Space", notes: ["C2", "G2", "C3"] },
      ],
    },
    {
      id: "instrumental", phraseIndex: 0, tokenIndex: null, token: null,
      targetCode: "Shift", notes: ["D4"], note: "D4", velocity: 82, kind: "hold",
      confidence: 1, provenance: ["test"],
      parts: [{ hand: "right", targetCode: "Shift", notes: ["D4"] }],
    },
  ],
};

describe("two-hand player", () => {
  it("accepts coordinated hands in either order and advances only after both", () => {
    const state = startPlayer(createPlayerState(duet));
    const left = pressKey(state, duet, "Space", 100);
    expect(left.sound?.notes).toEqual(["C2", "G2", "C3"]);
    expect(left.state.eventIndex).toBe(0);
    expect(left.partStarted).toBe("Space");
    expect(left.eventCompleted).toBe(false);

    const right = pressKey(left.state, duet, "KeyN", 120);
    expect(right.sound?.notes).toEqual(["C4"]);
    expect(right.state.eventIndex).toBe(1);
    expect(right.eventCompleted).toBe(true);
    expect(right.fusion).toBe("fused");
  });

  it("classifies either hand as the first attack and uses a 120ms fusion window", () => {
    const rightFirst = pressKey(startPlayer(createPlayerState(duet)), duet, "KeyN", 100);
    expect(rightFirst.fusion).toBe("first");
    expect(pressKey(rightFirst.state, duet, "Space", 220).fusion).toBe("fused");

    const leftFirst = pressKey(startPlayer(createPlayerState(duet)), duet, "Space", 100);
    expect(leftFirst.fusion).toBe("first");
    expect(pressKey(leftFirst.state, duet, "KeyN", 221).fusion).toBe("late");
  });

  it("clears pending fusion state when an event advances or playback resets", () => {
    let state = pressKey(startPlayer(createPlayerState(duet)), duet, "KeyN", 100).state;
    expect(state.pendingEventInput).toMatchObject({ eventIndex: 0, startedAt: 100, firstCode: "KeyN" });
    state = pressKey(state, duet, "Space", 130).state;
    expect(state.pendingEventInput).toBeUndefined();
  });

  it("does not consume the same coordinated part twice", () => {
    const first = pressKey(startPlayer(createPlayerState(duet)), duet, "KeyN", 100);
    expect(pressKey(first.state, duet, "KeyN", 110).state.eventIndex).toBe(0);
    expect(pressKey(first.state, duet, "KeyN", 110).sound).toBeNull();
  });

  it("accepts either physical Shift key and rejects Digit2 as the instrumental action", () => {
    let state = startPlayer(createPlayerState(duet));
    state = pressKey(state, duet, "KeyN").state;
    state = pressKey(state, duet, "Space").state;
    expect(pressKey(state, duet, "Digit2").sound).toBeNull();
    state = pressKey(state, duet, "ShiftRight").state;
    expect(state.eventIndex).toBe(2);
    state = releaseKey(state, duet, "ShiftRight").state;
    expect(state.activeHolds).toEqual(expect.not.objectContaining({ ShiftRight: expect.anything() }));
  });
});
