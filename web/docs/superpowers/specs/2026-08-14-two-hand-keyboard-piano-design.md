# Two-Hand Keyboard Piano Design

## Goal

Keep Moonlit Records as a user-played instrument while making guided songs sound like a restrained two-hand piano arrangement. No new note may attack without a real computer-key `keydown`.

## Controls

- `A`–`Z`: first right-hand melody note owned by a lyric token, using its pinyin/English initial.
- `Enter`: every later right-hand note owned by the same lyric token.
- `Space`: one authored or generated left-hand bass, octave, chord, or broken-chord gesture.
- `ShiftLeft` / `ShiftRight`: right-hand melody without lyrics (intro, interlude, outro).
- Digits remain available for free piano but are no longer guided instrumental targets.

## Score model

`SongEvent` remains the score-cursor unit and retains legacy `targetCode` and `notes`. It gains optional `parts`. Each part has a hand, target code, notes, and optional velocity. A legacy event normalizes to one part. A coordinated event may contain both right and left parts, such as `KeyA + Space`.

The player tracks which parts of the current event have received fresh physical keydowns. Either order is accepted. The cursor advances only after all parts are played. Keyup only releases physical ownership; it never advances the score or cuts a correct guided voice.

## Arrangement

Existing two-hand parts are preserved. Melody-only scores receive a deterministic, restrained left-hand layer derived from score time, meter, phrase boundaries, and tonal evidence. The arranger uses sparse downbeat/half-bar gestures and conservative bass/fifth/octave voicings. It may place Space together with a melody event or between right-hand events, but never schedules an attack by itself.

## Audio

Every part receives an independent audio handle. The first part of a new score event transitions older resonance; later parts of the same coordinated event do not release their sibling. Both hands share the selected piano, room, headroom, natural score-owned duration, and release model. Wrong letters/digits remain free piano and do not move the score.

## Compatibility

- Legacy lyric continuations normalize from repeated lyric events to `Enter`.
- Legacy no-lyric digit targets normalize to `Shift`.
- Legacy persisted songs remain readable because `targetCode` and `notes` stay required.
- Existing explicit `parts` are idempotently normalized and are not overwritten by the arranger.

## UI

The lyric stage, highway, shared timing bar, and on-screen keyboard use one action label helper. Coordinated events display `A + SPACE`. The keyboard shows explicit ENTER, SPACE, and SHIFT keys and can target more than one key. Timing remains guidance for the next attack, never a release judgment.
