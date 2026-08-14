import type { PianoVoice } from "../lib/song";
import { getPianoVoiceProfile, PIANO_VOICE_ORDER } from "./piano-voices";
import { captureOwnedToneSources, createOwnedToneSourceHandle } from "./tone-source-adapter";

export interface PianoKeyHandle {
  id: number;
  voice: PianoVoice;
  notes: readonly string[];
  channelHandle: PianoVoiceHandle;
}

export interface PianoVoiceHandle {
  release(options?: PianoReleaseOptions): void;
  scheduleRelease(delayMs: number | readonly number[], options?: PianoReleaseOptions): void;
  cancelScheduledRelease(): void;
}

export interface PianoReleaseOptions {
  fadeOutSeconds?: number;
}

export interface PianoRuntimeInfo {
  state: string;
  baseLatency: number | null;
  latencyHint: string | number | null;
  outputLatency?: number | null;
  outputTimestamp?: { contextTime?: number; performanceTime?: number } | null;
  currentTime?: number | null;
  lookAhead?: number | null;
}

export interface PianoPort {
  load(): Promise<void>;
  resume(): Promise<void>;
  setVoice(voice: PianoVoice): void;
  tailMs(): number;
  keyDown(notes: readonly string[], velocity: number | readonly number[], attackOffsetsMs?: readonly number[]): PianoKeyHandle;
  keyUp(handle: PianoKeyHandle, options?: PianoReleaseOptions): void;
  scheduleRelease(handle: PianoKeyHandle, delayMs: number | readonly number[], options?: PianoReleaseOptions): void;
  cancelScheduledRelease(handle: PianoKeyHandle): void;
  runtimeInfo(): PianoRuntimeInfo;
  releaseAll(): void;
  dispose(): void;
}

export interface PianoVoiceChannel {
  keyDown(notes: readonly string[], normalizedVelocity: number | readonly number[], attackOffsetsMs?: readonly number[]): PianoVoiceHandle;
  keyUp(handle: PianoVoiceHandle, options?: PianoReleaseOptions): void;
  scheduleRelease(handle: PianoVoiceHandle, delayMs: number | readonly number[], options?: PianoReleaseOptions): void;
  cancelScheduledRelease(handle: PianoVoiceHandle): void;
  releaseAll(): void;
  dispose(): void;
}

interface PianoEngineDependencies {
  channels: Record<PianoVoice, PianoVoiceChannel>;
  load: () => Promise<void>;
  resume: () => Promise<void>;
  runtimeInfo?: () => PianoRuntimeInfo;
}

export function createPianoEngine(dependencies: PianoEngineDependencies): PianoPort {
  const { channels, load, resume, runtimeInfo } = dependencies;
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
    keyDown(notes, velocity, attackOffsetsMs) {
      const stableNotes = [...notes];
      const normalizedVelocity = typeof velocity !== "number"
        ? velocity.map((item) => Math.min(1, Math.max(0, item / 127)))
        : Math.min(1, Math.max(0, velocity / 127));
      const channelHandle = attackOffsetsMs
        ? channels[activeVoice].keyDown(stableNotes, normalizedVelocity, [...attackOffsetsMs])
        : channels[activeVoice].keyDown(stableNotes, normalizedVelocity);
      return { id: nextHandleId++, voice: activeVoice, notes: stableNotes, channelHandle };
    },
    keyUp(handle, options) {
      if (options) channels[handle.voice].keyUp(handle.channelHandle, options);
      else channels[handle.voice].keyUp(handle.channelHandle);
    },
    scheduleRelease(handle, delayMs, options) {
      channels[handle.voice].scheduleRelease(handle.channelHandle, delayMs, options);
    },
    cancelScheduledRelease(handle) {
      channels[handle.voice].cancelScheduledRelease(handle.channelHandle);
    },
    runtimeInfo() {
      return runtimeInfo?.() ?? { state: "unavailable", baseLatency: null, latencyHint: null };
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
type ToneGain = import("tone").Gain;
interface LoadedVoice {
  sampler: ToneSampler;
  filter: ToneFilter;
  reverb: ToneReverb;
  output: ToneGain;
}

export function createBrowserPianoEngine(): PianoPort {
  const loaded = new Map<PianoVoice, LoadedVoice>();
  let toneModule: typeof import("tone") | null = null;
  let loading: Promise<void> | null = null;

  const channels = Object.fromEntries(
    PIANO_VOICE_ORDER.map((voice) => [
      voice,
      {
        keyDown(notes: readonly string[], normalizedVelocity: number | readonly number[], attackOffsetsMs?: readonly number[]) {
          const sampler = loaded.get(voice)?.sampler;
          if (!sampler || !toneModule) {
            return {
              release() {},
              scheduleRelease() {},
              cancelScheduledRelease() {},
            };
          }
          const midiNotes = notes.map((note) => Math.round(toneModule!.Frequency(note).toMidi()));
          const ownedSources = captureOwnedToneSources(sampler, midiNotes, () => {
            if (!attackOffsetsMs && typeof normalizedVelocity === "number") {
              sampler.triggerAttack([...notes], undefined, normalizedVelocity);
              return;
            }
            const attackAt = toneModule!.now();
            notes.forEach((note, index) => sampler.triggerAttack(
              note,
              attackAt + Math.max(0, attackOffsetsMs?.[index] ?? 0) / 1000,
              typeof normalizedVelocity === "number"
                ? normalizedVelocity
                : normalizedVelocity[index] ?? normalizedVelocity.at(-1) ?? 0.7,
            ));
          });
          return createOwnedToneSourceHandle(ownedSources, () => toneModule!.now());
        },
        keyUp(handle: PianoVoiceHandle, options?: PianoReleaseOptions) {
          handle.release(options);
        },
        scheduleRelease(handle, delayMs, options) {
          handle.scheduleRelease(delayMs, options);
        },
        cancelScheduledRelease(handle) {
          handle.cancelScheduledRelease();
        },
        releaseAll() {
          loaded.get(voice)?.sampler.releaseAll();
        },
        dispose() {
          const chain = loaded.get(voice);
          chain?.sampler.dispose();
          chain?.filter.dispose();
          chain?.reverb.dispose();
          chain?.output.dispose();
          loaded.delete(voice);
        },
      } satisfies PianoVoiceChannel,
    ]),
  ) as unknown as Record<PianoVoice, PianoVoiceChannel>;

  const load = async () => {
    if (loading) return loading;
    const attempt = (async () => {
      const Tone = await import("tone");
      toneModule = Tone;
      for (const voice of PIANO_VOICE_ORDER) {
        const profile = getPianoVoiceProfile(voice);
        const output = new Tone.Gain({ gain: profile.outputTrim }).toDestination();
        const reverb = new Tone.Reverb({
          decay: profile.reverbDecay,
          preDelay: profile.preDelay,
          wet: profile.wet,
        }).connect(output);
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
        loaded.set(voice, { sampler, filter, reverb, output });
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
    runtimeInfo() {
      if (!toneModule) return { state: "unavailable", baseLatency: null, latencyHint: null };
      const context = toneModule.getContext();
      const raw = context.rawContext;
      return {
        state: raw.state,
        baseLatency: "baseLatency" in raw ? raw.baseLatency : null,
        outputLatency: "outputLatency" in raw ? raw.outputLatency : null,
        outputTimestamp: "getOutputTimestamp" in raw ? raw.getOutputTimestamp() : null,
        currentTime: raw.currentTime,
        lookAhead: context.lookAhead,
        latencyHint: context.latencyHint || null,
      };
    },
  });
}
