import type { PianoVoice } from "../lib/song";
import { getPianoVoiceProfile, PIANO_VOICE_ORDER } from "./piano-voices";

export interface PianoAttackHandle {
  id: number;
  voice: PianoVoice;
  notes: readonly string[];
}

export interface PianoPort {
  load(): Promise<void>;
  resume(): Promise<void>;
  setVoice(voice: PianoVoice): void;
  tailMs(): number;
  attack(notes: readonly string[], velocity: number): PianoAttackHandle;
  release(handle: PianoAttackHandle): void;
  releaseAll(): void;
  dispose(): void;
}

export interface PianoVoiceChannel {
  attack(notes: readonly string[], normalizedVelocity: number): void;
  release(notes: readonly string[]): void;
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
    attack(notes, velocity) {
      const stableNotes = [...notes];
      channels[activeVoice].attack(stableNotes, Math.min(1, Math.max(0, velocity / 127)));
      return { id: nextHandleId++, voice: activeVoice, notes: stableNotes };
    },
    release(handle) {
      channels[handle.voice].release(handle.notes);
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
        attack(notes: readonly string[], normalizedVelocity: number) {
          loaded.get(voice)?.sampler.triggerAttack([...notes], undefined, normalizedVelocity);
        },
        release(notes: readonly string[]) {
          loaded.get(voice)?.sampler.triggerRelease([...notes]);
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
    loading = (async () => {
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
          release: profile.samplerRelease,
        }).connect(filter);
        loaded.set(voice, { sampler, filter, reverb });
      }
      await Tone.loaded();
    })();
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
