import { describe, expect, it, vi } from "vitest";
import { createPianoEngine } from "./piano-engine";
import { getPianoVoiceProfile } from "./piano-voices";

describe("piano engine", () => {
  it("normalizes MIDI velocity and forwards attack and release", async () => {
    const sampler = {
      triggerAttack: vi.fn(),
      triggerRelease: vi.fn(),
      releaseAll: vi.fn(),
      dispose: vi.fn(),
    };
    const load = vi.fn().mockResolvedValue(undefined);
    const resume = vi.fn().mockResolvedValue(undefined);
    const configureVoice = vi.fn();
    const piano = createPianoEngine({ sampler, load, resume, configureVoice });

    await piano.load();
    await piano.resume();
    piano.setVoice("upright");
    piano.attack("G4", 112);
    piano.release("G4");
    piano.releaseAll();
    piano.dispose();

    expect(load).toHaveBeenCalledOnce();
    expect(resume).toHaveBeenCalledOnce();
    expect(configureVoice).toHaveBeenCalledWith("upright");
    expect(piano.tailMs()).toBe(getPianoVoiceProfile("upright").tailMs);
    expect(sampler.triggerAttack).toHaveBeenCalledWith("G4", undefined, 112 / 127);
    expect(sampler.triggerRelease).toHaveBeenCalledWith("G4");
    expect(sampler.releaseAll).toHaveBeenCalledOnce();
    expect(sampler.dispose).toHaveBeenCalledOnce();
  });

  it("changes its acoustic tail immediately with the selected voice", () => {
    const sampler = {
      triggerAttack: vi.fn(),
      triggerRelease: vi.fn(),
      releaseAll: vi.fn(),
      dispose: vi.fn(),
    };
    const piano = createPianoEngine({
      sampler,
      load: async () => undefined,
      resume: async () => undefined,
    });

    expect(piano.tailMs()).toBe(getPianoVoiceProfile("warm").tailMs);
    piano.setVoice("concert");
    expect(piano.tailMs()).toBe(getPianoVoiceProfile("concert").tailMs);
  });

  it("clamps velocity to the sampler's zero-to-one range", () => {
    const sampler = {
      triggerAttack: vi.fn(),
      triggerRelease: vi.fn(),
      releaseAll: vi.fn(),
      dispose: vi.fn(),
    };
    const piano = createPianoEngine({
      sampler,
      load: async () => undefined,
      resume: async () => undefined,
    });

    piano.attack("C4", 300);
    piano.attack("C4", -20);
    expect(sampler.triggerAttack).toHaveBeenNthCalledWith(1, "C4", undefined, 1);
    expect(sampler.triggerAttack).toHaveBeenNthCalledWith(2, "C4", undefined, 0);
  });
});
