# Lyric Initial Repetition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore repeated lyric initials, persistent per-token key hints, melisma dots, and discrete Space cue positions while preserving legacy score import.

**Architecture:** Keep `LyricToken` as the display unit and normalize every owned right-hand event to the token initial. Keep legacy continuation aliases at the importer boundary only. Render hints from token ownership rather than only the current event, and project between-token Space cues to measured midpoints.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Testing Library.

## Global Constraints

- Do not change the piano audio engine or unrelated UI.
- A–Z remains lyric melody; Space remains left hand; Digit2 remains lyric-free right hand.
- Browser keyboard repeat must never advance repeated initials.
- Existing saved Score/1 and Score/2 material must remain importable.

---

### Task 1: Normalize every lyric gesture to its initial

**Files:**
- Modify: `app/lib/song-normalizer.ts`
- Modify: `app/lib/song-normalizer.test.ts`
- Modify: `app/import/moonlit-score-v2.ts`
- Modify: `app/import/moonlit-score-v2.test.ts`
- Modify: `app/import/moonlit-score-code.test.ts`

**Interfaces:**
- Consumes: `LyricToken.startEvent`, `LyricToken.endEvent`, token text, legacy canonical aliases.
- Produces: normalized lyric events whose `targetCode` is `Key${initial}` for every `lyricSubIndex`.

- [ ] Add failing tests proving a four-note token normalizes to `KeyA` four times, repeated A requires fresh key presses, a new Score/2 repeated-initial continuation is accepted, and legacy Digit1 still imports as KeyA.
- [ ] Run the focused tests and confirm failures are caused by the current Digit1 contract.
- [ ] Add one shared lyric-initial helper and use it while normalizing every event owned by a token.
- [ ] Relax Score/2 continuation validation to accept the expected initial plus legacy Digit1/Enter aliases, then rely on normalization for the runtime route.
- [ ] Run the focused import and normalizer tests to green.

### Task 2: Restore all-token letters and multi-note dots

**Files:**
- Modify: `app/components/LyricStage.tsx`
- Modify: `app/components/LyricStage.test.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: normalized `LyricToken` ranges and each token's first owned event.
- Produces: one persistent letter hint per visible token plus `noteCount` progress dots for multi-event tokens.

- [ ] Add failing component tests that assert every phrase token has a letter hint and later melisma events still show A rather than 1.
- [ ] Run the focused component test and confirm the current-only hint behavior fails it.
- [ ] Render the token's first-event input label for every token and add state attributes for current, upcoming, and done styling.
- [ ] Keep the existing note-progress structure, adjust spacing/contrast only as needed so the letter and dots are both visible.
- [ ] Run the LyricStage tests to green.

### Task 3: Snap Space cues to four discrete visual categories

**Files:**
- Modify: `app/lib/left-hand-cues.ts`
- Modify: `app/lib/left-hand-cues.test.ts`
- Verify: `app/components/LyricStage.test.tsx`

**Interfaces:**
- Consumes: `LeftHandCue.position` and measured token-centre percentages.
- Produces: 0% before, token centre under, adjacent-centre midpoint between, and 100% after.

- [ ] Change the projection test to expect the exact midpoint for a between cue even when its timing ratio is 0.25.
- [ ] Run it and confirm it fails at the current interpolated 35% result.
- [ ] Replace between-cue ratio interpolation with `(before + after) / 2` while retaining ratio metadata.
- [ ] Run cue and LyricStage tests to green.

### Task 4: Update contract tests and documentation

**Files:**
- Modify: `app/components/PlayerShell.test.tsx`
- Modify: `app/components/RhythmGuide.test.tsx`
- Modify: `app/lib/songs.test.ts`
- Modify: `app/import/jianpu-song-compiler.test.ts`
- Modify: `docs/gpt-piano-arrangement-prompt.md`
- Modify: `docs/moonlit-score-2-authoring-guide.md`
- Modify: `docs/final-piano-experience-report.md`

**Interfaces:**
- Consumes: repeated-initial runtime contract.
- Produces: regression coverage and authoring text that no longer instructs lyric continuations with Digit1.

- [ ] Update each guided-continuation expectation from Digit1 to a fresh repeated lyric initial while retaining Digit1 tests for free piano and legacy import.
- [ ] Update authoring documentation to describe repeated initials and explicit keyup/re-press.
- [ ] Run all tests affected by continuation-route expectations.

### Task 5: Full verification

**Files:**
- Verify: all modified files.

- [ ] Run TypeScript type checking.
- [ ] Run ESLint.
- [ ] Run the complete Vitest suite.
- [ ] Run the production build and render verification.
- [ ] Open the local performance page and visually confirm the whole phrase has letter hints, melisma dots remain visible, and Space stars occupy only the four allowed positions.
