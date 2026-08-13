# Phrase Resonance Design

## Objective

Turn the current point-by-point melody into a connected, lyrical piano line without adding any new physical controls. The computer keyboard remains the instrument: no note may begin without a physical keydown. The page remains guidance only.

## Chosen Approach

Use score-aware automatic damper handling for correct song notes. A physical keyup ends the held-key state, but a correct song voice may move into a short phrase-resonance bank instead of being stopped immediately. New physical keydowns still create every audible attack.

This is deliberately different from setting one very long global release. Resonance is bounded and responds to phrase boundaries, rests, repeated pitches, voice limits, cleanup actions, and time.

Two alternatives were rejected:

- A longer fixed sampler release would blur harmony and would not understand phrases.
- Automatic accompaniment generation would guess harmony that is not present in a Jianpu melody and could make a recognisable song less accurate. Existing multi-note `SongEvent.notes` remains the path for explicitly authored bass notes and chords.

## Behaviour

### Physical keydown

- A correct song key attacks its `SongEvent.notes` once and advances the score cursor immediately.
- Wrong and paused/free-play keys keep their existing one-key/one-voice behaviour.
- Browser repeat never creates another attack.
- Before a correct attack, the resonance bank is reconciled:
  - release all deferred voices from an older phrase;
  - release all deferred voices before a printed rest;
  - release deferred voices that contain a pitch about to be retriggered;
  - release the oldest voices until no more than four deferred gestures remain.

### Physical keyup

- Wrong and free-play voices call `piano.keyUp()` immediately.
- A correct song voice leaves the physical-key map and enters phrase resonance.
- It remains independently releasable through its existing `PianoKeyHandle`; it never becomes a pitch-wide release.
- A deferred voice is released after at most 2.4 seconds even if no later key is pressed.
- Holding the physical key keeps the voice out of the deferred bank, so long press still equals long piano-key hold.

### Phrase and lifecycle cleanup

- Pause, restart, replay line, exit, window blur, visibility loss, and component unmount release active and deferred voices and cancel all resonance timers.
- Song completion waits until every physical key is up and the deferred phrase-resonance bank is empty. Only then does the existing selected-room tail timer begin.
- The shared duration bar remains advisory and is not a score or gate.

## Architecture

Create a focused `phrase-resonance.ts` state helper rather than adding more policy directly to `PlayerShell`.

```ts
interface ResonantVoice {
  id: number;
  handle: PianoKeyHandle;
  phraseIndex: number;
  notes: readonly string[];
  releasedAt: number;
}

interface PhraseResonanceState {
  voices: ResonantVoice[];
}
```

Pure operations will decide which handles must be released:

- `deferVoice(state, voice)`
- `prepareAttack(state, event)`
- `expireVoice(state, handleId)`
- `clearResonance(state)`

`PlayerShell` owns browser timers and calls `piano.keyUp(handle)` for the handles returned by those operations. This keeps musical policy testable without Tone.js or React.

The physical-key map changes from `Map<string, PianoKeyHandle>` to a record that also stores whether the voice was correct and which score event produced it. Score cursor, physical keys, active audio and deferred resonance remain separate state domains.

## Multi-note Piano Gestures

No new automatic harmony inference is introduced in this phase. `SongEvent.notes` already supports multiple piano notes from one physical keydown and remains unchanged. A future calibrated score can explicitly store melody, bass and chord notes in that array; phrase resonance will connect those gestures without another audio refactor.

## Safety Against Mud

- Maximum four deferred gestures.
- Maximum residence time 2.4 seconds.
- Same-pitch retrigger releases the older source before the new attack.
- Phrase change and printed rest clear the bank.
- The existing short exponential damper release and independent room reverb remain unchanged.

## Compatibility

- No score-code syntax change.
- No migration of saved songs.
- A–Z, 1–0 and Space mappings remain unchanged.
- Incorrect keys still sound freely and never advance the score.
- Existing authored chords continue to work.
- No new pedal, Shift, MIDI, scoring or automatic playback control is added.

## Verification

Automated tests must cover:

1. Correct keyup defers release and a following correct key can overlap it.
2. Wrong/free keyup releases immediately.
3. Same-pitch retrigger releases only the older source.
4. A phrase boundary and a printed rest release deferred voices.
5. The fifth deferred gesture releases the oldest one.
6. A voice expires after 2.4 seconds.
7. Pause, restart, replay, blur and unmount clear timers and all voices.
8. Completion waits for phrase resonance, then waits for the room tail.
9. Long physical hold still attacks once and does not enter resonance until keyup.
10. Existing A–F, Space continuation and legato tests remain green.

Browser verification uses the local Flower Sea score to confirm that adjacent correct presses produce overlap, Space continuation remains visible, wrong notes do not advance, and no runtime errors are logged.
