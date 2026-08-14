import { describe, expect, it } from "vitest";

import type { SongEvent, SongPackage } from "./song";
import { getGuidedVelocity, getReleasePlan, getScoreOnsetMs } from "./piano-performance";

function score(events: Array<Partial<SongEvent>>, tempoBpm = 72): SongPackage {
  const complete = events.map((event, index): SongEvent => ({
    id: `event-${index}`,
    phraseIndex: 0,
    tokenIndex: index,
    token: String(index),
    targetCode: `Key${String.fromCharCode(65 + index)}`,
    notes: [`C${4 + (index % 2)}`],
    note: `C${4 + (index % 2)}`,
    velocity: 80,
    kind: "tap",
    holdMs: 700,
    confidence: 1,
    provenance: [],
    ...event,
  }));
  const phraseIndexes = [...new Set(complete.map((event) => event.phraseIndex))];
  return {
    id: "performance-test",
    title: "Performance test",
    artist: "Moonlit",
    version: "1",
    searchAliases: [],
    lyricLanguage: "en",
    durationLabel: "00:10",
    tempoBpm,
    recommendedPiano: "bright",
    quality: "clear",
    provenance: ["meter-4/4"],
    phrases: phraseIndexes.map((phraseIndex) => {
      const owned = complete
        .map((event, index) => ({ event, index }))
        .filter(({ event }) => event.phraseIndex === phraseIndex);
      return {
        id: `phrase-${phraseIndex}`,
        text: "phrase",
        startEvent: owned[0].index,
        endEvent: owned.at(-1)!.index,
      };
    }),
    events: complete,
  };
}

describe("piano performance policy", () => {
  it("keeps guided dynamics deterministic and within ten percent of the authored velocity", () => {
    const song = score(Array.from({ length: 5 }, () => ({})));
    const firstPass = song.events.map((_, index) => getGuidedVelocity(song, index));
    const secondPass = song.events.map((_, index) => getGuidedVelocity(song, index));

    expect(secondPass).toEqual(firstPass);
    firstPass.forEach((velocity) => {
      expect(velocity).toBeGreaterThanOrEqual(72);
      expect(velocity).toBeLessThanOrEqual(88);
    });
    expect(new Set(firstPass).size).toBeGreaterThan(1);
  });

  it("shapes a phrase arc and softens its ending without random values", () => {
    const song = score(Array.from({ length: 5 }, () => ({})));
    const velocities = song.events.map((_, index) => getGuidedVelocity(song, index));

    expect(velocities[2]).toBeGreaterThan(velocities[0]);
    expect(velocities[4]).toBeLessThan(velocities[2]);
  });

  it("uses the authored score duration as the release target instead of keyup time", () => {
    const ordinary = score([{ holdMs: 700 }, { holdMs: 700 }]);
    const fast = score([{ holdMs: 180 }, { holdMs: 180 }]);

    const ordinaryPlan = getReleasePlan(ordinary, 0, "bright", 0);
    const fastPlan = getReleasePlan(fast, 0, "bright", 0);

    expect(ordinaryPlan.kind).toBe("connected");
    expect(ordinaryPlan.targetDurationMs).toBe(700);
    expect(fastPlan.kind).toBe("fast");
    expect(fastPlan.targetDurationMs).toBe(180);
  });

  it("derives a bounded tempo-aware target for a legacy tap without authored duration", () => {
    const slow = score([{ holdMs: undefined }, {}], 60);
    const quick = score([{ holdMs: undefined }, {}], 120);
    const slowPlan = getReleasePlan(slow, 0, "warm", 0);
    const quickPlan = getReleasePlan(quick, 0, "warm", 0);

    expect(slowPlan.targetDurationMs).toBe(450);
    expect(quickPlan.targetDurationMs).toBe(225);
  });

  it("gives long notes and phrase endings distinct bounded releases", () => {
    const long = score([{ holdMs: 1_500 }, { holdMs: 700 }]);
    const ending = score([{ holdMs: 700 }]);

    const longPlan = getReleasePlan(long, 0, "concert", 0);
    const endingPlan = getReleasePlan(ending, 0, "concert", 0);

    expect(longPlan.kind).toBe("long");
    expect(longPlan.targetDurationMs).toBe(1_500);
    expect(endingPlan.kind).toBe("phrase-end");
    expect(endingPlan.fadeOutSeconds).toBeGreaterThan(longPlan.fadeOutSeconds);
    expect(endingPlan.transitionFadeOutSeconds).toBeLessThanOrEqual(endingPlan.fadeOutSeconds);
  });

  it("damps at a printed rest and does not carry virtual sustain across it", () => {
    const song = score([{ holdMs: 700 }, { restBeforeMs: 500 }]);
    const plan = getReleasePlan(song, 0, "warm", 0);

    expect(plan.kind).toBe("rest");
    expect(plan.targetDurationMs).toBe(700);
    expect(plan.fadeOutSeconds).toBeGreaterThan(0);
    expect(plan.fadeOutSeconds).toBeLessThanOrEqual(0.2);
    expect(plan.transitionFadeOutSeconds).toBe(plan.fadeOutSeconds);
  });

  it("protects same-pitch retriggers with a shorter transition fade", () => {
    const repeatedPitch = score([
      { notes: ["C4"], note: "C4" },
      { notes: ["C4"], note: "C4" },
    ]);
    const open = getReleasePlan(repeatedPitch, 0, "bright", 0);

    expect(open.samePitchNext).toBe(true);
    expect(open.transitionFadeOutSeconds).toBeLessThan(open.fadeOutSeconds);
    expect(open.transitionFadeOutSeconds).toBeLessThanOrEqual(0.18);
  });

  it("keeps transition fade bounded under resonance pressure without changing the score target", () => {
    const song = score([{ holdMs: 750 }, {}], 60);
    const open = getReleasePlan(song, 0, "warm", 0);
    const crowded = getReleasePlan(song, 0, "warm", 4);

    expect(crowded.targetDurationMs).toBe(750);
    expect(crowded.transitionFadeOutSeconds).toBeLessThanOrEqual(open.transitionFadeOutSeconds);
  });

  it("scales the musical target with the bounded human tempo estimate", () => {
    const song = score([{ holdMs: 800 }, {}]);

    expect(getReleasePlan(song, 0, "warm", 0, 1.12).targetDurationMs).toBe(896);
  });

  it("lets connected notes follow a slow typist while keeping rests and endings bounded", () => {
    const connected = score([{ holdMs: 800 }, { holdMs: 800 }]);
    const rested = score([{ holdMs: 800 }, { holdMs: 800, restBeforeMs: 400 }]);
    const ending = score([{ holdMs: 800 }]);

    expect(getReleasePlan(connected, 0, "warm", 0, 1.6).targetDurationMs).toBe(1_280);
    expect(getReleasePlan(rested, 0, "warm", 0, 1.6).targetDurationMs).toBe(864);
    expect(getReleasePlan(ending, 0, "warm", 0, 1.6).targetDurationMs).toBe(1_000);
  });

  it("uses cumulative score time instead of every fourth event for meter position", () => {
    const common = [
      { holdMs: 500 },
      { holdMs: 500 },
      { holdMs: 2_000 },
      { holdMs: 1_000 },
      { holdMs: 500 },
      { holdMs: 500 },
    ];
    const song = score(common, 60);
    const triple = score(common, 60);
    song.meter = { beatsPerBar: 4, beatUnit: 4 };
    triple.meter = { beatsPerBar: 3, beatUnit: 4 };

    expect(getScoreOnsetMs(song, 3)).toBe(3_000);
    expect(getScoreOnsetMs(song, 4)).toBe(4_000);
    expect(getGuidedVelocity(song, 4)).toBeGreaterThan(getGuidedVelocity(triple, 4));
  });

  it("uses tighter continuation articulation inside one lyric token", () => {
    const song = score([
      { lyricTokenId: "love", lyricSubIndex: 0, lyricSubCount: 2 },
      { lyricTokenId: "love", lyricSubIndex: 1, lyricSubCount: 2 },
      { lyricTokenId: "next", lyricSubIndex: 0, lyricSubCount: 1 },
    ]);

    const continuation = getReleasePlan(song, 0, "bright", 0);
    const newToken = getReleasePlan(song, 1, "bright", 0);
    expect(continuation.articulation).toBe("continuation");
    expect(newToken.articulation).toBe("new-token");
    expect(continuation.transitionFadeOutSeconds).toBeLessThan(newToken.transitionFadeOutSeconds);
  });
});
