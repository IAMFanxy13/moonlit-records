import { describe, expect, it } from "vitest";

import { instrumentalTarget } from "./instrumental-route";

describe("instrumental number route", () => {
  it("walks 1 through 0 and back with repeated endpoints", () => {
    expect(Array.from({ length: 22 }, (_, index) => instrumentalTarget(index))).toEqual([
      "Digit1", "Digit2", "Digit3", "Digit4", "Digit5",
      "Digit6", "Digit7", "Digit8", "Digit9", "Digit0",
      "Digit0", "Digit9", "Digit8", "Digit7", "Digit6",
      "Digit5", "Digit4", "Digit3", "Digit2", "Digit1",
      "Digit1", "Digit2",
    ]);
  });
});
