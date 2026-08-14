# Score-Target Articulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Guided Song Mode use the score as a maximum musical-duration target while allowing the next real correct keydown, rests, phrase boundaries, and same-note retriggers to create an earlier natural transition.

**Architecture:** Keep physical-key ownership in `PlayerShell` for repeat prevention and UI state, but move every correct guided voice into a separate score-owned lifecycle immediately on attack. A target timer begins on correct keydown; correct keyup only clears physical ownership. A later correct keydown releases any still-active previous guided gesture with a short legato fade before attacking the new gesture, while a target timeout releases it naturally if the player is late.

**Tech Stack:** React 19, TypeScript 5.9, Tone.js 15.1.22, Vitest 4, Testing Library.

## Global Constraints

- No user keydown means no new piano attack; the engine may only release voices already triggered by the user.
- Correct keyup in Guided Song Mode must never directly release a melody voice.
- Wrong keys, paused free play, and rest-time free play remain physical keydown/keyup voices.
- Keep A-Z, 1-0, Space, immediate score-cursor advancement, tempo scaling, cleanup, and same-key fresh-press requirements unchanged.
- No autoplay, accompaniment, scoring, pedal, MIDI, new dependency, parser change, sample change, or unrelated UI redesign.

---

### Task 1: Express target duration and transition release in the pure policy

**Files:**
- Modify: `app/lib/piano-performance.ts`
- Modify: `app/lib/piano-performance.test.ts`

**Interfaces:**
- Consumes: `SongPackage`, event index, selected `PianoVoice`, resonance count.
- Produces: `ReleasePlan` with `targetDurationMs`, `fadeOutSeconds`, and `transitionFadeOutSeconds`.

- [ ] Write failing tests proving a 700ms authored note targets exactly 700ms, a legacy tap falls back to a tempo-derived bounded duration, same-pitch transitions are shorter than ordinary transitions, and rest/phrase fades retain their musical profiles.
- [ ] Run `npm test -- app/lib/piano-performance.test.ts` and verify RED because target duration and transition fade are absent.
- [ ] Implement the minimal policy fields without changing guided dynamics.
- [ ] Re-run the focused test and verify GREEN.

### Task 2: Make guided-voice state independent from physical keyup

**Files:**
- Modify: `app/lib/phrase-resonance.ts`
- Modify: `app/lib/phrase-resonance.test.ts`

**Interfaces:**
- Consumes: score-owned `ResonantVoice` entries created at attack time.
- Produces: reasoned transitions (`target`, `next-attack`, `capacity`, `clear`) so the player chooses the correct fade.

- [ ] Write failing tests proving the next correct gesture releases every still-active prior guided gesture, exact target expiry removes one handle, and state transitions carry their release reason.
- [ ] Run `npm test -- app/lib/phrase-resonance.test.ts` and verify RED.
- [ ] Implement reasoned transitions while preserving the four-gesture safety cap and exact handles.
- [ ] Re-run the focused test and verify GREEN.

### Task 3: Integrate score-owned articulation in the player

**Files:**
- Modify: `app/components/PlayerShell.tsx`
- Modify: `app/components/PlayerShell.test.tsx`

**Interfaces:**
- Consumes: `ReleasePlan`, reasoned resonance transitions, existing `PianoPort` exact handles.
- Produces: keydown-started target timers, early next-key legato transitions, keyup-only physical cleanup, and unchanged free-play keyup.

- [ ] Write failing integration tests for: early keyup does not release before target; long physical hold still releases at target; early next correct keydown releases the previous gesture but does not delay the new attack; a late next key arrives after target release; N keyup after H attack never releases H; rest and phrase-end fades; same-note retrigger; pause/restart/replay/blur cleanup.
- [ ] Run `npm test -- app/components/PlayerShell.test.tsx` and verify failures occur at the old keyup-owned behavior.
- [ ] On correct keydown, release still-active prior guided gestures as a transition, immediately attack the new gesture, add it to score-owned state, and schedule its target timeout from attack time.
- [ ] On correct keyup, remove only the physical map/player hold. Keep free/wrong keyup immediate.
- [ ] Remove rest-start hard clearing of the newly attacked current gesture; use its score-derived rest release at target or an earlier real next keydown.
- [ ] Verify all cleanup paths cancel target timers and release all audio once.
- [ ] Re-run the focused player test and verify GREEN.

### Task 4: Reframe the duration rail as score information

**Files:**
- Modify: `app/components/RhythmGuide.tsx`
- Modify: `app/components/RhythmGuide.test.tsx`
- Modify: `app/components/PlayerShell.tsx`

**Interfaces:**
- Consumes: the currently score-owned guided event rather than a physical held key.
- Produces: a bar that visualizes the score target from attack to target release and never instructs the user to release.

- [ ] Write failing tests for copy stating `MUSICAL DURATION` / `SCORE TIMING`, with countdown continuing after physical keyup.
- [ ] Verify RED with `npm test -- app/components/RhythmGuide.test.tsx app/components/PlayerShell.test.tsx`.
- [ ] Update the shared rail state and copy without adding controls or scoring.
- [ ] Re-run focused tests and verify GREEN.

### Task 5: Full verification

**Files:**
- Modify only files required by discovered regressions.

**Interfaces:**
- Consumes: completed target-articulation increment.
- Produces: fresh automated and build evidence.

- [ ] Run `npm test`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `node --test tests/rendered-html.test.mjs`.
- [ ] Run `git diff --check` and inspect the scoped diff.

## Self-review

- Spec coverage: target duration, early/late next key, keyup ownership, rest, phrase end, same-note retrigger, free/wrong keys, cleanup, and duration-rail semantics each have a task and test.
- Placeholder scan: no deferred implementation item or unrelated feature is included.
- Type consistency: `ReleasePlan` flows into `ResonantVoice`; transition reason selects target versus legato fade; `PlayerShell` remains the sole owner of timers and exact `PianoKeyHandle` release calls.
