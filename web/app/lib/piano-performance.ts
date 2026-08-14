import { getPianoVoiceProfile } from "../audio/piano-voices";
import { MAX_PERFORMANCE_SCALE, MIN_PERFORMANCE_SCALE } from "./human-tempo-follower";
import type { PianoVoice, SongPackage } from "./song";

export type ReleaseKind = "connected" | "fast" | "long" | "phrase-end" | "rest";

export interface ReleasePlan {
  kind: ReleaseKind;
  /** Score-owned upper bound measured from the user's correct keydown. */
  targetDurationMs: number;
  /** Natural fade when the score target is reached without another note. */
  fadeOutSeconds: number;
  /** Shorter fade when another real correct keydown arrives first. */
  transitionFadeOutSeconds: number;
  samePitchNext: boolean;
  articulation: "continuation" | "new-token" | "rest" | "phrase-end";
}

export function getScoreOnsetMs(song: SongPackage, eventIndex: number): number {
  const direct = song.events[eventIndex]?.sourceStartMs;
  if (direct !== undefined) return direct;
  let elapsed = 0;
  for (let index = 0; index < eventIndex; index += 1) {
    elapsed += getScoreTargetDurationMs(song, index);
    elapsed += song.events[index + 1]?.restBeforeMs ?? 0;
  }
  return elapsed;
}

function isDownbeat(song: SongPackage, eventIndex: number): boolean {
  const meter = song.meter ?? { beatsPerBar: 4, beatUnit: 4 };
  const beatMs = 60_000 / (song.tempoBpm ?? 72);
  const meterUnitMs = beatMs * (4 / meter.beatUnit);
  const barMs = meterUnitMs * meter.beatsPerBar;
  if (barMs <= 0) return false;
  const position = getScoreOnsetMs(song, eventIndex) % barMs;
  return Math.min(position, barMs - position) <= Math.max(12, meterUnitMs * 0.08);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function phraseBounds(song: SongPackage, eventIndex: number): { start: number; end: number } {
  const event = song.events[eventIndex];
  if (!event) return { start: eventIndex, end: eventIndex };
  const phrase = song.phrases[event.phraseIndex];
  if (phrase) return { start: phrase.startEvent, end: phrase.endEvent };
  const indexes = song.events
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => candidate.phraseIndex === event.phraseIndex)
    .map(({ index }) => index);
  return { start: indexes[0] ?? eventIndex, end: indexes.at(-1) ?? eventIndex };
}

/**
 * Restrained score-derived gain for guided notes. This is deliberately not used
 * for free piano: a computer keyboard has no velocity sensor and random volume
 * would make it less predictable, not more pianistic.
 */
export function getGuidedVelocity(song: SongPackage, eventIndex: number): number {
  const event = song.events[eventIndex];
  if (!event) return 78;
  const { start, end } = phraseBounds(song, eventIndex);
  const length = Math.max(1, end - start);
  const relative = clamp((eventIndex - start) / length, 0, 1);
  const phraseArc = Math.sin(relative * Math.PI) * 0.06;
  const openingAccent = eventIndex === start ? 0.015 : 0;
  const meterAccent = isDownbeat(song, eventIndex) ? 0.01 : 0;
  const beatMs = 60_000 / (song.tempoBpm ?? 72);
  const longNoteLift = (event.holdMs ?? 0) >= beatMs * 1.25 ? 0.018 : 0;
  const endingShape = eventIndex === end ? -0.06 : 0;
  const multiplier = clamp(
    1 + phraseArc + openingAccent + meterAccent + longNoteLift + endingShape,
    0.9,
    1.1,
  );
  return clamp(Math.round(event.velocity * multiplier), 1, 127);
}

export function getScoreTargetDurationMs(song: SongPackage, eventIndex: number): number {
  const event = song.events[eventIndex];
  const beatMs = 60_000 / (song.tempoBpm ?? 72);
  const sourceDurationMs = event?.sourceStartMs !== undefined && event.sourceEndMs !== undefined
    ? event.sourceEndMs - event.sourceStartMs
    : undefined;
  return Math.round(Math.max(
    80,
    event?.holdMs ?? sourceDurationMs ?? clamp(beatMs * 0.45, 180, 650),
  ));
}

export function getReleasePlan(
  song: SongPackage,
  eventIndex: number,
  voice: PianoVoice,
  resonanceCount: number,
  performanceScale = 1,
): ReleasePlan {
  const current = song.events[eventIndex];
  const next = song.events[eventIndex + 1];
  const profile = getPianoVoiceProfile(voice);
  const beatMs = 60_000 / (song.tempoBpm ?? 72);
  const hasRest = Boolean(next?.restBeforeMs && next.restBeforeMs > 0);
  const phraseEnds = !next || next.phraseIndex !== current?.phraseIndex;
  const contextMaximum = hasRest ? 1.08 : phraseEnds ? 1.25 : MAX_PERFORMANCE_SCALE;
  const targetDurationMs = Math.round(
    getScoreTargetDurationMs(song, eventIndex)
      * clamp(performanceScale, MIN_PERFORMANCE_SCALE, contextMaximum),
  );
  const samePitchNext = Boolean(
    current && next && current.notes.some((note) => next.notes.includes(note)),
  );
  const sameLyricToken = Boolean(
    current?.lyricTokenId && current.lyricTokenId === next?.lyricTokenId,
  );
  const articulation: ReleasePlan["articulation"] = hasRest
    ? "rest"
    : phraseEnds
      ? "phrase-end"
      : sameLyricToken
        ? "continuation"
        : "new-token";

  let kind: ReleaseKind;
  let fadeOutSeconds: number;

  if (hasRest) {
    kind = "rest";
    fadeOutSeconds = profile.restRelease;
  } else if (phraseEnds) {
    kind = "phrase-end";
    fadeOutSeconds = profile.phraseRelease;
  } else if (targetDurationMs >= beatMs * 1.25) {
    kind = "long";
    fadeOutSeconds = profile.longRelease;
  } else if (targetDurationMs <= beatMs * 0.55) {
    kind = "fast";
    fadeOutSeconds = Math.min(profile.connectedRelease, 0.28);
  } else {
    kind = "connected";
    fadeOutSeconds = profile.connectedRelease;
  }

  let transitionFadeOutSeconds = hasRest
    ? profile.restRelease
    : phraseEnds
      ? Math.min(profile.phraseRelease, 0.34)
      : profile.connectedRelease;
  if (samePitchNext) {
    transitionFadeOutSeconds = Math.min(transitionFadeOutSeconds, 0.16);
  }
  if (sameLyricToken) {
    transitionFadeOutSeconds = Math.min(transitionFadeOutSeconds, 0.12);
  }
  if (resonanceCount > 1) {
    transitionFadeOutSeconds = Math.max(
      0.08,
      transitionFadeOutSeconds - (resonanceCount - 1) * 0.02,
    );
  }

  return {
    kind,
    targetDurationMs,
    fadeOutSeconds,
    transitionFadeOutSeconds,
    samePitchNext,
    articulation,
  };
}
