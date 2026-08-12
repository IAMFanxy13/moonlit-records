"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PianoPort } from "../audio/piano-engine";
import { isPlayableCode, labelForCode } from "../lib/keyboard";
import {
  createPlayerState,
  pressKey,
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

const VOICE_NAMES: Record<PianoVoice, string> = {
  warm: "暖毡",
  concert: "音乐厅",
  bright: "明亮",
  upright: "旧立式",
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName);
}

export function PlayerShell({ song, piano, onExit, onComplete }: PlayerShellProps) {
  const [playerState, setPlayerState] = useState(() => startPlayer(createPlayerState(song)));
  const [feedback, setFeedback] = useState<KeyFeedback | null>(null);
  const [pressedCodes, setPressedCodes] = useState<Set<string>>(() => new Set());
  const [voice, setVoice] = useState<PianoVoice>(song.recommendedPiano);
  const attackedNotes = useRef(new Map<string, string>());
  const completedOnce = useRef(false);

  const currentEvent = song.events[playerState.eventIndex];
  const progress = Math.round((playerState.eventIndex / song.events.length) * 100);

  const releaseEverything = useCallback(() => {
    piano.releaseAll();
    attackedNotes.current.clear();
    setPressedCodes(new Set());
  }, [piano]);

  useEffect(() => {
    piano.setVoice(voice);
  }, [piano, voice]);

  useEffect(() => {
    if (playerState.status === "complete" && !completedOnce.current) {
      completedOnce.current = true;
      releaseEverything();
      onComplete(playerState);
    }
  }, [onComplete, playerState, releaseEverything]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 260);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isTypingTarget(event.target) || !isPlayableCode(event.code)) return;
      event.preventDefault();
      setPressedCodes((current) => new Set(current).add(event.code));

      setPlayerState((current) => {
        const result = pressKey(current, song, event.code);
        if (result.sound) {
          const previousNote = attackedNotes.current.get(event.code);
          if (previousNote) piano.release(previousNote);
          piano.attack(result.sound.note, result.sound.velocity);
          attackedNotes.current.set(event.code, result.sound.note);
          setFeedback({ code: event.code, kind: result.sound.kind });
        }
        return result.state;
      });
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const note = attackedNotes.current.get(event.code);
      if (note) {
        piano.release(note);
        attackedNotes.current.delete(event.code);
      }
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
      piano.releaseAll();
    };
  }, [piano, releaseEverything, song]);

  const feedbackCopy = useMemo(() => {
    if (playerState.status === "paused") return "已暂停，随手按键仍可即兴";
    if (feedback?.kind === "wrong" && currentEvent) {
      return `${labelForCode(feedback.code)} 不是这一拍，${labelForCode(currentEvent.targetCode)} 还在等你`;
    }
    if (feedback?.kind === "correct") return "对了，让余音落下";
    return "按亮起的键 · 其他键仍会发出自己的琴声";
  }, [currentEvent, feedback, playerState.status]);

  const handleVoiceChange = (nextVoice: PianoVoice) => {
    setVoice(nextVoice);
    piano.setVoice(nextVoice);
  };

  const handlePause = () => {
    releaseEverything();
    setPlayerState((current) => togglePause(current));
  };

  const handleRestart = () => {
    releaseEverything();
    completedOnce.current = false;
    setFeedback(null);
    setPlayerState((current) => startPlayer(restartPlayer(current)));
  };

  return (
    <main className="player-shell">
      <header className="player-header">
        <button className="icon-button back-button" type="button" onClick={onExit} aria-label="返回曲库">←</button>
        <div className="track-title">
          <p>{song.artist}</p>
          <h1>{song.title}</h1>
        </div>
        <div className="player-actions">
          <label className="voice-picker">
            <span>琴色</span>
            <select
              aria-label="选择钢琴音色"
              value={voice}
              onChange={(event) => handleVoiceChange(event.target.value as PianoVoice)}
            >
              {(Object.keys(VOICE_NAMES) as PianoVoice[]).map((item) => (
                <option key={item} value={item}>{VOICE_NAMES[item]}</option>
              ))}
            </select>
          </label>
          <button className="text-button" type="button" onClick={handleRestart}>从头来</button>
          <button className="pause-button" type="button" onClick={handlePause}>
            {playerState.status === "paused" ? "继续" : "暂停"}
          </button>
        </div>
      </header>

      <div className="player-progress" aria-label={`歌曲进度 ${progress}%`}>
        <i style={{ width: `${progress}%` }} />
      </div>

      <LyricStage song={song} eventIndex={playerState.eventIndex} />

      <div className="performance-status" data-kind={feedback?.kind ?? playerState.status} aria-live="polite">
        <span>{feedbackCopy}</span>
        <strong>{playerState.eventIndex} / {song.events.length}</strong>
      </div>

      <ScreenKeyboard
        targetCode={playerState.status === "complete" ? null : currentEvent?.targetCode ?? null}
        feedback={feedback}
        pressedCodes={pressedCodes}
      />

      <div className="mobile-performance-note">
        <span aria-hidden="true">⌨</span>
        <strong>请用电脑打开演奏</strong>
        <p>手机端可以选歌；完整键盘与即兴演奏会在电脑上出现。</p>
      </div>

      <footer className="player-footer">
        <button type="button" onClick={() => setPlayerState((current) => rewindPhrase(current, song))}>↶ 重弹本句</button>
        <span>按错不会跳过，弹对才继续</span>
        <span>{VOICE_NAMES[voice]} · SALAMANDER GRAND</span>
      </footer>
    </main>
  );
}
