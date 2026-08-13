import { describe, expect, it, vi } from "vitest";

import { createPianoEngine, type PianoVoiceChannel } from "./piano-engine";
import { getPianoVoiceProfile } from "./piano-voices";
import type { PianoVoice } from "../lib/song";

function channel(): PianoVoiceChannel {
  return {
    keyDown: vi.fn(() => ({ release: vi.fn() })),
    keyUp: vi.fn((handle) => handle.release()),
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
    const firstVoice = { release: vi.fn() };
    const secondVoice = { release: vi.fn() };
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
});
