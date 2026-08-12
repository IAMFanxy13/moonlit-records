import { describe, expect, it } from "vitest";

import { parseFilenameMetadata } from "./filename-metadata";

describe("filename metadata", () => {
  it("reads an Artist - Title convention without keeping the extension", () => {
    expect(parseFilenameMetadata("周杰伦 - 晴天.mp3")).toEqual({ title: "晴天", artist: "周杰伦" });
  });

  it("keeps a lone filename as a title and does not invent an artist", () => {
    expect(parseFilenameMetadata("My private recording.m4a")).toEqual({
      title: "My private recording",
      artist: "Unknown Artist",
    });
  });

  it("uses honest fallback metadata for an empty or extension-only name", () => {
    expect(parseFilenameMetadata(".wav")).toEqual({ title: "Imported Track", artist: "Unknown Artist" });
  });
});
