# Moonlit Records — Final Piano Experience Upgrade Report

Date: 2026-08-13

## 2026-08-14 Full Piano Gesture & Realism Upgrade

Moonlit's authored musical unit is now a `PianoGesture`, stored compatibly in `SongEvent.parts`. One physical keydown can attack one note or a simultaneous voicing with per-note dynamics and duration, but it can never queue a future pitched attack. Performance events may contain independently triggered right and left gestures.

The current input contract is frozen: A–Z plays every gesture owned by its lyric token, so a one-character melisma repeats the same initial with a genuine release and new press. Space starts a left-hand gesture, including phrase-start, simultaneous, between-lyric, and phrase-end positions. Shift starts lyric-free right hand. Digits and Enter do not advance current guided songs; legacy aliases migrate in memory.

The former global `prepareAttack` path is no longer used by the player. `prepareGestureAttack` transitions only the hand receiving a new gesture: right-hand melody does not cut sustained left harmony, while a real new left gesture owns the left-hand harmonic change. Pause, restart, line replay, seek, blur, hidden state, unmount and completion still clean every handle.

The browser engine now accepts per-note velocity arrays in one simultaneous gesture and can schedule each owned source's release at a separate audio-clock duration. Authored melody/inner-voice/left-hand balance therefore survives parsing instead of collapsing to one scalar.

`MOONLIT-SCORE/2` is implemented as a marker followed by strictly validated declarative JSON. It carries absolute pitches (including accidentals), key and mode, meter, beat positions, sections/energy, independent gestures, harmony identity, articulation, pedal intent, role, origin and confidence. It never executes script. A formal authoring guide and fixed GPT arrangement prompt are included under `docs/`.

The original built-in library is now exposed to the application through `preparedBuiltinSongs`, the same normalization/fallback boundary used for V1 material. Existing raw fixtures remain available for backward-compatible tests and saved records. Curated built-ins now carry explicit score onset/duration data; timed scores use actual meter/downbeats, while untimed legacy songs still receive one conservative left-hand harmony at each phrase opening.

The lyric stage now owns a separate left-hand cue track. `SPACE` is projected from its authored onset against neighboring lyric-token onsets: equal onsets render under a lyric, intermediate onsets use real-time interpolation between token anchors, and leading/trailing gestures appear before or after the lyric. The main lyric text, order, centering and wrapping are unchanged.

Prepared fallback arrangements add restrained right-hand octave colour at structural left-hand accents and keep the original melody voice stronger than supporting tones. Left hand remains an open two-to-four-note register. This makes one physical gesture fuller without turning every key into a muddy large chord or scheduling an automatic future pitch.

Long current lyric phrases are rendered as one full-width, centered, wrapping flex unit. They no longer use `white-space: nowrap`, so the end of a long sentence remains visible instead of extending beyond the viewport.

## Outcome

Moonlit remains fully user-played: only a real keyboard `keydown` creates a note. The score now determines a musical target length, Tone's audio clock schedules how that existing note ends, and the next real correct `keydown` can reshape the transition. Guided `keyup` records only that the physical key was released.

The performance page also supports silent phrase seeking through the progress strip and a `START FROM LINE` selector.

## Root causes

1. Guided target release was authorized by `window.setTimeout`, so main-thread delay could change musical timing.
2. Tone's exact per-gesture sources were captured, but their future stops could not be scheduled/cancelled through the project port.
3. Release duration used only authored tempo and did not account for a player's consistently faster or slower real onsets.
4. Dynamics treated every fourth event as a bar accent even when event durations were unequal.
5. The progress strip was visual only and could not safely relocate every playback subsystem.
6. The compact bank was suspected of being too short, but had not been decoded and measured.

## Key implementation

### Audio clock

`tone-source-adapter.ts` is now the only file that knows Tone Sampler's private active-source registry. It captures only the sources created by one physical gesture, schedules their stop against Tone's `currentTime`, cancels a future stop with `cancelStop()`, and protects overlapping same-pitch handles from each other.

`PianoPort` now exposes:

- `scheduleRelease(handle, delayMs, options)`
- `cancelScheduledRelease(handle)`
- existing exact-handle `keyUp(handle, options)` for immediate release

PlayerShell schedules every correct note immediately after attack. Its JavaScript timer only retires visual/resonance state; it no longer calls the musical release for the ordinary target-expiry path. An early next correct attack cancels the old future stop, then applies the score-aware transition fade.

### Human tempo follower

The follower compares recent correct-onset intervals with expected score-onset intervals, keeps five recent valid ratios, takes a median, applies confidence-aware asymmetric smoothing, and clamps the result to 0.82–1.75. It ignores rests, interruptions, non-positive intervals, idle gaps over four seconds, and ratios outside 0.55–2.4. It resets on pause, restart, replay, explicit seek, blur, and visibility interruption.

The scale changes release windows only. It cannot create an onset, move the score cursor, or correct when the next note appears.

### Comfort pace following

The slow-player path now uses confidence-aware asymmetric smoothing. The first two intervals are deliberately capped so one hesitation cannot dominate; after three consistent observations, a stable slow cadence can extend connected release windows up to 1.75×. Slower behavior is learned quickly, while recovery toward a faster estimate is gentler. Printed rests remain capped at 1.08× and phrase endings at 1.25×, so comfort pacing does not erase musical breathing. A next real correct keydown still cancels the old scheduled release and performs the existing transition immediately. No user keydown still means no new piano attack.

### Phrase seek

`seekPlayerToPhrase` is a pure player-machine transition. PlayerShell wraps it in atomic cleanup:

- cancel completion and UI timers;
- cancel every audio-clock release;
- release all exact audio handles;
- clear physical held keys, resonance, feedback, completed-rest state, duration UI, and tempo history;
- place the score cursor at the phrase's first playable event;
- consider the chosen line's leading rest already consumed;
- preserve manual tempo, piano voice, and paused/playing intent;
- turn ringing/complete back into playable state without emitting sound.

### Score policy

MOONLIT-SCORE/1 and offline Jianpu compilation now carry optional structured meter `{ beatsPerBar, beatUnit }`. Legacy songs remain valid and use a 4/4 default. Meter accents are derived from cumulative score time rather than event count.

Articulation distinguishes a continuation inside one lyric token, a new token, same-pitch retrigger, rest, and phrase ending. One-character multi-note ownership stays visible as one lyric plus progress dots; every gesture repeats that lyric token's initial.

### Diagnostics

Development diagnostics now include supported `baseLatency`, `outputLatency`, `getOutputTimestamp()`, audio `currentTime`, Tone `lookAhead`, context state, physical voice count, resonant voice count, keydown-to-attack delta, hold time, and inter-key gap.

## Asset audit and decision

The local bank has 14 MP3 pitch anchors, 0.882 MiB total, one velocity layer, and no separate local release, resonance, or impulse-response assets. Decoded durations range from 6.226 s to 16.186 s. C4 remains measurable through eight seconds; A2 retains still more energy.

The samples total 196.959 seconds. One decoded 44.1 kHz stereo Float32 bank is approximately 66.27 MiB (approximately 72.13 MiB at 48 kHz). Cold-load and first-playable wall time remain device/cache/decoder dependent, so no single-machine number is presented as a product guarantee. Runtime diagnostics expose the supported audio-clock and output-latency values instead. Deferred resonance is capped at four gestures and 1.1 seconds; no convolution, live pitch analysis, or network-time DSP was added.

The source samples were not the main one-to-two-second cutoff. The authority and transition policy were. The official original Salamander bank has 16 velocity layers and would improve velocity timbre, but a computer keyboard has no velocity sensor and the full bank would impose a disproportionate offline payload. No unproven large bank or random convolution impulse was added. Detailed measurements and references are in `docs/piano-reference-and-sample-audit.md`.

## Compatibility

Preserved:

- existing local library and imported songs;
- MOONLIT-SCORE/1 syntax;
- LyricToken + NoteEvent normalization;
- A–Z lyric initials repeated for same-token extra notes, Shift instrumental right hand, and Space left hand at the four supported musical positions;
- wrong-key and paused free piano;
- overlapping physical keys and same-note retriggers;
- tempo, four voices, pause, restart, replay line, completion, blur cleanup;
- no automatic notes, grading, pedal, MIDI, OCR, network API, or unrelated UI rewrite.

## Verification evidence

Latest single-line lyric and Space-star verification (2026-08-14):

- Vitest: 39 files, 243 tests passed.
- Focused player regression: 6 files, 91 tests passed.
- TypeScript: `npx tsc --noEmit` passed.
- ESLint: `npm run lint` passed.
- Production build: `npm run build` passed through all five vinext stages.
- Server-rendered HTML: `npm run test:render` rebuilt successfully and passed 1/1 test.
- Long lyric browser check on imported 《晴天》 line 18: `data-layout=single-line`, computed `white-space: nowrap`, computed `flex-wrap: nowrap`, 1232 px stage inside a 1280 px viewport, and no horizontal page overflow.
- Built-in two-hand browser check on “Hello, Moonlight”: the Space star track ended at y=152.01 while the lyric began at y=165, confirming the track is above the lyric; the current star was filled gold at opacity 1 and remained aligned above `你`.
- Automated cue fixtures cover before-first, simultaneous-under, quarter-time-between, and after-last placements; measured anchors at 20% and 80% project a quarter-time cue to 35% rather than rounding to a neighboring character.
- The four-gesture melisma fixture renders one lyric token, four dots, and prompts initial → `1` → `1` → `1`; the independent `爱爱爱` regression remains three lyric tokens.

Latest score-positioned control verification (2026-08-14):

- Vitest: 38 files, 241 tests passed.
- TypeScript: `npx tsc --noEmit` passed.
- ESLint: `npm run lint` passed.
- Production build: `npm run build` passed.
- Server-rendered HTML: `npm run test:render` passed, 1/1 test.
- Local server: `http://localhost:3000/` returned HTTP 200.
- In-app browser: physical Enter left progress at 0/8; N alone still waited for the coordinated left hand; Space completed the event and advanced to 1/8; H became the next target; no console warning/error was reported.
- Layout measurement confirmed the independent Space track rendered below the unchanged lyric block.

Earlier full-experience verification:

- Vitest: 34 files, 205 tests passed.
- TypeScript: `npx tsc --noEmit` passed.
- ESLint: `npm run lint` passed.
- Production build: `npm run test:render` rebuilt successfully.
- Server-rendered HTML: 1/1 test passed.
- Sample audit script decoded and measured all 14/14 local MP3 anchors.
- Browser exercise on `http://localhost:3000/` with imported 《晴天》:
  - wrong A kept progress at 0/498;
  - correct 1 advanced to 1/498;
  - line selector listed 65 phrases, including instrumental phrases;
  - silent jump to line 3 moved to event 37/498;
  - paused jump to line 4 kept the Resume state;
  - Concert Grand selection survived the seek;
  - no browser console warnings or errors were reported.

## Known physical limits

This is closer to a real piano, but no browser laptop keyboard can be literally indistinguishable from a concert grand: it has no strike velocity or pedal travel, the compact bank has one velocity layer, speakers/headphones shape the result, and the browser/OS/audio device add variable output latency. The implementation exposes and bounds these limits rather than hiding them with infinite sustain, heavy reverb, or automatic rhythm correction.
