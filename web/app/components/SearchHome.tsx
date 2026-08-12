"use client";

import { useMemo, useState } from "react";

import { getPianoVoiceProfile } from "../audio/piano-voices";
import type { PrivateSongRecord } from "../import/types";
import type { SongPackage } from "../lib/song";
import { ImportStudio } from "./ImportStudio";

interface SearchHomeProps {
  songs: SongPackage[];
  privateSongs?: SongPackage[];
  onChoose: (song: SongPackage) => void;
  onImported?: (record: PrivateSongRecord) => void;
}

export function SearchHome({ songs, privateSongs = [], onChoose, onImported = () => undefined }: SearchHomeProps) {
  const [query, setQuery] = useState("");
  const allSongs = useMemo(() => [...privateSongs, ...songs], [privateSongs, songs]);
  const filteredSongs = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return allSongs;
    return allSongs.filter((song) =>
      [song.title, song.artist, song.version, ...song.searchAliases].some((value) =>
        value.toLocaleLowerCase().includes(normalized),
      ),
    );
  }, [allSongs, query]);

  return (
    <main className="search-home">
      <nav className="topbar" aria-label="Primary navigation">
        <a className="wordmark" href="#top" aria-label="Moonlit Records home">
          <span className="wordmark-mark" aria-hidden="true">M</span>
          <span>MOONLIT RECORDS</span>
        </a>
        <span className="topbar-note">A PRIVATE INSTRUMENT · EST. AFTER DARK</span>
      </nav>

      <section className="search-hero import-first-hero" id="top">
        <div className="hero-declaration">
          <p className="eyebrow">YOUR RECORDING, ARRANGED FOR THE KEYS</p>
          <p className="hero-kicker">A private recital begins with music you already love.</p>
          <div className="hero-rule" aria-hidden="true"><i /><span>Ⅰ</span></div>
          <p className="hero-aside">Every piano sound waits for your hands. Hold the computer key as you would hold the piano key.</p>
        </div>
        <ImportStudio onImported={onImported} onPerform={onChoose} />
      </section>

      <section className="catalog" aria-labelledby="catalog-title">
        <div className="section-heading library-heading">
          <div>
            <p className="eyebrow">YOUR LIBRARY &amp; PREPARED SCORES</p>
            <h2 id="catalog-title">The night&apos;s repertoire</h2>
          </div>
          <span>{String(filteredSongs.length).padStart(2, "0")} SCORES PREPARED</span>
        </div>

        <label className="song-search library-search">
          <span className="search-glyph" aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label="Search your library"
            placeholder="Search title, artist, or lyric…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd>LIBRARY</kbd>
        </label>

        <div className="song-list">
          {filteredSongs.map((song, index) => (
            <button
              className="song-row"
              key={song.id}
              type="button"
              aria-label={`Open ${song.title}`}
              onClick={() => onChoose(song)}
            >
              <span className="song-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="song-main">
                <strong>{song.title}</strong>
                <small>{song.artist} · {song.version}</small>
              </span>
              <span className="song-piano" data-quality={song.quality}>RECOMMENDED · {getPianoVoiceProfile(song.recommendedPiano).name}</span>
              <span className="song-duration">{song.durationLabel}</span>
              <span className="song-arrow" aria-hidden="true">↗</span>
            </button>
          ))}
        </div>

        {filteredSongs.length === 0 && (
          <div className="empty-catalog" role="status">
            <span aria-hidden="true">○</span>
            <p>No private arrangement carries that name yet.</p>
            <small>Import the recording above and it will join this library.</small>
          </div>
        )}
      </section>

      <footer className="home-footer">
        <span>A little room for music after words.</span>
        <span>PRIVATE LISTENING ROOM · 36-KEY GRAND</span>
      </footer>
    </main>
  );
}
