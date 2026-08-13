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
  it("starts and advances a guided note on keydown while keyup only clears its hold", () => {
    const started = startPlayer(createPlayerState(song));
    const result = pressKey(started, song, song.events[0].targetCode, 100);

    expect(result.sound).toEqual({
      notes: song.events[0].notes,
      velocity: song.events[0].velocity,
      kind: "correct",
    });
    expect(result.state.eventIndex).toBe(1);
    expect(result.state.activeHolds[song.events[0].targetCode]).toMatchObject({
      eventIndex: 0,
      code: song.events[0].targetCode,
      startedAt: 100,
    });

    const released = releaseKey(result.state, song, song.events[0].targetCode, 120);
    expect(released.state.eventIndex).toBe(1);
    expect(released.state.correctCount).toBe(1);
    expect(released.state.activeHolds).toEqual({});
  });

  it("opens H while N is still held and releasing N cannot affect H", () => {
    const twoNoteSong = { ...song, events: song.events.slice(0, 2) };
    const afterN = pressKey(startPlayer(createPlayerState(twoNoteSong)), twoNoteSong, "KeyN", 100).state;
    const afterH = pressKey(afterN, twoNoteSong, "KeyH", 140).state;

    expect(afterH.eventIndex).toBe(2);
    expect(afterH.status).toBe("ringing");
    expect(Object.keys(afterH.activeHolds)).toEqual(["KeyN", "KeyH"]);

    const releasedN = releaseKey(afterH, twoNoteSong, "KeyN", 200).state;
    expect(releasedN.eventIndex).toBe(2);
    expect(releasedN.activeHolds.KeyN).toBeUndefined();
    expect(releasedN.activeHolds.KeyH).toMatchObject({ eventIndex: 1 });
  });

  it("requires A then two fresh Space presses for one three-note lyric token", () => {
    const melisma = {
      ...song,
      phrases: [{ id: "melisma", text: "爱", startEvent: 0, endEvent: 2 }],
      events: [
        { ...song.events[0], id: "a-0", token: "爱", targetCode: "KeyA" },
        { ...song.events[0], id: "a-1", token: "爱", targetCode: "Space" },
        { ...song.events[0], id: "a-2", token: "爱", targetCode: "Space" },
      ],
    };
    let state = pressKey(startPlayer(createPlayerState(melisma)), melisma, "KeyA").state;
    expect(state.eventIndex).toBe(1);
    state = pressKey(state, melisma, "Space").state;
    expect(state.eventIndex).toBe(2);
    expect(pressKey(state, melisma, "Space").state.eventIndex).toBe(2);
    state = releaseKey(state, melisma, "Space").state;
    state = pressKey(state, melisma, "Space").state;
    expect(state.eventIndex).toBe(3);
  });

  it("requires three fresh A presses for three real repeated lyric characters", () => {
    const repeated = {
      ...song,
      phrases: [{ id: "repeated", text: "爱爱爱", startEvent: 0, endEvent: 2 }],
      events: [0, 1, 2].map((index) => ({
        ...song.events[0], id: `a-${index}`, token: "爱", targetCode: "KeyA",
      })),
    };
    let state = startPlayer(createPlayerState(repeated));
    state = pressKey(state, repeated, "KeyA").state;
    expect(pressKey(state, repeated, "KeyA").state.eventIndex).toBe(1);
    state = releaseKey(state, repeated, "KeyA").state;
    state = pressKey(state, repeated, "KeyA").state;
    state = releaseKey(state, repeated, "KeyA").state;
    state = pressKey(state, repeated, "KeyA").state;
    expect(state.eventIndex).toBe(3);
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

  it("rings after every target key has been pressed and released, then completes explicitly", () => {
    let state = startPlayer(createPlayerState(song));
    for (const event of song.events) {
      state = pressKey(state, song, event.targetCode).state;
      state = releaseKey(state, song, event.targetCode).state;
    }
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
    expect(releaseKey(result.state, chordSong, "KeyA", 101).state.status).toBe("ringing");
  });

  it("uses the printed duration as guidance and never judges an early release", () => {
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
    expect(earlyAttack.eventIndex).toBe(1);
    expect(earlyAttack.activeHolds.KeyA).toMatchObject({ eventIndex: 0, code: "KeyA", startedAt: 100 });
    const earlyRelease = releaseKey(earlyAttack, holdSong, "KeyA", 220);
    expect(earlyRelease.state.eventIndex).toBe(1);
    expect(earlyRelease.state.status).toBe("ringing");
    expect(earlyRelease.holdResult).toBe("complete");
  });
});
