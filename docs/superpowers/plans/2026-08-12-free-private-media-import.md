# Free Private Media Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user import an audio or video file as the primary home-screen action and always receive a private, playable piano sketch without any paid service.

**Architecture:** The browser decodes and analyzes media into a deterministic fallback arrangement so import never depends on a server or paid inference. A provider-isolated enrichment route optionally queries free/open metadata and lyric sources; accepted evidence is version-matched and merged into the locally generated package. Only the lightweight derived package is stored in the browser's private library; source bytes remain on the user's device.

**Tech Stack:** React 19, TypeScript, Web Audio API, IndexedDB, Next-compatible route handlers, MusicBrainz/AcoustID/Cover Art Archive, optional permitted free/open lyrics provider, Vitest.

## Global Constraints

- Import is more prominent than search.
- MP3, WAV, FLAC, M4A/AAC, OGG, MP4, MOV, and WebM are offered; actual decoding follows browser codec support and always reports a precise unsupported/corrupt error.
- No paid API, commercial trial, paid inference, or VIP streaming dependency.
- Raw media never leaves the browser in the zero-cost path.
- Every successfully decoded file with audible content yields `CLEAR`, `USABLE`, or `SKETCH`; provider/model failure does not block the result.
- Unknown identity remains `Imported Track` / `Unknown Artist`; values are never invented.
- Generated packages use the 36-key event grammar and Free Performance.
- Online results are optional evidence and must match title/artist/version/duration before use.

---

### Task 1: Define import, enrichment, and private-library contracts

**Files:**
- Create: `web/app/import/types.ts`
- Create: `web/app/import/types.test.ts`
- Create: `web/app/import/filename-metadata.ts`
- Create: `web/app/import/filename-metadata.test.ts`

**Interfaces:**
- Produces: `ImportStage`, `ImportProgress`, `ImportedMetadata`, `EnrichedField<T>`, `AnalysisEvidence`, `PrivateSongRecord`, `parseFilenameMetadata(name)`.
- Consumes: `SongPackageV2` from the performance-core plan.

- [ ] Write failing tests for `Artist - Title`, `Title`, extension removal, blank names, and fallback metadata.
- [ ] Run `npm test -- app/import/types.test.ts app/import/filename-metadata.test.ts`; expect missing modules.
- [ ] Implement exact discriminated unions and deterministic filename parsing without guessing an author from arbitrary words.
- [ ] Run the focused tests; expect PASS.
- [ ] Commit with `git commit -m "feat: define private media import contracts"`.

### Task 2: Build the always-producing browser sketch analyzer

**Files:**
- Create: `web/app/import/pcm-sketch.ts`
- Create: `web/app/import/pcm-sketch.test.ts`
- Create: `web/app/import/browser-media-analyzer.ts`
- Create: `web/app/import/browser-media-analyzer.test.ts`

**Interfaces:**
- Produces: `analyzePcmToSketch(input): AnalysisEvidence`, `analyzeMediaFile(file, onProgress): Promise<PrivateSongRecord>`.
- Consumes: compiler and import contracts.

- [ ] Write failing deterministic PCM tests using generated sine, silence, chord-like, pulse, and noisy buffers.
- [ ] Assert audible fixtures always produce 8–512 events, MIDI pitches within C3–B5, stable confidence, phrase boundaries, and an exact instrumental number route; silence returns `NO_AUDIBLE_AUDIO`.
- [ ] Run focused tests and verify missing analyzer failure.
- [ ] Implement bounded frame RMS, zero-crossing/autocorrelation pitch candidates, onset/energy-change selection, pitch-class key evidence, tempo estimate, event simplification, and phrase grouping. Avoid randomness so the same file produces the same package.
- [ ] Implement `decodeAudioData` integration, progress stages, duration/file validation, and cleanup of AudioContext/Object URLs.
- [ ] Run focused tests; expect PASS.
- [ ] Commit with `git commit -m "feat: create free browser piano sketch analyzer"`.

### Task 3: Add free/open provenance-aware enrichment

**Files:**
- Create: `web/app/enrichment/types.ts`
- Create: `web/app/enrichment/match.ts`
- Create: `web/app/enrichment/match.test.ts`
- Create: `web/app/enrichment/musicbrainz.ts`
- Create: `web/app/enrichment/free-lyrics.ts`
- Create: `web/app/api/enrich/route.ts`
- Create: `web/app/api/enrich/route.test.ts`

**Interfaces:**
- Produces: `scoreRecordingMatch`, `enrichTrack(query, fetcher)`, `GET /api/enrich`.
- Consumes: filename/duration evidence from Tasks 1–2.

- [ ] Write failing match tests: exact title/artist/duration wins; live/remix/cover mismatch loses; weak title-only results cannot replace identity; provider errors return empty enrichment.
- [ ] Run focused tests and verify failure.
- [ ] Implement MusicBrainz recording/work relationships and Cover Art Archive lookup with a meaningful User-Agent, one-request-per-second cache discipline, timeout, and field provenance.
- [ ] Implement a free-lyrics adapter behind a provider interface. It must be easy to disable if terms change and must never be the only lyric path.
- [ ] Merge accepted lyrics only after identity/duration match; otherwise return local transcription/placeholder evidence unchanged.
- [ ] Run route and matcher tests; expect PASS even when all upstream fetches reject.
- [ ] Commit with `git commit -m "feat: enrich imports from free open music sources"`.

### Task 4: Persist lightweight private packages on-device

**Files:**
- Create: `web/app/import/private-library.ts`
- Create: `web/app/import/private-library.test.ts`

**Interfaces:**
- Produces: `PrivateLibrary { list, get, put, remove }` with IndexedDB implementation and in-memory test adapter.
- Consumes: `PrivateSongRecord`.

- [ ] Write failing CRUD, newest-first, schema-version, duplicate-checksum, and corrupt-record skip tests.
- [ ] Run focused tests and verify missing implementation.
- [ ] Implement IndexedDB storage for derived packages only. Do not store raw `File`, ArrayBuffer, stems, lyrics-provider responses forbidden from persistence, or object URLs.
- [ ] Run focused tests; expect PASS.
- [ ] Commit with `git commit -m "feat: save private arrangements on device"`.

### Task 5: Make import the gentlemanly primary home experience

**Files:**
- Create: `web/app/components/ImportStudio.tsx`
- Create: `web/app/components/ImportStudio.test.tsx`
- Create: `web/app/components/PrivateLibrary.tsx`
- Modify: `web/app/components/SearchHome.tsx`
- Modify: `web/app/components/SearchHome.test.tsx`
- Modify: `web/app/MoonlitPiano.tsx`
- Modify: `web/app/MoonlitPiano.test.tsx`

**Interfaces:**
- Produces: drag/drop and file-picker import, staged progress, result handoff, local private library.
- Consumes: analyzer, enrichment, library, and `onChoose(song)`.

- [ ] Write failing tests proving import is the primary CTA, audio/video accept list exists, drag/drop and picker call analysis, provider failure still yields a playable package, processing stages are truthful, and saved results reopen.
- [ ] Run component tests and verify failure.
- [ ] Implement `ImportStudio` with one composed panel: file selection, validation, seven named stages, graceful warnings, and `PERFORM THIS ARRANGEMENT`.
- [ ] Run enrichment after the local sketch in parallel-safe fashion; never discard the sketch if enrichment fails.
- [ ] Show imported packages above the prepared catalogue and keep search available for private/built-in records.
- [ ] Run component tests; expect PASS.
- [ ] Commit with `git commit -m "feat: make recording import the main entrance"`.

### Task 6: Add free-worker contracts without blocking browser import

**Files:**
- Create: `processor/README.md`
- Create: `processor/pyproject.toml`
- Create: `processor/moonlit_processor/contracts.py`
- Create: `processor/moonlit_processor/pipeline.py`
- Create: `processor/tests/test_pipeline_fallbacks.py`

**Interfaces:**
- Produces: versioned JSON job input/output compatible with `AnalysisEvidence` and `SongPackageV2`.
- Consumes: local media path and optional free/open provider adapters.

- [ ] Write Python contract tests simulating success and failure of identify, separate, lyrics, melody, harmony, and arrangement stages.
- [ ] Run `python -m pytest processor/tests/test_pipeline_fallbacks.py`; expect missing package failure.
- [ ] Implement an adapter pipeline whose default-free stages are FFmpeg, Chromaprint/AcoustID, MusicBrainz, Demucs-compatible separation, Whisper/WhisperX, Basic Pitch, and Essentia. Every adapter returns evidence or a typed warning; the final browser-compatible sketch fallback is mandatory.
- [ ] Document exact optional install groups and make clear that model downloads/inference run only on a user-controlled machine, never a paid endpoint.
- [ ] Run the Python contract tests; expect PASS without downloading models by using fakes.
- [ ] Commit with `git commit -m "feat: scaffold open source analysis worker"`.

### Task 7: Validate import end to end

**Files:**
- Modify only when validation exposes an actual defect.

- [ ] Run `npm test`; expect all web tests pass.
- [ ] Run `npm run lint`; expect zero errors.
- [ ] Run `npm run build`; expect successful Sites-compatible production output.
- [ ] Run `python -m pytest processor/tests`; expect all processor contract tests pass.
- [ ] Import a small generated WAV fixture locally and confirm a playable private `SKETCH` appears even with network disabled.
- [ ] Commit validation corrections with `git commit -m "fix: close free import validation gaps"` only if changes were required.

