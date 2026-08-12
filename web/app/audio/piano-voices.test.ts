import { describe, expect, it } from "vitest";
import { getPianoVoiceProfile, PIANO_VOICE_ORDER } from "./piano-voices";

describe("piano voice profiles", () => {
  it("gives every voice an international instrument name", () => {
    expect(PIANO_VOICE_ORDER).toEqual(["warm", "bright", "upright", "concert"]);
    expect(getPianoVoiceProfile("warm").name).toBe("Felt Grand");
    expect(getPianoVoiceProfile("bright").name).toBe("Studio Grand");
    expect(getPianoVoiceProfile("upright").name).toBe("Vintage Upright");
    expect(getPianoVoiceProfile("concert").name).toBe("Concert Grand");
  });

  it("budgets the longest hall tail for Concert Grand", () => {
    const concert = getPianoVoiceProfile("concert");
    const studio = getPianoVoiceProfile("bright");
    const felt = getPianoVoiceProfile("warm");

    expect(concert.reverbDecay).toBeGreaterThan(felt.reverbDecay);
    expect(concert.tailMs).toBeGreaterThan(felt.tailMs);
    expect(felt.tailMs).toBeGreaterThan(studio.tailMs);
  });
});
