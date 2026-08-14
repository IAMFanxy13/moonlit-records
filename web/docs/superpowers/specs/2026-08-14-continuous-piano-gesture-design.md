# Continuous Piano Gesture Design

## Goal

Keep Moonlit Records physically simple—lyrics use A–Z, accompaniment uses Space, instrumental passages use Shift—while making each user attack produce a short, deterministic piano gesture and making adjacent gestures form one continuous phrase.

No new user controls, no automatic next event, no score-driven future event attack, and no unrelated architectural rewrite.

## Locked interaction

- Lyric event: press its displayed A–Z initial.
- Lyric event with left hand: press the displayed A–Z initial and Space approximately together.
- `CHORD_INPUT_WINDOW_MS = 120`; either key may arrive first. The first part sounds immediately. The second part inside the window is classified as the same fused gesture. A late second part remains accepted as a recovery so the performer cannot become stuck, but it is not classified as a fused chord.
- Instrumental event: one fresh physical Shift keydown advances exactly one event. Shift is not a modifier.
- A repeated lyric note repeats the same letter and requires a real keyup before another keydown.
- Keyup never advances the score. No timer attacks or advances the next score event.
- Wrong A–Z keys remain free-piano attacks and do not advance.

## Runtime data flow

1. `keyboard.ts` canonicalizes `ShiftLeft` and `ShiftRight` to `Shift`, and migrates legacy instrumental digits to Shift at score normalization boundaries.
2. `input-fusion.ts` records the first required part of a coordinated event and classifies the second part against the 120ms window without delaying either sound.
3. `player-machine.ts` remains the score authority. It accepts required parts in either order, tracks completed parts, and advances only after all required parts received real keydowns.
4. `piano-gesture.ts` turns a `SongEventPart` into notes, velocities, durations, and deterministic attack offsets using fixed templates.
5. `phrase-continuity.ts` decides which existing resonant voices survive a new attack based on phrase, hand, harmony, articulation, pitch proximity, and pedal intent.
6. `piano-engine.ts` schedules the notes of one gesture on the Tone audio clock while returning one owned composite handle.

## Score and compatibility

`SongEventPart` gains optional `gestureType`: `block`, `softRollUp`, `rollUp`, `rollDown`, `grace`, or `octave`. Score/2 accepts only those names. Millisecond offsets remain internal templates, not author-provided arbitrary timing.

Legacy `Digit2` and other lyric-free digit events normalize to Shift. Legacy independent Space events are folded at runtime into the nearest lyric event in the same phrase; new Score/2 authoring places left and right parts in the same event. Persisted source text is not rewritten.

## Gesture templates

- `block`: all offsets 0ms.
- `softRollUp`: ascending notes at 0/25/50ms, distributed up to 75ms for larger voicings.
- `rollUp`: ascending notes at 0/35/70/105ms, capped at 140ms.
- `rollDown`: descending pitch order with the roll-up offsets.
- `grace`: first note at 0ms, main and remaining notes 45–75ms later.
- `octave`: preserve the melody and add a restrained octave when missing; attack together or with at most 25ms spread.

Lyric gestures are capped at 180ms. Instrumental Shift gestures may use the same templates but never schedule another score event.

## Voice leading and texture

The melody pitch is immutable. Only inner/right-harmony and left-hand notes may change octave or inversion. The deterministic optimizer prioritizes common tones, then minimum semitone motion, while enforcing registers. It never invents chromatic notes outside the supplied pitch classes.

Texture density derives from `Phrase.section` and `Phrase.energy`: verse is sparse, pre-chorus adds inner motion, chorus allows fuller voicing and rolls, high energy allows octave melody and broken left hand, ending reduces density. Explicit high-confidence Score/2 gestures are preserved except for safe register normalization.

## Phrase continuity

The current per-gesture owned handles remain intact. A new attack does not automatically clear every previous voice of the same hand. Compatible same-phrase voices continue to their scheduled release; incompatible harmony changes, rests, phrase boundaries, pedal release, capacity pressure, and same-pitch retriggers receive bounded transition fades.

This keeps room resonance and left-hand tails continuous while preventing indefinite sustain or accumulating mud.

## UI

- Remove before/between/after Space stars.
- Each lyric token displays its letter, or `LETTER + SPACE` when that event requires a left part.
- Instrumental lines, highway, screen keyboard and footer display `SHIFT`.
- The duration bar remains advisory and never becomes a scoring system.

## Safety and tests

Regression tests cover: 120ms either-order fusion; late recovery; ShiftLeft/ShiftRight canonical ownership; no keyboard repeat; no auto-advance; wrong-key free sound; overlapping physical keys; same-pitch reattack; gesture offsets and 180ms cap; voice-leading melody preservation and motion cost; same-phrase resonance; rest/phrase cleanup; legacy Space and Digit2 migration; UI removal of positional Space stars.

