import { defaultNoteFor, isPlayableCode } from "./keyboard";
import type { SongPackage } from "./song";

export interface Mistake {
  eventIndex: number;
  token: string;
  pressedCode: string;
  expectedCode: string;
}

export interface PlayerState {
  status: "ready" | "playing" | "paused" | "ringing" | "complete";
  eventIndex: number;
  correctCount: number;
  mistakes: Mistake[];
  activeHold: {
    eventIndex: number;
    code: string;
    startedAt: number;
  } | null;
}

export interface PianoSound {
  notes: string[];
  velocity: number;
  kind: "correct" | "wrong" | "free";
}

export interface KeyResult {
  state: PlayerState;
  sound: PianoSound | null;
}

export function createPlayerState(song: SongPackage): PlayerState {
  return {
    status: song.events.length === 0 ? "complete" : "ready",
    eventIndex: 0,
    correctCount: 0,
    mistakes: [],
    activeHold: null,
  };
}

export function startPlayer(state: PlayerState): PlayerState {
  return state.status === "ready" ? { ...state, status: "playing" } : state;
}

export function togglePause(state: PlayerState): PlayerState {
  if (state.status === "playing") return { ...state, status: "paused", activeHold: null };
  if (state.status === "paused") return { ...state, status: "playing" };
  return state;
}

export function restartPlayer(state: PlayerState): PlayerState {
  return {
    ...state,
    status: "ready",
    eventIndex: 0,
    correctCount: 0,
    mistakes: [],
    activeHold: null,
  };
}

export function finishRinging(state: PlayerState): PlayerState {
  return state.status === "ringing" ? { ...state, status: "complete" } : state;
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
    activeHold: null,
  };
}

function advance(state: PlayerState, song: SongPackage): PlayerState {
  const nextEventIndex = state.eventIndex + 1;
  return {
    ...state,
    eventIndex: nextEventIndex,
    correctCount: state.correctCount + 1,
    activeHold: null,
    status: nextEventIndex === song.events.length ? "ringing" : "playing",
  };
}

export function pressKey(
  state: PlayerState,
  song: SongPackage,
  code: string,
  now = Date.now(),
): KeyResult {
  if (!isPlayableCode(code) || state.status === "complete") return { state, sound: null };

  if (state.status !== "playing") {
    return {
      state,
      sound: { notes: [defaultNoteFor(code)], velocity: 78, kind: "free" },
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
      sound: { notes: [defaultNoteFor(code)], velocity: 82, kind: "wrong" },
    };
  }

  if (currentEvent.kind === "hold") {
    if (state.activeHold) return { state, sound: null };
    return {
      state: {
        ...state,
        activeHold: { eventIndex: state.eventIndex, code, startedAt: now },
      },
      sound: { notes: currentEvent.notes, velocity: currentEvent.velocity, kind: "correct" },
    };
  }

  return {
    state: advance(state, song),
    sound: { notes: currentEvent.notes, velocity: currentEvent.velocity, kind: "correct" },
  };
}

export interface ReleaseResult {
  state: PlayerState;
  holdResult: "early" | "complete" | null;
}

export function releaseKey(
  state: PlayerState,
  song: SongPackage,
  code: string,
  now = Date.now(),
): ReleaseResult {
  const hold = state.activeHold;
  if (!hold || hold.code !== code || hold.eventIndex !== state.eventIndex) {
    return { state, holdResult: null };
  }

  const event = song.events[state.eventIndex];
  const minimumHoldMs = Math.max(0, event?.holdMs ?? 0);
  if (now - hold.startedAt < minimumHoldMs) {
    return { state: { ...state, activeHold: null }, holdResult: "early" };
  }

  return { state: advance(state, song), holdResult: "complete" };
}
