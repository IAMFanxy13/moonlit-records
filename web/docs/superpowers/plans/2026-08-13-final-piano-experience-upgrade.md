# Final Piano Experience Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make guided performance sustain and transition like a real sampled piano while adding silent phrase navigation and preserving simple human-created note onsets.

**Architecture:** Keep score state, exact audio-voice ownership, and UI orchestration separate. Schedule musical releases in the Tone audio clock through one private-source adapter; use a pure tempo follower and pure seek transition so behavior is deterministic and testable.

**Tech Stack:** React 19, TypeScript 5.9, Tone.js 15.1.22, Vitest, Testing Library, local Salamander MP3 samples.

## Global Constraints

- Incremental changes only; do not rewrite Moonlit Records or change unrelated features.
- Every note onset still requires a real user `keydown`; never auto-play.
- A-Z, 1-0, Space continuation, wrong-key free play, and key-repeat protection remain unchanged.
- Guided `keyup` is physical ownership only; free/wrong `keyup` releases its own exact voice.
- No Shift, pedal, MIDI, scoring, OCR, PDF recognition, network API, auto accompaniment, or 88-key UI.
- Preserve MOONLIT-SCORE/1 and saved-song compatibility.

---

### Task 1: Audio-clock release ownership

**Files:**
- Create: `app/audio/tone-source-adapter.ts`
- Create: `app/audio/tone-source-adapter.test.ts`
- Modify: `app/audio/piano-engine.ts`
- Modify: `app/audio/piano-engine.test.ts`

**Interfaces:**
- Produces `scheduleRelease(handle, delayMs, options)`, `cancelScheduledRelease(handle)`, and exact-handle `keyUp` on `PianoPort`.
- The adapter captures newly-created `ToneBufferSource` instances, schedules `stop(context.currentTime + delay)` and uses `cancelStop()` before rescheduling.

- [ ] Write failing tests proving a target stop is scheduled at audio time, an early transition cancels/replaces it, duplicate calls are idempotent, same-pitch handles remain isolated, and release-all cancels every handle.
- [ ] Run `npm test -- app/audio/tone-source-adapter.test.ts app/audio/piano-engine.test.ts` and confirm failures are missing audio-clock behavior.
- [ ] Implement the focused adapter and extend the engine interfaces without exposing Tone private fields elsewhere.
- [ ] Run the focused tests until green, then run all audio tests.

### Task 2: Human tempo follower and score-time performance policy

**Files:**
- Create: `app/lib/human-tempo-follower.ts`
- Create: `app/lib/human-tempo-follower.test.ts`
- Modify: `app/lib/piano-performance.ts`
- Modify: `app/lib/piano-performance.test.ts`
- Modify: `app/lib/song.ts`
- Modify: `app/lib/song-normalizer.ts`

**Interfaces:**
- Produces `createHumanTempoFollower()` with `observe(input)`, `scale()`, and `reset()`.
- `getReleasePlan` accepts an optional bounded performance scale.
- `SongPackage.meter` is optional and normalized without invalidating legacy songs.

- [ ] Write failing literal tests for robust median/EMA behavior, clamp limits, idle/rest/outlier rejection, reset, lyric-token articulation, and meter accents derived from score time.
- [ ] Run the focused tests and confirm the intended failures.
- [ ] Implement the smallest pure follower and performance-policy changes.
- [ ] Run the focused and song compatibility suites until green.

### Task 3: Pure phrase seek transition

**Files:**
- Modify: `app/lib/player-machine.ts`
- Modify: `app/lib/player-machine.test.ts`

**Interfaces:**
- Produces `seekPlayerToPhrase(state, song, phraseIndex)`.
- Preserves paused/playing intent, revives ringing/complete as playing, clears active holds, and sets cursor/statistics to the phrase start.

- [ ] Write failing tests for playing, paused, ringing, complete, invalid phrase indexes, and instrumental phrase starts.
- [ ] Run `npm test -- app/lib/player-machine.test.ts` and confirm failures.
- [ ] Implement the pure transition without audio/UI dependencies.
- [ ] Re-run the focused suite until green.

### Task 4: PlayerShell integration and phrase controls

**Files:**
- Modify: `app/components/PlayerShell.tsx`
- Modify: `app/components/PlayerShell.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes audio-clock scheduling, tempo follower, and pure seek.
- Produces an accessible phrase progress range, `START FROM LINE` dialog, phrase preview, and lifecycle-safe cleanup.

- [ ] Write failing integration tests for scheduling without musical `setTimeout`, early correct-key transition, seek silence/cleanup, paused-state preservation, leading-rest consumption, tempo/voice preservation, and dialog/range accessibility.
- [ ] Run the focused component test and confirm failures are behavior gaps.
- [ ] Replace JS musical release authority with `piano.scheduleRelease`; keep timers only for UI cleanup.
- [ ] Wire tempo observations only from eligible correct keydowns and reset on seek, pause, restart, replay, blur, and visibility interruption.
- [ ] Add the range and line dialog, then implement atomic silent seek and restrained CSS.
- [ ] Run PlayerShell, RhythmGuide, LyricStage, and ScreenKeyboard tests until green.

### Task 5: Diagnostics and local sample audit

**Files:**
- Modify: `app/audio/performance-diagnostics.ts`
- Modify: `app/audio/performance-diagnostics.test.ts`
- Create: `scripts/audit-piano-samples.mjs`
- Create: `docs/piano-reference-and-sample-audit.md`
- Modify: `public/audio/ATTRIBUTION.md` only if attribution evidence requires clarification.

**Interfaces:**
- Runtime info adds optional `outputLatency`, `outputTimestamp`, `currentTime`, and `lookAhead` fields.
- The audit script reads every local MP3, reports size/format/duration and decoded energy checkpoints when the runtime supports decoding.

- [ ] Write failing diagnostics tests for optional browser timing fields and graceful unsupported-field behavior.
- [ ] Implement runtime collection against the existing AudioContext.
- [ ] Run diagnostics tests until green.
- [ ] Run local asset inspection and record official Tone, Web Audio, and Salamander findings, measured bank characteristics, and the evidence-based asset decision.

### Task 6: Full regression and browser verification

**Files:**
- Modify tests only when a verified regression exposes a missing behavior contract.

**Interfaces:**
- No new production interface; this task proves the complete system.

- [ ] Run `npm test` and resolve every regression with a failing test first.
- [ ] Run `npm run lint` and the TypeScript/build commands used by the project.
- [ ] Start the local server and exercise imported 《晴天》: free play, wrong key, correct legato, repeated key, Space continuation, phrase range, line dialog, paused seek, restart with held voices, and completion seek.
- [ ] Inspect browser console/runtime diagnostics for errors and stuck voices.
- [ ] Review the final diff against every requirement and document physical limits: computer-key velocity, speaker/headphone quality, browser scheduling/output latency, and the compact sample bank.
