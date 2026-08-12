# Private Song Import and Piano-Arrangement Pipeline — Design Specification

Date: 2026-08-12  
Status: Approved in conversation; written specification awaiting final user review

## 1. Objective

Extend Moonlit Records from a calibrated demonstration catalogue into a personal piano-singing instrument. A user imports an ordinary audio or video file—possibly containing a singer, drums, bass, guitars, strings, synths, live ambience, and no original piano—and receives a private, playable piano arrangement.

The product is not intended to reproduce every source instrument. Its purpose is to preserve enough of the vocal melody, signature instrumental phrases, harmony, bass direction, and phrasing that the user can recognize and sing the song while personally triggering every piano sound from the computer keyboard.

The governing quality rule is **fail soft, always produce**:

- for every decodable media file containing usable audio, the pipeline returns a playable result;
- a weak lyric, metadata, separation, chord, or melody result lowers confidence and activates a fallback, but does not fail the whole job;
- unsupported, corrupt, empty, or undecodable files may be rejected because no honest musical result can be derived from them;
- temporary infrastructure failures remain retryable jobs and must never be disguised as completed arrangements.

## 2. Approved Product Decisions

- Importing audio or video is the primary path. Search is secondary and is used for the user's private library, already prepared lawful song packages, and metadata enrichment.
- Imported source media and generated artifacts are private to the importing user in the first version. They are not published or shared.
- The interface is English-first. Lyrics may remain in their source language, including Chinese.
- The arrangement favors recognizability over literal multi-track reproduction.
- Performance is `Free Performance` by default: the song waits for the player, rather than advancing at the original recording's tempo.
- The source recording does not play as accompaniment during performance. There is no automatic melody, backing track, or audible metronome.
- A piano sound is produced only by a physical performance-key press.
- Only `Digit1` through `Digit0` and `KeyA` through `KeyZ` are performance keys. Space, Shift, Escape, punctuation, arrows, modifiers, and function keys have no performance role.
- A physical-key hold behaves as a piano-key hold. Releasing the physical key releases the attacked piano voice into its natural tail.
- One performance event always consumes exactly one computer-key press, even when the musical output is a chord or other multi-pitch piano voicing.
- Wrong keys sound as free piano notes, turn red, and do not advance the guided song. The player may improvise indefinitely before pressing the target key.
- Completion waits until all held notes are released and the configured piano/reverb tail has ended.

## 3. Reference Wisdom

The implementation composes mature, independently replaceable tools rather than relying on a single opaque model:

- [FFmpeg](https://ffmpeg.org/documentation.html) for media decoding, audio extraction, resampling, channel conversion, and normalization.
- [Chromaprint](https://github.com/acoustid/chromaprint) and [AcoustID](https://musicbrainz.org/doc/AcoustID) for open acoustic fingerprinting.
- [MusicBrainz Web Service](https://musicbrainz.org/doc/MusicBrainz_API) for recording, artist, release, duration, and identifier metadata enrichment.
- [Demucs](https://github.com/facebookresearch/demucs) for separating vocals, drums, bass, and the remaining accompaniment. The processing adapter must be replaceable because the original repository is now maintenance-only.
- [OpenAI Whisper](https://github.com/openai/whisper) for multilingual transcription, with [WhisperX](https://github.com/m-bain/whisperX) for more precise word-level alignment.
- [Spotify Basic Pitch](https://github.com/spotify/basic-pitch) for audio-to-MIDI candidate notes.
- [Essentia MELODIA](https://essentia.upf.edu/reference/streaming_PredominantPitchMelodia.html) for predominant melody extraction from polyphonic accompanied singing, including pitch confidence.
- [Essentia tonal and rhythm algorithms](https://essentia.upf.edu/algorithms_overview.html) for key, scale, chord sequence, beat position, BPM, onset, and other structural evidence.

These tools provide evidence, not unquestioned truth. The arrangement compiler merges candidates, rejects obvious octave and breath artifacts, assigns confidence, and applies deterministic fallbacks.

## 4. User Experience

### 4.1 Library and import

The home screen keeps a single prominent search field and adds an `IMPORT AUDIO OR VIDEO` action. Search results distinguish:

- `IN YOUR LIBRARY`: a private generated song package, immediately playable;
- `READY TO PLAY`: a lawful prepared package, copied into the user's private library when selected;
- `METADATA ONLY`: a song identity is known but no playable package exists; the user is asked to import their own media;
- no match: import remains available without requiring a title.

Accepted initial formats are MP3, WAV, FLAC, M4A/AAC, OGG, MP4, MOV, and WebM, subject to a documented duration and file-size limit.

### 4.2 Processing progress

The job reports meaningful stages rather than a fake percentage:

1. `PREPARING THE RECORDING`
2. `IDENTIFYING THE SONG`
3. `SEPARATING VOICE AND INSTRUMENTS`
4. `ALIGNING THE LYRICS`
5. `TRACING THE MELODY`
6. `ARRANGING FOR PIANO`
7. `READY TO PERFORM`

Completed artifacts are cached per stage. A retry resumes from the most recent valid artifact instead of restarting the whole song. The user may leave the page and return to the private library while processing continues.

### 4.3 Result screen

Every completed package shows:

- identified or fallback title and artist;
- arrangement confidence as a calm descriptive label (`CLEAR`, `USABLE`, or `SKETCH`), not a punitive score;
- recommended piano voice;
- detected language, key, approximate tempo, and duration when available;
- `PERFORM` as the primary action;
- optional `REANALYZE` and metadata correction actions.

No mandatory correction gate blocks performance. A user can immediately play an approximate result.

## 5. Processing Pipeline

### 5.1 Decode and normalize

FFmpeg extracts a canonical analysis stream while preserving the original private upload separately. The analysis stream is mono or stereo PCM at the model-required sample rate. Duration, silence ratio, clipping, and decode integrity are recorded before expensive work begins.

### 5.2 Identify the recording

Evidence is considered in this order:

1. embedded media tags;
2. sanitized filename hints;
3. Chromaprint fingerprint and AcoustID match;
4. MusicBrainz lookup and search using the strongest available identifiers;
5. transcription-derived title/artist hints only when corroborated by a metadata result.

An uncertain identity is never fabricated. The deterministic fallback is `Imported Track` and `Unknown Artist`. Metadata matching failure does not reduce musical processing.

### 5.3 Separate musical sources

Demucs or a compatible adapter produces at least `vocals`, `drums`, `bass`, and `other` stems. Separation quality is assessed using energy, bleed, clipping, and usable-duration checks.

If separation fails or yields unusable stems, downstream extractors run on the original mix. The pipeline records that confidence is lower but continues.

### 5.4 Recover lyrics and timing

Whisper transcribes the vocal stem (or original mix fallback). WhisperX aligns words or characters to time spans. Identified title, artist, language, and trusted embedded lyrics may guide transcription, but the product does not scrape arbitrary copyrighted lyric pages.

Post-processing:

- preserves Chinese characters and English words for display;
- removes or down-weights obvious breath, applause, and repeated hallucination segments;
- groups tokens into KTV-style phrases;
- retains uncertain text rather than dropping the entire phrase;
- represents unrecognized vocal passages with unobtrusive placeholders;
- switches truly lyric-free spans to instrumental events.

### 5.5 Recover melody, harmony, and structure

Multiple candidate paths run independently:

- MELODIA estimates the predominant sung or lead melody and frame confidence;
- Basic Pitch proposes note onsets, offsets, pitches, and amplitudes on useful stems;
- tonal extraction estimates key, scale, and chords;
- rhythm extraction estimates beats, onsets, phrase boundaries, and tempo;
- bass evidence helps choose chord inversions and harmonic direction;
- repeated sections help repair isolated low-confidence passages from stronger occurrences.

The compiler quantizes noisy pitch curves into stable notes, removes implausibly short events, corrects likely octave jumps, and retains characteristic instrumental hooks in lyric-free sections.

### 5.6 Reduce to piano

The arrangement is a piano interpretation, not a stem recreation:

- sung melody receives priority during lyric phrases;
- signature lead-in, fill, and interlude melodies receive priority outside lyric phrases;
- harmony is reduced to playable piano voicings;
- bass direction may be included in the same single-key voicing;
- simultaneous musical notes may be grouped into one polyphonic event;
- fast decorative notes may be simplified when they would harm singability or create excessive key presses;
- register, inversion, and density are constrained to sound natural on the selected piano.

## 6. Guaranteed Fallback Ladder

The highest available tier becomes the result; no lower-confidence tier prevents performance.

### Tier A — Clear arrangement

Reliable identity, lyrics, word timing, melody, chords, and structure. Produces the closest piano-singing arrangement.

### Tier B — Usable arrangement

Lyrics and principal melody are usable; uncertain harmony is simplified to stable diatonic or key-consistent voicings.

### Tier C — Melody sketch

Lyrics are partial or melody confidence varies. Retain recognized phrases, use placeholders for unknown text, and construct accompaniment from key, beat, bass, and chord evidence.

### Tier D — Performance sketch

Lyrics or separation may be unusable. Generate a recognizable-as-possible piano path from predominant pitch contour, onsets, key, rhythm, repeated structure, and energy. Lyric-free spans use the number-row instrumental mode. The package remains playable and is labeled `SKETCH`.

If no credible title or author exists at any tier, the fallback metadata remains explicit rather than invented.

## 7. Song Package and Event Grammar

The durable compiled form is independent of the models that generated it.

```text
LyricToken
  -> zero or more PerformanceEvents
  -> each PerformanceEvent requires exactly one physical key
  -> each PerformanceEvent produces one or more piano pitches
```

A `PerformanceEvent` includes:

- stable ID and phrase index;
- lyric token reference or instrumental marker;
- target physical key code;
- one or more MIDI pitches;
- velocity and recommended piano voice;
- source start/end timestamps for provenance only;
- event kind: `tap` or `hold`;
- hold duration guidance when applicable;
- confidence and fallback tier;
- optional provenance links to melody, chord, beat, and lyric artifacts.

One computer key may therefore trigger a single note, octave, dyad, triad, or reduced piano chord. The player never requires a simultaneous multi-key chord to advance one event.

## 8. Lyric-to-Key Rules

- Chinese lyric tokens use the initial of the current pronunciation's pinyin: `你 -> N`, `好 -> H`.
- English tokens use the word's first letter: `I love you -> I L Y`.
- Punctuation creates no performance event.
- One lyric token spanning several notes produces repeated events with the same target: `爱 -> A A A`.
- Several lyric tokens sung on the same pitch still produce one event per token: `我爱你 -> W A N`, even if all three output the same pitch.
- A held syllable uses a `hold` event. Correct keydown begins the note and visual rail; keyup releases the piano voice. Premature release keeps the guided target available rather than skipping it.
- The stage shows the current KTV-style phrase and the next phrase at the same time.

## 9. Instrumental-Key Rules

Lyric-free musical events use only the number row and this exact repeating path:

```text
1 2 3 4 5 6 7 8 9 0 | 0 9 8 7 6 5 4 3 2 1 | repeat
```

The endpoint digits are intentionally repeated. Every instrumental musical event consumes one digit press. A single event may output multiple piano pitches. Sequential arpeggio notes remain sequential presses. The current digit is prominent and the next few digits are previewed.

## 10. Physical Keyboard Contract

The only playable physical codes are:

```text
Digit1 Digit2 Digit3 Digit4 Digit5 Digit6 Digit7 Digit8 Digit9 Digit0
KeyQ KeyW KeyE KeyR KeyT KeyY KeyU KeyI KeyO KeyP
KeyA KeyS KeyD KeyF KeyG KeyH KeyJ KeyK KeyL
KeyZ KeyX KeyC KeyV KeyB KeyN KeyM
```

This produces 36 stable keys. Physical `KeyboardEvent.code` is used so Chinese input methods, capitalization, and layout state do not alter the mapping.

In free-piano mode, the 36 keys map deterministically from low to high across three chromatic octaves in the visual row order above. During a guided event, only the current target key temporarily outputs that event's song pitch or piano voicing; all other playable keys retain their default free-piano pitches.

No special, punctuation, modifier, navigation, or function key is captured for performance.

## 11. Piano Input and Audio Invariants

- Silence is the default. No scheduler produces piano sound without a physical performance-key event.
- `keydown` attacks once. Browser/OS key-repeat events are ignored.
- Holding the physical key keeps the virtual damper lifted while the sampled or modeled piano naturally decays; it does not loop or retrigger mechanically.
- `keyup` releases exactly the note or voicing attacked by that physical key.
- A chord event attacks and releases all of its pitches together.
- Several physical keys can remain held independently for free improvisation.
- A wrong key obeys the same attack, hold, and release lifecycle as a correct key, but records an error and does not consume the target event.
- Repeated targets require release and a fresh keydown.
- The source recording, accompaniment, metronome, and recognition preview never autoplay on the performance screen.
- After the final event, the stage remains in `ringing` until all keys are released and the current voice's natural release/reverb tail reaches acoustic idle.

## 12. Free-Performance Timing

Imported timestamps are analysis evidence, not an automatic playback clock. They determine:

- phrase grouping and KTV line breaks;
- notes per lyric token;
- hold guidance and relative duration;
- structural boundaries for introductions, fills, interludes, and ending;
- recommended velocity and phrasing.

The next event waits indefinitely for the correct physical key. No missed-time failure, life system, or forced skip exists. A future optional original-tempo mode is outside this delivery.

## 13. Privacy, Rights, and Storage

- Source uploads, fingerprints, stems, transcripts, analysis artifacts, and compiled packages are private per user.
- Storage separates original media from derived artifacts so the user can remove the original while retaining a private lightweight arrangement, or delete both.
- Public search APIs are used for metadata and lawful prepared packages, not as arbitrary commercial-audio downloaders.
- No imported song becomes public merely because another user imports the same recording.
- Logs must not include raw lyrics, audio bytes, signed URLs, or private filenames.
- Object access uses expiring authorization and jobs enforce ownership on every read and mutation.

## 14. System Boundaries

### Web application

Owns import UI, job progress, private library, result summary, KTV stage, 36-key display, keyboard state machine, and piano engine.

### Application API

Owns authenticated uploads, job creation, status, ownership, metadata correction, package retrieval, retry, and deletion.

### Object storage

Owns original uploads and versioned stage artifacts. The database stores references, checksums, states, confidence, and provenance rather than large media blobs.

### Processing worker

Owns FFmpeg and model execution. Each stage has a typed input/output contract, timeout, retry policy, artifact checksum, and fallback path. Heavy processing runs away from the browser and edge request lifecycle so ordinary client computers need no local models or GPUs.

### Arrangement compiler

Owns deterministic evidence fusion, cleanup, fallback tiers, piano reduction, lyric mapping, instrumental digit routing, event validation, and song-package versioning. It must be testable without running ML models.

## 15. Failure and Recovery

- An individual model timeout activates its fallback or resumes from the previous artifact.
- Duplicate upload hashes reuse the same user's completed private artifacts when compatible with the current compiler version.
- Worker interruption leaves the job resumable.
- A low-confidence region is represented in the finished package rather than deleting later phrases.
- Package validation repairs or replaces invalid events so every ready package has at least one playable event.
- A corrupt/empty file receives a precise import error and is not represented as a fake arrangement.
- Deletion cancels active work, revokes object access, and removes private source and selected derivatives according to the user's choice.

## 16. Test Contract

Automated tests must prove:

- only the 36 approved key codes can produce or consume performance events;
- silence persists without physical key input;
- keydown attacks once, repeat is ignored, hold does not retrigger, and keyup releases the exact attacked pitches;
- a one-key polyphonic event attacks/releases every pitch in its voicing;
- wrong keys sound, mark red, and do not advance;
- repeated targets require release and another keydown;
- Chinese initials, English word initials, melisma repetition, same-pitch lyric tokens, long holds, and punctuation behavior compile correctly;
- instrumental events use the exact forward/reverse number sequence with repeated endpoints;
- imported timestamps never auto-advance Free Performance;
- final completion waits for held notes and the full engine-reported tail;
- every decodable analysis fixture reaches a valid package under each simulated model-stage failure;
- fallback metadata never hallucinates a title or artist;
- partial artifacts are cached and resumable;
- ownership prevents cross-user access to sources, artifacts, jobs, and packages;
- the KTV stage simultaneously displays current and next phrases;
- existing English-first international visual and accessibility behavior remains intact.

Representative fixtures must include studio pop, dense electronic production, acoustic guitar with voice, live recording with applause/reverb, rap or speech-heavy vocals, instrumental music, Chinese lyrics, English lyrics, a repeated melisma, and deliberately damaged or low-quality audio.

## 17. Acceptance Criteria

1. A user can import a supported, decodable audio or video file and later find the job and result in a private library.
2. The system attempts identity, lyrics, melody, harmony, rhythm, and structure independently and records confidence/provenance.
3. Every decodable file with usable audio yields a valid `CLEAR`, `USABLE`, or `SKETCH` piano package even when one or more analysis stages fail.
4. The generated package prioritizes the sung melody and recognizable musical hooks, reducing all source instruments to a coherent piano interpretation.
5. Search enriches metadata and discovers existing private/prepared packages but never assumes permission to fetch arbitrary commercial audio.
6. The performance screen uses only digits `1–0` and letters `A–Z`.
7. Every musical event requires exactly one physical key and can emit one or more piano pitches.
8. No physical key press means no piano sound and no progression.
9. Physical key hold/release matches piano attack, natural held decay, and release behavior.
10. Wrong keys remain expressive free-piano notes and never skip the target.
11. Free Performance waits for the player and does not enforce the recording's tempo.
12. The final experience waits for all held notes and their acoustic tail before completion.
13. Current and next lyric phrases remain visible in the KTV-style stage.
14. Imported media and every derived artifact remain private to their owner.

## 18. Explicit Non-goals for This Delivery

- public sharing of imported songs or derived lyrics;
- automatic downloading of arbitrary music from YouTube, Spotify, or other commercial services;
- faithful reconstruction of every original instrument or production effect;
- mandatory manual score editing before a song can be played;
- MIDI hardware, mobile touch performance, sustain pedal, Space/Shift controls, punctuation keys, function keys, or ROG keyboard-light integration;
- automatic backing tracks, autoplay, or original-tempo scoring;
- claiming perfect lyrics, authorship, pitch, chord, or arrangement accuracy.

