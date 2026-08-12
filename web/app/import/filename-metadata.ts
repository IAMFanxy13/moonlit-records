import type { ImportedMetadata } from "./types";

export function parseFilenameMetadata(filename: string): ImportedMetadata {
  const withoutExtension = filename.trim().replace(/\.[^.]+$/u, "").trim();
  if (!withoutExtension) return { title: "Imported Track", artist: "Unknown Artist" };

  const pieces = withoutExtension.split(/\s+[-–—]\s+/u).map((piece) => piece.trim()).filter(Boolean);
  if (pieces.length >= 2) {
    return {
      artist: pieces[0],
      title: pieces.slice(1).join(" - "),
    };
  }

  return { title: withoutExtension, artist: "Unknown Artist" };
}
