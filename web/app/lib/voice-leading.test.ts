import { describe, expect, it } from "vitest";

import { nearestVoicing } from "./voice-leading";

describe("voice leading", () => {
  it("keeps common tones and chooses nearby chord inversions", () => {
    expect(nearestVoicing([0, 5, 9], ["C4", "E4", "G4"], { low: 48, high: 72 }))
      .toEqual(["C4", "F4", "A4"]);
  });

  it("returns an ordered voicing inside the requested range", () => {
    const notes = nearestVoicing([7, 11, 2], [], { low: 36, high: 55 });
    expect(notes).toEqual(["G2", "B2", "D3"]);
  });
});
