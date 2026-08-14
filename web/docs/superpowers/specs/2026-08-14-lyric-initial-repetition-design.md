# Lyric Initial Repetition And Discrete Space Cues Design

## Goal

Restore the simple guided-performance contract without changing audio or unrelated features:

- every melody gesture owned by one lyric token uses that token's initial;
- one lyric token remains one visible character or English word;
- multi-gesture tokens keep their per-note progress dots;
- every lyric token displays its input letter in advance;
- Space cues appear only before the first lyric, directly above one lyric, exactly between two adjacent lyrics, or after the final lyric.

## Input model

`LyricToken` remains the display and ownership unit. Its inclusive `startEvent..endEvent` range owns one or more right-hand `SongEvent` values. During normalization, every event in that range receives the same `KeyX` target derived from the token's Chinese pinyin initial or English first letter.

For a three-note “爱”, the runtime event route is therefore `KeyA`, `KeyA`, `KeyA`. Browser repeat remains ignored, so each repeated A requires a real keyup followed by a new keydown. Three independent lyric tokens “爱爱爱” also produce `A`, `A`, `A`, but remain three tokens rather than one token with three progress dots.

Legacy Score/2 material using `Digit1` or `Enter` for a continuation remains importable. The import boundary accepts the alias, and `normalizeSongPackage()` converts it to the lyric initial. New Score/2 material may use either the lyric initial or the legacy continuation alias, but the returned runtime song always uses the lyric initial.

## Lyric presentation

The complete current phrase remains a single fitted line. Every visible lyric token always renders a compact input letter below it. Current letters are brighter; upcoming letters are readable but quieter; completed letters are subdued.

A token with more than one melody event renders one row of progress dots. The token text is never duplicated. The dots advance by `lyricSubIndex`: completed notes are filled, the waiting note glows, and future notes remain hollow. The letter below the token does not turn into `1` for later notes.

## Space presentation

The existing score timing still classifies each left-hand onset, but the visual projection is discrete:

1. `before`: at the leading edge before the first token;
2. `under`: directly above the measured centre of its lyric token;
3. `between`: at the exact visual midpoint of the two adjacent measured token centres;
4. `after`: at the trailing edge after the final token.

The temporal ratio may remain in the cue data for diagnostics, but it no longer moves the star within the gap. All phrase cues remain visible in advance: upcoming cues are hollow and dim, the current cue is filled and bright, and completed cues fade out.

## Compatibility and scope

No piano-engine, voice, timing, cursor, wrong-key, pause, restart, or free-play behavior changes in this task. Digit1 remains a playable number key where ordinary free piano permits it; it simply stops being the guided continuation key for lyric-owned events. Digit2 remains the lyric-free right-hand route and Space remains left hand.

## Acceptance tests

- One-token “爱” with four events displays one “爱”, one `A`, four dots, and requires four fresh A presses.
- Three-token “爱爱爱” displays three characters and three `A` hints without melisma dots.
- A complete phrase shows an initial under every token before it is played.
- A legacy Score/2 continuation authored as Digit1 imports and normalizes to the lyric initial.
- A new Score/2 continuation authored as the repeated lyric initial is accepted.
- Between-token Space cues render at the midpoint of the adjacent token centres regardless of timing ratio.
- Before, under, between, and after Space classifications remain distinct.
