# Offline Jianpu Image Import Design

## Goal

Replace audio/video import with a fully local workflow that accepts one or more lyric-bearing Jianpu screenshots or a PDF and always produces a playable keyboard-piano arrangement. Preserve the note highway, physical-key piano semantics, private-library rename, and confirmed deletion.

## Input contract

- Accept PNG, JPEG, WebP, and PDF only.
- Accept multiple images in one import and preserve the user-selected order.
- Inputs may be phone screenshots containing social-media chrome, large margins, page indicators, playback controls, or overlapping portions of consecutive score pages.
- Printed Jianpu is the primary target. Handwritten or severely blurred scores may produce an estimated result but must not make the entire import fail when usable notes remain.
- All processing, model assets, and persistence remain on the device. No runtime network request is permitted.

## Recognition architecture

Use a modular expert-system pipeline inspired by published Jianpu OMR work rather than a single opaque end-to-end guess:

1. PDF.js renders every PDF page to a high-resolution canvas. Images are decoded to the same internal page type.
2. Page preprocessing finds the high-density white score region, removes surrounding app chrome and margins, corrects contrast, and preserves the original grayscale pixels for symbol inspection.
3. A bundled PaddleOCR.js Chinese mobile pipeline returns ordered text lines and bounding polygons. Its model and ONNX/WASM assets are served only from local static paths.
4. Line classification separates title/metadata, numbered-notation lines, and lyric lines.
5. Jianpu expert rules interpret digits 0–7, bar lines, dashes, augmentation dots, octave dots, underlines, and ties. Pixel probes around OCR digit positions supplement characters that generic OCR commonly omits.
6. Score rows are matched to the closest lyric row below them. Repeated row signatures across overlapping screenshots are discarded.
7. A deterministic compiler converts relative Jianpu pitch and beat duration into the existing `SongPackage` format.

Every stage reports real progress. Recognition warnings are explicit and the result is labelled `ESTIMATED` when confidence is low.

## Musical rules

- Read `1=<pitch>` as the tonic. If it is absent, use C major and add `TONIC_ESTIMATED`.
- Read the displayed meter when available; default to 4/4.
- Read an explicit tempo when available; otherwise use 72 BPM.
- The performance page exposes a 50–120 BPM tempo control.
- Base digit duration is one beat. One underline halves it; two underlines quarter it. An augmentation dot multiplies it by 1.5. Each following dash extends it by one beat.
- An upper dot raises one octave; a lower dot lowers one octave.
- `0` is a silent timed rest and never produces piano audio.
- A tie between identical pitches merges their duration. Slurred different pitches remain separate presses.
- Simultaneous or otherwise complex marks that cannot be recovered collapse to one playable piano gesture rather than aborting the score.

## Lyrics and keyboard route

- Chinese lyric characters use pinyin initials; English words use their first Latin letter.
- A lyric character spanning several melody notes repeats the same target key once per note.
- Melody notes without lyrics use the digit row, cycling `1` through `0` in score order.
- Each actual melody gesture requires exactly one physical key press. A press is the only action that creates piano audio.
- Wrong and improvisational keys use the globally selected piano voice, turn red when wrong, and do not advance.
- Correct holds advance only after their required duration; releasing early leaves the same target active.

## Note highway

- Display a Rhythm-Master-style lane view for both letter and digit routes.
- Every block shows its keyboard key and estimated duration in seconds.
- The caption uses explicit copy such as `TAP 0.3s · N` and `HOLD 1.2s · H`.
- Holding the physical key fills the active block. A rest displays a silent countdown before the next target becomes available.
- Durations recalculate when the user changes tempo.

## Import result and failure behavior

- Successful recognition directly creates and stores a private arrangement; there is no mandatory correction screen.
- If metadata is missing, derive a readable title from the filename and use `Unknown Artist`.
- If lyrics are incomplete, keep recognized lyric initials and use digits for unmatched notes.
- If rhythm marks are incomplete, use one-beat estimates and label the result `ESTIMATED`.
- Only unsupported/corrupt files or pages with no recognizable Jianpu digits produce a blocking error.

## Private library controls

- Only imported records expose a `•••` manage button.
- Rename is inline, rejects a blank value, and updates both `metadata.title` and `song.title` in IndexedDB and React state.
- Delete requires an explicit `Delete forever` confirmation and removes only that private record.
- Built-in scores, including the complete Twinkle Twinkle Little Star, have no rename/delete controls.

## Removal and migration

- Remove audio/video file types and all Basic Pitch and Whisper runtime code, packages, and model assets.
- Existing imported private records remain readable and manageable; only the creation workflow changes.
- No published deployment is created. The result remains the local application at `http://localhost:3000/`.

## Verification

- Unit-test notation duration, octave, tonic, rest, lyric alignment, overlap de-duplication, and deterministic fallback behavior.
- Component-test multi-file image/PDF acceptance, progress copy, duration-labelled note blocks, tempo adjustment, rename, and confirmed deletion.
- Run the entire Vitest suite, TypeScript, ESLint, production build, and production dependency audit.
- Verify local OCR/PDF/model assets return HTTP 200 from localhost and scan source/build output for forbidden remote model URLs.
