"use client";

import { useEffect, useRef, useState } from "react";

import { createBrowserPianoEngine, type PianoPort } from "./audio/piano-engine";
import { getPianoVoiceProfile } from "./audio/piano-voices";
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
        <button className="icon-button entrance-back" type="button" onClick={backToCatalog} aria-label="Back to catalogue">←</button>
        <div className="entrance-record" data-state={view} aria-hidden="true">
          <i /><span>MOONLIT<br />RECORDS</span>
        </div>
        <section className="entrance-copy">
          <p className="eyebrow">PREPARING YOUR PIANO</p>
          <h1>{selectedSong.title}</h1>
          <p>{selectedSong.artist} · {selectedSong.version}</p>
          <span className="entrance-voice">RECOMMENDED VOICE · {getPianoVoiceProfile(selectedSong.recommendedPiano).name}</span>

          {view === "loading" && (
            <div className="loading-note" role="status">
              <i />
              <span>Opening the instrument and preparing the hall…</span>
            </div>
          )}

          {view === "entrance" && (
            <>
              <p className="entrance-instruction">The instrument is ready. Hold a key for a sustained note; release it and the room will carry the sound.</p>
              <button className="primary-button entrance-button" type="button" onClick={enterPerformance}>
                Enter the performance
              </button>
              <small>SOUND ON · HEADPHONES OR SPEAKERS RECOMMENDED</small>
            </>
          )}

          {view === "error" && (
            <>
              <p className="entrance-instruction">The piano could not wake this time. Your selected score is still here.</p>
              <button className="primary-button entrance-button" type="button" onClick={() => chooseSong(selectedSong)}>
                Try again
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
