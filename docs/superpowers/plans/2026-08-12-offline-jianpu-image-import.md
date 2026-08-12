# Offline Jianpu Image Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the misleading audio/video sketch importer with a real, fully local image/PDF Jianpu workflow that creates a playable piano score, shows exact press durations, and supports renaming and deleting private scores.

**Architecture:** A browser-only pipeline renders PDF pages, preprocesses score images, recognizes printed text and notation with bundled local OCR plus deterministic Jianpu rules, then compiles the result into the existing `SongPackage`. The player scales note/rest timings from a song tempo, while IndexedDB remains the source of truth for private-library rename and delete operations.

**Tech Stack:** React 19, TypeScript 5.9, Vitest, Testing Library, PDF.js, local PaddleOCR-compatible OCR adapter, Canvas 2D, IndexedDB, Tone.js.

## Global Constraints

- Accept PNG, JPEG, WebP, and PDF only; accept multiple files and preserve selected order.
- All processing and model assets run locally; no runtime network request is allowed.
- Use 72 BPM when tempo is absent and expose a 50–120 BPM control.
- `0` is a silent timed rest. One underline halves a beat, two underlines quarter it, augmentation dots multiply by 1.5, and each following dash adds one beat.
- Every audible gesture comes only from a physical keyboard press; keydown attacks and keyup releases.
- Wrong or improvisational keys use the selected global piano voice and never advance the score.
- Every highway block displays its key and duration in seconds; correct holds advance only after their duration.
- Imported rows alone expose rename and confirmed permanent deletion; built-in scores remain immutable.
- Keep the complete built-in “Twinkle, Twinkle, Little Star”.
- UI text is English except recognized lyrics.
- Preserve existing private records and keep the application local at `http://localhost:3000/`.

---

## File Structure

- `web/app/import/jianpu-types.ts`: normalized OCR, notation, warning, and parsed-score contracts.
- `web/app/import/jianpu-parser.ts`: deterministic text/box interpretation, durations, octave, metadata, alignment, and overlap de-duplication.
- `web/app/import/jianpu-song-compiler.ts`: conversion from parsed relative notation into a playable `SongPackage`.
- `web/app/import/score-page-loader.ts`: image decoding and PDF.js page rendering.
- `web/app/import/local-score-recognizer.ts`: local recognition adapter, preprocessing, progress, and best-effort fallback.
- `web/app/import/browser-score-analyzer.ts`: public import orchestration and persistence-ready result.
- `web/app/lib/tempo.ts`: deterministic timing scale helpers.
- `web/app/components/ImportStudio.tsx`: multi-file score import and honest progress UI.
- `web/app/components/PlayerShell.tsx`: tempo control and silent-rest gate.
- `web/app/components/RhythmGuide.tsx`: key, duration, hold fill, and rest countdown presentation.
- `web/app/components/SearchHome.tsx` and `web/app/MoonlitPiano.tsx`: private rename/delete UI and state persistence.

### Task 1: Define and parse normalized Jianpu

**Files:**
- Create: `web/app/import/jianpu-types.ts`
- Create: `web/app/import/jianpu-parser.ts`
- Test: `web/app/import/jianpu-parser.test.ts`

**Interfaces:**
- Consumes: ordered `RecognizedScorePage[]` containing OCR lines and optional symbol boxes.
- Produces: `parseJianpuPages(pages, options): ParsedJianpuScore` with metadata, rows, note beats, rests, octave shifts, lyric tokens, confidence, and warnings.

- [ ] **Step 1: Write failing musical-rule tests**

```ts
expect(parseJianpuToken("1__.")).toMatchObject({ degree: 1, beats: 0.375 });
expect(parseJianpuToken("0-")).toMatchObject({ degree: 0, beats: 2, rest: true });
expect(parseJianpuHeader(["1=F", "4/4", "♩=96"])).toMatchObject({ tonic: "F", meter: "4/4", tempoBpm: 96 });
```

- [ ] **Step 2: Run `npx vitest run app/import/jianpu-parser.test.ts` and verify failures name the missing exports.**

- [ ] **Step 3: Implement pure token/header parsing**

```ts
export function parseJianpuToken(raw: string): ParsedJianpuNote {
  const degree = Number(raw.match(/[0-7]/)?.[0]);
  const underlineCount = Math.min(2, (raw.match(/_/g) ?? []).length);
  const base = underlineCount === 0 ? 1 : underlineCount === 1 ? 0.5 : 0.25;
  const dotted = /\.(?!.*\d)/.test(raw) ? base * 1.5 : base;
  const beats = dotted + (raw.match(/-/g) ?? []).length;
  return { degree, beats, rest: degree === 0, octave: readOctave(raw), confidence: 1 };
}
```

- [ ] **Step 4: Add tests for lyric-row matching, one lyric across several notes, missing lyrics, repeated screenshot overlap, missing tonic, and malformed-but-usable rows.**

- [ ] **Step 5: Implement row classification, nearest-lower lyric alignment, signature-based overlap removal, C/4-4/72 fallbacks, and `ESTIMATED` warnings; run the focused test until green.**

- [ ] **Step 6: Commit `feat: parse offline jianpu scores`.**

### Task 2: Compile Jianpu into keyboard-piano events

**Files:**
- Create: `web/app/import/jianpu-song-compiler.ts`
- Test: `web/app/import/jianpu-song-compiler.test.ts`
- Modify: `web/app/lib/song.ts`
- Modify: `web/app/import/types.ts`

**Interfaces:**
- Consumes: `ParsedJianpuScore` and a stable import id.
- Produces: `compileJianpuSong(score, id): SongPackage` with `tempoBpm`, playable events, `restBeforeMs`, source timing, lyrics, provenance, and quality.

- [ ] **Step 1: Write a failing compiler test for tonic F, octave movement, Chinese pinyin initial routing, English word initials, repeated lyric keys, digit fallback, and a rest before the next audible event.**

```ts
expect(song.tempoBpm).toBe(72);
expect(song.events[0]).toMatchObject({ targetCode: "KeyN", note: "F4" });
expect(song.events[1].restBeforeMs).toBe(833);
```

- [ ] **Step 2: Run `npx vitest run app/import/jianpu-song-compiler.test.ts` and verify it fails for the missing compiler.**

- [ ] **Step 3: Extend `SongPackage` with optional `tempoBpm` and `SongEvent` with optional `restBeforeMs`; keep both optional so existing IndexedDB records remain readable.**

- [ ] **Step 4: Implement degree-to-MIDI conversion, one-gesture note collapsing, duration-to-tap/hold selection, lyric key routing, digit cycling, rest accumulation, phrase construction, and stable ids.**

- [ ] **Step 5: Run compiler, existing song, arrangement, keyboard, and player-machine tests; fix only compatibility regressions.**

- [ ] **Step 6: Commit `feat: compile jianpu into piano arrangements`.**

### Task 3: Load score pages and recognize locally

**Files:**
- Create: `web/app/import/score-page-loader.ts`
- Create: `web/app/import/score-page-loader.test.ts`
- Create: `web/app/import/local-score-recognizer.ts`
- Create: `web/app/import/local-score-recognizer.test.ts`
- Create: `web/app/import/browser-score-analyzer.ts`
- Create: `web/app/import/browser-score-analyzer.test.ts`
- Modify: `web/package.json`
- Modify: `web/package-lock.json`
- Add: `web/public/ocr/` bundled local model/config assets

**Interfaces:**
- Consumes: ordered `File[]`, `AbortSignal`, and `(progress: ScoreImportProgress) => void`.
- Produces: `analyzeScoreFiles(files, options): Promise<PrivateSongRecord>` or typed `ScoreImportError`.

- [ ] **Step 1: Write failing loader tests that accept PNG/JPEG/WebP/PDF, preserve order, reject audio/video, and render injected PDF pages at two-times scale.**

- [ ] **Step 2: Install `pdfjs-dist` and the chosen PaddleOCR-compatible browser runtime, then implement image decoding and dependency-injected PDF rendering; keep worker/model URLs under `/pdf/` and `/ocr/`.**

- [ ] **Step 3: Write failing recognizer tests using a synthetic white score canvas with title, `1=F`, `4/4`, digit rows, underlines, lyric rows, and social-app chrome.**

- [ ] **Step 4: Implement score-region cropping, grayscale/contrast normalization, ordered local OCR invocation, notation digit probes, and a deterministic emergency digit-row fallback.**

- [ ] **Step 5: Write orchestration tests for real stage progress, metadata fallback, low-confidence `ESTIMATED`, multi-page de-duplication, no-digit blocking error, and persistence-ready output.**

- [ ] **Step 6: Implement `analyzeScoreFiles`; ensure every success passes through loader → recognizer → parser → compiler and no timeout/fake result path exists.**

- [ ] **Step 7: Run all three focused suites and commit `feat: recognize jianpu images and pdfs locally`.**

### Task 4: Replace the import studio and remove audio transcription

**Files:**
- Modify: `web/app/components/ImportStudio.tsx`
- Modify: `web/app/components/ImportStudio.test.tsx`
- Modify: `web/app/MoonlitPiano.tsx`
- Modify: `web/app/MoonlitPiano.test.tsx`
- Delete: `web/app/import/basic-pitch-transcriber.ts`
- Delete: `web/app/import/basic-pitch-transcriber.test.ts`
- Delete: `web/app/import/browser-media-analyzer.ts`
- Delete: `web/app/import/browser-media-analyzer.test.ts`
- Delete: `web/app/import/local-whisper-transcriber.ts`
- Delete: `web/app/import/local-whisper-transcriber.test.ts`
- Delete: obsolete Basic Pitch/Whisper assets under `web/public/models/` and `web/public/wasm/`
- Modify: `web/package.json`
- Modify: `web/package-lock.json`

**Interfaces:**
- Consumes: the `analyzeScoreFiles` function from Task 3.
- Produces: a private score added to React state and IndexedDB, then opened in the player.

- [ ] **Step 1: Replace component tests with multi-select score-file acceptance, ordered file list, PDF/image copy, six honest progress stages, cancel/retry, and blocking error behavior.**

- [ ] **Step 2: Run the focused tests and verify they fail against the audio/video UI.**

- [ ] **Step 3: Implement `<input type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf">`, ordered previews, score-specific English copy, and real progress rendering.**

- [ ] **Step 4: Wire `MoonlitPiano` to `analyzeScoreFiles`, `savePrivateSong`, and immediate player opening.**

- [ ] **Step 5: Remove Basic Pitch/Whisper source, packages, and locally downloaded obsolete assets after resolving and checking their exact paths are inside `web/public`.**

- [ ] **Step 6: Run import and app integration tests and commit `feat: replace media import with score import`.**

### Task 5: Add tempo scaling, silent rests, and exact highway durations

**Files:**
- Create: `web/app/lib/tempo.ts`
- Create: `web/app/lib/tempo.test.ts`
- Modify: `web/app/components/PlayerShell.tsx`
- Modify: `web/app/components/PlayerShell.test.tsx`
- Modify: `web/app/components/RhythmGuide.tsx`
- Modify: `web/app/components/RhythmGuide.test.tsx`
- Modify: `web/app/globals.css`

**Interfaces:**
- Consumes: `SongPackage.tempoBpm`, `SongEvent.holdMs`, source timing, and `restBeforeMs`.
- Produces: `scaleSongTempo(song, bpm): SongPackage` and player state that gates score progress during silent rests.

- [ ] **Step 1: Write failing pure tests proving 72→60 BPM scales 500 ms to 600 ms, leaves pitch/key data unchanged, and scales rests and source timing.**

- [ ] **Step 2: Implement immutable tempo scaling and clamp BPM to 50–120.**

- [ ] **Step 3: Add component tests for the tempo slider, every highway block showing seconds, `TAP 0.3s`, `HOLD 1.2s`, and a visible silent-rest countdown.**

- [ ] **Step 4: Implement the 50–120 BPM control, feed the scaled song to the player and highway, and prevent progression during a rest while still allowing free piano sound.**

- [ ] **Step 5: Implement active hold fill, early-release reset, rest countdown styling, and responsive lane geometry; run player/rhythm tests.**

- [ ] **Step 6: Commit `feat: add tempo-aware rhythm highway`.**

### Task 6: Finish private-library management

**Files:**
- Modify: `web/app/components/SearchHome.tsx`
- Modify: `web/app/components/SearchHome.test.tsx`
- Modify: `web/app/MoonlitPiano.tsx`
- Modify: `web/app/MoonlitPiano.test.tsx`
- Modify: `web/app/import/private-library.ts`
- Modify: `web/app/import/private-library.test.ts`
- Modify: `web/app/globals.css`

**Interfaces:**
- Consumes: existing private records loaded from IndexedDB.
- Produces: `renamePrivateSong(id, title)` and `deletePrivateSong(id)` synchronized across IndexedDB, catalog rows, and currently selected song.

- [ ] **Step 1: Keep/add tests proving only private rows have a manage button, blank rename is disabled, rename updates metadata and song titles, delete requires `Delete forever`, and built-ins cannot be changed.**

- [ ] **Step 2: Run private-library, SearchHome, and MoonlitPiano suites and verify any incomplete paths fail.**

- [ ] **Step 3: Complete inline rename, escape/cancel behavior, destructive confirmation, focus handling, IndexedDB transactions, and React state updates.**

- [ ] **Step 4: Run focused tests and commit `feat: manage private score library`.**

### Task 7: Full local verification and presentation polish

**Files:**
- Modify: `web/app/globals.css`
- Modify: `web/README.md`
- Modify: tests only where assertions must reflect the final truthful UI

**Interfaces:**
- Consumes: the completed local application.
- Produces: a verified local build and documented workflow.

- [ ] **Step 1: Update the README with supported score files, offline guarantees, tempo/hold rules, private-library controls, and `npm run dev`.**

- [ ] **Step 2: Run `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, and `npm audit --omit=dev`; record and fix every relevant failure.**

- [ ] **Step 3: Start localhost and verify OCR/PDF/WASM assets return HTTP 200; scan source and generated output with `rg "https?://|huggingface|basic-pitch|whisper" app public dist` and remove runtime model URLs.**

- [ ] **Step 4: Exercise the import using the supplied two overlapping “花海” screenshots; verify a named private score appears, the player displays lyrics plus key/duration blocks, tempo changes duration, the selected voice applies to every key, and rename/delete work after reload.**

- [ ] **Step 5: Visually inspect desktop and narrow layouts for the requested restrained gentlemanly international style, correct overflow/focus states, and readable rhythm lanes.**

- [ ] **Step 6: Commit `chore: verify offline jianpu workflow`.**

## Self-Review

- Spec coverage: all input formats, local recognition, musical marks, lyric routing, rests, tempo, physical-key semantics, highway durations, fallbacks, migration, Twinkle, rename/delete, and verification map to Tasks 1–7.
- Placeholder scan: no TBD/TODO/“implement later” instructions remain.
- Type consistency: `ParsedJianpuScore` flows parser → compiler; `SongPackage.tempoBpm` and `SongEvent.restBeforeMs` flow compiler → tempo scaler → player/highway; `analyzeScoreFiles` flows loader/recognizer → ImportStudio → IndexedDB.
