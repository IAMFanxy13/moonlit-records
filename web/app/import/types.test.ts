import { describe, expect, it } from "vitest";

import { IMPORT_STAGE_SEQUENCE } from "./types";

describe("import stages", () => {
  it("describes the truthful free processing sequence", () => {
    expect(IMPORT_STAGE_SEQUENCE).toEqual([
      "preparing",
      "rendering",
      "recognizing",
      "interpreting",
      "arranging",
      "ready",
    ]);
  });
});
