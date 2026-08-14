import { describe, expect, it } from "vitest";
import type { PianoKeyHandle } from "../audio/piano-engine";
import type { ReleasePlan } from "./piano-performance";
import {
  clearResonance,
  createPhraseResonanceState,
  deferVoice,
  expireVoice,
  MAX_RESONANT_GESTURES,
  prepareAttack,
  prepareGestureAttack,
  type ResonantVoice,
} from "./phrase-resonance";

function handle(id: number, notes = [`C${id + 3}`]): PianoKeyHandle {
  return {
    id,
    voice: "warm",
    notes,
    channelHandle: { release() {}, scheduleRelease() {}, cancelScheduledRelease() {} },
  };
}

function plan(kind: ReleasePlan["kind"] = "connected"): ReleasePlan {
  return {
    kind,
    targetDurationMs: 700,
    fadeOutSeconds: 0.3,
    transitionFadeOutSeconds: 0.2,
    samePitchNext: false,
    articulation: kind === "rest" ? "rest" : kind === "phrase-end" ? "phrase-end" : "new-token",
  };
}

function voice(
  id: number,
  metadata: { hand: "left" | "right"; harmonyId: string },
): ResonantVoice {
  return {
    id,
    handle: handle(id),
    phraseIndex: 0,
    notes: [`C${id + 3}`],
    releasedAt: id,
    releasePlan: plan(),
    ...metadata,
  };
}

describe("phrase resonance", () => {
  it("keeps only four deferred gestures and releases the oldest", () => {
    let state = createPhraseResonanceState();
    const released: ResonantVoice[] = [];
    let overflowReason: string | undefined;
    for (let id = 1; id <= MAX_RESONANT_GESTURES + 1; id += 1) {
      const transition = deferVoice(state, {
        id, handle: handle(id), phraseIndex: 0, notes: [`C${id + 3}`], releasedAt: id,
        releasePlan: plan(),
      });
      state = transition.state;
      released.push(...transition.release);
      if (transition.release.length > 0) overflowReason = transition.reason;
    }
    expect(state.voices.map((voice) => voice.id)).toEqual([2, 3, 4, 5]);
    expect(released.map((voice) => voice.id)).toEqual([1]);
    expect(released[0].releasePlan).toEqual(plan());
    expect(overflowReason).toBe("capacity");
  });

  it("expires exactly one source and clear returns every remaining handle", () => {
    const first = deferVoice(createPhraseResonanceState(), {
      id: 1, handle: handle(1), phraseIndex: 0, notes: ["C4"], releasedAt: 10,
      releasePlan: plan("fast"),
    }).state;
    const second = deferVoice(first, {
      id: 2, handle: handle(2), phraseIndex: 0, notes: ["D4"], releasedAt: 20,
      releasePlan: plan("long"),
    }).state;
    const expired = expireVoice(second, 1);
    expect(expired.release.map((voice) => voice.id)).toEqual([1]);
    expect(expired.reason).toBe("target");
    const cleared = clearResonance(expired.state);
    expect(cleared.release.map((voice) => voice.id)).toEqual([2]);
    expect(cleared.reason).toBe("clear");
  });

  it("releases an older phrase and every voice before a printed rest", () => {
    const state = {
      voices: [
        { id: 1, handle: handle(1), phraseIndex: 0, notes: ["C4"], releasedAt: 10, releasePlan: plan() },
        { id: 2, handle: handle(2), phraseIndex: 0, notes: ["D4"], releasedAt: 20, releasePlan: plan() },
      ],
    };
    expect(prepareAttack(state).release.map((item) => item.id)).toEqual([1, 2]);
  });

  it("lets the next real correct gesture transition every still-active prior voice", () => {
    const state = {
      voices: [
        { id: 1, handle: handle(1), phraseIndex: 0, notes: ["C4", "E4"], releasedAt: 10, releasePlan: plan() },
        { id: 2, handle: handle(2), phraseIndex: 0, notes: ["D4"], releasedAt: 20, releasePlan: plan() },
      ],
    };
    const transition = prepareAttack(state);
    expect(transition.release.map((item) => item.id)).toEqual([1, 2]);
    expect(transition.state.voices).toEqual([]);
    expect(transition.reason).toBe("next-attack");
  });
});

describe("hand and harmony aware resonance", () => {
  it("keeps the left harmony while the right melody crossfades to its next attack", () => {
    const state = {
      voices: [
        voice(1, { hand: "left", harmonyId: "C" }),
        voice(2, { hand: "right", harmonyId: "C" }),
      ],
    };
    const transition = prepareGestureAttack(
      state,
      { hand: "right", harmonyId: "C" },
      { phraseIndex: 0, notes: ["E4", "G4"], articulation: "legato" },
    );
    expect(transition.release.map((item) => item.id)).toEqual([2]);
    expect(transition.state.voices.map((item) => item.id)).toEqual([1]);
  });

  it("releases the old left harmony only when a new left harmony begins", () => {
    const state = { voices: [voice(1, { hand: "left", harmonyId: "C" }), voice(2, { hand: "right", harmonyId: "C" })] };
    const transition = prepareGestureAttack(
      state,
      { hand: "left", harmonyId: "G" },
      { phraseIndex: 0, notes: ["G2", "D3"], articulation: "connected" },
    );
    expect(transition.release.map((item) => item.id)).toEqual([1]);
    expect(transition.state.voices.map((item) => item.id)).toEqual([2]);
  });

  it("releases the older same-pitch voice before a safe retrigger", () => {
    const state = { voices: [voice(1, { hand: "right", harmonyId: "C" })] };
    const transition = prepareGestureAttack(
      state,
      { hand: "right", harmonyId: "C" },
      { phraseIndex: 0, notes: ["C4"], articulation: "legato" },
    );
    expect(transition.release.map((item) => item.id)).toEqual([1]);
  });

  it("clears the old phrase sound field at a new phrase boundary", () => {
    const state = { voices: [voice(1, { hand: "left", harmonyId: "C" }), voice(2, { hand: "right", harmonyId: "C" })] };
    const transition = prepareGestureAttack(
      state,
      { hand: "right", harmonyId: "C" },
      { phraseIndex: 1, notes: ["E4"], articulation: "connected" },
    );
    expect(transition.release.map((item) => item.id)).toEqual([1, 2]);
  });
});
