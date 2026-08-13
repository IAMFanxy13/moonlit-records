"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PianoKeyHandle, PianoPort } from "../audio/piano-engine";
import { getPianoVoiceProfile, PIANO_VOICE_ORDER } from "../audio/piano-voices";
import { defaultNoteFor, isPerformanceInputCode, isPlayableCode, labelForCode } from "../lib/keyboard";
import {
  createPlayerState,
  finishRinging,
  pressKey,
  releaseKey,
  restartPlayer,
  rewindPhrase,
  startPlayer,
  togglePause,
  type PlayerState,
} from "../lib/player-machine";
import type { PianoVoice, SongPackage } from "../lib/song";
import { normalizeSongPackage } from "../lib/song-normalizer";
import { scaleSongTempo } from "../lib/tempo";
import { LyricStage } from "./LyricStage";
import { RhythmGuide, SharedDurationBar } from "./RhythmGuide";
import { ScreenKeyboard, type KeyFeedback } from "./ScreenKeyboard";

interface PlayerShellProps {
  song: SongPackage;
  piano: PianoPort;
  onExit: () => void;
  onComplete: (state: PlayerState) => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName);
}

export function PlayerShell({ song, piano, onExit, onComplete }: PlayerShellProps) {
  const [tempo, setTempo] = useState(song.tempoBpm ?? 72);
  const normalizedSong = useMemo(() => normalizeSongPackage(song), [song]);
  const performanceSong = useMemo(() => scaleSongTempo(normalizedSong, tempo), [normalizedSong, tempo]);
  const [playerState, setPlayerState] = useState(() => startPlayer(createPlayerState(normalizedSong)));
  const [feedback, setFeedback] = useState<KeyFeedback | null>(null);
  const [pressedCodes, setPressedCodes] = useState<Set<string>>(() => new Set());
  const [voice, setVoice] = useState<PianoVoice>(song.recommendedPiano);
  const [restRemainingMs, setRestRemainingMs] = useState(
    () => performanceSong.events[0]?.restBeforeMs ?? 0,
  );
  const attackedHandles = useRef(new Map<string, PianoKeyHandle>());
  const completedRests = useRef(new Set<string>());
  const completedOnce = useRef(false);
  const completionTimer = useRef<number | null>(null);

  const currentEvent = performanceSong.events[playerState.eventIndex];
  const latestActiveHold = Object.values(playerState.activeHolds)
    .sort((left, right) => right.startedAt - left.startedAt)[0];
  const heldGuideEvent = latestActiveHold
    ? performanceSong.events[latestActiveHold.eventIndex]
    : undefined;
  const durationGuideEvent = heldGuideEvent ?? currentEvent;
  const progress = Math.round((playerState.eventIndex / performanceSong.events.length) * 100);
  const isResting = restRemainingMs > 0;

  const releaseEverything = useCallback(() => {
    piano.releaseAll();
    attackedHandles.current.clear();
    setPressedCodes(new Set());
  }, [piano]);

  const cancelCompletionTimer = useCallback(() => {
    if (completionTimer.current === null) return;
    window.clearTimeout(completionTimer.current);
    completionTimer.current = null;
  }, []);

  useEffect(() => {
    piano.setVoice(voice);
  }, [piano, voice]);

  useEffect(() => {
    const event = performanceSong.events[playerState.eventIndex];
    const restMs = event?.restBeforeMs ?? 0;
    if (
      playerState.status !== "playing" ||
      !event ||
      restMs <= 0 ||
      completedRests.current.has(event.id)
    ) {
      setRestRemainingMs(0);
      return;
    }

    setRestRemainingMs(restMs);
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setRestRemainingMs(Math.max(0, restMs - (Date.now() - startedAt)));
    }, 50);
    const timeout = window.setTimeout(() => {
      completedRests.current.add(event.id);
      setRestRemainingMs(0);
    }, restMs);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [performanceSong, playerState.eventIndex, playerState.status]);

  useEffect(() => {
    cancelCompletionTimer();
    if (playerState.status !== "ringing" || pressedCodes.size > 0) return;

    completionTimer.current = window.setTimeout(() => {
      completionTimer.current = null;
      setPlayerState((current) => finishRinging(current));
    }, piano.tailMs());

    return cancelCompletionTimer;
  }, [cancelCompletionTimer, piano, playerState.status, pressedCodes, voice]);

  useEffect(() => {
    if (playerState.status === "complete" && !completedOnce.current) {
      completedOnce.current = true;
      onComplete(playerState);
    }
  }, [onComplete, playerState]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 260);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") event.preventDefault();
      if (
        event.repeat ||
        attackedHandles.current.has(event.code) ||
        isTypingTarget(event.target) ||
        !isPerformanceInputCode(event.code)
      ) return;
      event.preventDefault();
      setPressedCodes((current) => new Set(current).add(event.code));

      setPlayerState((current) => {
        if (isResting) {
          if (isPlayableCode(event.code)) {
            const handle = piano.keyDown([defaultNoteFor(event.code)], 78);
            attackedHandles.current.set(event.code, handle);
            setFeedback({ code: event.code, kind: "free" });
          }
          return current;
        }
        const result = pressKey(current, performanceSong, event.code, event.timeStamp);
        if (result.sound) {
          const handle = piano.keyDown(result.sound.notes, result.sound.velocity);
          attackedHandles.current.set(event.code, handle);
          setFeedback({ code: event.code, kind: result.sound.kind });
        }
        return result.state;
      });
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const handle = attackedHandles.current.get(event.code);
      if (handle) {
        piano.keyUp(handle);
        attackedHandles.current.delete(event.code);
      }
      setPlayerState((current) => {
        const result = releaseKey(current, performanceSong, event.code, event.timeStamp);
        return result.state;
      });
      setPressedCodes((current) => {
        if (!current.has(event.code)) return current;
        const next = new Set(current);
        next.delete(event.code);
        return next;
      });
    };

    const pauseForInterruption = () => {
      releaseEverything();
      setPlayerState((current) => current.status === "playing"
        ? togglePause(current)
        : { ...current, activeHolds: {} });
    };

    const handleVisibility = () => {
      if (document.hidden) pauseForInterruption();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", pauseForInterruption);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", pauseForInterruption);
      document.removeEventListener("visibilitychange", handleVisibility);
      cancelCompletionTimer();
      piano.releaseAll();
    };
  }, [cancelCompletionTimer, isResting, performanceSong, piano, releaseEverything]);

  const feedbackCopy = useMemo(() => {
    if (playerState.status === "ringing") return "LET IT RING";
    if (playerState.status === "paused") return "Paused — the keyboard remains open for free play.";
    if (isResting) return `Silent rest — the next key opens in ${(restRemainingMs / 1000).toFixed(1)}s.`;
    if (feedback?.kind === "wrong" && currentEvent) {
      return `${labelForCode(feedback.code)} is free play. ${labelForCode(currentEvent.targetCode)} is still waiting.`;
    }
    if (feedback?.kind === "correct") return "The guide is draining — release whenever you choose.";
    return "The bar is guidance only. It moves only while you hold the expected key.";
  }, [currentEvent, feedback, isResting, playerState.status, restRemainingMs]);

  const handleVoiceChange = (nextVoice: PianoVoice) => {
    setVoice(nextVoice);
  };

  const handlePause = () => {
    releaseEverything();
    setPlayerState((current) => togglePause(current));
  };

  const handleRestart = () => {
    cancelCompletionTimer();
    releaseEverything();
    completedOnce.current = false;
    completedRests.current.clear();
    setFeedback(null);
    setPlayerState((current) => startPlayer(restartPlayer(current)));
  };

  const handleExit = () => {
    cancelCompletionTimer();
    releaseEverything();
    onExit();
  };

  return (
    <main className="player-shell">
      <header className="player-header">
        <button className="icon-button back-button" type="button" onClick={handleExit} aria-label="Back to catalogue">←</button>
        <div className="track-title">
          <p>{song.artist}</p>
          <h1>{song.title}</h1>
        </div>
        <div className="player-actions">
          <label className="tempo-picker">
            <span>TEMPO <b>{tempo} BPM</b></span>
            <input
              aria-label="Tempo"
              type="range"
              min={50}
              max={120}
              step={1}
              value={tempo}
              onChange={(event) => setTempo(Number(event.target.value))}
            />
          </label>
          <label className="voice-picker">
            <span>VOICE</span>
            <select
              aria-label="Select piano voice"
              value={voice}
              onChange={(event) => handleVoiceChange(event.target.value as PianoVoice)}
            >
              {PIANO_VOICE_ORDER.map((item) => (
                <option key={item} value={item}>{getPianoVoiceProfile(item).name}</option>
              ))}
            </select>
          </label>
          <button className="text-button" type="button" onClick={handleRestart}>Restart</button>
          <button className="pause-button" type="button" onClick={handlePause}>
            {playerState.status === "paused" ? "Resume" : "Pause"}
          </button>
        </div>
      </header>

      <div className="player-progress" aria-label={`Song progress ${progress}%`}>
        <i style={{ width: `${progress}%` }} />
      </div>

      <LyricStage song={performanceSong} eventIndex={playerState.eventIndex} />

      {!["ringing", "complete"].includes(playerState.status) && (
        <RhythmGuide
          song={performanceSong}
          eventIndex={playerState.eventIndex}
          restRemainingMs={restRemainingMs}
        />
      )}

      <div className="performance-status" data-kind={playerState.status === "ringing" ? "ringing" : feedback?.kind ?? playerState.status} aria-live="polite">
        <span>
          <b>{feedbackCopy}</b>
          {playerState.status === "ringing" && <small>The hall is holding your final note.</small>}
        </span>
        <strong>{playerState.eventIndex} / {performanceSong.events.length}</strong>
      </div>

      {durationGuideEvent && playerState.status !== "complete" && (
        <SharedDurationBar
          key={`${durationGuideEvent.id}-${latestActiveHold?.startedAt ?? "preview"}`}
          event={durationGuideEvent}
          active={Boolean(latestActiveHold)}
          resting={isResting && !heldGuideEvent}
        />
      )}

      <ScreenKeyboard
        targetCode={["ringing", "complete"].includes(playerState.status) || isResting ? null : currentEvent?.targetCode ?? null}
        feedback={feedback}
        pressedCodes={pressedCodes}
      />

      <div className="mobile-performance-note">
        <span aria-hidden="true">⌨</span>
        <strong>Open on a computer to perform</strong>
        <p>Song selection works here. The full free piano and lyric-guided keyboard appear on desktop.</p>
      </div>

      <footer className="player-footer">
        <button type="button" onClick={() => {
          releaseEverything();
          completedRests.current.clear();
          setPlayerState((current) => rewindPhrase(current, performanceSong));
        }}>↶ Replay this line</button>
        <span>Pinyin initials guide the melody; every key stays free.</span>
        <span>{getPianoVoiceProfile(voice).name} · SALAMANDER GRAND</span>
      </footer>
    </main>
  );
}
