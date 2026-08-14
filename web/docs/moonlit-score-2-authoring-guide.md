# MOONLIT-SCORE/2 Authoring Guide

Score/2 is a safe, declarative piano-arrangement package. The first line is exactly `MOONLIT-SCORE/2`; everything after it is one JSON object. It contains data only—never JavaScript, comments, functions or expressions.

## Minimal shape

```text
MOONLIT-SCORE/2
{
  "meta": {
    "title": "Song title",
    "artist": "Artist",
    "key": "G",
    "mode": "major",
    "meter": "4/4",
    "tempo": 68,
    "voice": "concert"
  },
  "phrases": [{
    "text": "爱你",
    "section": "verse",
    "energy": 2,
    "events": []
  }]
}
```

Voices are `felt`, `concert`, `studio`, or `upright`. Keys accept flats/sharps and either `major` or `minor`. Pitches are absolute scientific names such as `C2`, `F#4`, `Bb5`; this preserves accidentals and supports modulation without guessing from Jianpu degrees.

## Events and gestures

Each event has a non-negative `beat` position and one or both of `right` and `left`. Both parts are independent gestures but belong to one performance event. Their controls can be pressed in either order.

```json
{
  "beat": 0,
  "lyric": { "id": "love-1", "text": "爱", "subIndex": 0 },
  "right": {
    "trigger": "KeyA",
    "notes": [
      { "pitch": "B4", "velocity": 0.54, "durationBeats": 1.5 },
      { "pitch": "E5", "velocity": 0.78, "durationBeats": 1.0 }
    ],
    "articulation": "legato",
    "harmonyId": "Em7",
    "pedalIntent": "hold",
    "role": "melody-voicing",
    "origin": "gpt-arranged",
    "confidence": 0.92
  },
  "left": {
    "trigger": "Space",
    "notes": [
      { "pitch": "E2", "velocity": 0.48, "durationBeats": 3 },
      { "pitch": "B2", "velocity": 0.42, "durationBeats": 3 }
    ],
    "harmonyId": "Em7",
    "pedalIntent": "hold",
    "role": "left-open-voicing"
  }
}
```

All notes inside one gesture attack from that one real keydown, optionally using one of the fixed bounded roll/grace templates. A multi-event figure still needs several real Space, Shift, or repeated-lyric-initial keydowns.

## Frozen trigger rules

- First gesture of one lyric token: its initial (`KeyA` for 爱, `KeyN` for 你, `KeyL` for Love).
- Further gestures of that same token: repeat the same lyric initial, with sequential `subIndex` 1, 2, … and the same lyric `id` and text. Each repetition requires keyup followed by a new keydown.
- A genuinely repeated lyric creates new IDs and starts from the initial each time.
- Every left-hand gesture: `Space`.
- Every lyric-free right-hand gesture: `Shift`.
- Digits and Enter are not guided controls in the current performance contract.
- Legacy `Enter`/`Digit1` continuation aliases and lyric-free digit events remain accepted while importing old data, then normalize to the lyric initial or `Shift`.

Every left-hand event must use its real musical `beat`. Do not attach Space to the nearest lyric for appearance. If the left hand begins before a word, between two lyric attacks, simultaneously with a lyric, or after the last lyric, keep that authored onset. Moonlit projects the cue from the shared score-time axis and displays it before, between, under, or after the corresponding lyric anchors.

## Musical constraints

Keep the source melody present and perceptually strongest. Inner voices should be quieter and normally below the melody. Keep left hand in an open low/mid-low register, retain common tones and prefer short inner-voice motion. Avoid close-position thirds in the low register. Use sparse textures in verses, restrained octave or chord colour at structural accents, denser but still breathable voicings in choruses, and explicit `release`/`repedal` intent at rests, phrase endings and harmony changes. More notes are not automatically more luxurious: register, voice leading, dynamics and controlled resonance must preserve clarity.

MOONLIT-SCORE/1 remains accepted and is migrated in memory. Score/2 should be used whenever the arrangement intentionally contains harmony, independent hands, dynamics or voicings.
