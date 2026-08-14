import type { PianoReleaseOptions, PianoVoiceHandle } from "./piano-engine";

export interface SchedulableToneSource {
  readonly state: string;
  fadeOut: unknown;
  cancelStop(): unknown;
  stop(time?: number): unknown;
}

interface ToneSamplerSourceRegistry {
  _activeSources: Map<number, SchedulableToneSource[]>;
}

/** The sole boundary that knows Tone Sampler's private active-source registry. */
export function captureOwnedToneSources(
  sampler: unknown,
  midiNotes: readonly number[],
  attack: () => void,
): SchedulableToneSource[] {
  const registry = sampler as ToneSamplerSourceRegistry;
  const before = new Map<number, Set<SchedulableToneSource>>();
  for (const midi of midiNotes) {
    before.set(midi, new Set(registry._activeSources.get(midi) ?? []));
  }
  attack();
  return midiNotes.flatMap((midi) => {
    const existing = before.get(midi) ?? new Set<SchedulableToneSource>();
    return (registry._activeSources.get(midi) ?? []).filter((source) => !existing.has(source));
  });
}

const clampFade = (value: number | undefined): number | undefined => value === undefined
  ? undefined
  : Math.min(0.8, Math.max(0.04, value));

/**
 * Owns only the ToneBufferSource instances created by one physical gesture.
 * Tone's audio clock is the musical authority; wall-clock timers are not used.
 */
export function createOwnedToneSourceHandle(
  sources: readonly SchedulableToneSource[],
  audioNow: () => number,
): PianoVoiceHandle & { isReleased(): boolean } {
  const owned = [...new Set(sources)];
  let released = false;
  let scheduled = false;

  const cancelScheduledRelease = () => {
    if (released || !scheduled) return;
    for (const source of owned) {
      if (source.state === "started") source.cancelStop();
    }
    scheduled = false;
  };

  return {
    scheduleRelease(delayMs, options) {
      if (released) return;
      if (scheduled) cancelScheduledRelease();
      const fade = clampFade(options?.fadeOutSeconds);
      const now = audioNow();
      for (const [index, source] of owned.entries()) {
        if (source.state !== "started") continue;
        if (fade !== undefined) source.fadeOut = fade;
        const sourceDelay = Array.isArray(delayMs) ? delayMs[index] ?? delayMs.at(-1) ?? 0 : delayMs;
        source.stop(now + Math.max(0, sourceDelay) / 1000);
      }
      scheduled = true;
    },
    cancelScheduledRelease,
    release(options?: PianoReleaseOptions) {
      if (released) return;
      cancelScheduledRelease();
      released = true;
      const fade = clampFade(options?.fadeOutSeconds);
      const stopAt = audioNow();
      for (const source of owned) {
        if (source.state !== "started") continue;
        if (fade !== undefined) source.fadeOut = fade;
        source.stop(stopAt);
      }
    },
    isReleased() {
      return released;
    },
  };
}
