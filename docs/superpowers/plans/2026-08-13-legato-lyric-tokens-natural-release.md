# Legato, Lyric Tokens, and Natural Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate lyrics, score progression, held inputs, and audio releases so Moonlit Records supports Space-based melismas, natural legato, and reliable piano release behavior without breaking old songs.

**Architecture:** A pure song normalizer builds first-class lyric tokens and annotated play events from both new and legacy packages. The state machine advances on correct keydown and tracks multiple held guided inputs, while `PlayerShell` owns one audio handle per physical key and keyup only releases that handle. Tone.js remains the sampler engine behind explicit `keyDown`/`keyUp` methods.

**Tech Stack:** TypeScript, React 19, Tone.js 15.1.22, pinyin-pro, Vitest, Testing Library, IndexedDB.

## Global Constraints

- Preserve A–Z and 1–0 free play and add Space only for lyric continuation.
- Do not add Shift, pedal controls, MIDI, 88-key UI, scoring, accompaniment, OCR, PDF recognition, or networking.
- A correct keydown advances immediately; keyup only releases its own audio handle.
- Wrong letters and digits sound freely and never advance the score.
- Printed duration remains advisory.
- Keep old `MOONLIT-SCORE/1`, saved packages, built-ins, tempo, pause, restart, replay line, chords, and local library compatible.
- Use tests before every production behavior change.

---

### Task 1: Normalize Lyric Tokens and Legacy Songs

**Files:**
- Modify: `web/app/lib/song.ts`
- Create: `web/app/lib/song-normalizer.ts`
- Create: `web/app/lib/song-normalizer.test.ts`

**Interfaces:**
- Produces `LyricToken`, optional event lyric metadata, and `normalizeSongPackage(song: SongPackage): SongPackage`.
- Consumed by the parser, player shell, and lyric UI in later tasks.

- [ ] Write failing tests proving `爱` with three legacy events becomes one token with targets `KeyA, Space, Space`, while `爱爱爱` remains three tokens with `KeyA, KeyA, KeyA`; also prove idempotence and instrumental preservation.
- [ ] Run `npx vitest run app/lib/song-normalizer.test.ts` and confirm failure because the normalizer does not exist.
- [ ] Add `LyricToken` and optional `lyricTokenId`, `lyricSubIndex`, `lyricSubCount` fields without removing legacy fields.
- [ ] Implement phrase-unit alignment that copies rather than mutates the source and annotates every lyric event.
- [ ] Run the focused test and commit the green task.

### Task 2: Add Explicit Grouped Tokens to MOONLIT-SCORE/1

**Files:**
- Modify: `web/app/import/moonlit-score-code.test.ts`
- Modify: `web/app/import/moonlit-score-code.ts`

**Interfaces:**
- Accepts `[3:.5 4:.5 5:1]{爱}` in a `notes:` row.
- Produces a normalized package through `normalizeSongPackage` while continuing to accept old note tokens.

- [ ] Add a failing parser test for a grouped Chinese token with three notes and expected `KeyA, Space, Space`, plus an old-syntax compatibility assertion.
- [ ] Run the focused parser test and verify the grouped token is rejected.
- [ ] Extend the bounded lexer with a bracketed note-group form that reuses the existing pitch, chord, duration, and lyric validation.
- [ ] Compile group members with one token identity and normalize the completed package.
- [ ] Run parser and normalizer tests and commit.

### Task 3: Advance Score Cursor on Keydown and Track Multiple Held Inputs

**Files:**
- Modify: `web/app/lib/keyboard.ts`
- Modify: `web/app/lib/player-machine.ts`
- Modify: `web/app/lib/player-machine.test.ts`

**Interfaces:**
- Produces `isPerformanceInputCode`, Space labeling, `activeHolds: Record<string, ActiveHold>`, immediate keydown advancement, and release-only `releaseKey`.

- [ ] Replace old state-machine expectations with failing tests for immediate advancement, N-then-H while N remains held, release independence, A-Space-Space, A-A-A requiring fresh presses, wrong-key behavior, and final ringing on final keydown.
- [ ] Run the focused state-machine test and verify failures reflect the keyup-coupled cursor.
- [ ] Add Space as a guided input but not a free-piano note; label it `SPACE`.
- [ ] Replace singular `activeHold` with a record keyed by physical code and advance only inside successful `pressKey`.
- [ ] Make `releaseKey` remove only the matching held record and never touch cursor or another hold.
- [ ] Run state-machine tests and commit.

### Task 4: Make Physical Audio Handles Legato-Safe

**Files:**
- Modify: `web/app/components/PlayerShell.test.tsx`
- Modify: `web/app/components/PlayerShell.tsx`

**Interfaces:**
- Uses immediate state-machine advancement.
- Keeps `Map<physicalCode, PianoAttackHandle>` as the audio source of truth.

- [ ] Add failing integration tests for N held while H attacks, N keyup releasing only N, key repeat suppression, Space preventDefault/no-op outside continuation, simultaneous free-play keys, and multi-handle cleanup on pause/restart/replay/blur.
- [ ] Run `npx vitest run app/components/PlayerShell.test.tsx` and confirm current keyup progression and singular hold behavior fail.
- [ ] Normalize the song once before tempo scaling, attack each physical code once, and advance cursor during keydown.
- [ ] On keyup, release and delete only that physical code's handle; clear all maps/sets for every interruption path.
- [ ] Keep completion waiting for all pressed codes and room tail even though final cursor advancement occurs at keydown.
- [ ] Run PlayerShell and state-machine tests and commit.

### Task 5: Render One Lyric Token with Sub-note Progress and Explicit Space

**Files:**
- Modify: `web/app/components/LyricStage.test.tsx`
- Modify: `web/app/components/LyricStage.tsx`
- Modify: `web/app/components/RhythmGuide.test.tsx`
- Modify: `web/app/components/RhythmGuide.tsx`
- Modify: `web/app/components/ScreenKeyboard.test.tsx`
- Modify: `web/app/components/ScreenKeyboard.tsx`
- Modify: `web/app/globals.css`

**Interfaces:**
- Renders normalized token ranges and sub-event progress.
- Shows `SPACE` in the lyric key label, highway label, and a wide screen-keyboard key.

- [ ] Add failing UI tests for one `爱` with three progress marks across three event indices, three independent `爱` tokens, an explicit `SPACE` label in the highway, and a wide Space screen key.
- [ ] Run the focused component tests and verify the current duplicated event rendering fails.
- [ ] Render each `LyricToken` once, derive completed/current/pending sub-event marks from `eventIndex`, and preserve punctuation/current-next-line behavior.
- [ ] Add the wide Space key without assigning it a free-play note and update concise instructional copy.
- [ ] Adapt the shared duration bar to the most recently pressed still-held guided event, otherwise preview the next event.
- [ ] Run focused UI tests and commit.

### Task 6: Clarify Natural Piano keyDown/keyUp and Damper Release

**Files:**
- Modify: `web/app/audio/piano-engine.test.ts`
- Modify: `web/app/audio/piano-engine.ts`
- Modify: `web/app/audio/piano-voices.test.ts`
- Modify: `web/app/audio/piano-voices.ts`
- Update call sites and test fakes that implement `PianoPort`.

**Interfaces:**
- Replaces public `attack/release` with `keyDown(notes, velocity): PianoAttackHandle` and `keyUp(handle): void`.
- Retains non-looping Tone.js Sampler attack, exponential stop fade, and independent reverb tail.

- [ ] Add failing tests for one keyDown attack, one matching keyUp release through the original voice, velocity clamping, and short damper-release profiles independent from long room tails.
- [ ] Run audio tests and verify the explicit API is missing.
- [ ] Rename the port/channel methods, use Tone `triggerAttack` and `triggerRelease`, set exponential curve explicitly, and tune short per-voice damper fades without changing the reverb tail contract.
- [ ] Update PlayerShell and all test doubles to the new API.
- [ ] Run audio, PlayerShell, and voice-profile tests and commit.

### Task 7: Compatibility, Cleanup, and Full Verification

**Files:**
- Modify only files directly required by regressions caused by Tasks 1–6.
- Update: `web/README.md`

**Interfaces:**
- Verifies the feature as a complete existing application.

- [ ] Add or update compatibility tests for built-in songs, private-library records lacking `lyricTokens`, tempo scaling, pause/restart/replay, and completion tails.
- [ ] Run `npm test` and require every test to pass.
- [ ] Run `npx tsc --noEmit`, `npm run lint`, and `npm run test:render`.
- [ ] In the local browser, verify Case A `N→H`, Case B `A→SPACE→SPACE`, Case C `A→A→A`, Case D wrong J, Case E N/H overlap, Case F long press/release, and restart with multiple keys held.
- [ ] Confirm Space never scrolls the page and no note remains stuck after blur, pause, replay, or restart.
- [ ] Review the final diff for unrelated changes, update the report-ready file list and known limitations, then commit.
