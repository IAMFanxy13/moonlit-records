# Real Local Transcription and Rhythm Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the instant fixed-duration import sketch with real local note transcription and add a Rhythm Master-style duration guide.

**Architecture:** A focused Basic Pitch adapter owns resampling, model inference, and note-to-event conversion. The browser analyzer selects that path and falls back to the existing PCM sketch with honest progress. A pure rhythm-guide projection feeds a small React note highway without changing the user-driven player state machine.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Spotify Basic Pitch, TensorFlow.js, Web Audio, CSS.

## Global Constraints

- Only physical `1`-`0` and `A`-`Z` keys are playable.
- No key press means no sound and no automatic arrangement advance.
- One computer key plays one reduced note/chord event.
- All processing and model assets are free and local; optional online enrichment may fail without losing the local result.
- Model failures must produce an explicitly labelled fallback sketch when audible PCM exists.

---

### Task 1: Note Transcription Boundary

**Files:**
- Create: `web/app/import/basic-pitch-transcriber.test.ts`
- Create: `web/app/import/basic-pitch-transcriber.ts`
- Modify: `web/package.json`
- Create: `web/public/models/basic-pitch/model.json`
- Create: `web/public/models/basic-pitch/group1-shard1of1.bin`

**Interfaces:**
- Produces: `transcribeWithBasicPitch(pcm, onProgress): Promise<AnalysisEvidence>`
- Produces: `basicPitchNotesToEvidence(notes, durationMs): AnalysisEvidence`

- [ ] Write failing tests with hand-authored detected notes proving that starts within 80 ms become one chord, only the three strongest notes remain, and a 900 ms group becomes a hold-length evidence event.
- [ ] Run `npm test -- app/import/basic-pitch-transcriber.test.ts` and verify failure because the module does not exist.
- [ ] Install `@spotify/basic-pitch@1.0.1`, copy its two Apache-2.0 model files to the local public model directory, and implement resampling plus lazy model inference.
- [ ] Run `npm test -- app/import/basic-pitch-transcriber.test.ts` and verify it passes.
- [ ] Commit the adapter, tests, dependency lockfile, and model assets.

### Task 2: Truthful Analyzer and Duration-Preserving Compiler

**Files:**
- Modify: `web/app/import/browser-media-analyzer.test.ts`
- Modify: `web/app/import/browser-media-analyzer.ts`
- Modify: `web/app/import/types.test.ts`
- Modify: `web/app/import/types.ts`
- Modify: `web/app/lib/arrangement-compiler.test.ts`
- Modify: `web/app/lib/arrangement-compiler.ts`
- Modify: `web/app/components/ImportStudio.test.tsx`
- Modify: `web/app/components/ImportStudio.tsx`

**Interfaces:**
- `ImportProgress` gains `fraction?: number` and `method?: "neural" | "fallback" | "online"`.
- `InstrumentalEvidence` gains `durationMs`, `kind`, and `holdMs`.

- [ ] Write failing analyzer and compiler tests proving variable source durations become `tap`/`hold` song events and real transcription progress reaches the UI.
- [ ] Run the focused tests and verify their expected assertion failures.
- [ ] Replace misleading stages with preparing, identifying, transcribing, arranging, enriching, and ready; inject the transcriber for tests; catch model failures and run the PCM fallback with an explicit warning.
- [ ] Pass `durationMs`, `kind`, and `holdMs` through the compiler and render a determinate progress fill from `fraction`.
- [ ] Run the focused tests and verify they pass.
- [ ] Commit the analyzer and progress changes.

### Task 3: Shared Rhythm Guide and Lyric-Key Alignment

**Files:**
- Create: `web/app/components/RhythmGuide.test.tsx`
- Create: `web/app/components/RhythmGuide.tsx`
- Modify: `web/app/components/PlayerShell.test.tsx`
- Modify: `web/app/components/PlayerShell.tsx`
- Modify: `web/app/globals.css`
- Modify: `web/app/import/jianpu-parser.test.ts`
- Modify: `web/app/import/jianpu-parser.ts`

**Interfaces:**
- `RhythmGuide({ song, eventIndex, pressedCodes })` renders upcoming keys plus one shared lower duration bar.

- [ ] Write failing parser tests proving spaced Chinese lyrics become individual characters, rests consume no character, repeated-note syllables repeat their initial, and English words remain whole tokens.
- [ ] Run `npx vitest run app/import/jianpu-parser.test.ts` and verify the new assertions fail against grouped lyric tokens.
- [ ] Implement character/word tokenization and non-rest lyric distribution, then run the parser and compiler tests to green.
- [ ] Write failing component tests proving a 1,200 ms shared bar is full before input, drains only while the correct current key is held, and resets full after release advances the event.
- [ ] Move countdown animation out of per-note blocks into one accessible shared bar above the screen keyboard; retain the highway only for current/upcoming key orientation.
- [ ] Mount the guide in `PlayerShell` with only the active correct hold code, so wrong, improvised, paused, and resting states cannot drain it.
- [ ] Run the focused tests and verify they pass.
- [ ] Commit the guide.

### Task 4: Verification

**Files:**
- Modify only files required by failures directly caused by Tasks 1-3.

- [ ] Run `npm test` and fix only regressions caused by this feature.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run test:render`.
- [ ] Open `http://localhost:3000/`, import a real recording, verify that progress takes measurable time, and perform both a tap and a hold on the note highway.
- [ ] Commit any verification-only fixes and record the exact evidence in the handoff.
