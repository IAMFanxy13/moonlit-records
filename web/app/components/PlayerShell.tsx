"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PianoKeyHandle, PianoPort } from "../audio/piano-engine";
import { createPerformanceDiagnostics } from "../audio/performance-diagnostics";
import { getPianoVoiceProfile, PIANO_VOICE_ORDER } from "../audio/piano-voices";
import { canonicalPerformanceCode, defaultNoteFor, eventInputCodes, eventInputLabel, isPerformanceInputCode, isPlayableCode, labelForCode } from "../lib/keyboard";
import {
  createPlayerState,
  finishRinging,
  pressKey,
  releaseKey,
  restartPlayer,
  rewindPhrase,
  seekPlayerToPhrase,
  startPlayer,
  togglePause,
  type PlayerState,
} from "../lib/player-machine";
import {
  clearResonance,
  createPhraseResonanceState,
  deferVoice,
  expireVoice,
  prepareGestureAttack,
  type ResonanceTransition,
} from "../lib/phrase-resonance";
import { getGuidedVelocity, getReleasePlan, getScoreTargetDurationMs } from "../lib/piano-performance";
import { getScoreOnsetMs } from "../lib/piano-performance";
import { mapGestureValues, mapGestureVelocities, planPianoGesture } from "../lib/piano-gesture";
import { buildLeftHandCues, leftHandCuePositionLabel } from "../lib/left-hand-cues";
import { createHumanTempoFollower } from "../lib/human-tempo-follower";
import type { PianoVoice, SongPackage } from "../lib/song";
import { normalizeSongPackage } from "../lib/song-normalizer";
import { arrangeTwoHandSong } from "../lib/two-hand-arranger";
import { scaleSongTempo } from "../lib/tempo";
import { LyricStage } from "./LyricStage";
import { RhythmGuide, SharedDurationBar } from "./RhythmGuide";
import { ScreenKeyboard, type KeyFeedback } from "./ScreenKeyboard";

interface PlayerShellProps {
  song: SongPackage;
  piano: PianoPort;
  onExit: () => void;
  onComplete: (state: PlayerState) => void;
  /** Test seam; production and local development always enable the arranger. */
  autoArrangeLeftHand?: boolean;
}

interface PlayedVoice {
  handle: PianoKeyHandle;
  kind: "correct" | "wrong" | "free";
  eventIndex: number | null;
  phraseIndex: number | null;
  notes: readonly string[];
}

interface GuidedDuration {
  handleId: number;
  eventIndex: number;
  startedAt: number;
}

const PERFORMANCE_DIAGNOSTICS_ENABLED = process.env.NODE_ENV === "development";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName);
}

export function PlayerShell({
  song,
  piano,
  onExit,
  onComplete,
  autoArrangeLeftHand = process.env.NODE_ENV !== "test",
}: PlayerShellProps) {
  const [tempo, setTempo] = useState(song.tempoBpm ?? 72);
  const normalizedSong = useMemo(() => {
    const normalized = normalizeSongPackage(song);
    return autoArrangeLeftHand ? arrangeTwoHandSong(normalized) : normalized;
  }, [autoArrangeLeftHand, song]);
  const performanceSong = useMemo(() => scaleSongTempo(normalizedSong, tempo), [normalizedSong, tempo]);
  const [playerState, setPlayerState] = useState(() => startPlayer(createPlayerState(normalizedSong)));
  const playerStateRef = useRef(playerState);
  const [feedback, setFeedback] = useState<KeyFeedback | null>(null);
  const [pressedCodes, setPressedCodes] = useState<Set<string>>(() => new Set());
  const [voice, setVoice] = useState<PianoVoice>(song.recommendedPiano);
  const [restRemainingMs, setRestRemainingMs] = useState(
    () => performanceSong.events[0]?.restBeforeMs ?? 0,
  );
  const attackedVoices = useRef(new Map<string, PlayedVoice>());
  const resonance = useRef(createPhraseResonanceState());
  const resonanceTimers = useRef(new Map<number, number>());
  const [resonantVoiceCount, setResonantVoiceCount] = useState(0);
  const [guidedDuration, setGuidedDuration] = useState<GuidedDuration | null>(null);
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const completedRests = useRef(new Set<string>());
  const completedOnce = useRef(false);
  const completionTimer = useRef<number | null>(null);
  const diagnostics = useRef(createPerformanceDiagnostics({
    enabled: PERFORMANCE_DIAGNOSTICS_ENABLED,
  }));
  const tempoFollower = useRef(createHumanTempoFollower());

  const commitPlayerState = useCallback((next: PlayerState) => {
    playerStateRef.current = next;
    setPlayerState(next);
  }, []);

  const currentEvent = performanceSong.events[playerState.eventIndex];
  const durationGuideIndex = guidedDuration?.eventIndex ?? playerState.eventIndex;
  const durationGuideEvent = guidedDuration
    ? performanceSong.events[durationGuideIndex]
    : currentEvent;
  const durationGuidePositionLabel = useMemo(() => {
    if (!durationGuideEvent || !eventInputCodes(durationGuideEvent).includes("Space")) return undefined;
    const cue = buildLeftHandCues(performanceSong, durationGuideEvent.phraseIndex)
      .find((item) => item.eventIndex === durationGuideIndex);
    return cue ? leftHandCuePositionLabel(cue.position) : undefined;
  }, [durationGuideEvent, durationGuideIndex, performanceSong]);
  const progress = Math.round((playerState.eventIndex / performanceSong.events.length) * 100);
  const phraseLookupIndex = Math.min(playerState.eventIndex, performanceSong.events.length - 1);
  const currentPhraseIndex = performanceSong.events[phraseLookupIndex]?.phraseIndex ?? 0;
  const currentPhrase = performanceSong.phrases[currentPhraseIndex];
  const isResting = restRemainingMs > 0;

  const applyResonanceTransition = useCallback((transition: ResonanceTransition) => {
    resonance.current = transition.state;
    transition.release.forEach((releasedVoice) => {
      const handle = releasedVoice.handle;
      const timer = resonanceTimers.current.get(handle.id);
      if (timer !== undefined) window.clearTimeout(timer);
      resonanceTimers.current.delete(handle.id);
      const fadeOutSeconds = transition.reason === "next-attack" || transition.reason === "capacity"
        ? releasedVoice.releasePlan.transitionFadeOutSeconds
        : releasedVoice.releasePlan.fadeOutSeconds;
      if (transition.reason !== "target") {
        piano.cancelScheduledRelease(handle);
        piano.keyUp(handle, { fadeOutSeconds });
      }
    });
    if (transition.release.length > 0) {
      const releasedIds = new Set(transition.release.map((item) => item.id));
      setGuidedDuration((current) => current && releasedIds.has(current.handleId) ? null : current);
    }
    setResonantVoiceCount(transition.state.voices.length);
  }, [piano]);

  const cancelCompletionTimer = useCallback(() => {
    if (completionTimer.current === null) return;
    window.clearTimeout(completionTimer.current);
    completionTimer.current = null;
  }, []);

  const clearResonanceTimers = useCallback(() => {
    resonanceTimers.current.forEach((timer) => window.clearTimeout(timer));
    resonanceTimers.current.clear();
  }, []);

  const releaseEverything = useCallback(() => {
    cancelCompletionTimer();
    clearResonanceTimers();
    resonance.current.voices.forEach((voice) => piano.cancelScheduledRelease(voice.handle));
    resonance.current = clearResonance(resonance.current).state;
    attackedVoices.current.clear();
    piano.releaseAll();
    setResonantVoiceCount(0);
    setGuidedDuration(null);
    setPressedCodes(new Set());
  }, [cancelCompletionTimer, clearResonanceTimers, piano]);

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
  }, [applyResonanceTransition, performanceSong, playerState.eventIndex, playerState.status]);

  useEffect(() => {
    cancelCompletionTimer();
    if (
      playerState.status !== "ringing" ||
      pressedCodes.size > 0 ||
      attackedVoices.current.size > 0 ||
      resonantVoiceCount > 0
    ) return;

    completionTimer.current = window.setTimeout(() => {
      completionTimer.current = null;
      commitPlayerState(finishRinging(playerStateRef.current));
    }, piano.tailMs());

    return cancelCompletionTimer;
  }, [cancelCompletionTimer, commitPlayerState, piano, playerState.status, pressedCodes, resonantVoiceCount, voice]);

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

  useEffect(() => releaseEverything, [releaseEverything]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        attackedVoices.current.has(event.code) ||
        isTypingTarget(event.target) ||
        !isPerformanceInputCode(event.code)
      ) return;
      event.preventDefault();
      const diagnosticNow = performance.now();
      if (PERFORMANCE_DIAGNOSTICS_ENABLED) {
        diagnostics.current.keyDown(event.code, diagnosticNow, {
          activePhysicalVoices: attackedVoices.current.size + 1,
          activeResonanceVoices: resonance.current.voices.length,
          runtime: piano.runtimeInfo(),
        });
      }
      const canonicalCode = canonicalPerformanceCode(event.code);
      setPressedCodes((current) => new Set(current).add(canonicalCode));

      if (isResting) {
        if (isPlayableCode(canonicalCode)) {
          const notes = [defaultNoteFor(canonicalCode)];
          const handle = piano.keyDown(notes, 78);
          attackedVoices.current.set(event.code, {
            handle,
            kind: "free",
            eventIndex: null,
            phraseIndex: null,
            notes,
          });
          if (PERFORMANCE_DIAGNOSTICS_ENABLED) {
            diagnostics.current.audioAttack(event.code, performance.now(), {
              activePhysicalVoices: attackedVoices.current.size,
              activeResonanceVoices: resonance.current.voices.length,
              runtime: piano.runtimeInfo(),
            });
          }
          setFeedback({ code: canonicalCode, kind: "free" });
        }
        return;
      }

      const current = playerStateRef.current;
      const eventIndex = current.eventIndex;
      const result = pressKey(current, performanceSong, event.code, event.timeStamp);
      commitPlayerState(result.state);
      if (result.sound) {
        const gesturePlan = result.sound.kind === "correct" && result.gesture
          ? planPianoGesture(result.gesture, performanceSong.events[eventIndex]?.token == null)
          : null;
        if (result.sound.kind === "correct" && result.gesture) {
          applyResonanceTransition(
            prepareGestureAttack(resonance.current, result.gesture, {
              phraseIndex: performanceSong.events[eventIndex].phraseIndex,
              notes: gesturePlan?.notes ?? result.sound.notes,
              articulation: result.gesture.articulation,
            }),
          );
        }
        const guidedScale = result.sound.kind === "correct"
          ? getGuidedVelocity(performanceSong, eventIndex) / Math.max(1, performanceSong.events[eventIndex].velocity)
          : 1;
        const velocity = result.sound.kind === "correct" && result.gesture?.velocities?.length
          ? result.gesture.velocities.map((item) => Math.max(1, Math.min(127, Math.round(item * 127 * guidedScale))))
          : result.sound.kind === "correct"
            ? Math.max(1, Math.min(127, Math.round(result.sound.velocity * guidedScale)))
            : result.sound.velocity;
        const plannedVelocity = gesturePlan && (
          Array.isArray(velocity) || gesturePlan.velocityScales.some((scale) => scale !== 1)
        )
          ? mapGestureVelocities(gesturePlan, velocity)
          : velocity;
        const playedNotes = gesturePlan?.notes ?? result.sound.notes;
        const handle = piano.keyDown(playedNotes, plannedVelocity, gesturePlan?.attackOffsetsMs);
        const playedVoice: PlayedVoice = {
          handle,
          kind: result.sound.kind,
          eventIndex: result.sound.kind === "correct" ? eventIndex : null,
          phraseIndex: result.sound.kind === "correct"
            ? performanceSong.events[eventIndex].phraseIndex
            : null,
          notes: playedNotes,
        };
        attackedVoices.current.set(event.code, playedVoice);
        if (playedVoice.kind === "correct" && playedVoice.phraseIndex !== null) {
          if (result.firstPart) {
            tempoFollower.current.observe({
              actualAtMs: diagnosticNow,
              scoreOnsetMs: getScoreOnsetMs(performanceSong, eventIndex),
              hasRest: Boolean(performanceSong.events[eventIndex].restBeforeMs),
            });
          }
          const releasePlan = getReleasePlan(
            performanceSong,
            eventIndex,
            handle.voice,
            resonance.current.voices.length,
            tempoFollower.current.scale(),
          );
          applyResonanceTransition(deferVoice(resonance.current, {
            id: handle.id,
            handle,
            phraseIndex: playedVoice.phraseIndex,
            notes: playedVoice.notes,
            releasedAt: performance.now(),
            releasePlan,
            hand: result.gesture?.hand ?? "right",
            harmonyId: result.gesture?.harmonyId,
            pedalIntent: result.gesture?.pedalIntent,
          }));
          const gestureDurations = result.gesture?.durationsMs?.length
            ? (gesturePlan
              ? mapGestureValues(gesturePlan, result.gesture.durationsMs)
              : result.gesture.durationsMs
            ).map((duration) => Math.max(80, Math.round(duration * tempoFollower.current.scale())))
            : null;
          const scheduledDuration = gestureDurations ?? releasePlan.targetDurationMs;
          piano.scheduleRelease(handle, scheduledDuration, {
            fadeOutSeconds: releasePlan.fadeOutSeconds,
          });
          if (result.firstPart) {
            setGuidedDuration({
              handleId: handle.id,
              eventIndex,
              startedAt: performance.now(),
            });
          }
          const timer = window.setTimeout(() => {
            resonanceTimers.current.delete(handle.id);
            applyResonanceTransition(expireVoice(resonance.current, handle.id));
          }, Array.isArray(scheduledDuration) ? Math.max(...scheduledDuration) : scheduledDuration);
          resonanceTimers.current.set(handle.id, timer);
        }
        if (PERFORMANCE_DIAGNOSTICS_ENABLED) {
          diagnostics.current.audioAttack(event.code, performance.now(), {
            activePhysicalVoices: attackedVoices.current.size,
            activeResonanceVoices: resonance.current.voices.length,
            runtime: piano.runtimeInfo(),
          });
        }
        setFeedback({ code: canonicalCode, kind: result.sound.kind });
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const played = attackedVoices.current.get(event.code);
      if (played) {
        attackedVoices.current.delete(event.code);
        if (played.kind !== "correct") {
          piano.keyUp(played.handle);
        }
      }
      if (PERFORMANCE_DIAGNOSTICS_ENABLED) {
        diagnostics.current.keyUp(event.code, performance.now(), {
          activePhysicalVoices: attackedVoices.current.size,
          activeResonanceVoices: resonance.current.voices.length,
          runtime: piano.runtimeInfo(),
        });
      }
      const result = releaseKey(
        playerStateRef.current,
        performanceSong,
        event.code,
        event.timeStamp,
      );
      commitPlayerState(result.state);
      const canonicalCode = canonicalPerformanceCode(event.code);
      setPressedCodes((current) => {
        if (!current.has(canonicalCode)) return current;
        const next = new Set(current);
        next.delete(canonicalCode);
        return next;
      });
    };

    const pauseForInterruption = () => {
      releaseEverything();
      tempoFollower.current.reset();
      const current = playerStateRef.current;
      commitPlayerState(current.status === "playing"
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
    };
  }, [applyResonanceTransition, commitPlayerState, isResting, performanceSong, piano, releaseEverything]);

  const feedbackCopy = useMemo(() => {
    if (playerState.status === "ringing") return "LET IT RING";
    if (playerState.status === "paused") return "Paused — the keyboard remains open for free play.";
    if (isResting) return `Silent rest — the next key opens in ${(restRemainingMs / 1000).toFixed(1)}s.`;
    if (feedback?.kind === "wrong" && currentEvent) {
      return `${labelForCode(feedback.code)} is free play. ${eventInputLabel(currentEvent)} is still waiting.`;
    }
    if (feedback?.kind === "correct") return "The score is shaping this note; play the next key when you want the next note.";
    return "The bar previews musical duration. Guided keyup never cuts the melody short.";
  }, [currentEvent, feedback, isResting, playerState.status, restRemainingMs]);

  const handleVoiceChange = (nextVoice: PianoVoice) => {
    setVoice(nextVoice);
  };

  const handlePause = () => {
    releaseEverything();
    tempoFollower.current.reset();
    commitPlayerState(togglePause(playerStateRef.current));
  };

  const handleRestart = () => {
    releaseEverything();
    tempoFollower.current.reset();
    completedOnce.current = false;
    completedRests.current.clear();
    setFeedback(null);
    commitPlayerState(startPlayer(restartPlayer(playerStateRef.current)));
  };

  const handleExit = () => {
    releaseEverything();
    onExit();
  };

  const handleSeekPhrase = (phraseIndex: number) => {
    releaseEverything();
    tempoFollower.current.reset();
    completedOnce.current = false;
    completedRests.current.clear();
    setFeedback(null);
    const nextState = seekPlayerToPhrase(playerStateRef.current, performanceSong, phraseIndex);
    const target = performanceSong.events[nextState.eventIndex];
    if (target?.restBeforeMs) completedRests.current.add(target.id);
    commitPlayerState(nextState);
    setLineDialogOpen(false);
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
          <button className="text-button" type="button" onClick={() => setLineDialogOpen(true)}>Start from line</button>
          <button className="pause-button" type="button" onClick={handlePause}>
            {playerState.status === "paused" ? "Resume" : "Pause"}
          </button>
        </div>
      </header>

      <div
        className="player-progress"
        title={`LINE ${currentPhraseIndex + 1} / ${performanceSong.phrases.length} — ${currentPhrase?.text || "Instrumental"}`}
      >
        <i style={{ width: `${progress}%` }} />
        <input
          aria-label="Song line"
          type="range"
          min={0}
          max={Math.max(0, performanceSong.phrases.length - 1)}
          step={1}
          value={currentPhraseIndex}
          onChange={(event) => handleSeekPhrase(Number(event.target.value))}
        />
        <span>LINE {String(currentPhraseIndex + 1).padStart(2, "0")} / {String(performanceSong.phrases.length).padStart(2, "0")}</span>
      </div>

      {lineDialogOpen && (
        <div className="line-dialog-backdrop">
          <section
            className="line-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Start from line"
          >
            <header><span>START FROM LINE</span><button type="button" onClick={() => setLineDialogOpen(false)} aria-label="Close line selector">×</button></header>
            <div>
              {performanceSong.phrases.map((phrase, phraseIndex) => (
                <button
                  key={phrase.id}
                  type="button"
                  aria-label={`Line ${phraseIndex + 1} ${phrase.text || "Instrumental"}`}
                  data-current={phraseIndex === currentPhraseIndex}
                  onClick={() => handleSeekPhrase(phraseIndex)}
                >
                  <small>{String(phraseIndex + 1).padStart(2, "0")}</small>
                  <span>{phrase.text || "Instrumental"}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      <LyricStage
        song={performanceSong}
        eventIndex={playerState.eventIndex}
        completedCodes={playerState.completedPartCodes}
      />

      {!["ringing", "complete"].includes(playerState.status) && (
        <RhythmGuide
          song={performanceSong}
          eventIndex={playerState.eventIndex}
          restRemainingMs={restRemainingMs}
          completedCodes={playerState.completedPartCodes}
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
          key={`${durationGuideEvent.id}-${guidedDuration?.startedAt ?? "preview"}`}
          event={durationGuideEvent}
          durationMs={getScoreTargetDurationMs(performanceSong, durationGuideIndex)}
          active={Boolean(guidedDuration)}
          resting={isResting && !guidedDuration}
          positionLabel={durationGuidePositionLabel}
        />
      )}

      <ScreenKeyboard
        targetCodes={["ringing", "complete"].includes(playerState.status) || isResting || !currentEvent
          ? []
          : eventInputCodes(currentEvent).filter((code) => !(playerState.completedPartCodes ?? []).includes(code))}
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
          tempoFollower.current.reset();
          completedRests.current.clear();
          commitPlayerState(rewindPhrase(playerStateRef.current, performanceSong));
        }}>↶ Replay this line</button>
        <span>A–Z melody · A–Z + Space two hands · Shift instrumental.</span>
        <span>{getPianoVoiceProfile(voice).name} · SALAMANDER GRAND</span>
      </footer>
    </main>
  );
}
