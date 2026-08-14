# Independent Gesture Fullness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give standalone correct A–Z, Space, and Shift gestures restrained multi-note piano fullness without changing controls or automatic-play boundaries.

**Architecture:** Extend the existing pure piano gesture planner with conservative default note expansion and velocity scales. Keep the current player state machine, score cursor, piano engine, phrase resonance, and authored multi-note gestures intact.

**Tech Stack:** TypeScript 5.9, React 19, Tone.js 15, Vitest 4.

## Global Constraints

- One physical correct keydown remains the only source of one score-event attack.
- Do not add controls, automatic future notes, accompaniment timers, or new audio assets.
- Preserve explicit multi-note parts and explicit block gestures.
- Melody pitch remains first and strongest.
- Free/wrong piano keys remain literal single keys.

---

### Task 1: Pure standalone gesture enrichment

**Files:**
- Modify: `app/lib/piano-gesture.ts`
- Test: `app/lib/piano-gesture.test.ts`

**Interfaces:**
- Extend `PlannedPianoGesture` with `velocityScales: number[]` aligned to `notes`.
- Preserve `mapGestureValues<T>()` for authored arrays.
- Add `mapGestureVelocities(plan, values)` for scale-aware velocity mapping.

- [ ] Add failing tests: KeyA one-note -> octave pair; Shift one-note -> octave pair; Space one-note -> root/fifth/octave; explicit block -> one note; existing chords unchanged; secondary scales lower than 1.
- [ ] Run `npm test -- --run app/lib/piano-gesture.test.ts` and confirm expected failures.
- [ ] Implement minimal default expansion and bounded offsets/scales.
- [ ] Re-run the focused test and confirm pass.

### Task 2: Player integration

**Files:**
- Modify: `app/components/PlayerShell.tsx`
- Test: `app/components/PlayerShell.test.tsx`

**Interfaces:**
- Consume `mapGestureVelocities(plan, velocity)` immediately before `piano.keyDown`.

- [ ] Add failing integration tests proving one correct letter, standalone Space, and Shift each attack the enriched notes once while the score advances only once.
- [ ] Run the focused player tests and confirm expected failures.
- [ ] Wire velocity-scaled planned gestures into the existing audio call.
- [ ] Re-run focused tests and confirm pass.

### Task 3: Regression verification

**Files:**
- Modify: `CURRENT_LOGIC_ZH.md`

- [ ] Document standalone guided richness and the free-piano exception.
- [ ] Run `npx tsc --noEmit`, `npm run lint`, `npm test -- --run`, and `npm run build`.
- [ ] Confirm simultaneous two-hand tests, cleanup tests, no-repeat tests, and cursor tests remain green.
