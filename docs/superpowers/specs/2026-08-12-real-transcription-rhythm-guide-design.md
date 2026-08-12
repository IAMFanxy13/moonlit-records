# Real Local Transcription and Rhythm Guide Design

## Goal

Imported audio or video must undergo visible, real local music transcription, and every playable event must tell the performer when to tap or how long to hold. The app must never imply that voice separation, lyric recognition, or model inference happened when it did not.

## Product Contract

- Audio is produced only by physical `1`-`0` or `A`-`Z` key presses.
- One computer-key gesture may play one piano note or one reduced chord.
- Keydown starts the piano sound and keyup releases it.
- A wrong or improvised key sounds with the selected global piano voice but does not advance the arrangement.
- A correct tap advances on keydown. A correct hold advances only after the displayed duration has been held and released.
- Imported instrumental passages use the repeating numeric route `1` through `0`, then `0` through `1`.
- All imported recordings produce a playable result when audible audio can be decoded. A failed neural transcription falls back to an explicitly labelled local rhythm sketch.

## Analysis Architecture

The browser decodes the entire recording and downmixes it to mono. A local adapter resamples the PCM to 22,050 Hz and lazily loads Spotify Basic Pitch from local static model files. Basic Pitch performs automatic music transcription and reports real progress for each inference window. Its detected note starts, durations, pitches, and amplitudes are converted into arrangement evidence.

Notes beginning within 80 milliseconds are grouped into one reduced chord because the interaction contract permits only one physical computer key per musical event. A group keeps at most its three strongest notes. Its duration is the longest member duration. Durations of at least 600 milliseconds become hold events; shorter durations remain taps but still retain source timing for display.

If the model cannot load or returns no stable notes, the existing PCM analyzer produces a fallback result. The UI identifies this as a fallback sketch and records the reason in warnings. It never labels that path as voice separation or neural transcription.

## Progress and Error Handling

Progress stages are `preparing`, `identifying`, `transcribing`, `arranging`, `enriching`, and `ready`. Every progress update may include a zero-to-one fraction. Model progress comes from Basic Pitch's inference callback instead of an animation. Optional free online metadata and lyric lookup happens after local transcription and cannot discard a successful local result.

Unsupported, silent, oversized, and excessively long files remain explicit errors. Model download or inference failures are recoverable and select the local sketch path.

## Rhythm Guide

The player gains a compact note highway between the KTV lyric stage and the performance status. Imported numeric arrangements show ten lanes; lyric-initial arrangements show twenty-six alphabet lanes. The current event sits on a gold judgment line and upcoming events appear above it, positioned by source-time distance when available and ordinal distance otherwise.

Each note block is labelled with the required key. Its height represents duration. The current instruction says `TAP` for a short note or `HOLD 1.2s` for a hold. While the correct hold key is physically down, a fill travels through the block for exactly `holdMs`; releasing early resets the fill and leaves the same event waiting. The guide itself never advances by clock time.

## Testing

Pure conversion tests cover onset grouping, chord reduction, duration preservation, and hold classification. Analyzer tests inject a transcription function to prove that real duration evidence reaches song events, that progress is truthful, and that failures visibly fall back. Component tests verify ten numeric lanes, source-time ordering, duration labels, active hold state, and integration with the existing player state machine. Full unit, type, lint, build, rendered-HTML, and local-browser checks finish the change.
