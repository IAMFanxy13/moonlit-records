# Moonlit Records — Full Piano Gesture & Realism Design

## Outcome

Moonlit keeps its simple physical controls while changing the musical unit from “one computer key equals one piano note” to “one computer key starts one pre-authored piano gesture.” A gesture may contain one note or a simultaneous voicing, but it never schedules a future pitched attack. The browser remains a deterministic validator, parser and player.

## Frozen input contract

- `A–Z`: first right-hand lyric gesture for a lyric token.
- `Enter` / `NumpadEnter`: second and later right-hand gestures owned by the same lyric token. It is invalid for a first lyric gesture, left hand, or instrumental first gesture.
- `Space`: one left-hand gesture.
- `ShiftLeft` / `ShiftRight`: one lyric-free right-hand gesture.
- `1–0`: free piano only.
- Composite events accept their required controls in either order. Each control needs a fresh physical keydown; browser repeat never advances the score.

## Data model

`SongEventPart` becomes the compatibility surface for a structured `PianoGesture`: trigger, hand, notes, per-note velocities and durations, articulation, harmony identity, pedal intent, role, origin and confidence. Existing scalar event fields remain available. A performance event can own independent right and left gestures.

V1 is normalized in memory: old lyric melismas become initial + Enter, old digit instrumentals become Shift, old note arrays become right-hand gestures. V2 is a safe declarative JSON payload following a `MOONLIT-SCORE/2` marker; it is schema-validated and never evaluated. Built-in songs pass through the same normalization and conservative two-hand preparation at the catalogue boundary.

## Audio ownership

Each physical gesture owns its Tone buffer sources and its own release schedule. Active musical voices carry hand, harmony and gesture identity. A new right-hand gesture transitions only eligible right-hand voices. A new left-hand gesture transitions earlier left-hand harmony according to harmony/pedal intent. Rest, phrase end, pause, restart, replay, blur and disposal clear both hands. This removes the global “release everything on every attack” behavior.

Per-note dynamics and durations are applied by splitting a gesture into independently owned voices while sharing one real keydown. Tone/Web Audio audio-clock scheduling remains authoritative; no wall-clock timer creates or times pitched attacks.

## Arrangement policy

Authored V2 gestures always win. The existing deterministic I–V–vi–IV helper remains only a compatibility fallback for V1/built-ins without left-hand information. It uses score timing/meter to choose sparse harmonic positions and open low-register voicings, not a claim that four melody events equal a bar.

## Lyrics

Lyric tokens remain separate from note events. A melisma displays one token with progress dots and expects initial + Enter(s). True repeated words/characters remain separate tokens and expect repeated initials. The entire current phrase is horizontally centered as a wrapping unit; long phrases wrap to a second centered line instead of being clipped beyond the viewport.

## Sample policy

The current compact Salamander-derived bank remains because its source is traceable and licensed. Its limited anchors and one velocity layer are documented as a realism ceiling. No unlicensed or unexplained soundfont is introduced. The architecture leaves room for a future licensed HQ bank without coupling score semantics to assets.

## Verification

Unit tests cover strict Enter semantics, V1 compatibility, V2 validation, simultaneous voicings, independent hands/harmonies, catalogue migration, long-lyric layout, repeat suppression and cleanup. Full Vitest, TypeScript, ESLint, production build and browser interaction are run before delivery.
