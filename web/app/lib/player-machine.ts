import { defaultNoteFor, isPlayableCode } from "./keyboard";
import type { SongPackage } from "./song";

export interface Mistake {
  eventIndex: number;
  token: string;
  pressedCode: string;
  expectedCode: string;
}

export interface PlayerState {
  status: "ready" | "playing" | "paused" | "complete";
  eventIndex: number;
  correctCount: number;
  mistakes: Mistake[];
}

export interface PianoSound {
  note: string;
  velocity: number;
  kind: "correct" | "wrong" | "free";
}

export interface KeyResult {
  state: PlayerState;
  sound: PianoSound | null;
}

export function createPlayerState(_song: SongPackage): PlayerState {
  return { status: "ready", eventIndex: 0, correctCount: 0, mistakes: [] };
}

export function startPlayer(state: PlayerState): PlayerState {
  return state.status === "ready" ? { ...state, status: "playing" } : state;
}

export function togglePause(state: PlayerState): PlayerState {
  if (state.status === "playing") return { ...state, status: "paused" };
  if (state.status === "paused") return { ...state, status: "playing" };
  return state;
}

export function restartPlayer(_state: PlayerState): PlayerState {
  return { status: "ready", eventIndex: 0, correctCount: 0, mistakes: [] };
}

export function rewindPhrase(state: PlayerState, song: SongPackage): PlayerState {
  const lookupIndex = Math.min(state.eventIndex, song.events.length - 1);
  const phraseIndex = song.events[lookupIndex]?.phraseIndex ?? 0;
  const startEvent = song.phrases[phraseIndex]?.startEvent ?? 0;
  return {
    ...state,
    status: "playing",
    eventIndex: startEvent,
    correctCount: startEvent,
    mistakes: state.mistakes.filter((mistake) => mistake.eventIndex < startEvent),
  };
}

export function pressKey(state: PlayerState, song: SongPackage, code: string): KeyResult {
  if (!isPlayableCode(code) || state.status === "complete") return { state, sound: null };

  if (state.status !== "playing") {
    return {
      state,
      sound: { note: defaultNoteFor(code), velocity: 78, kind: "free" },
    };
  }

  const currentEvent = song.events[state.eventIndex];
  if (!currentEvent) return { state: { ...state, status: "complete" }, sound: null };

  if (code !== currentEvent.targetCode) {
    return {
      state: {
        ...state,
        mistakes: [
          ...state.mistakes,
          {
            eventIndex: state.eventIndex,
            token: currentEvent.token,
            pressedCode: code,
            expectedCode: currentEvent.targetCode,
          },
        ],
      },
      sound: { note: defaultNoteFor(code), velocity: 82, kind: "wrong" },
    };
  }

  const nextEventIndex = state.eventIndex + 1;
  return {
    state: {
      ...state,
      eventIndex: nextEventIndex,
      correctCount: state.correctCount + 1,
      status: nextEventIndex === song.events.length ? "complete" : "playing",
    },
    sound: { note: currentEvent.note, velocity: currentEvent.velocity, kind: "correct" },
  };
}
