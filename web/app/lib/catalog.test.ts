import { describe, expect, it } from "vitest";
import { searchSongs } from "./catalog";

describe("searchSongs", () => {
  it("finds a ready song by title", () => {
    expect(searchSongs("月光")).toEqual([
      expect.objectContaining({ title: "你好，月光", status: "ready" }),
    ]);
  });

  it("finds songs by artist and returns the full catalog for an empty query", () => {
    expect(searchSongs("佚名").length).toBeGreaterThan(0);
    expect(searchSongs("").length).toBe(3);
    expect(searchSongs("").every((song) => song.status === "ready")).toBe(true);
  });
});
