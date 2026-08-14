import { describe, expect, it } from "vitest";

import { createHumanTempoFollower } from "./human-tempo-follower";

describe("human tempo follower", () => {
  it("uses real-to-score onset ratios to gently lengthen release windows", () => {
    const follower = createHumanTempoFollower();
    follower.observe({ actualAtMs: 0, scoreOnsetMs: 0 });
    follower.observe({ actualAtMs: 1_100, scoreOnsetMs: 1_000 });
    follower.observe({ actualAtMs: 2_200, scoreOnsetMs: 2_000 });
    follower.observe({ actualAtMs: 3_300, scoreOnsetMs: 3_000 });

    expect(follower.scale()).toBeGreaterThan(1);
    expect(follower.scale()).toBeLessThanOrEqual(1.1);
  });

  it("learns a steady slow typing cadence quickly enough to keep phrases connected", () => {
    const follower = createHumanTempoFollower();
    follower.observe({ actualAtMs: 0, scoreOnsetMs: 0 });
    for (let index = 1; index <= 5; index += 1) {
      follower.observe({ actualAtMs: index * 1_600, scoreOnsetMs: index * 1_000 });
    }

    expect(follower.scale()).toBeGreaterThan(1.5);
    expect(follower.scale()).toBeLessThanOrEqual(1.6);
  });

  it("uses low-confidence caps before trusting the first two slow intervals", () => {
    const follower = createHumanTempoFollower();
    follower.observe({ actualAtMs: 0, scoreOnsetMs: 0 });
    follower.observe({ actualAtMs: 1_800, scoreOnsetMs: 1_000 });
    expect(follower.scale()).toBeLessThanOrEqual(1.07);

    follower.observe({ actualAtMs: 3_600, scoreOnsetMs: 2_000 });
    expect(follower.scale()).toBeLessThanOrEqual(1.23);
  });

  it("does not let one plausible hesitation dominate otherwise steady timing", () => {
    const follower = createHumanTempoFollower();
    follower.observe({ actualAtMs: 0, scoreOnsetMs: 0 });
    follower.observe({ actualAtMs: 1_800, scoreOnsetMs: 1_000 });
    follower.observe({ actualAtMs: 2_800, scoreOnsetMs: 2_000 });
    follower.observe({ actualAtMs: 3_800, scoreOnsetMs: 3_000 });

    expect(follower.scale()).toBeLessThan(1.15);
  });

  it("rejects an outlier without letting one accidental pause dominate", () => {
    const follower = createHumanTempoFollower();
    follower.observe({ actualAtMs: 0, scoreOnsetMs: 0 });
    follower.observe({ actualAtMs: 1_000, scoreOnsetMs: 1_000 });
    follower.observe({ actualAtMs: 2_000, scoreOnsetMs: 2_000 });
    const before = follower.scale();
    follower.observe({ actualAtMs: 9_000, scoreOnsetMs: 3_000 });

    expect(follower.scale()).toBe(before);
  });

  it("ignores rests and the first onset after an interruption", () => {
    const follower = createHumanTempoFollower();
    follower.observe({ actualAtMs: 0, scoreOnsetMs: 0 });
    follower.observe({ actualAtMs: 1_200, scoreOnsetMs: 1_000, hasRest: true });
    follower.observe({ actualAtMs: 2_400, scoreOnsetMs: 2_000 });

    expect(follower.scale()).toBe(1);
  });

  it("hard-clamps extreme but valid playing rates and resets deterministically", () => {
    const follower = createHumanTempoFollower();
    follower.observe({ actualAtMs: 0, scoreOnsetMs: 0 });
    for (let index = 1; index <= 24; index += 1) {
      follower.observe({ actualAtMs: index * 2_200, scoreOnsetMs: index * 1_000 });
    }
    expect(follower.scale()).toBe(1.75);

    follower.reset();
    expect(follower.scale()).toBe(1);
  });
});
