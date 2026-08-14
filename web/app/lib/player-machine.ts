import { canonicalPerformanceCode, defaultNoteFor, eventInputCodes, isPerformanceInputCode, isPlayableCode } from "./keyboard";
import type { SongEventPart, SongPackage } from "./song";

export interface Mistake {
  eventIndex: number;
  token: string | null;
  pressedCode: string;
  expectedCode: string;
}

export interface PlayerState {
  status: "ready" | "playing" | "paused" | "ringing" | "complete";
  eventIndex: number;
  correctCount: number;
  mistakes: Mistake[];
  activeHolds: Record<string, {
    eventIndex: number;
    code: string;
    startedAt: number;
  }>;
  completedPartCodes?: string[];
  pendingEventInput?: {
    eventIndex: number;
    startedAt: number;
    firstCode: string;
  };
}

export interface PianoSound {
  notes: string[];
  velocity: number;
  kind: "correct" | "wrong" | "free";
}

export interface KeyResult {
  state: PlayerState;
  sound: PianoSound | null;
  partStarted?: string;
  firstPart?: boolean;
  eventCompleted?: boolean;
  gesture?: SongEventPart;
  fusion?: "first" | "fused" | "late";
}

export const TWO_HAND_FUSION_WINDOW_MS = 120;

export function createPlayerState(song: SongPackage): PlayerState {
  return {
    status: song.events.length === 0 ? "complete" : "ready",
    eventIndex: 0,
    correctCount: 0,
    mistakes: [],
    activeHolds: {},
    completedPartCodes: [],
    pendingEventInput: undefined,
  };
}

export function startPlayer(state: PlayerState): PlayerState {
  return state.status === "ready" ? { ...state, status: "playing" } : state;
}

export function togglePause(state: PlayerState): PlayerState {
  if (state.status === "playing") return { ...state, status: "paused", activeHolds: {}, completedPartCodes: [], pendingEventInput: undefined };
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
    activeHolds: {},
    completedPartCodes: [],
    pendingEventInput: undefined,
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
    activeHolds: {},
    completedPartCodes: [],
    pendingEventInput: undefined,
  };
}

export function seekPlayerToPhrase(
  state: PlayerState,
  song: SongPackage,
  requestedPhraseIndex: number,
): PlayerState {
  if (song.events.length === 0 || song.phrases.length === 0) {
    return { ...state, status: "complete", eventIndex: 0, correctCount: 0, activeHolds: {}, completedPartCodes: [], pendingEventInput: undefined };
  }
  const phraseIndex = Math.min(
    song.phrases.length - 1,
    Math.max(0, Math.round(requestedPhraseIndex)),
  );
  const phrase = song.phrases[phraseIndex];
  let startEvent = phrase.startEvent;
  for (let index = phrase.startEvent; index <= phrase.endEvent; index += 1) {
    if (isPerformanceInputCode(song.events[index]?.targetCode ?? "")) {
      startEvent = index;
      break;
    }
  }
  return {
    ...state,
    status: state.status === "paused" ? "paused" : "playing",
    eventIndex: startEvent,
    correctCount: startEvent,
    mistakes: state.mistakes.filter((mistake) => mistake.eventIndex < startEvent),
    activeHolds: {},
    completedPartCodes: [],
    pendingEventInput: undefined,
  };
}

function advance(state: PlayerState, song: SongPackage): PlayerState {
  const nextEventIndex = state.eventIndex + 1;
  return {
    ...state,
    eventIndex: nextEventIndex,
    correctCount: state.correctCount + 1,
    status: nextEventIndex === song.events.length ? "ringing" : "playing",
    completedPartCodes: [],
    pendingEventInput: undefined,
  };
}

function partsForEvent(song: SongPackage, eventIndex: number): SongEventPart[] {
  const event = song.events[eventIndex];
  if (!event) return [];
  return event.parts?.length
    ? event.parts
    : [{ hand: event.targetCode === "Space" ? "left" : "right", targetCode: event.targetCode, notes: event.notes }];
}

export function pressKey(
  state: PlayerState,
  song: SongPackage,
  code: string,
  now = Date.now(),
): KeyResult {
  if (!isPerformanceInputCode(code) || state.status === "complete") return { state, sound: null };
  const canonicalCode = canonicalPerformanceCode(code);

  if (state.status !== "playing") {
    return {
      state,
      sound: isPlayableCode(canonicalCode)
        ? { notes: [defaultNoteFor(canonicalCode)], velocity: 78, kind: "free" }
        : null,
    };
  }

  const currentEvent = song.events[state.eventIndex];
  if (!currentEvent) return { state: { ...state, status: "complete" }, sound: null };

  const parts = partsForEvent(song, state.eventIndex);
  const part = parts.find((candidate) => canonicalPerformanceCode(candidate.targetCode) === canonicalCode);
  if (!part) {
    if (!isPlayableCode(canonicalCode)) return { state, sound: null };
    return {
      state: {
        ...state,
        mistakes: [
          ...state.mistakes,
          {
            eventIndex: state.eventIndex,
            token: currentEvent.token,
            pressedCode: canonicalCode,
            expectedCode: eventInputCodes(currentEvent).join("+"),
          },
        ],
      },
      sound: { notes: [defaultNoteFor(canonicalCode)], velocity: currentEvent.velocity, kind: "wrong" },
    };
  }

  const alreadyCompleted = state.completedPartCodes ?? [];
  if (state.activeHolds[code] || alreadyCompleted.includes(canonicalCode)) {
    return { state, sound: null };
  }
  const firstPart = alreadyCompleted.length === 0;
  const pendingEventInput = firstPart
    ? { eventIndex: state.eventIndex, startedAt: now, firstCode: canonicalCode }
    : state.pendingEventInput;
  const fusion = firstPart
    ? "first" as const
    : pendingEventInput && now - pendingEventInput.startedAt <= TWO_HAND_FUSION_WINDOW_MS
      ? "fused" as const
      : "late" as const;
  const completedPartCodes = [...alreadyCompleted, canonicalCode];
  const withHold: PlayerState = {
    ...state,
    activeHolds: {
      ...state.activeHolds,
      [code]: { eventIndex: state.eventIndex, code, startedAt: now },
    },
    completedPartCodes,
    pendingEventInput,
  };
  const eventCompleted = parts.every((candidate) => completedPartCodes.includes(
    canonicalPerformanceCode(candidate.targetCode),
  ));
  return {
    state: eventCompleted ? advance(withHold, song) : withHold,
    sound: {
      notes: part.notes,
      velocity: part.velocity ?? currentEvent.velocity,
      kind: "correct",
    },
    partStarted: canonicalCode,
    firstPart,
    eventCompleted,
    gesture: part,
    fusion,
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
  void now;
  void song;
  const hold = state.activeHolds[code];
  if (!hold) {
    return { state, holdResult: null };
  }

  const activeHolds = { ...state.activeHolds };
  delete activeHolds[code];
  return { state: { ...state, activeHolds }, holdResult: "complete" };
}
