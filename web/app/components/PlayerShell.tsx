"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PianoAttackHandle, PianoPort } from "../audio/piano-engine";
import { getPianoVoiceProfile, PIANO_VOICE_ORDER } from "../audio/piano-voices";
import { isPlayableCode, labelForCode } from "../lib/keyboard";
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
import { LyricStage } from "./LyricStage";
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
  const [playerState, setPlayerState] = useState(() => startPlayer(createPlayerState(song)));
  const [feedback, setFeedback] = useState<KeyFeedback | null>(null);
  const [pressedCodes, setPressedCodes] = useState<Set<string>>(() => new Set());
  const [voice, setVoice] = useState<PianoVoice>(song.recommendedPiano);
  const [earlyHold, setEarlyHold] = useState(false);
  const attackedHandles = useRef(new Map<string, PianoAttackHandle>());
  const completedOnce = useRef(false);
  const completionTimer = useRef<number | null>(null);

  const currentEvent = song.events[playerState.eventIndex];
  const progress = Math.round((playerState.eventIndex / song.events.length) * 100);

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
      if (
        event.repeat ||
        attackedHandles.current.has(event.code) ||
        isTypingTarget(event.target) ||
        !isPlayableCode(event.code)
      ) return;
      event.preventDefault();
      setPressedCodes((current) => new Set(current).add(event.code));

      setPlayerState((current) => {
        const result = pressKey(current, song, event.code, event.timeStamp);
        if (result.sound) {
          const handle = piano.attack(result.sound.notes, result.sound.velocity);
          attackedHandles.current.set(event.code, handle);
          setEarlyHold(false);
          setFeedback({ code: event.code, kind: result.sound.kind });
        }
        return result.state;
      });
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const handle = attackedHandles.current.get(event.code);
      if (handle) {
        piano.release(handle);
        attackedHandles.current.delete(event.code);
      }
      setPlayerState((current) => {
        const result = releaseKey(current, song, event.code, event.timeStamp);
        if (result.holdResult === "early") setEarlyHold(true);
        if (result.holdResult === "complete") setEarlyHold(false);
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
      setPlayerState((current) => current.status === "playing" ? togglePause(current) : current);
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
  }, [cancelCompletionTimer, piano, releaseEverything, song]);

  const feedbackCopy = useMemo(() => {
    if (playerState.status === "ringing") return "LET IT RING";
    if (playerState.status === "paused") return "Paused — the keyboard remains open for free play.";
    if (earlyHold) return "Release was early — press and hold the illuminated key once more.";
    if (feedback?.kind === "wrong" && currentEvent) {
      return `${labelForCode(feedback.code)} is free play. ${labelForCode(currentEvent.targetCode)} is still waiting.`;
    }
    if (feedback?.kind === "correct") return "That is the note — let it breathe.";
    return "Follow the illuminated initial. Every other key remains your piano.";
  }, [currentEvent, earlyHold, feedback, playerState.status]);

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
    setEarlyHold(false);
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

      <LyricStage song={song} eventIndex={playerState.eventIndex} />

      <div className="performance-status" data-kind={playerState.status === "ringing" ? "ringing" : feedback?.kind ?? playerState.status} aria-live="polite">
        <span>
          <b>{feedbackCopy}</b>
          {playerState.status === "ringing" && <small>The hall is holding your final note.</small>}
        </span>
        <strong>{playerState.eventIndex} / {song.events.length}</strong>
      </div>

      <ScreenKeyboard
        targetCode={["ringing", "complete"].includes(playerState.status) ? null : currentEvent?.targetCode ?? null}
        feedback={feedback}
        pressedCodes={pressedCodes}
      />

      <div className="mobile-performance-note">
        <span aria-hidden="true">⌨</span>
        <strong>Open on a computer to perform</strong>
        <p>Song selection works here. The full free piano and lyric-guided keyboard appear on desktop.</p>
      </div>

      <footer className="player-footer">
        <button type="button" onClick={() => setPlayerState((current) => rewindPhrase(current, song))}>↶ Replay this line</button>
        <span>Pinyin initials guide the melody; every key stays free.</span>
        <span>{getPianoVoiceProfile(voice).name} · SALAMANDER GRAND</span>
      </footer>
    </main>
  );
}
