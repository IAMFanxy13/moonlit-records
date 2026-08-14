import { describe, expect, it, vi } from "vitest";

import { createBrowserPianoEngine, createPianoEngine, type PianoVoiceChannel } from "./piano-engine";
import { getPianoVoiceProfile } from "./piano-voices";
import type { PianoVoice } from "../lib/song";

const tone = vi.hoisted(() => {
  const reverbs: Array<{ dispose: ReturnType<typeof vi.fn> }> = [];
  const filters: Array<{ dispose: ReturnType<typeof vi.fn> }> = [];
  const gains: Array<{ dispose: ReturnType<typeof vi.fn> }> = [];
  const sources: Array<{ state: string; stop: ReturnType<typeof vi.fn>; fadeOut: number }> = [];
  const samplers: Array<{
    _activeSources: Map<number, Array<{ state: string; stop: ReturnType<typeof vi.fn>; fadeOut: number }>>;
    dispose: ReturnType<typeof vi.fn>;
    releaseAll: ReturnType<typeof vi.fn>;
    triggerAttack: ReturnType<typeof vi.fn>;
  }> = [];
  const Reverb = vi.fn(function Reverb() {
    const instance = {
      dispose: vi.fn(),
      connect() { return instance; },
      toDestination() { return instance; },
    };
    reverbs.push(instance);
    return instance;
  });
  const Filter = vi.fn(function Filter() {
    const instance = {
      dispose: vi.fn(),
      connect() { return instance; },
    };
    filters.push(instance);
    return instance;
  });
  const Gain = vi.fn(function Gain() {
    const instance = {
      dispose: vi.fn(),
      connect() { return instance; },
      toDestination() { return instance; },
    };
    gains.push(instance);
    return instance;
  });
  const Sampler = vi.fn(function Sampler() {
    const instance = {
      _activeSources: new Map(),
      dispose: vi.fn(),
      releaseAll: vi.fn(),
      triggerAttack: vi.fn((notes: string | string[]) => {
        const list = Array.isArray(notes) ? notes : [notes];
        list.forEach(() => {
          const source = { state: "started", stop: vi.fn(), fadeOut: 0 };
          sources.push(source);
          const active = instance._activeSources.get(60) ?? [];
          active.push(source);
          instance._activeSources.set(60, active);
        });
      }),
      connect() { return instance; },
    };
    samplers.push(instance);
    return instance;
  });
  return {
    Filter,
    Frequency: vi.fn(() => ({ toMidi: () => 60 })),
    Gain,
    Reverb,
    Sampler,
    filters,
    gains,
    getContext: vi.fn(() => ({
      currentTime: 8.7,
      lookAhead: 0.1,
      latencyHint: "interactive",
      rawContext: {
        baseLatency: 0.012,
        outputLatency: 0.034,
        state: "running",
        currentTime: 8.7,
        getOutputTimestamp: () => ({ contextTime: 8.5, performanceTime: 220 }),
      },
    })),
    loaded: vi.fn(),
    reverbs,
    samplers,
    sources,
    start: vi.fn().mockResolvedValue(undefined),
    now: vi.fn(() => 10),
  };
});

vi.mock("tone", () => ({
  Filter: tone.Filter,
  Frequency: tone.Frequency,
  Gain: tone.Gain,
  Reverb: tone.Reverb,
  Sampler: tone.Sampler,
  getContext: tone.getContext,
  loaded: tone.loaded,
  start: tone.start,
  now: tone.now,
}));

function channel(): PianoVoiceChannel {
  return {
    keyDown: vi.fn(() => ({
      release: vi.fn(),
      scheduleRelease: vi.fn(),
      cancelScheduledRelease: vi.fn(),
    })),
    keyUp: vi.fn((handle) => handle.release()),
    scheduleRelease: vi.fn((handle, delayMs, options) => handle.scheduleRelease(delayMs, options)),
    cancelScheduledRelease: vi.fn((handle) => handle.cancelScheduledRelease()),
    releaseAll: vi.fn(),
    dispose: vi.fn(),
  };
}

function channels(): Record<PianoVoice, PianoVoiceChannel> {
  return {
    warm: channel(),
    bright: channel(),
    upright: channel(),
    concert: channel(),
  };
}

describe("piano engine", () => {
  it("starts one complete voicing through the globally selected voice", async () => {
    const voiceChannels = channels();
    const load = vi.fn().mockResolvedValue(undefined);
    const resume = vi.fn().mockResolvedValue(undefined);
    const piano = createPianoEngine({ channels: voiceChannels, load, resume });

    await piano.load();
    await piano.resume();
    const warmHandle = piano.keyDown(["C4", "E4", "G4"], 112);
    piano.setVoice("concert");
    const concertHandle = piano.keyDown(["D4"], 88);

    expect(warmHandle).toMatchObject({ voice: "warm", notes: ["C4", "E4", "G4"] });
    expect(concertHandle).toMatchObject({ voice: "concert", notes: ["D4"] });
    expect(voiceChannels.warm.keyDown).toHaveBeenCalledWith(["C4", "E4", "G4"], 112 / 127);
    expect(voiceChannels.concert.keyDown).toHaveBeenCalledWith(["D4"], 88 / 127);
  });

  it("preserves per-note dynamics for one simultaneous physical gesture", () => {
    const voiceChannels = channels();
    const piano = createPianoEngine({ channels: voiceChannels, load: async () => undefined, resume: async () => undefined });
    piano.keyDown(["C4", "E4", "G4"], [64, 72, 104]);
    expect(voiceChannels.warm.keyDown).toHaveBeenCalledWith(["C4", "E4", "G4"], [64 / 127, 72 / 127, 104 / 127]);
  });

  it("passes bounded per-note attack offsets to the selected voice", () => {
    const voiceChannels = channels();
    const piano = createPianoEngine({ channels: voiceChannels, load: async () => undefined, resume: async () => undefined });
    piano.keyDown(["C4", "E4", "G4"], [64, 72, 104], [0, 25, 50]);
    expect(voiceChannels.warm.keyDown).toHaveBeenCalledWith(
      ["C4", "E4", "G4"],
      [64 / 127, 72 / 127, 104 / 127],
      [0, 25, 50],
    );
  });

  it("releases a key through the voice that originally made it", () => {
    const voiceChannels = channels();
    const piano = createPianoEngine({ channels: voiceChannels, load: async () => undefined, resume: async () => undefined });

    const handle = piano.keyDown(["C4", "E4", "G4"], 96);
    piano.setVoice("concert");
    piano.keyUp(handle);

    expect(voiceChannels.warm.keyUp).toHaveBeenCalledWith(handle.channelHandle);
    expect(voiceChannels.concert.keyUp).not.toHaveBeenCalled();
  });

  it("releases only one physical voice when two handles share the same pitch", () => {
    const firstVoice = { release: vi.fn(), scheduleRelease: vi.fn(), cancelScheduledRelease: vi.fn() };
    const secondVoice = { release: vi.fn(), scheduleRelease: vi.fn(), cancelScheduledRelease: vi.fn() };
    const voiceChannels = channels();
    vi.mocked(voiceChannels.warm.keyDown)
      .mockReturnValueOnce(firstVoice)
      .mockReturnValueOnce(secondVoice);
    const piano = createPianoEngine({ channels: voiceChannels, load: async () => undefined, resume: async () => undefined });

    const first = piano.keyDown(["C4"], 90);
    const second = piano.keyDown(["C4"], 90);
    piano.keyUp(first);

    expect(firstVoice.release).toHaveBeenCalledOnce();
    expect(secondVoice.release).not.toHaveBeenCalled();
    expect(voiceChannels.warm.keyUp).toHaveBeenCalledOnce();

    piano.keyUp(second);
    expect(secondVoice.release).toHaveBeenCalledOnce();
  });

  it("uses the selected voice tail and clamps velocity", () => {
    const voiceChannels = channels();
    const piano = createPianoEngine({ channels: voiceChannels, load: async () => undefined, resume: async () => undefined });

    piano.keyDown(["C4"], 300);
    piano.keyDown(["D4"], -20);
    expect(voiceChannels.warm.keyDown).toHaveBeenNthCalledWith(1, ["C4"], 1);
    expect(voiceChannels.warm.keyDown).toHaveBeenNthCalledWith(2, ["D4"], 0);

    piano.setVoice("upright");
    expect(piano.tailMs()).toBe(getPianoVoiceProfile("upright").tailMs);
  });

  it("delegates scheduled release and cancellation to the exact owned voice", () => {
    const owned = {
      release: vi.fn(),
      scheduleRelease: vi.fn(),
      cancelScheduledRelease: vi.fn(),
    };
    const voiceChannels = channels();
    vi.mocked(voiceChannels.warm.keyDown).mockReturnValueOnce(owned);
    const piano = createPianoEngine({
      channels: voiceChannels,
      load: async () => undefined,
      resume: async () => undefined,
    });
    const handle = piano.keyDown(["C4"], 90);

    piano.scheduleRelease(handle, 640, { fadeOutSeconds: 0.31 });
    piano.cancelScheduledRelease(handle);

    expect(owned.scheduleRelease).toHaveBeenCalledWith(640, { fadeOutSeconds: 0.31 });
    expect(owned.cancelScheduledRelease).toHaveBeenCalledOnce();
  });

  it("applies a planned fade to only the exact owned Tone source", async () => {
    tone.loaded.mockResolvedValue(undefined);
    tone.sources.length = 0;
    const piano = createBrowserPianoEngine();
    await piano.load();

    const first = piano.keyDown(["C4"], 90);
    const second = piano.keyDown(["C4"], 90);
    piano.keyUp(first, { fadeOutSeconds: 0.37 });

    expect(tone.sources[0].fadeOut).toBe(0.37);
    expect(tone.sources[0].stop).toHaveBeenCalledOnce();
    expect(tone.sources[1].stop).not.toHaveBeenCalled();

    piano.keyUp(first, { fadeOutSeconds: 0.1 });
    expect(tone.sources[0].stop).toHaveBeenCalledOnce();
    piano.keyUp(second, { fadeOutSeconds: 0.22 });
    expect(tone.sources[1].fadeOut).toBe(0.22);
    expect(tone.sources[1].stop).toHaveBeenCalledOnce();
  });

  it("reports the existing interactive AudioContext without creating another context", async () => {
    tone.loaded.mockResolvedValue(undefined);
    tone.getContext.mockClear();
    const piano = createBrowserPianoEngine();
    await piano.load();

    expect(piano.runtimeInfo()).toEqual({
      state: "running",
      baseLatency: 0.012,
      outputLatency: 0.034,
      outputTimestamp: { contextTime: 8.5, performanceTime: 220 },
      currentTime: 8.7,
      lookAhead: 0.1,
      latencyHint: "interactive",
    });
    expect(tone.getContext).toHaveBeenCalled();
  });

  it("releases and disposes every voice channel", () => {
    const voiceChannels = channels();
    const piano = createPianoEngine({ channels: voiceChannels, load: async () => undefined, resume: async () => undefined });

    piano.releaseAll();
    piano.dispose();

    for (const voice of Object.values(voiceChannels)) {
      expect(voice.releaseAll).toHaveBeenCalledOnce();
      expect(voice.dispose).toHaveBeenCalledOnce();
    }
  });

  it("disposes a failed browser load and rebuilds every voice on retry", async () => {
    tone.Filter.mockClear();
    tone.Reverb.mockClear();
    tone.Sampler.mockClear();
    tone.filters.length = 0;
    tone.gains.length = 0;
    tone.reverbs.length = 0;
    tone.samplers.length = 0;
    tone.loaded.mockReset()
      .mockRejectedValueOnce(new Error("sample decode failed"))
      .mockResolvedValueOnce(undefined);
    const piano = createBrowserPianoEngine();

    await expect(piano.load()).rejects.toThrow("sample decode failed");
    const failedSamplers = [...tone.samplers];
    const failedFilters = [...tone.filters];
    const failedReverbs = [...tone.reverbs];
    const failedGains = [...tone.gains];

    await expect(piano.load()).resolves.toBeUndefined();
    expect(tone.Sampler).toHaveBeenCalledTimes(8);
    failedSamplers.forEach((sampler) => expect(sampler.dispose).toHaveBeenCalledOnce());
    failedFilters.forEach((filter) => expect(filter.dispose).toHaveBeenCalledOnce());
    failedReverbs.forEach((reverb) => expect(reverb.dispose).toHaveBeenCalledOnce());
    failedGains.forEach((gain) => expect(gain.dispose).toHaveBeenCalledOnce());
  });
});
