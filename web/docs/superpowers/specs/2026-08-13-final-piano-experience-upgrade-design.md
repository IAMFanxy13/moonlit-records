# Moonlit Records Final Piano Experience Upgrade Design

## Intent

Keep Moonlit Records a human-played computer-keyboard piano: the player creates every onset, while the score and audio engine make each already-created note end musically. No automatic notes, scoring, pedal key, MIDI, OCR, network service, or unrelated redesign is introduced.

The user-supplied final specification is the approved product design. This document records the implementation boundaries used in the existing codebase.

## Architecture

Playback remains split into three independent layers:

1. `player-machine.ts` owns the score cursor and physical key ownership.
2. `piano-engine.ts` owns exact audio voices. A small Tone source adapter is the only module allowed to touch Sampler private source collections.
3. `PlayerShell.tsx` coordinates score-aware release policy, tempo following, phrase seek, and presentation.

Correct guided `keydown` creates a voice and immediately advances the score. Guided `keyup` removes physical ownership only. The audio engine schedules the target release on Tone's audio clock. A later real correct `keydown` can cancel that future release and replace it with an immediate, bounded legato release. JavaScript timers may mirror this for UI and stale-state cleanup but are not the musical clock.

## Phrase navigation

The existing song progress strip becomes an accessible phrase range control. It snaps to phrase boundaries and previews `LINE x / y` plus phrase text. A `START FROM LINE` dialog exposes the same destinations as an explicit list.

Seeking is silent and atomic: release all voices, cancel audio-clock releases and UI timers, clear held keys, rests, feedback, completion, and tempo-follow history, then move to the destination phrase's first playable event. The selected voice and manual BPM survive. Paused playback remains paused; ringing and complete become playable. A leading rest on the destination is considered consumed because the user explicitly chose that line.

## Musical duration and tempo following

Authored duration remains the target, not a judgment. A bounded human-tempo follower compares recent real correct-onset intervals with score onset intervals, rejects rests, idle gaps, interruptions, and outliers, then applies a robust median plus EMA scale only to release windows. It never moves the score cursor or creates notes.

Articulation distinguishes continuation inside one lyric token, a new lyric token, repeated pitch, rest, and phrase ending. Dynamics use cumulative score time and optional meter metadata instead of counting every fourth event.

## Audio and assets

The current compact Salamander bank is audited before any replacement. A larger bank or convolution impulse is adopted only if the source is official, licensing is explicit, the bundle remains practical, and measured/listening evidence demonstrates a material improvement. Otherwise the existing local bank remains, with transparent documented limits.

Four existing voices remain. Studio Grand stays the stable default behavior. Runtime diagnostics report AudioContext state, base/output latency, output timestamp, current audio time, and Tone look-ahead where supported.

## Compatibility and safety

MOONLIT-SCORE/1, saved songs, lyric-token normalization, free play, A-Z/1-0/Space, wrong-key free sound, pause, restart, replay-line, tempo, and completion remain compatible. Every lifecycle transition and browser interruption releases all exact handles and cancels scheduled releases to prevent stuck notes.

## Verification

Tests cover audio scheduling/cancellation, same-note ownership, phrase seek from every player status, leading rests, tempo follower filtering/reset, score-time dynamics, diagnostics, and full PlayerShell integration. Final verification includes the full automated suite, lint, type/build, sample measurements, and local browser exercise.
