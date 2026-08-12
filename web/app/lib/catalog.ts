import type { CatalogSong } from "./song";
import { builtinSongs } from "./songs";

export function searchSongs(query: string): CatalogSong[] {
  const normalized = query.trim().toLocaleLowerCase();
  return builtinSongs
    .filter((song) => {
      if (!normalized) return true;
      return [song.title, song.artist, song.version]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalized);
    })
    .map((song) => ({ ...song, status: "ready" as const }));
}
