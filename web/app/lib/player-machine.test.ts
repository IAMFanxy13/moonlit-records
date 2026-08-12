import { describe, expect, it } from "vitest";
import { defaultNoteFor } from "./keyboard";
import {
  createPlayerState,
  finishRinging,
  pressKey,
  releaseKey,
  rewindPhrase,
  restartPlayer,
  startPlayer,
  togglePause,
} from "./player-machine";
import { builtinSongs } from "./songs";

const song = builtinSongs[0];

describe("player machine", () => {
  it("plays the song note and advances exactly one event for the target key", () => {
    const started = startPlayer(createPlayerState(song));
    const result = pressKey(started, song, song.events[0].targetCode);

    expect(result.sound).toEqual({
      notes: song.events[0].notes,
      velocity: song.events[0].velocity,
      kind: "correct",
    });
    expect(result.state.eventIndex).toBe(1);
    expect(result.state.correctCount).toBe(1);
  });

  it("plays a wrong key's default note but keeps waiting for the same target", () => {
    const started = startPlayer(createPlayerState(song));
    const wrongCode = "KeyZ";
    const result = pressKey(started, song, wrongCode);

    expect(result.sound).toEqual({
      notes: [defaultNoteFor(wrongCode)],
      velocity: 92,
      kind: "wrong",
    });
    expect(result.state.eventIndex).toBe(0);
    expect(result.state.mistakes).toEqual([
      {
        eventIndex: 0,
        token: "你",
        pressedCode: "KeyZ",
        expectedCode: "KeyN",
      },
    ]);
  });

  it("does not consume events while paused or for a reserved key", () => {
    const paused = togglePause(startPlayer(createPlayerState(song)));
    expect(pressKey(paused, song, "KeyN").state.eventIndex).toBe(0);
    const resumed = togglePause(paused);
    expect(pressKey(resumed, song, "Escape").state.eventIndex).toBe(0);
  });

  it("restarts with clean statistics", () => {
    const wrong = pressKey(startPlayer(createPlayerState(song)), song, "KeyZ").state;
    expect(restartPlayer(wrong)).toEqual(createPlayerState(song));
  });

  it("rewinds to the first event of the current phrase", () => {
    const state = {
      ...startPlayer(createPlayerState(song)),
      eventIndex: song.phrases[1].startEvent + 1,
      correctCount: song.phrases[1].startEvent + 1,
    };
    const rewound = rewindPhrase(state, song);
    expect(rewound.eventIndex).toBe(song.phrases[1].startEvent);
    expect(rewound.correctCount).toBe(song.phrases[1].startEvent);
  });

  it("rings after every target key has been pressed, then completes explicitly", () => {
    let state = startPlayer(createPlayerState(song));
    for (const event of song.events) state = pressKey(state, song, event.targetCode).state;
    expect(state.status).toBe("ringing");
    expect(state.eventIndex).toBe(song.events.length);

    const encore = pressKey(state, song, "KeyQ");
    expect(encore.sound?.kind).toBe("free");
    expect(encore.state).toBe(state);
    expect(finishRinging(state).status).toBe("complete");
  });

  it("emits a whole piano voicing from one correct physical key", () => {
    const chordSong = {
      ...song,
      phrases: [{ id: "chord", text: "爱", startEvent: 0, endEvent: 0 }],
      events: [{ ...song.events[0], targetCode: "KeyA", notes: ["C4", "E4", "G4"], note: "C4" }],
    };

    const result = pressKey(startPlayer(createPlayerState(chordSong)), chordSong, "KeyA", 100);
    expect(result.sound?.notes).toEqual(["C4", "E4", "G4"]);
    expect(result.state.status).toBe("ringing");
  });

  it("advances a held lyric only after a long-enough matching release", () => {
    const holdSong = {
      ...song,
      phrases: [{ id: "hold", text: "爱", startEvent: 0, endEvent: 0 }],
      events: [{
        ...song.events[0],
        targetCode: "KeyA",
        token: "爱",
        kind: "hold" as const,
        holdMs: 800,
      }],
    };
    const started = startPlayer(createPlayerState(holdSong));

    const earlyAttack = pressKey(started, holdSong, "KeyA", 100).state;
    expect(earlyAttack.eventIndex).toBe(0);
    expect(earlyAttack.activeHold).toMatchObject({ eventIndex: 0, code: "KeyA", startedAt: 100 });
    const earlyRelease = releaseKey(earlyAttack, holdSong, "KeyA", 220);
    expect(earlyRelease.state.eventIndex).toBe(0);
    expect(earlyRelease.holdResult).toBe("early");

    const fullAttack = pressKey(earlyRelease.state, holdSong, "KeyA", 300).state;
    const fullRelease = releaseKey(fullAttack, holdSong, "KeyA", 1200);
    expect(fullRelease.state.eventIndex).toBe(1);
    expect(fullRelease.state.status).toBe("ringing");
    expect(fullRelease.holdResult).toBe("complete");
  });
});
