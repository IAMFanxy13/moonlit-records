import { describe, expect, it, vi } from "vitest";

import { createPianoEngine, type PianoVoiceChannel } from "./piano-engine";
import { getPianoVoiceProfile } from "./piano-voices";
import type { PianoVoice } from "../lib/song";

function channel(): PianoVoiceChannel {
  return {
    attack: vi.fn(),
    release: vi.fn(),
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
  it("attacks a complete voicing through the globally selected voice", async () => {
    const voiceChannels = channels();
    const load = vi.fn().mockResolvedValue(undefined);
    const resume = vi.fn().mockResolvedValue(undefined);
    const piano = createPianoEngine({ channels: voiceChannels, load, resume });

    await piano.load();
    await piano.resume();
    const warmHandle = piano.attack(["C4", "E4", "G4"], 112);
    piano.setVoice("concert");
    const concertHandle = piano.attack(["D4"], 88);

    expect(warmHandle).toMatchObject({ voice: "warm", notes: ["C4", "E4", "G4"] });
    expect(concertHandle).toMatchObject({ voice: "concert", notes: ["D4"] });
    expect(voiceChannels.warm.attack).toHaveBeenCalledWith(["C4", "E4", "G4"], 112 / 127);
    expect(voiceChannels.concert.attack).toHaveBeenCalledWith(["D4"], 88 / 127);
  });

  it("releases an old attack through the voice that originally made it", () => {
    const voiceChannels = channels();
    const piano = createPianoEngine({ channels: voiceChannels, load: async () => undefined, resume: async () => undefined });

    const handle = piano.attack(["C4", "E4", "G4"], 96);
    piano.setVoice("concert");
    piano.release(handle);

    expect(voiceChannels.warm.release).toHaveBeenCalledWith(["C4", "E4", "G4"]);
    expect(voiceChannels.concert.release).not.toHaveBeenCalled();
  });

  it("uses the selected voice tail and clamps velocity", () => {
    const voiceChannels = channels();
    const piano = createPianoEngine({ channels: voiceChannels, load: async () => undefined, resume: async () => undefined });

    piano.attack(["C4"], 300);
    piano.attack(["D4"], -20);
    expect(voiceChannels.warm.attack).toHaveBeenNthCalledWith(1, ["C4"], 1);
    expect(voiceChannels.warm.attack).toHaveBeenNthCalledWith(2, ["D4"], 0);

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
