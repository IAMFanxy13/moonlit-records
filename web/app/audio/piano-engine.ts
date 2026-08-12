import type { PianoVoice } from "../lib/song";
import { getPianoVoiceProfile } from "./piano-voices";

type ToneSampler = import("tone").Sampler;

export interface PianoPort {
  load(): Promise<void>;
  resume(): Promise<void>;
  setVoice(voice: PianoVoice): void;
  tailMs(): number;
  attack(note: string, velocity: number): void;
  release(note: string): void;
  releaseAll(): void;
  dispose(): void;
}

interface SamplerPort {
  triggerAttack(note: string, time?: number, velocity?: number): unknown;
  triggerRelease(note: string): unknown;
  releaseAll(): unknown;
  dispose(): unknown;
}

interface PianoEngineDependencies {
  sampler: SamplerPort;
  load: () => Promise<void>;
  resume: () => Promise<void>;
  configureVoice?: (voice: PianoVoice) => void;
}

export function createPianoEngine(dependencies: PianoEngineDependencies): PianoPort {
  const { sampler, load, resume, configureVoice } = dependencies;
  let currentVoice: PianoVoice = "warm";
  return {
    load,
    resume,
    setVoice(voice) {
      currentVoice = voice;
      configureVoice?.(voice);
    },
    tailMs() {
      return getPianoVoiceProfile(currentVoice).tailMs;
    },
    attack(note, velocity) {
      sampler.triggerAttack(note, undefined, Math.min(1, Math.max(0, velocity / 127)));
    },
    release(note) {
      sampler.triggerRelease(note);
    },
    releaseAll() {
      sampler.releaseAll();
    },
    dispose() {
      sampler.dispose();
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

export function createBrowserPianoEngine(): PianoPort {
  let sampler: SamplerPort | null = null;
  let disposeEffects: (() => void) | null = null;
  let toneModule: typeof import("tone") | null = null;
  let loading: Promise<void> | null = null;
  let currentVoice: PianoVoice = "warm";
  let configureLoadedVoice: ((voice: PianoVoice) => void) | null = null;

  const load = async () => {
    if (loading) return loading;
    loading = (async () => {
      const Tone = await import("tone");
      toneModule = Tone;
      const initialProfile = getPianoVoiceProfile(currentVoice);
      const reverb = new Tone.Reverb({
        decay: initialProfile.reverbDecay,
        preDelay: initialProfile.preDelay,
        wet: initialProfile.wet,
      }).toDestination();
      const filter = new Tone.Filter({ frequency: 4300, type: "lowpass", rolloff: -12 }).connect(reverb);
      sampler = new Tone.Sampler({
        urls: SAMPLE_URLS,
        baseUrl: "/audio/salamander/",
        attack: 0.004,
        release: initialProfile.samplerRelease,
      }).connect(filter);
      configureLoadedVoice = (voice) => {
        const profile = getPianoVoiceProfile(voice);
        filter.frequency.value = profile.cutoff;
        reverb.wet.value = profile.wet;
        reverb.decay = profile.reverbDecay;
        reverb.preDelay = profile.preDelay;
        if (sampler) (sampler as ToneSampler).release = profile.samplerRelease;
      };
      configureLoadedVoice(currentVoice);
      disposeEffects = () => {
        filter.dispose();
        reverb.dispose();
      };
      await Tone.loaded();
    })();
    return loading;
  };

  return {
    load,
    async resume() {
      if (!toneModule) toneModule = await import("tone");
      await toneModule.start();
    },
    setVoice(voice) {
      currentVoice = voice;
      configureLoadedVoice?.(voice);
    },
    tailMs() {
      return getPianoVoiceProfile(currentVoice).tailMs;
    },
    attack(note, velocity) {
      sampler?.triggerAttack(note, undefined, Math.min(1, Math.max(0, velocity / 127)));
    },
    release(note) {
      sampler?.triggerRelease(note);
    },
    releaseAll() {
      sampler?.releaseAll();
    },
    dispose() {
      sampler?.dispose();
      disposeEffects?.();
      sampler = null;
      disposeEffects = null;
      configureLoadedVoice = null;
    },
  };
}
