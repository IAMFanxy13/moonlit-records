# Legato, Lyric Tokens, and Natural Release Design

## Goal

Make Moonlit Records feel closer to a real piano without changing its simple input model. Letters remain lyric/free-play keys, digits remain instrumental/free-play keys, and Space becomes the continuation key for additional notes sung on one lyric token. No pedal, Shift modifier, MIDI input, scoring system, OCR, or unrelated interface redesign is included.

The physical computer keyboard is the instrument: sound exists only because the performer presses a key. The webpage is a visual lyric, note, and duration guide; it never auto-plays the score or blocks expression to enforce timing.

## Confirmed Interaction Contract

- A correct physical `keydown` attacks exactly one score event and immediately advances the score cursor.
- The next score event is immediately available even while the previous physical key remains held.
- `keyup` releases only the audio voice started by that physical key. It never advances or rewinds the score cursor.
- Browser key repeat and a second `keydown` for a physical key that is already held are ignored.
- A wrong letter or digit plays its stable free-piano note, records visual feedback, and leaves the score cursor unchanged.
- Space prevents browser scrolling. It produces a score note only when Space is the expected continuation; otherwise it neither sounds nor advances.
- Consecutive events that require the same physical key still require an actual release and a fresh press because a held key cannot attack twice.
- Pause, restart, replay-line, blur, visibility loss, exit, and unmount release every active audio handle and clear every held-key record.

## Data Model

`SongPackage` gains an optional `lyricTokens` collection so existing saved packages remain structurally valid. Each token has a stable ID, its phrase index, display text, ordinal position in the phrase, and the inclusive event range it owns.

```ts
interface LyricToken {
  id: string;
  phraseIndex: number;
  tokenIndex: number;
  text: string;
  startEvent: number;
  endEvent: number;
}
```

`SongEvent` retains the old `token` and `tokenIndex` fields for persistence compatibility and adds optional normalized references:

```ts
interface SongEvent {
  lyricTokenId?: string | null;
  lyricSubIndex?: number | null;
  lyricSubCount?: number | null;
}
```

The first event owned by a lyric token uses that token's initial. Every later event owned by the same token uses `Space`. Three distinct lyric tokens whose text is `爱爱爱` each own one event and therefore remain `KeyA`, `KeyA`, `KeyA`.

## Legacy Normalization

A pure normalizer converts every song into the internal model before playback. New songs already contain explicit token ranges. Older saved songs are aligned against each phrase's visible lyric units and event-token sequence:

- `line: 爱` plus event tokens `爱, 爱, 爱` becomes one token owning three events.
- `line: 爱爱爱` plus event tokens `爱, 爱, 爱` becomes three tokens owning one event each.
- Existing curated, instrumental, OCR-era, and private packages remain loadable without rewriting IndexedDB.
- Instrumental events retain their `1` through `0` route and have no lyric-token reference.

The normalizer is idempotent and does not mutate the persisted object supplied by the caller.

## Moonlit Score Code

`MOONLIT-SCORE/1` remains the version header. The parser accepts both the existing per-note syntax and a compatible grouped-token extension:

```text
notes: [3:.5 4:.5 5:1]{爱}
```

The group creates one lyric token with three note events and the input route `KeyA`, `Space`, `Space`. Existing code such as `3:.5{爱} 4:.5{爱} 5:1{爱}` remains accepted and is disambiguated with the phrase text during normalization. Chords inside a grouped token continue to use `+`.

## Player State and Legato

The score cursor and held inputs are independent. `PlayerState` replaces singular `activeHold` with a serializable record keyed by physical code. Each held guided input stores the score event index and press time. React's audio-handle map remains the source of truth for currently sounding physical-key attacks.

On a correct `keydown`, `pressKey`:

1. creates the correct sound request;
2. records the physical key as held;
3. increments `eventIndex` and `correctCount` immediately;
4. exposes the next event without waiting for release;
5. enters `ringing` immediately after attacking the final score event, while completion still waits for all physical keys to be released and the selected room tail.

On `keyup`, `releaseKey` only removes that physical key's held-input record. `PlayerShell` releases the exact `PianoAttackHandle` stored for that code. Releasing N after H starts cannot release H or alter H's score state.

## Duration Guidance

Printed duration remains advice, never a grade or gate. Held-input records allow duration state to survive score-cursor advancement. The shared duration area shows the most recently attacked still-held guided event; when no guided input is held, it previews the currently expected event. Early release, late release, and overlapping held notes are all valid.

The Note Highway always labels a continuation as `SPACE` in text as well as highlighting the wide Space key on the screen keyboard.

## Lyric UI

`LyricStage` renders lyric tokens rather than one visual character per note event. A token with multiple events appears once and includes one progress dot per sub-event:

- pending: `○`
- current sub-event: `●`
- completed sub-event: `✓`

The key label under the token changes from its initial to `SPACE` as the cursor crosses its event range. Only after the last sub-event completes does the next lyric token become current.

## Audio Model

The public piano port becomes explicit `keyDown(notes, velocity)` and `keyUp(handle)` operations. A keydown invokes Tone.js `Sampler.triggerAttack` once; keyup invokes `Sampler.triggerRelease` once through the voice that created the handle. The input layer prevents repeated attacks for the same held physical code.

The bundled Salamander subset contains only sustained piano samples, not dedicated release or resonance samples. Tone.js 15.1.22 plays those samples once without looping and uses an exponential fade when stopped. The implementation therefore keeps the natural decay recorded in the sample, uses a short per-voice damper fade rather than an exaggerated fixed release, and lets the separate room reverb carry the tail. No large physical-model engine or new sample set is introduced.

## Compatibility and Scope

- IndexedDB schema and private-library records remain unchanged.
- Old `MOONLIT-SCORE/1` text remains accepted.
- Existing built-in and imported songs are normalized at playback time.
- Tempo, pause, restart, replay-line, voice selection, completion tail, free play, wrong-key feedback, chords, and local-only storage remain available.
- Only letters, digits, and guided Space are recognized as performance inputs.

## Verification

Automated tests cover ordinary Chinese initials, grouped one-token melisma, true repeated lyrics, wrong-key free play, immediate keydown cursor advancement, N/H overlap, independent key releases, browser repeat suppression, Space scrolling prevention, pause/restart/replay/blur cleanup, natural keyDown/keyUp audio routing, and the existing full suite. Browser verification confirms the visible lyric dots, explicit `SPACE` highway label, overlapping key behavior, and no stuck notes after interruption.
