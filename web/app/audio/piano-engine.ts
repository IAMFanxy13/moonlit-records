import type { PianoVoice } from "../lib/song";
import { getPianoVoiceProfile, PIANO_VOICE_ORDER } from "./piano-voices";

export interface PianoKeyHandle {
  id: number;
  voice: PianoVoice;
  notes: readonly string[];
  channelHandle: PianoVoiceHandle;
}

export interface PianoVoiceHandle {
  release(): void;
}

export interface PianoPort {
  load(): Promise<void>;
  resume(): Promise<void>;
  setVoice(voice: PianoVoice): void;
  tailMs(): number;
  keyDown(notes: readonly string[], velocity: number): PianoKeyHandle;
  keyUp(handle: PianoKeyHandle): void;
  releaseAll(): void;
  dispose(): void;
}

export interface PianoVoiceChannel {
  keyDown(notes: readonly string[], normalizedVelocity: number): PianoVoiceHandle;
  keyUp(handle: PianoVoiceHandle): void;
  releaseAll(): void;
  dispose(): void;
}

interface PianoEngineDependencies {
  channels: Record<PianoVoice, PianoVoiceChannel>;
  load: () => Promise<void>;
  resume: () => Promise<void>;
}

export function createPianoEngine(dependencies: PianoEngineDependencies): PianoPort {
  const { channels, load, resume } = dependencies;
  let activeVoice: PianoVoice = "warm";
  let nextHandleId = 1;

  return {
    load,
    resume,
    setVoice(voice) {
      activeVoice = voice;
    },
    tailMs() {
      return getPianoVoiceProfile(activeVoice).tailMs;
    },
    keyDown(notes, velocity) {
      const stableNotes = [...notes];
      const channelHandle = channels[activeVoice].keyDown(
        stableNotes,
        Math.min(1, Math.max(0, velocity / 127)),
      );
      return { id: nextHandleId++, voice: activeVoice, notes: stableNotes, channelHandle };
    },
    keyUp(handle) {
      channels[handle.voice].keyUp(handle.channelHandle);
    },
    releaseAll() {
      for (const channel of Object.values(channels)) channel.releaseAll();
    },
    dispose() {
      for (const channel of Object.values(channels)) channel.dispose();
    },
  };
}

const SAMPLE_URLS = {
  A2: "A2.mp3",
  C3: "C3.mp3",
  "D#3": "Ds3.mp3",
  "F#3": "Fs3.mp3",
  A3: "A3.mp3",
  C4: "C4.mp3",
  "D#4": "Ds4.mp3",
  "F#4": "Fs4.mp3",
  A4: "A4.mp3",
  C5: "C5.mp3",
  "D#5": "Ds5.mp3",
  "F#5": "Fs5.mp3",
  A5: "A5.mp3",
  C6: "C6.mp3",
};

type ToneSampler = import("tone").Sampler;
type ToneFilter = import("tone").Filter;
type ToneReverb = import("tone").Reverb;
type ToneBufferSource = import("tone").ToneBufferSource;

interface ToneSamplerSources {
  _activeSources: Map<number, ToneBufferSource[]>;
}

interface LoadedVoice {
  sampler: ToneSampler;
  filter: ToneFilter;
  reverb: ToneReverb;
}

export function createBrowserPianoEngine(): PianoPort {
  const loaded = new Map<PianoVoice, LoadedVoice>();
  let toneModule: typeof import("tone") | null = null;
  let loading: Promise<void> | null = null;

  const channels = Object.fromEntries(
    PIANO_VOICE_ORDER.map((voice) => [
      voice,
      {
        keyDown(notes: readonly string[], normalizedVelocity: number) {
          const sampler = loaded.get(voice)?.sampler;
          if (!sampler || !toneModule) return { release() {} };
          const internals = sampler as unknown as ToneSamplerSources;
          const before = new Map<number, Set<ToneBufferSource>>();
          for (const note of notes) {
            const midi = Math.round(toneModule.Frequency(note).toMidi());
            before.set(midi, new Set(internals._activeSources.get(midi) ?? []));
          }
          sampler.triggerAttack([...notes], undefined, normalizedVelocity);
          const ownedSources = notes.flatMap((note) => {
            const midi = Math.round(toneModule!.Frequency(note).toMidi());
            const existing = before.get(midi) ?? new Set<ToneBufferSource>();
            return (internals._activeSources.get(midi) ?? []).filter((source) => !existing.has(source));
          });
          let released = false;
          return {
            release() {
              if (released) return;
              released = true;
              for (const source of new Set(ownedSources)) {
                if (source.state === "started") source.stop();
              }
            },
          };
        },
        keyUp(handle: PianoVoiceHandle) {
          handle.release();
        },
        releaseAll() {
          loaded.get(voice)?.sampler.releaseAll();
        },
        dispose() {
          const chain = loaded.get(voice);
          chain?.sampler.dispose();
          chain?.filter.dispose();
          chain?.reverb.dispose();
          loaded.delete(voice);
        },
      } satisfies PianoVoiceChannel,
    ]),
  ) as Record<PianoVoice, PianoVoiceChannel>;

  const load = async () => {
    if (loading) return loading;
    const attempt = (async () => {
      const Tone = await import("tone");
      toneModule = Tone;
      for (const voice of PIANO_VOICE_ORDER) {
        const profile = getPianoVoiceProfile(voice);
        const reverb = new Tone.Reverb({
          decay: profile.reverbDecay,
          preDelay: profile.preDelay,
          wet: profile.wet,
        }).toDestination();
        const filter = new Tone.Filter({
          frequency: profile.cutoff,
          type: "lowpass",
          rolloff: -12,
        }).connect(reverb);
        const sampler = new Tone.Sampler({
          urls: SAMPLE_URLS,
          baseUrl: "/audio/salamander/",
          attack: 0.004,
          release: profile.damperRelease,
          curve: "exponential",
        }).connect(filter);
        loaded.set(voice, { sampler, filter, reverb });
      }
      await Tone.loaded();
    })();
    loading = attempt.catch((reason) => {
      for (const channel of Object.values(channels)) channel.dispose();
      toneModule = null;
      loading = null;
      throw reason;
    });
    return loading;
  };

  return createPianoEngine({
    channels,
    load,
    async resume() {
      if (!toneModule) toneModule = await import("tone");
      await toneModule.start();
    },
  });
}
