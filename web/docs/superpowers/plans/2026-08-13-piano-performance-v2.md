# Moonlit Piano Performance Engine V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve Moonlit's one-key-per-user-attack interaction while making already-triggered piano samples connect, release, breathe, and finish more like a musical phrase.

**Architecture:** Keep the current `PianoPort`, exact physical-key handles, score cursor, and Tone.js Sampler. Add a pure score-performance policy that computes deterministic guided velocity and a release plan from tempo, note duration, phrase/rest boundaries, selected voice, and resonance pressure; `PlayerShell` applies that plan without delaying attacks. Tone.js continues to own sample playback and fades, while Moonlit owns exact handle lifetime and the short virtual-damper timer.

**Tech Stack:** React 19, TypeScript 5.9, Tone.js 15.1.22, Web Audio, Vitest 4, Testing Library.

## Global Constraints

- No physical user keydown means no new piano attack.
- Keep A-Z, 1-0, and Space behavior unchanged.
- Do not add autoplay, accompaniment, scoring, MIDI, pedal, Shift, new key combinations, dependencies, or samples.
- Preserve MOONLIT-SCORE/1, exact physical-key voice ownership, same-note safe retrigger, and all lifecycle cleanup.
- Tone.js remains pinned to 15.1.22 and local Salamander files remain unchanged.
- Production UI receives no diagnostics or engineering controls.

---

### Task 1: Baseline and reference evidence

**Files:**
- Create: `docs/superpowers/plans/2026-08-13-piano-performance-v2.md`
- Inspect: `app/audio/piano-engine.ts`, `app/audio/piano-voices.ts`, `app/components/PlayerShell.tsx`, `app/lib/phrase-resonance.ts`

**Interfaces:**
- Consumes: existing project scripts and pinned dependencies.
- Produces: recorded baseline and implementation constraints used by every later task.

- [x] **Step 1: Run baseline tests**

Run: `npm test`
Expected: 30 files and 163 tests pass before changes.

- [x] **Step 2: Run static and build baseline**

Run: `npx tsc --noEmit`, `npm run lint`, `npm run build`, `node --test tests/rendered-html.test.mjs`
Expected: all commands exit 0.

- [x] **Step 3: Audit authoritative mechanisms**

Confirm in Tone.js 15.1.22 source that Sampler creates one `ToneBufferSource` per attacked pitch, applies velocity as source gain, repitches the nearest mapped sample, and uses `fadeOut` on source stop. Confirm Tone's default context latency hint is `interactive`; read the existing context's `rawContext.baseLatency` rather than creating a second context.

- [x] **Step 4: Audit local samples**

Confirm 14 MP3 files, A2-C6 anchor coverage in minor thirds, one velocity layer, and no local release, resonance, hammer, or pedal sample assets.

### Task 2: Pure adaptive performance policy

**Files:**
- Create: `app/lib/piano-performance.ts`
- Create: `app/lib/piano-performance.test.ts`
- Modify: `app/audio/piano-voices.ts`
- Modify: `app/audio/piano-voices.test.ts`

**Interfaces:**
- Consumes: `SongPackage`, event index, `PianoVoice`, and active resonance count.
- Produces: `getGuidedVelocity(song, eventIndex): number` and `getReleasePlan(song, eventIndex, voice, resonanceCount): ReleasePlan`.

- [ ] **Step 1: Write failing deterministic-dynamics tests**

Test that repeated calls return the same values, adjustments stay within 10% of authored velocity, phrase endings soften, long notes receive controlled emphasis, and free-play values are not passed through this function.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- app/lib/piano-performance.test.ts`
Expected: failure because the module does not exist.

- [ ] **Step 3: Implement deterministic dynamics**

Use phrase-relative position, beat grouping, and duration. Clamp output to authored velocity +/-10% and MIDI 1-127. Do not use random numbers.

- [ ] **Step 4: Write failing adaptive-release tests**

Cover ordinary connected notes, fast notes, long notes, phrase ending, printed rest, tempo scaling, same-pitch context, and reduced grace under resonance pressure.

- [ ] **Step 5: Implement release planning and voice performance profiles**

Return `{ kind, graceMs, fadeOutSeconds }`; normal grace remains 70-180ms, rest is immediate damping, and long/phrase endings receive bounded longer musical release. Add per-voice `outputTrim`, `legato`, `longNoteGraceMs`, `phraseTailMs`, and release calibration without exposing new UI.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `npm test -- app/lib/piano-performance.test.ts app/audio/piano-voices.test.ts`
Expected: all pass.

### Task 3: Exact-handle release shaping and runtime information

**Files:**
- Modify: `app/audio/piano-engine.ts`
- Modify: `app/audio/piano-engine.test.ts`

**Interfaces:**
- Consumes: `PianoReleaseOptions { fadeOutSeconds?: number }` from the performance policy.
- Produces: `PianoPort.keyUp(handle, options?)` and optional `PianoPort.runtimeInfo()`.

- [ ] **Step 1: Write failing exact-source release tests**

Prove that releasing one handle only changes/stops its owned Tone sources, applies the requested fade, does not stop a newer same-pitch source, and remains idempotent.

- [ ] **Step 2: Verify RED**

Run: `npm test -- app/audio/piano-engine.test.ts`
Expected: failure because release options and runtime diagnostics are absent.

- [ ] **Step 3: Implement the minimal Tone.js adaptation**

Before `source.stop()`, set the owned source's `fadeOut` to the bounded requested value. Keep source capture and handle ownership unchanged. Add per-voice Gain output trim and report the existing Tone context state/baseLatency/latencyHint without constructing another context.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- app/audio/piano-engine.test.ts`
Expected: all engine tests pass, including failed-load retry.

### Task 4: Adaptive virtual damper state

**Files:**
- Modify: `app/lib/phrase-resonance.ts`
- Modify: `app/lib/phrase-resonance.test.ts`

**Interfaces:**
- Consumes: `ReleasePlan` attached to each released guided voice.
- Produces: capped `ResonantVoice` state whose transitions retain the exact handle and planned fade.

- [ ] **Step 1: Write failing state tests**

Cover four-gesture cap, exact expiry, same-pitch removal, phrase boundary, printed rest, and propagation of each voice's release plan.

- [ ] **Step 2: Verify RED**

Run: `npm test -- app/lib/phrase-resonance.test.ts`
Expected: failure because resonant voices do not carry adaptive release plans.

- [ ] **Step 3: Implement minimal state changes**

Remove the fixed 2400ms policy from the state machine. Retain the cap and exact-handle transitions; timers stay in `PlayerShell`.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- app/lib/phrase-resonance.test.ts`
Expected: all resonance tests pass.

### Task 5: Player integration and development timing diagnostics

**Files:**
- Create: `app/audio/performance-diagnostics.ts`
- Create: `app/audio/performance-diagnostics.test.ts`
- Modify: `app/components/PlayerShell.tsx`
- Modify: `app/components/PlayerShell.test.tsx`

**Interfaces:**
- Consumes: performance policy, release plans, `PianoPort.runtimeInfo()`, existing physical voice map.
- Produces: immediate attacks, adaptive delayed release, rest-boundary damping, deterministic guided dynamics, and development-only console records.

- [ ] **Step 1: Write failing diagnostics tests**

Prove hold duration, inter-key gap, keydown-to-attack delta, active physical/resonance counts, context state, and baseLatency are recorded only when enabled.

- [ ] **Step 2: Verify diagnostics RED then implement**

Run: `npm test -- app/audio/performance-diagnostics.test.ts`
Expected RED before implementation, GREEN afterward. Diagnostics must have no rendered UI.

- [ ] **Step 3: Write failing player integration tests**

Replace fixed-2.4s assertions with ordinary, fast, long, phrase-ending, and rest release assertions. Assert correct keydown still advances immediately; wrong/free notes use unchanged velocity; next note can attack before prior virtual damper closes; same pitch releases old before new; a rest clears deferred resonance without muting a physically held key; cleanup cancels every adaptive timer.

- [ ] **Step 4: Verify player RED**

Run: `npm test -- app/components/PlayerShell.test.tsx`
Expected: failures at fixed release behavior and unshaped guided velocity.

- [ ] **Step 5: Integrate policy without delaying attacks**

On correct keydown, compute guided velocity and immediately call `piano.keyDown`; immediately commit the score cursor as today. On correct keyup, compute and schedule the release plan. Free/wrong keyup remains immediate. At rest start release only deferred virtual-damper voices. Every pause/restart/replay/exit/blur/hidden/unmount path cancels timers and calls `releaseAll` as today.

- [ ] **Step 6: Verify player GREEN**

Run: `npm test -- app/components/PlayerShell.test.tsx`
Expected: all old interaction cases and new V2 cases pass.

### Task 6: Full verification and browser acceptance

**Files:**
- Modify only files required by discovered regressions.

**Interfaces:**
- Consumes: completed V2 implementation.
- Produces: final evidence for the A-H report.

- [ ] **Step 1: Run focused and full automated verification**

Run: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, `node --test tests/rendered-html.test.mjs`.

- [ ] **Step 2: Inspect development diagnostics in the real browser**

Open `http://localhost:3000/`, play ordinary sequences, and capture actual context state/baseLatency and gesture timing. Do not invent metrics unavailable from the browser.

- [ ] **Step 3: Exercise browser acceptance paths**

Verify ordinary melody, A-A-A, A-Space-Space, rest, fast passage, long note, chord, all four voices, pause/restart/replay/exit, and no console/runtime errors.

- [ ] **Step 4: Review the diff for scope**

Run: `git diff --check`, `git status --short`, and inspect every changed file. Confirm no parser, library, OCR, import, score UI, CSS, sample, dependency, or key mapping changes.

## Self-review

- Spec coverage: tasks cover reference/sample/latency audit, diagnostics, virtual damper, adaptive legato, phrase release, deterministic dynamics, four voices, headroom, rest, completion, cleanup, tests, browser verification, and reporting.
- Placeholder scan: no implementation step is deferred; calibration is bounded by exact constraints and focused tests.
- Type consistency: `ReleasePlan` flows from `piano-performance.ts` through `ResonantVoice` into `PianoPort.keyUp(handle, options?)`; diagnostics read only optional `runtimeInfo()`.
