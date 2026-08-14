import { describe, expect, it } from "vitest";

import { mapGestureVelocities, planPianoGesture } from "./piano-gesture";

describe("piano gesture planner", () => {
  it("uses deterministic short offsets for a soft upward roll", () => {
    expect(planPianoGesture({
      hand: "right", targetCode: "KeyH", notes: ["G4", "B4", "E5"], gestureType: "softRollUp",
    }, false)).toMatchObject({
      notes: ["G4", "B4", "E5"],
      attackOffsetsMs: [0, 25, 50],
    });
  });

  it("reverses note order for a downward roll and bounds a lyric gesture", () => {
    const plan = planPianoGesture({
      hand: "right", targetCode: "KeyH", notes: ["C4", "E4", "G4", "C5"], gestureType: "rollDown",
    }, false);
    expect(plan.notes).toEqual(["C5", "G4", "E4", "C4"]);
    expect(Math.max(...plan.attackOffsetsMs)).toBeLessThanOrEqual(180);
  });

  it("chooses richer but bounded defaults for left-hand and instrumental gestures", () => {
    expect(planPianoGesture({ hand: "left", targetCode: "Space", notes: ["C2", "G2", "C3"] }, false).attackOffsetsMs)
      .toEqual([0, 35, 70]);
    expect(planPianoGesture({ hand: "right", targetCode: "Shift", notes: ["C4", "E4", "G4", "C5"] }, true).attackOffsetsMs)
      .toEqual([0, 35, 70, 105]);
  });

  it("turns a standalone lyric note into a melody-led octave gesture", () => {
    const plan = planPianoGesture({ hand: "right", targetCode: "KeyA", notes: ["E5"] }, false);

    expect(plan.notes).toEqual(["E5", "E6"]);
    expect(plan.attackOffsetsMs).toEqual([0, 18]);
    expect(plan.velocityScales).toEqual([1, 0.58]);
    expect(mapGestureVelocities(plan, 100)).toEqual([100, 58]);
  });

  it("gives a standalone Shift the same restrained octave fullness", () => {
    const plan = planPianoGesture({ hand: "right", targetCode: "Shift", notes: ["C4"] }, true);

    expect(plan.notes).toEqual(["C4", "C5"]);
    expect(plan.velocityScales).toEqual([1, 0.58]);
  });

  it("turns a one-note standalone Space into an open bass gesture", () => {
    const plan = planPianoGesture({ hand: "left", targetCode: "Space", notes: ["C2"] }, true);

    expect(plan.notes).toEqual(["C2", "G2", "C3"]);
    expect(plan.attackOffsetsMs).toEqual([0, 32, 64]);
    expect(plan.velocityScales).toEqual([1, 0.72, 0.56]);
  });

  it("keeps an explicit single-note block literal and preserves existing chords", () => {
    const block = planPianoGesture({
      hand: "right", targetCode: "KeyA", notes: ["E5"], gestureType: "block",
    }, false);
    const chord = planPianoGesture({
      hand: "left", targetCode: "Space", notes: ["C2", "G2", "C3"], gestureType: "rollUp",
    }, false);

    expect(block.notes).toEqual(["E5"]);
    expect(block.velocityScales).toEqual([1]);
    expect(chord.notes).toEqual(["C2", "G2", "C3"]);
    expect(chord.velocityScales).toEqual([1, 1, 1]);
  });
});
