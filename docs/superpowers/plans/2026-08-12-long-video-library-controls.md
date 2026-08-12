# Long-video Transcription and Private Library Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make multi-minute model inference bounded and observable, expose every note duration, and add rename/delete controls for private arrangements.

**Architecture:** A pure chunk coordinator slices source PCM into overlapping windows and assembles detector results in whole-song time. Basic Pitch becomes one detector behind that coordinator. Existing player data drives clearer duration UI, while private-library mutations flow from SearchHome through MoonlitPiano into IndexedDB.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Spotify Basic Pitch, TensorFlow.js, IndexedDB, CSS.

## Global Constraints

- Only `1`-`0` and `A`-`Z` are performance keys.
- No key press means no piano sound and no performance advance.
- Local neural transcription must use bounded memory for multi-minute media.
- Fallback timing must be labelled estimated.
- Rename and delete apply only to private imported arrangements.
- Delete requires a second explicit click.

---

### Task 1: Bounded Whole-song Transcription

**Files:**
- Modify: `web/app/import/basic-pitch-transcriber.test.ts`
- Modify: `web/app/import/basic-pitch-transcriber.ts`
- Modify: `web/app/import/browser-media-analyzer.test.ts`
- Modify: `web/app/import/browser-media-analyzer.ts`

**Interfaces:**
- Produces `transcribePcmInChunks(input, detect, onProgress): Promise<AnalysisEvidence>`.
- `detect(samples)` returns timestamped `BasicPitchNote[]` local to one segment.

- [ ] Add a failing 45-second fixture proving the detector receives three calls no longer than 21 seconds, whole-song timestamps survive overlap, duplicate boundary notes collapse, and progress ends at one.
- [ ] Add a failing chord fixture proving 550 ms plus a later 550 ms onset remains 550 ms instead of becoming a hold.
- [ ] Run `npm test -- app/import/basic-pitch-transcriber.test.ts` and confirm the new behaviors fail.
- [ ] Implement 20-second chunks, 1-second overlap, independent resampling, 120 ms pitch-aware deduplication, and per-chunk Basic Pitch conversion.
- [ ] Add a failing analyzer assertion that every emitted progress fraction is nondecreasing.
- [ ] Map neural progress to 0.08-0.92, arranging to 0.94, enrichment to 0.96, and ready to 1.
- [ ] Run both focused test files and commit.

### Task 2: Explicit Duration Guide

**Files:**
- Modify: `web/app/components/RhythmGuide.test.tsx`
- Modify: `web/app/components/RhythmGuide.tsx`
- Modify: `web/app/globals.css`
- Modify: `web/app/components/ImportStudio.test.tsx`
- Modify: `web/app/components/ImportStudio.tsx`

**Interfaces:**
- Rhythm blocks expose key plus `secondsLabel(durationMs)`.

- [ ] Add failing tests for `TAP 0.3s · 1`, visible block text `1 0.3s`, and `ESTIMATED` wording on sketch arrangements.
- [ ] Add a failing immediate-result test for explicit `FALLBACK SKETCH` wording.
- [ ] Run the focused tests and confirm expected assertion failures.
- [ ] Implement the copy, note-block secondary label, and fallback result badge.
- [ ] Run the focused tests and commit.

### Task 3: Private Arrangement Rename and Delete

**Files:**
- Modify: `web/app/import/private-library.test.ts`
- Modify: `web/app/import/private-library.ts`
- Modify: `web/app/components/SearchHome.test.tsx`
- Modify: `web/app/components/SearchHome.tsx`
- Modify: `web/app/MoonlitPiano.test.tsx`
- Modify: `web/app/MoonlitPiano.tsx`
- Modify: `web/app/globals.css`

**Interfaces:**
- `PrivateLibrary.rename(id, title): Promise<PrivateSongRecord>` updates metadata and song title.
- `SearchHome` accepts `onRenamePrivateSong(id, title)` and `onDeletePrivateSong(id)`.

- [ ] Add failing library tests for rename normalization and missing-record rejection.
- [ ] Add failing SearchHome tests covering private-only Manage, Save/Cancel, blank-title prevention, and confirmed delete.
- [ ] Add a failing MoonlitPiano integration test showing the renamed item and removing the deleted item.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement the library methods, parent mutations, accessible non-nested row controls, and elegant inline management states.
- [ ] Run focused tests and commit.

### Task 4: Verification

**Files:**
- Modify only files required by failures directly caused by Tasks 1-3.

- [ ] Run `npm test`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run test:render`.
- [ ] In `http://localhost:3000/`, verify a multi-segment recording shows non-instant progress, explicit seconds appear, a private title persists after rename, and delete requires confirmation.
- [ ] Commit verification fixes and keep the local page open.
