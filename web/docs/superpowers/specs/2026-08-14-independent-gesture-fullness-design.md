# Independent Gesture Fullness Design

## Goal

Make every correctly guided standalone lyric letter, Space, and Shift sound full and continuous while preserving the existing rich two-hand sound, one-key operation, recognizable melody, authored multi-note material, and free-piano key mapping.

## Locked behaviour

- A standalone correct lyric letter with one authored pitch becomes a restrained octave-layer gesture. The authored melody pitch remains first and strongest.
- A standalone correct Shift event with one authored pitch uses the same restrained octave layer; multi-note instrumental gestures stay unchanged.
- A standalone correct Space event with only one authored bass pitch becomes an open bass gesture consisting of root, fifth, and octave. Existing two-to-four-note left-hand voicings stay unchanged.
- Explicit `gestureType: "block"` is an opt-out and remains a literal block gesture.
- Simultaneous letter + Space material is not enlarged again. Existing multi-note gestures pass through unchanged.
- Secondary notes are quieter than the authored pitch and use bounded 18–64ms spreading so the result feels played, not mechanically stacked.
- Existing phrase-resonance, release scheduling, room tail, same-pitch retrigger, rest, pause, restart, and blur cleanup remain unchanged.
- Wrong keys and paused free-piano letters remain literal single piano keys. The richness upgrade applies only to correct guided score events.

## Architecture

Extend the pure `piano-gesture.ts` planner. It owns only note expansion, attack offsets, source-index mapping, and secondary-note velocity scaling. `PlayerShell` consumes the completed gesture plan and applies its velocity scales before calling the existing piano engine. No new controls, score fields, audio libraries, or automatic attacks are introduced.

## Verification

Pure planner tests cover standalone letter, Shift, Space, explicit block opt-out, and unchanged existing chords. Player integration verifies that one real correct keydown produces the planned multi-note handle without producing future score events. The full existing suite must remain green.
