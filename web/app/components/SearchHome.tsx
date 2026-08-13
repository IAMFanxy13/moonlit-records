"use client";

import { useMemo, useState } from "react";

import { getPianoVoiceProfile } from "../audio/piano-voices";
import type { PrivateSongRecord } from "../import/types";
import type { SongPackage } from "../lib/song";
import { ImportStudio } from "./ImportStudio";

interface SearchHomeProps {
  songs: SongPackage[];
  privateSongs?: SongPackage[];
  privateRecords?: PrivateSongRecord[];
  libraryError?: string | null;
  onChoose: (song: SongPackage) => void;
  onImported?: (record: PrivateSongRecord) => void;
  onRenamePrivate?: (record: PrivateSongRecord, title: string) => void | Promise<void>;
  onDeletePrivate?: (record: PrivateSongRecord) => void | Promise<void>;
}

interface CatalogItem {
  song: SongPackage;
  record?: PrivateSongRecord;
}

export function SearchHome({
  songs,
  privateSongs = [],
  privateRecords = [],
  libraryError = null,
  onChoose,
  onImported = () => undefined,
  onRenamePrivate = () => undefined,
  onDeletePrivate = () => undefined,
}: SearchHomeProps) {
  const [query, setQuery] = useState("");
  const [manageId, setManageId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const allItems = useMemo<CatalogItem[]>(() => {
    const recordItems = privateRecords.map((record) => ({ song: record.song, record }));
    const recordIds = new Set(privateRecords.map((record) => record.id));
    const legacyPrivateItems = privateSongs
      .filter((song) => !recordIds.has(song.id))
      .map((song) => ({ song }));
    return [...recordItems, ...legacyPrivateItems, ...songs.map((song) => ({ song }))];
  }, [privateRecords, privateSongs, songs]);
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return allItems;
    return allItems.filter(({ song }) =>
      [song.title, song.artist, song.version, ...song.searchAliases].some((value) =>
        value.toLocaleLowerCase().includes(normalized),
      ),
    );
  }, [allItems, query]);

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
          <p className="eyebrow">YOUR CODE, ARRANGED FOR THE KEYS</p>
          <p className="hero-kicker">A private recital begins with a score prepared just for you.</p>
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
          <span>{String(filteredItems.length).padStart(2, "0")} SCORES PREPARED</span>
        </div>

        {libraryError && <p className="import-error" role="alert">{libraryError}</p>}

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
          {filteredItems.map(({ song, record }, index) => {
            const row = (
              <button
                className="song-row"
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
            );
            if (!record) return <div key={song.id}>{row}</div>;
            const menuOpen = manageId === record.id;
            return (
              <div className="private-song-row" key={song.id}>
                {row}
                <button
                  className="song-manage"
                  type="button"
                  aria-label={`Manage ${song.title}`}
                  aria-expanded={menuOpen}
                  onClick={() => {
                    setManageId(menuOpen ? null : record.id);
                    setEditingId(null);
                    setDeletingId(null);
                  }}
                >
                  •••
                </button>
                {menuOpen && (
                  <aside className="song-manage-panel" aria-label={`Private arrangement controls for ${song.title}`}>
                    {editingId === record.id ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          const title = draftTitle.trim();
                          if (!title) return;
                          void onRenamePrivate(record, title);
                          setEditingId(null);
                          setManageId(null);
                        }}
                      >
                        <label>
                          <span>NEW TITLE</span>
                          <input
                            aria-label={`Rename ${song.title}`}
                            value={draftTitle}
                            onChange={(event) => setDraftTitle(event.target.value)}
                          />
                        </label>
                        <div><button type="submit" disabled={!draftTitle.trim()}>Save name</button><button type="button" onClick={() => setEditingId(null)}>Cancel</button></div>
                      </form>
                    ) : deletingId === record.id ? (
                      <div className="song-delete-confirm">
                        <p>Delete this private arrangement forever?</p>
                        <div><button type="button" onClick={() => { void onDeletePrivate(record); setManageId(null); setDeletingId(null); }}>Delete forever</button><button type="button" onClick={() => setDeletingId(null)}>Cancel</button></div>
                      </div>
                    ) : (
                      <div className="song-manage-actions">
                        <button type="button" onClick={() => { setDraftTitle(song.title); setEditingId(record.id); }}>Rename</button>
                        <button type="button" onClick={() => setDeletingId(record.id)}>Delete</button>
                      </div>
                    )}
                  </aside>
                )}
              </div>
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <div className="empty-catalog" role="status">
            <span aria-hidden="true">○</span>
            <p>No private arrangement carries that name yet.</p>
            <small>Paste the score code above and it will join this library.</small>
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
