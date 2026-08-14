# Continuous Piano Gesture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace digit-based instrumental control with A–Z / Space / Shift input, retain clearly projected four-position Space cues, and add deterministic piano gestures, voice leading, and phrase-aware continuity.

**Architecture:** Preserve the current player state machine, owned Tone source handles, sampler channels, release plans, and two-hand score parts. Add small pure planning modules between normalized score events and the existing audio engine, then wire them into `PlayerShell` without introducing automatic event playback.

**Tech Stack:** TypeScript 5.9, React 19, Tone.js 15, Vitest 4, Testing Library, vinext/Vite.

## Global Constraints

- Modify the current isolated worktree only; preserve unrelated dirty changes.
- Real physical keydown remains the only way to attack or advance a score event.
- Do not add Ctrl, Alt, pedals, modifier combinations, scoring, MIDI, or automatic accompaniment playback.
- Keep local Salamander samples, existing voices, per-note velocity, human tempo follower, articulation, pedal intent, and independent audio handles.
- Lyric gesture attack offsets must not exceed 180ms.
- Prefer compatibility conversion at runtime over rewriting persisted songs.

---

### Task 1: Canonical Shift instrumental route

**Files:**
- Modify: `app/lib/keyboard.ts`
- Modify: `app/lib/song-normalizer.ts`
- Modify: `app/components/ScreenKeyboard.tsx`
- Modify: `app/components/RhythmGuide.tsx`
- Modify: `app/components/LyricStage.tsx`
- Test: `app/lib/keyboard.test.ts`
- Test: `app/lib/song-normalizer.test.ts`
- Test: `app/lib/two-hand-player.test.ts`
- Test: `app/components/ScreenKeyboard.test.tsx`
- Test: `app/components/RhythmGuide.test.tsx`
- Test: `app/components/LyricStage.test.tsx`

**Interfaces:**
- Produces `INSTRUMENTAL_MELODY_CODE = "Shift"` and canonical `ShiftLeft|ShiftRight -> Shift`.
- Migrates lyric-free legacy digit events to Shift during normalization.

- [ ] Write tests asserting physical left/right Shift are accepted, legacy Digit2 becomes Shift, one Shift advances one instrumental event, numbers no longer target guided play, and all instrumental UI says SHIFT.
- [ ] Run `npm test -- --run app/lib/keyboard.test.ts app/lib/song-normalizer.test.ts app/lib/two-hand-player.test.ts app/components/ScreenKeyboard.test.tsx app/components/RhythmGuide.test.tsx app/components/LyricStage.test.tsx` and confirm the new assertions fail for Digit2/ignored Shift.
- [ ] Implement canonical Shift handling, legacy migration, on-screen Shift key, and copy changes without removing A–Z free piano.
- [ ] Re-run the focused tests and confirm they pass.

### Task 2: Non-blocking 120ms input fusion

**Files:**
- Create: `app/lib/input-fusion.ts`
- Create: `app/lib/input-fusion.test.ts`
- Modify: `app/lib/player-machine.ts`
- Modify: `app/lib/player-machine.test.ts`
- Modify: `app/components/PlayerShell.tsx`
- Modify: `app/components/PlayerShell.test.tsx`

**Interfaces:**
- Produces `CHORD_INPUT_WINDOW_MS = 120` and `classifyFusedInput(firstAtMs, secondAtMs)` returning `"fused" | "late"`.
- `KeyResult` exposes fusion classification for diagnostics; score advancement remains in `pressKey`.

- [ ] Write tests for letter-first at 120ms, Space-first at 120ms, 121ms late recovery, immediate first-part sound, no timer advance, and no duplicate attack from repeat/held keys.
- [ ] Run the focused input/player tests and confirm failure.
- [ ] Implement the pure fusion classifier and add the first-part timestamp to player event state; accept late recovery without scoring or auto-advance.
- [ ] Wire diagnostics/UI state in `PlayerShell` without delaying `piano.keyDown`.
- [ ] Re-run focused tests and confirm pass.

### Task 3: Preserve and generate four-position Space cues

**Files:**
- Create: `app/lib/score-input-migration.ts`
- Create: `app/lib/score-input-migration.test.ts`
- Modify: `app/lib/two-hand-arranger.ts`
- Modify: `app/lib/two-hand-arranger.test.ts`
- Modify: `app/components/LyricStage.tsx`
- Modify: `app/components/LyricStage.test.tsx`
- Modify: `app/components/PlayerShell.tsx`
- Modify: `app/components/ScreenKeyboard.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- `two-hand-arranger.ts` may generate standalone or simultaneous Space parts at phrase start, phrase end, a lyric onset, or the midpoint between two lyric onsets.
- `left-hand-cues.ts` projects those four relations without changing lyric token ownership or the one-line lyric layout.
- UI consumes `eventInputLabel`, shows `LETTER + SPACE` for simultaneous input, and previews standalone Space with the star rail.

- [x] Write tests for phrase-start, simultaneous, midpoint, and phrase-end Space generation, no duplicated lyric dots, and `H + SPACE` rendering.
- [x] Implement sparse deterministic Space generation while preserving explicitly authored left-hand parts.
- [x] Keep the positional star-track, single-line lyrics, per-token letters, and multi-note dots.
- [x] Run focused arranger, cue, and LyricStage tests and confirm pass.

### Task 4: Deterministic piano gesture templates

**Files:**
- Create: `app/lib/piano-gesture.ts`
- Create: `app/lib/piano-gesture.test.ts`
- Modify: `app/lib/song.ts`
- Modify: `app/import/moonlit-score-v2.ts`
- Modify: `app/import/moonlit-score-v2.test.ts`
- Modify: `app/audio/piano-engine.ts`
- Modify: `app/audio/piano-engine.test.ts`
- Modify: `app/components/PlayerShell.tsx`
- Modify: `app/components/PlayerShell.test.tsx`

**Interfaces:**
- Adds `PianoGestureType = "block" | "softRollUp" | "rollUp" | "rollDown" | "grace" | "octave"` and optional `SongEventPart.gestureType`.
- Produces `planPianoGesture(part, context)` with aligned `notes`, `velocities`, `durationsMs`, and `attackOffsetsMs`.
- Extends `PianoPort.keyDown(notes, velocity, attackOffsetsMs?)`.

- [ ] Write pure planner tests for every template, stable note ordering, velocity alignment, octave melody preservation, and 180ms lyric cap.
- [ ] Write parser tests accepting only the six gesture names.
- [ ] Write engine tests showing Tone attacks are scheduled at audio-clock offsets and remain one owned releasable handle.
- [ ] Run tests and confirm failure.
- [ ] Implement the planner, Score/2 parser field, engine offset argument, and PlayerShell wiring.
- [ ] Re-run focused tests and confirm pass.

### Task 5: Phrase continuity transition policy

**Files:**
- Create: `app/lib/phrase-continuity.ts`
- Create: `app/lib/phrase-continuity.test.ts`
- Modify: `app/lib/phrase-resonance.ts`
- Modify: `app/lib/phrase-resonance.test.ts`
- Modify: `app/lib/piano-performance.ts`
- Modify: `app/lib/piano-performance.test.ts`
- Modify: `app/components/PlayerShell.tsx`
- Modify: `app/components/PlayerShell.test.tsx`

**Interfaces:**
- Produces `planPhraseTransition(activeVoices, incomingGesture, context)` describing retained and released handle IDs plus transition fade.
- Keeps the existing `PhraseResonanceState` and `PianoKeyHandle` ownership model.

- [ ] Write tests retaining compatible same-phrase/same-harmony tails, preserving opposite-hand resonance, shortening same-pitch retriggers, and releasing on rest, phrase boundary, pedal release, capacity, pause, restart, replay, and blur.
- [ ] Run focused tests and confirm failure.
- [ ] Implement deterministic continuity policy and integrate it through `prepareGestureAttack` rather than replacing the audio engine.
- [ ] Re-run focused tests and confirm pass.

### Task 6: Melody-safe voice leading and dynamic texture

**Files:**
- Create: `app/lib/voice-leading.ts`
- Create: `app/lib/voice-leading.test.ts`
- Modify: `app/lib/two-hand-arranger.ts`
- Modify: `app/lib/two-hand-arranger.test.ts`
- Modify: `app/lib/songs.test.ts`

**Interfaces:**
- Produces `leadVoicing(previous, candidate, options)` preserving the melody and choosing octave placements with minimum deterministic motion.
- Produces section/energy texture decisions consumed only by fallback/auto-arranged material.

- [ ] Write tests for common-tone retention, smaller total motion, immutable melody, legal left/right registers, deterministic output, sparse verse, fuller chorus, climax octave, and reduced ending density.
- [ ] Run tests and confirm failure.
- [ ] Implement bounded octave/inversion search and deterministic texture profiles; preserve explicit high-confidence Score/2 arrangements.
- [ ] Re-run focused tests and confirm pass.

### Task 7: Acceptance regression and documentation

**Files:**
- Modify: `app/components/PlayerShell.test.tsx`
- Modify: `app/lib/player-machine.test.ts`
- Modify: `app/audio/tone-source-adapter.test.ts`
- Modify: `docs/moonlit-score-2-authoring-guide.md`
- Modify: `docs/gpt-piano-arrangement-prompt.md`
- Modify: `CURRENT_LOGIC_ZH.md`

**Interfaces:**
- No new runtime interface; locks TEST 1–10 and documents the final authoring contract.

- [ ] Add integration tests for 5–10 fast lyric attacks, coordinated A–Z+Space, continuous Space gestures, repeated Shift, held-key overlap, same-note reattack, repeat suppression, wrong-key behavior, and no automatic next event.
- [ ] Run the new integration tests and resolve only failures caused by this feature set.
- [ ] Update authoring and current-logic documentation to A–Z / A–Z+Space / Shift and fixed gesture templates.
- [ ] Run `npx tsc --noEmit`, `npm run lint`, `npm test -- --run`, `npm run build`, and `node --test tests/rendered-html.test.mjs`.
- [ ] Inspect the local site in the in-app browser for lyric, H+SPACE, SHIFT, keyboard and pause/restart behavior.
