import { describe, expect, it } from "vitest";
import { searchSongs } from "./catalog";

describe("searchSongs", () => {
  it("shows English metadata while remaining searchable through Chinese aliases", () => {
    expect(searchSongs("月光")).toEqual([
      expect.objectContaining({ title: "Hello, Moonlight", status: "ready" }),
    ]);
    expect(searchSongs("小星星")[0]?.title).toBe("Twinkle, Twinkle, Little Star");
  });

  it("finds songs by artist or alias and returns the full catalog for an empty query", () => {
    expect(searchSongs("anonymous").length).toBeGreaterThan(0);
    expect(searchSongs("贝多芬")[0]?.title).toBe("Ode to Joy · Excerpt");
    expect(searchSongs("").length).toBe(3);
    expect(searchSongs("").every((song) => song.status === "ready")).toBe(true);
  });

  it("recommends a piano voice that suits each arrangement", () => {
    expect(searchSongs("hello")[0]?.recommendedPiano).toBe("warm");
    expect(searchSongs("twinkle")[0]?.recommendedPiano).toBe("bright");
    expect(searchSongs("ode to joy")[0]?.recommendedPiano).toBe("concert");
  });
});
