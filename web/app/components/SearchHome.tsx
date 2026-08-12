"use client";

import { useMemo, useState } from "react";

import { getPianoVoiceProfile } from "../audio/piano-voices";
import type { SongPackage } from "../lib/song";

interface SearchHomeProps {
  songs: SongPackage[];
  onChoose: (song: SongPackage) => void;
}

export function SearchHome({ songs, onChoose }: SearchHomeProps) {
  const [query, setQuery] = useState("");
  const filteredSongs = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return songs;
    return songs.filter((song) =>
      [song.title, song.artist, song.version, ...song.searchAliases].some((value) =>
        value.toLocaleLowerCase().includes(normalized),
      ),
    );
  }, [query, songs]);

  return (
    <main className="search-home">
      <nav className="topbar" aria-label="Primary navigation">
        <a className="wordmark" href="#top" aria-label="Moonlit Records home">
          <span className="wordmark-mark" aria-hidden="true">M</span>
          <span>MOONLIT RECORDS</span>
        </a>
        <span className="topbar-note">YOUR KEYBOARD, IN CONCERT · EST. AFTER DARK</span>
      </nav>

      <section className="search-hero" id="top">
        <p className="eyebrow">A PRIVATE CONCERT, ONE KEY AT A TIME</p>
        <h1>Find your song</h1>
        <p className="hero-copy">Play freely, or let lyric initials turn familiar words into melody.</p>

        <label className="song-search">
          <span className="sr-only">Search songs</span>
          <span className="search-glyph" aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label="Search songs"
            placeholder="Search title, artist, or lyric…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd>ENTER</kbd>
        </label>
      </section>

      <section className="catalog" aria-labelledby="catalog-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CURATED FOR THE KEYS</p>
            <h2 id="catalog-title">The night&apos;s repertoire</h2>
          </div>
          <span>{String(filteredSongs.length).padStart(2, "0")} SCORES PREPARED</span>
        </div>

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
              <span className="song-piano">RECOMMENDED · {getPianoVoiceProfile(song.recommendedPiano).name}</span>
              <span className="song-duration">{song.durationLabel}</span>
              <span className="song-arrow" aria-hidden="true">↗</span>
            </button>
          ))}
        </div>

        {filteredSongs.length === 0 && (
          <div className="empty-catalog" role="status">
            <span aria-hidden="true">○</span>
            <p>That song is still beyond tonight&apos;s catalogue.</p>
            <small>Try another title, artist, or lyric phrase.</small>
          </div>
        )}
      </section>

      <footer className="home-footer">
        <span>A little room for music after words.</span>
        <span>PRIVATE LISTENING ROOM · SALAMANDER GRAND</span>
      </footer>
    </main>
  );
}
