# Moonlit Records — Score-Positioned Left Hand and Simple-Luxury Controls

## Goal

Moonlit Records must remain extremely simple to operate while sounding rich, full, elegant, and recognizably pianistic. The player decides when every musical gesture begins by pressing a physical key. The score and piano engine decide which simultaneous piano notes belong to that gesture, how the voices connect, and how they decay. No future pitched attack may be generated without a new physical keydown.

## Frozen Controls

- `A–Z`: first right-hand gesture owned by a lyric token, selected from the lyric initial.
- `Digit1`: second and later right-hand gestures owned by the same lyric token. This replaces physical Enter.
- `Digit2`: lyric-free right-hand gestures in introductions, interludes, and endings. This replaces physical Shift.
- `Space`: every left-hand gesture.
- `Digit3–Digit0`: remain available to free piano where the existing mode permits it.

Physical Enter and Shift are retired from guided performance. Existing saved scores and built-ins that contain legacy `Enter` or `Shift` targets are migrated in memory to `Digit1` and `Digit2`; the original stored record does not need destructive rewriting.

Repeated `Digit1`, repeated `Digit2`, and repeated lyric initials require a genuine keyup followed by a new keydown. Browser keyboard repeat never advances the score. Wrong keys retain the existing free-piano behavior and never advance the score.

## Score-Time Model

Right- and left-hand gestures are independent authored events on one musical time axis. Every gesture has a score onset (`sourceStartMs` or an equivalent beat-derived onset), duration, hand, trigger, notes, dynamics, articulation, harmony identity, and pedal intent where available.

The score cursor may expose a coordinated right/left event. If both hands begin together, the right-hand trigger and `Space` are accepted independently in either physical order; each attacks only when its own key is pressed. The cursor advances after the required authored parts have been started. The engine never supplies the missing hand automatically.

Legacy material without trustworthy score time uses the existing conservative arranger. Generated fallback positions must be marked internally as inferred and must never be presented as more precise than the available score permits.

## True `Space` Placement

The main lyric text, centering, wrapping, and token ownership remain unchanged. A separate left-hand cue row is rendered below each visual lyric line.

`Space` is never attached to the nearest character merely for visual convenience. Its position comes from the authored left-hand onset compared with the authored onsets of neighboring lyric tokens:

- onset before the next lyric onset: show `SPACE` before that lyric;
- onset equal to a lyric onset within a small notation tolerance: show `SPACE` directly below that lyric;
- onset between two lyric onsets: place `SPACE` between their visual anchors, interpolated by the real time ratio;
- onset after the final lyric onset: show `SPACE` after the final lyric at its relative score position.

For two neighboring lyric onsets `t0` and `t1`, a left-hand onset `tL` uses `r = (tL - t0) / (t1 - t0)`. Its horizontal position is interpolated between the measured centers of the two rendered lyric tokens using `r`, rather than rounded to either token.

When a long phrase wraps, rendered lyric-token rectangles are grouped by visual line. Each line receives its own cue row. A cue that lies within a line's time span is placed on that line; a cue at a wrap boundary is placed after the preceding line or before the following line according to its real onset. Layout measurement changes only the cue overlay and never rewrites the lyric text.

Each cue visibly says `SPACE`. Current cues receive the existing active highlight language. Cues communicate when to press; they do not judge timing, autoplay the left hand, or require accurate key release.

## Rich Piano Gesture Policy

More notes do not automatically produce a more luxurious result. Complexity is produced through musical voice leading, register, density, dynamics, articulation, and controlled resonance.

- The melody remains the perceptual leader and is voiced slightly above supporting right-hand notes.
- A right-hand keydown may trigger one melody note, an octave, or a restrained two- or three-note voicing when the score calls for it.
- A `Space` keydown may trigger a bass note, octave, open fifth, broken-harmony snapshot, or two- to four-note left-hand voicing.
- Low-register close-position thirds are avoided; bass voicings use wider spacing to prevent mud.
- Adjacent chords prefer common tones and short voice-leading motion instead of jumping every voice.
- Verses remain relatively transparent. Choruses and climaxes may use wider registers, octaves, fuller harmony, and stronger resonance.
- Simultaneous density remains bounded so the melody is not masked and the sample engine is not overloaded.

One physical keydown may attack several simultaneous piano notes as one `PianoGesture`. It may not schedule a later arpeggio note automatically. A genuinely broken chord therefore requires another authored physical trigger, normally another `Space` press.

## Piano Sound and Release

The existing sample-based piano path remains the foundation. Each physical attack happens once, browser repeat is ignored, and individual notes use their authored velocity. Song-mode keyup releases physical ownership but does not hard-cut a correctly triggered musical gesture.

Musical release considers target score duration, the next real keydown, same-note retrigger, rest, phrase boundary, harmony change, and pedal intent. It must not be implemented as one long fixed release. Neighboring voices may overlap naturally, while low-register or harmony-changing voices are cleared sooner to avoid blur. Phrase endings retain a longer room tail than ordinary transitions.

The ambience remains supportive rather than washed out: direct piano attack stays intelligible, room reverb supplies depth, and the final completion state waits for the bounded piano tail before ending. Pause, restart, replay-line, exit, and window blur cancel schedules and release every active handle.

## Data and Parser Compatibility

`PianoGesture` / `SongEventPart` remains the structured musical unit. Score normalization changes only the control aliases:

- legacy lyric continuation `Enter` → `Digit1`;
- legacy lyric-free right hand `Shift`, `ShiftLeft`, or `ShiftRight` → `Digit2`;
- left hand remains `Space`;
- first lyric gesture remains the lyric initial.

MOONLIT-SCORE/2 validation and authoring documentation use `Digit1` and `Digit2` for new material but accept the legacy aliases only at the import/normalization boundary. Runtime keyboard input does not canonicalize a newly pressed Enter or Shift into the new controls.

Built-in songs pass through the same preparation boundary as imported songs. Their prepared forms must contain the updated targets, independent left-hand onsets, appropriate harmony identities, and bounded gestures. The raw legacy fixtures remain usable for compatibility tests.

## UI Changes

The on-screen keyboard highlights `1`, `2`, and `SPACE` in their physical rows. Separate Enter and Shift performance keys are removed. Short English guidance explains:

- `A–Z · LYRIC MELODY`
- `1 · CONTINUE THE SAME WORD`
- `2 · RIGHT-HAND INSTRUMENTAL`
- `SPACE · LEFT HAND`

The lyric remains the largest centered element. The left-hand cue row sits immediately below it, and the note highway continues to show the exact next required trigger. No scoring, accuracy judgment, pedal key, MIDI control, 88-key interface, or unrelated visual redesign is added.

## Tests

Automated coverage must include:

1. `A → Digit1 → Digit1` for one three-gesture lyric token.
2. `A → A → A` for three independent repeated lyric tokens.
3. `Digit2` for lyric-free right-hand events and rejection of physical Shift.
4. Migration of old Enter/Shift saved scores without destructive rewriting.
5. `Space` positioned before, under, between, and after lyric tokens from score onset data.
6. A between-token cue uses temporal interpolation rather than nearest-token rounding.
7. Wrapped lyrics receive per-line cue rows without clipping or changing lyric order.
8. Coordinated right/left events accept either keydown order and never autoplay the missing part.
9. Wrong keys sound freely but do not advance the cursor.
10. Multi-note right and left gestures attack simultaneously, preserve melody prominence, and remain polyphony-bounded.
11. Repeated-key suppression and genuine keyup/re-press behavior for `Digit1`, `Digit2`, and `Space`.
12. Natural overlap, same-note retrigger, rest, phrase ending, completion tail, pause, restart, replay, exit, and blur cleanup.
13. Existing local library, free piano, tempo, pause, restart, replay-line, rename, delete, and code import continue to work.

Final verification runs the complete Vitest suite, TypeScript checking, ESLint, the production build, server-side render smoke testing, and a local browser interaction pass where tooling permits.

## Non-Goals

This increment does not add autoplay, automatic future notes, timing scores, accompaniment playback, Shift controls, Enter controls, pedal controls, MIDI, an 88-key UI, OCR, PDF recognition, network APIs, or an unrelated interface redesign.
