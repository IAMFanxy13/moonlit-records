import { describe, expect, it } from "vitest";
import { defaultNoteFor } from "./keyboard";
import {
  createPlayerState,
  finishRinging,
  pressKey,
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
      note: song.events[0].note,
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
      note: defaultNoteFor(wrongCode),
      velocity: 82,
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
});
