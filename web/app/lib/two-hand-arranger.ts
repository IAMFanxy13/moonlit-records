import { normalizeSongPackage } from "./song-normalizer";
import type { SongEvent, SongEventPart, SongPackage } from "./song";
import { nearestVoicing } from "./voice-leading";

const ARRANGER_MARKER = "two-hand-arrangement-v2-fallback";
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];

function midiFor(note: string): number | null {
  const match = note.match(/^([A-G])(#|b)?(-?\d+)$/u);
  if (!match) return null;
  const natural = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1] as "A"];
  const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
  return (Number(match[3]) + 1) * 12 + natural + accidental;
}

function noteForMidi(midi: number): string {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function inferTonic(song: SongPackage): number {
  const explicit = song.provenance.join(" ").match(/key-([A-G])(#|b)?/iu)?.[0]?.slice(4);
  if (explicit) {
    const midi = midiFor(`${explicit.toUpperCase()}4`);
    if (midi !== null) return midi % 12;
  }
  const histogram = Array.from({ length: 12 }, () => 0);
  song.events.forEach((event) => event.notes.forEach((note) => {
    const midi = midiFor(note);
    if (midi !== null) histogram[midi % 12] += 1;
  }));
  let bestRoot = 0;
  let bestScore = -Infinity;
  for (let root = 0; root < 12; root += 1) {
    const score = histogram.reduce((sum, count, pitch) => (
      sum + count * MAJOR_PROFILE[(pitch - root + 12) % 12]
    ), 0);
    if (score > bestScore) {
      bestScore = score;
      bestRoot = root;
    }
  }
  return bestRoot;
}

function leftPart(tonic: number, gestureIndex: number, previousNotes: readonly string[], energy = 3): SongEventPart {
  const progression = [0, 7, 9, 5];
  const rootPitch = (tonic + progression[gestureIndex % progression.length]) % 12;
  const third = (rootPitch + (progression[gestureIndex % progression.length] === 9 ? 3 : 4)) % 12;
  const pitchClasses = energy >= 5
    ? [rootPitch, (rootPitch + 7) % 12, rootPitch, third]
    : energy >= 3
      ? [rootPitch, (rootPitch + 7) % 12, rootPitch, third]
      : [rootPitch, (rootPitch + 7) % 12];
  const notes = nearestVoicing(pitchClasses, previousNotes, { low: 36, high: 60 });
  return {
    hand: "left",
    targetCode: "Space",
    notes,
    velocity: 66,
    velocities: notes.map((_, index) => Math.max(0.32, 0.5 - index * 0.045)),
    articulation: "legato",
    harmonyId: NOTE_NAMES[rootPitch],
    pedalIntent: "hold",
    role: "left-open-voicing",
    origin: "deterministic-v1-fallback",
    confidence: 0.45,
    gestureType: energy >= 4 ? "rollUp" : "softRollUp",
  };
}

function clampVelocity(value: number): number {
  return Math.max(0.05, Math.min(1, value));
}

function prepareRightPart(
  part: SongEventPart,
  event: SongEvent,
  addColour: boolean,
): SongEventPart {
  const melodyVelocity = clampVelocity((part.velocity ?? event.velocity) / 127);
  const copied = {
    ...part,
    notes: [...part.notes],
    velocities: part.velocities
      ? [...part.velocities]
      : part.notes.map((_, index) => clampVelocity(melodyVelocity - index * 0.08)),
    durationsMs: part.durationsMs ? [...part.durationsMs] : undefined,
  };
  if (!addColour || copied.notes.length !== 1) return copied;

  const melodyMidi = midiFor(copied.notes[0]);
  if (melodyMidi === null) return copied;
  const colourMidi = melodyMidi <= 84 ? melodyMidi + 12 : melodyMidi - 12;
  const duration = copied.durationsMs?.[0];
  return {
    ...copied,
    notes: [copied.notes[0], noteForMidi(colourMidi)],
    velocities: [melodyVelocity, clampVelocity(melodyVelocity - 0.28)],
    durationsMs: duration === undefined ? undefined : [duration, Math.round(duration * 0.9)],
    role: copied.role ?? "melody-voicing",
    gestureType: copied.gestureType ?? "softRollUp",
  };
}

function standaloneLeftEvent(
  part: SongEventPart,
  phraseIndex: number,
  id: string,
  onsetMs: number,
  beatMs: number,
): SongEvent {
  const holdMs = Math.round(beatMs * 1.35);
  return {
    id,
    phraseIndex,
    tokenIndex: null,
    token: null,
    lyricTokenId: null,
    lyricSubIndex: null,
    lyricSubCount: null,
    targetCode: "Space",
    notes: [...part.notes],
    parts: [{ ...part, notes: [...part.notes] }],
    note: part.notes[0],
    velocity: part.velocity ?? 66,
    kind: "hold",
    holdMs,
    sourceStartMs: Math.max(0, Math.round(onsetMs)),
    sourceEndMs: Math.max(0, Math.round(onsetMs)) + holdMs,
    confidence: part.confidence ?? 0.45,
    provenance: ["deterministic-v1-fallback", "positional-left-hand"],
  };
}

export function arrangeTwoHandSong(input: SongPackage): SongPackage {
  const song = normalizeSongPackage(input);
  if (song.provenance.includes(ARRANGER_MARKER)) return song;

  const tonic = inferTonic(song);
  const events: SongEvent[] = [];
  const phrases = [] as SongPackage["phrases"];
  let gestureIndex = 0;
  let previousLeftNotes: string[] = [];
  const meter = song.meter ?? { beatsPerBar: 4, beatUnit: 4 };
  const beatMs = 60_000 / (song.tempoBpm ?? 72);
  const barMs = beatMs * (4 / meter.beatUnit) * meter.beatsPerBar;

  song.phrases.forEach((phrase, phraseIndex) => {
    const phraseStart = events.length;
    const sourceEvents = song.events.slice(phrase.startEvent, phrase.endEvent + 1);
    const authoredPhraseLeft = sourceEvents.some((event) => event.parts?.some((part) => part.hand === "left"));
    const hasScoreTiming = sourceEvents.every((event) => Number.isFinite(event.sourceStartMs));
    const positionMode = phraseIndex % 4;
    const addStandalone = (position: "before" | "between" | "after", onsetMs: number) => {
      const part = leftPart(tonic, gestureIndex++, previousLeftNotes, phrase.energy ?? 3);
      previousLeftNotes = [...part.notes];
      events.push(standaloneLeftEvent(
        part,
        phraseIndex,
        `${phrase.id}-left-${position}`,
        onsetMs,
        beatMs,
      ));
    };

    if (!authoredPhraseLeft && hasScoreTiming && positionMode === 1) {
      addStandalone("before", Math.max(0, sourceEvents[0].sourceStartMs! - beatMs * 0.35));
    }

    for (let oldIndex = phrase.startEvent; oldIndex <= phrase.endEvent; oldIndex += 1) {
      const source = song.events[oldIndex];
      const localIndex = oldIndex - phrase.startEvent;
      if (
        !authoredPhraseLeft
        && hasScoreTiming
        && positionMode === 2
        && localIndex === Math.max(1, Math.floor(sourceEvents.length / 2))
      ) {
        const previous = sourceEvents[localIndex - 1];
        addStandalone("between", ((previous.sourceStartMs ?? 0) + (source.sourceStartMs ?? 0)) / 2);
      }
      const scoreOnset = source.sourceStartMs;
      const barPosition = scoreOnset === undefined || barMs <= 0 ? null : scoreOnset % barMs;
      const onMeasuredDownbeat = barPosition !== null
        && Math.min(barPosition, barMs - barPosition) <= Math.max(12, beatMs * 0.08);
      // Untimed V1 has no defensible bar information: use one quiet harmony at
      // each phrase opening instead of pretending four melody events equal a bar.
      const addGesture = !authoredPhraseLeft && (
        (localIndex === 0 && (!hasScoreTiming || positionMode === 0))
        || (
          positionMode !== 2
          && localIndex > 0
          && scoreOnset !== undefined
          && onMeasuredDownbeat
        )
      );
      const authoredLeft = source.parts?.some((candidate) => candidate.hand === "left") ?? false;
      const part = addGesture && !authoredLeft
        ? leftPart(tonic, gestureIndex++, previousLeftNotes, phrase.energy ?? 3)
        : null;
      if (part) previousLeftNotes = [...part.notes];
      else if (authoredLeft) {
        previousLeftNotes = source.parts?.find((candidate) => candidate.hand === "left")?.notes.slice() ?? previousLeftNotes;
      }

      const rightParts = (source.parts ?? []).map((candidate) => (
        candidate.hand === "right"
          ? prepareRightPart(candidate, source, Boolean(part))
          : { ...candidate, notes: [...candidate.notes] }
      ));
      const right = {
        ...source,
        parts: rightParts,
      };
      if (part) right.parts.push(part);
      events.push(right);
    }

    if (!authoredPhraseLeft && hasScoreTiming && (positionMode === 3 || phraseIndex === song.phrases.length - 1)) {
      const last = sourceEvents[sourceEvents.length - 1];
      addStandalone("after", (last.sourceEndMs ?? last.sourceStartMs! + beatMs) + beatMs * 0.2);
    }
    phrases.push({ ...phrase, startEvent: phraseStart, endEvent: events.length - 1 });
  });

  const lyricTokens = song.lyricTokens?.map((token) => {
    const indexes = events.flatMap((event, index) => event.lyricTokenId === token.id ? [index] : []);
    return indexes.length > 0
      ? { ...token, startEvent: indexes[0], endEvent: indexes[indexes.length - 1] }
      : { ...token };
  });

  return {
    ...song,
    provenance: [...song.provenance, ARRANGER_MARKER],
    phrases,
    lyricTokens,
    events,
  };
}
