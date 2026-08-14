# Single-Line Lyric and Space Stars Design

## Goal

Improve guided performance readability without changing the established musical controls or score semantics. The current phrase must stay on one centered line across the widest safe part of the viewport. Left-hand `Space` events must be visible early as quiet stars above their exact score-time positions. One lyric token with several melody gestures must remain one visible lyric token with progress dots.

## Frozen Controls

- `A`–`Z`: the first right-hand melody gesture owned by a lyric token.
- `Digit1`: every later right-hand melody gesture owned by that same lyric token.
- `Digit2`: lyric-free right-hand gestures.
- `Space`: left-hand gestures.
- Wrong keys retain free-piano sound and never advance the guided score.
- Browser repeat never creates another attack or advances the score.

No keyboard mapping, audio ownership, parser format, score cursor, or automatic-play behavior changes in this increment.

## Single-Line Lyric Layout

The entire current phrase is rendered as one horizontal line. The usable lyric stage expands from the previous narrow content width to almost the full viewport width while retaining safe side margins. The phrase remains truly centered.

The line never wraps. A measured fit calculation scales only the current phrase's font size and character spacing down when required. It starts from the existing large concert-scale typography, preserves that size for ordinary phrases, and reduces it only enough to fit the available width. A minimum readable size prevents pathological shrinking. If an unusually long phrase still cannot fit at the minimum size, the text remains one line and uses a clipped/faded edge fallback rather than creating a second row or pushing the page horizontally.

Punctuation and lyric-token order remain unchanged. The hidden accessible lyric line continues to expose the complete phrase.

## Left-Hand Space Star Track

A dedicated star track sits directly above the lyric line. It renders every left-hand event in the current phrase early enough for preparation, rather than showing only the current event.

Each star uses the existing `buildLeftHandCues` score-time projection:

- a left-hand onset simultaneous with a lyric onset appears directly above that lyric token;
- an onset between two lyric attacks appears proportionally between those two token anchors;
- an onset before the first lyric appears before it;
- an onset after the last lyric appears after it.

The cue is never snapped to the nearest character for decoration. A simultaneous event remains simultaneous, and a before/after event remains spatially before/after.

Stars have three unambiguous states:

- upcoming: dim, hollow, but visible;
- current: bright, filled, and softly glowing;
- completed: extinguished to a very faint neutral mark.

The star itself is the primary symbol. Only the current star may show a compact `SPACE` label for learnability; upcoming stars stay visually quiet. When the same score event requires a right-hand input and `Space`, the star lights at that shared event while the lyric key prompt continues to show the right-hand input. Either physical key may be pressed first according to the existing coordinated-event rules; the event advances only after both required gestures occur.

## One Lyric, Multiple Melody Gestures

Lyric display and note-event progress remain separate. A token such as `爱` with four melody gestures is rendered once, with four small progress dots.

The input sequence is:

1. first gesture: `A`;
2. second gesture: `1`;
3. third gesture: `1`;
4. fourth gesture: `1`.

Each repeated `1` requires a genuine keyup and new keydown. The lyric character is never duplicated. The dots show completed, current, and upcoming gesture state. Three genuinely repeated lyric tokens such as `爱爱爱` remain three characters and require `A → A → A`.

## Component Boundaries

- `left-hand-cues.ts` remains the pure score-time classification layer.
- A small lyric-layout hook/helper measures the available line and content widths and returns a bounded font scale without changing song data.
- `LyricStage.tsx` composes lyric tokens, melisma dots, the current key prompt, and the star track.
- CSS owns the concert visual states, single-line containment, safe margins, and responsive limits.

No unrelated player, audio, library, import, or keyboard component is redesigned.

## Accessibility and Lifecycle

The star track has an accessible label and each cue exposes its temporal relationship and state. Decorative star geometry is hidden from assistive technology. Resize and font-load changes recompute the lyric fit. Observers and animation work are released on unmount.

## Tests

Automated coverage must prove:

1. an ordinary phrase remains one line at the default concert size;
2. a long phrase scales down and never wraps;
3. the lyric stage uses the wider safe viewport width;
4. Space stars render above the lyric and preserve before, simultaneous, between, and after positions;
5. upcoming, current, and completed stars expose distinct states;
6. a coordinated melody-plus-Space event lights the star without hiding the lyric input;
7. one four-gesture lyric renders one character, four dots, and `A → 1 → 1 → 1` prompts;
8. three independent repeated characters remain three tokens;
9. existing keyboard, player, audio, parser, library, pause, restart, replay, and free-play tests remain green;
10. browser layout inspection confirms a single lyric row, no horizontal page overflow, and a star-track rectangle above the lyric rectangle.

## Non-Goals

This increment does not change piano samples, chord voicing, target duration, tempo following, left-hand arrangement generation, score import, network behavior, library management, grading, autoplay, or any physical control.
