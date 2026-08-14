# Moonlit Comfort Pace Following Design

## Goal

Make a steadily slow typist produce a connected, musical slow rendition without adding controls and without creating any note that was not triggered by a real keydown.

## Root cause

The existing tempo follower clamps release adaptation to 0.82–1.18 and smooths every observation slowly. A player who is 30–60% slower therefore reaches the score-owned release target before the next real keydown, leaving a perceptible hole. The first observations also carry little usable adaptation.

## Design

Keep the existing user-onset architecture. Widen only the release-window estimate for connected guided notes. Use five recent actual/score onset ratios, robust median filtering, confidence caps for the first two intervals, faster attack when a stable slower pace is detected, slower recovery toward a faster pace, and a hard 1.75 maximum. Ignore rests, interruptions, idle gaps, and implausible ratios as before.

Connected notes may use the full comfort scale because the next real correct keydown cancels the scheduled stop and performs the existing legato transition. Notes before a printed rest use at most 1.08 and phrase endings at most 1.25, preserving breathing and preventing organ-like sustain. No onset, cursor movement, pitch, key mapping, score event, or free-piano behavior changes.

## Success criteria

- A steady 1.6× player cadence converges above 1.5× within five valid intervals.
- One accidental hesitation cannot dominate the estimate.
- Connected note release targets can follow the slow estimate up to 1.75×.
- Rest and phrase-end targets remain tightly bounded.
- The next real correct keydown still releases/transitions the previous voice immediately.
- No real keydown still means no new piano attack.
