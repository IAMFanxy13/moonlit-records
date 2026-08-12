"use client";

import { useMemo, useState } from "react";

import type { SongPackage } from "../lib/song";

interface SearchHomeProps {
  songs: SongPackage[];
  onChoose: (song: SongPackage) => void;
}

const PIANO_NAMES = {
  warm: "暖毡三角钢琴",
  concert: "音乐厅三角钢琴",
  bright: "明亮三角钢琴",
  upright: "旧式立式钢琴",
} as const;

export function SearchHome({ songs, onChoose }: SearchHomeProps) {
  const [query, setQuery] = useState("");
  const filteredSongs = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    if (!normalized) return songs;
    return songs.filter((song) =>
      [song.title, song.artist, song.version].some((value) =>
        value.toLocaleLowerCase("zh-CN").includes(normalized),
      ),
    );
  }, [query, songs]);

  return (
    <main className="search-home">
      <nav className="topbar" aria-label="网站导航">
        <a className="wordmark" href="#top" aria-label="月光唱片首页">
          <span className="wordmark-mark" aria-hidden="true">月</span>
          <span>月光唱片</span>
        </a>
        <span className="topbar-note">KEYS BECOME MELODY</span>
      </nav>

      <section className="search-hero" id="top">
        <p className="eyebrow">A QUIET INSTRUMENT FOR ONE</p>
        <h1>今晚，想弹哪一首？</h1>
        <p className="hero-copy">不必会钢琴。跟着歌词，按亮起的键，让电脑键盘替你唱。</p>

        <label className="song-search">
          <span className="sr-only">搜索歌名</span>
          <span className="search-glyph" aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label="搜索歌名"
            placeholder="搜索一首歌…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd>ENTER</kbd>
        </label>
      </section>

      <section className="catalog" aria-labelledby="catalog-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MOONLIT SELECTION</p>
            <h2 id="catalog-title">今夜曲库</h2>
          </div>
          <span>{String(filteredSongs.length).padStart(2, "0")} 首已校准</span>
        </div>

        <div className="song-list">
          {filteredSongs.map((song, index) => (
            <button
              className="song-row"
              key={song.id}
              type="button"
              aria-label={`打开《${song.title}》`}
              onClick={() => onChoose(song)}
            >
              <span className="song-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="song-main">
                <strong>{song.title}</strong>
                <small>{song.artist} · {song.version}</small>
              </span>
              <span className="song-piano">{PIANO_NAMES[song.recommendedPiano]}</span>
              <span className="song-duration">{song.durationLabel}</span>
              <span className="song-arrow" aria-hidden="true">↗</span>
            </button>
          ))}
        </div>

        {filteredSongs.length === 0 && (
          <div className="empty-catalog" role="status">
            <span aria-hidden="true">☾</span>
            <p>这首歌还在月光之外。</p>
            <small>首版先收录已人工校准的曲目。</small>
          </div>
        )}
      </section>

      <footer className="home-footer">
        <span>用一排按键，留住一小段夜晚。</span>
        <span>V1 · PRIVATE LISTENING ROOM</span>
      </footer>
    </main>
  );
}
