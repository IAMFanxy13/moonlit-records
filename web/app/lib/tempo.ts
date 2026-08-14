import type { SongPackage } from "./song";

export function clampTempo(value: number): number {
  return Math.min(120, Math.max(50, Math.round(value)));
}

function scaleOptional(value: number | undefined, ratio: number): number | undefined {
  return value === undefined ? undefined : Math.max(0, Math.round(value * ratio));
}

export function scaleSongTempo(song: SongPackage, requestedTempo: number): SongPackage {
  const sourceTempo = song.tempoBpm ?? 72;
  const tempoBpm = clampTempo(requestedTempo);
  const ratio = sourceTempo / tempoBpm;
  return {
    ...song,
    tempoBpm,
    phrases: song.phrases.map((phrase) => ({ ...phrase })),
    events: song.events.map((event) => ({
      ...event,
      notes: [...event.notes],
      parts: event.parts?.map((part) => ({
        ...part,
        notes: [...part.notes],
        velocities: part.velocities ? [...part.velocities] : undefined,
        durationsMs: part.durationsMs?.map((duration) => Math.max(1, Math.round(duration * ratio))),
      })),
      holdMs: scaleOptional(event.holdMs, ratio),
      restBeforeMs: scaleOptional(event.restBeforeMs, ratio),
      sourceStartMs: scaleOptional(event.sourceStartMs, ratio),
      sourceEndMs: scaleOptional(event.sourceEndMs, ratio),
    })),
  };
}
