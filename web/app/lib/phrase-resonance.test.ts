import { describe, expect, it } from "vitest";
import type { PianoKeyHandle } from "../audio/piano-engine";
import type { SongEvent } from "./song";
import {
  clearResonance,
  createPhraseResonanceState,
  deferVoice,
  expireVoice,
  MAX_RESONANT_GESTURES,
  prepareAttack,
} from "./phrase-resonance";

function handle(id: number, notes = [`C${id + 3}`]): PianoKeyHandle {
  return { id, voice: "warm", notes, channelHandle: { release() {} } };
}

function event(overrides: Partial<SongEvent> = {}): SongEvent {
  return {
    id: "event", phraseIndex: 0, tokenIndex: 0, token: "你",
    targetCode: "KeyN", notes: ["C4"], note: "C4", velocity: 80,
    kind: "tap", confidence: 1, provenance: [], ...overrides,
  };
}

describe("phrase resonance", () => {
  it("keeps only four deferred gestures and releases the oldest", () => {
    let state = createPhraseResonanceState();
    const released: PianoKeyHandle[] = [];
    for (let id = 1; id <= MAX_RESONANT_GESTURES + 1; id += 1) {
      const transition = deferVoice(state, {
        id, handle: handle(id), phraseIndex: 0, notes: [`C${id + 3}`], releasedAt: id,
      });
      state = transition.state;
      released.push(...transition.release);
    }
    expect(state.voices.map((voice) => voice.id)).toEqual([2, 3, 4, 5]);
    expect(released.map((voice) => voice.id)).toEqual([1]);
  });

  it("expires exactly one source and clear returns every remaining handle", () => {
    const first = deferVoice(createPhraseResonanceState(), {
      id: 1, handle: handle(1), phraseIndex: 0, notes: ["C4"], releasedAt: 10,
    }).state;
    const second = deferVoice(first, {
      id: 2, handle: handle(2), phraseIndex: 0, notes: ["D4"], releasedAt: 20,
    }).state;
    const expired = expireVoice(second, 1);
    expect(expired.release.map((voice) => voice.id)).toEqual([1]);
    expect(clearResonance(expired.state).release.map((voice) => voice.id)).toEqual([2]);
  });

  it("releases an older phrase and every voice before a printed rest", () => {
    const state = {
      voices: [
        { id: 1, handle: handle(1), phraseIndex: 0, notes: ["C4"], releasedAt: 10 },
        { id: 2, handle: handle(2), phraseIndex: 0, notes: ["D4"], releasedAt: 20 },
      ],
    };
    expect(prepareAttack(state, event({ phraseIndex: 1 })).release.map((item) => item.id)).toEqual([1, 2]);
    expect(prepareAttack(state, event({ restBeforeMs: 250 })).release.map((item) => item.id)).toEqual([1, 2]);
  });

  it("releases only voices sharing a pitch with the new gesture", () => {
    const state = {
      voices: [
        { id: 1, handle: handle(1), phraseIndex: 0, notes: ["C4", "E4"], releasedAt: 10 },
        { id: 2, handle: handle(2), phraseIndex: 0, notes: ["D4"], releasedAt: 20 },
      ],
    };
    const transition = prepareAttack(state, event({ notes: ["E4", "G4"] }));
    expect(transition.release.map((item) => item.id)).toEqual([1]);
    expect(transition.state.voices.map((voice) => voice.id)).toEqual([2]);
  });
});
