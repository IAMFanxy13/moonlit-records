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

The player keeps the compact note highway for upcoming-key orientation, but duration countdown belongs to one shared horizontal energy bar in the lower performance area immediately above the computer keyboard. Per-note highway blocks may show key and duration labels, but they do not animate individual countdown fills.

At every new event the shared bar is full and labelled with the required key plus suggested duration. It remains completely still until the correct current key is physically pressed. While that key remains down, the bar drains linearly for the printed duration and stays empty if the player continues holding. Releasing at any moment advances to the next event and refills the bar; the bar is guidance only and never grades, blocks, fails, or automatically advances the performance. Wrong and improvised keys sound normally but do not drain the shared bar.

Chinese lyrics are tokenized one Han character at a time and map to uppercase pinyin initials. English lyrics are tokenized one word at a time and map to uppercase word initials. Printed rests consume no lyric token. When one lyric token spans multiple melody notes, its keyboard initial repeats; passages with no lyric token use the repeating numeric route.

## Testing

Pure conversion tests cover lyric tokenization, rest alignment, repeated-note syllables, onset grouping, chord reduction, duration preservation, and hold classification. Component tests verify that the shared bar starts full, drains only for the correct held key, refills on the next event, and never judges release timing. Full unit, type, lint, build, rendered-HTML, and local-browser checks finish the change.
