"use client";

import { useEffect, useRef, useState } from "react";

import { createBrowserPianoEngine, type PianoPort } from "./audio/piano-engine";
import { CompletionCard } from "./components/CompletionCard";
import { PlayerShell } from "./components/PlayerShell";
import { SearchHome } from "./components/SearchHome";
import type { PlayerState } from "./lib/player-machine";
import type { SongPackage } from "./lib/song";
import { builtinSongs } from "./lib/songs";

type View = "search" | "loading" | "entrance" | "player" | "complete" | "error";

interface MoonlitPianoProps {
  piano?: PianoPort;
}

export function MoonlitPiano({ piano: injectedPiano }: MoonlitPianoProps) {
  const [piano] = useState<PianoPort>(() => injectedPiano ?? createBrowserPianoEngine());
  const ownsPiano = useRef(!injectedPiano);
  const [view, setView] = useState<View>("search");
  const [selectedSong, setSelectedSong] = useState<SongPackage | null>(null);
  const [finalState, setFinalState] = useState<PlayerState | null>(null);
  const loadRequest = useRef(0);

  useEffect(() => () => {
    if (ownsPiano.current) piano.dispose();
  }, [piano]);

  const chooseSong = async (song: SongPackage) => {
    const request = ++loadRequest.current;
    setSelectedSong(song);
    setFinalState(null);
    setView("loading");
    piano.setVoice(song.recommendedPiano);
    try {
      await piano.load();
      if (request === loadRequest.current) setView("entrance");
    } catch {
      if (request === loadRequest.current) setView("error");
    }
  };

  const enterPerformance = async () => {
    try {
      await piano.resume();
      setView("player");
    } catch {
      setView("error");
    }
  };

  const backToCatalog = () => {
    loadRequest.current += 1;
    piano.releaseAll();
    setView("search");
    setSelectedSong(null);
    setFinalState(null);
  };

  if (view === "search") return <SearchHome songs={builtinSongs} onChoose={chooseSong} />;

  if ((view === "loading" || view === "entrance" || view === "error") && selectedSong) {
    return (
      <main className="entrance-shell">
        <button className="icon-button entrance-back" type="button" onClick={backToCatalog} aria-label="返回曲库">←</button>
        <div className="entrance-record" data-state={view} aria-hidden="true">
          <i /><span>MOONLIT<br />RECORDS</span>
        </div>
        <section className="entrance-copy">
          <p className="eyebrow">PREPARING YOUR PIANO</p>
          <h1>{selectedSong.title}</h1>
          <p>{selectedSong.artist} · {selectedSong.version}</p>

          {view === "loading" && (
            <div className="loading-note" role="status">
              <i />
              <span>正在为你打开琴盖…</span>
            </div>
          )}

          {view === "entrance" && (
            <>
              <p className="entrance-instruction">声音已经就位。按下开始后，网页会接住你的每一次落键。</p>
              <button className="primary-button entrance-button" type="button" onClick={enterPerformance}>
                打开琴盖，开始演奏
              </button>
              <small>请保持声音开启 · 建议使用耳机</small>
            </>
          )}

          {view === "error" && (
            <>
              <p className="entrance-instruction">钢琴没有顺利醒来。可以再试一次，曲目不会丢。</p>
              <button className="primary-button entrance-button" type="button" onClick={() => chooseSong(selectedSong)}>
                再试一次
              </button>
            </>
          )}
        </section>
      </main>
    );
  }

  if (view === "player" && selectedSong) {
    return (
      <PlayerShell
        song={selectedSong}
        piano={piano}
        onExit={backToCatalog}
        onComplete={(state) => {
          setFinalState(state);
          setView("complete");
        }}
      />
    );
  }

  if (view === "complete" && selectedSong && finalState) {
    return (
      <CompletionCard
        song={selectedSong}
        state={finalState}
        onAgain={() => {
          setFinalState(null);
          setView("player");
        }}
        onCatalog={backToCatalog}
      />
    );
  }

  return null;
}
