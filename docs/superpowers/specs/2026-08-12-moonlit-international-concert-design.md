# Moonlit Records International Concert Edition — Design Specification

## Objective

Transform the existing Moonlit Records keyboard-piano site into an English-first product for an international audience while preserving Chinese lyric performance. Make the physical computer keyboard behave like a piano key: keydown attacks and sustains a note, keyup releases it, multiple held keys form chords, and the experience does not leave the performance screen until every held note and its concert-hall tail have finished.

## Approved Direction

Use a cohesive international classical-label redesign rather than a surface translation. The site remains private and single-route. Existing search, guided lyrics, improvisation-safe wrong-key behavior, responsive desktop/mobile behavior, and local Salamander samples remain in scope.

Alternatives rejected:

- A fixed delay after the final lyric note can finish too early when a key remains held or a player adds an encore note.
- A manual `Finish` button is acoustically accurate but adds an unnecessary interaction.
- Removing the voice selector would simplify tuning but contradict the previously approved multi-piano experience.

## Reference Wisdom

- Tone.js `Sampler` exposes separate `triggerAttack` and `triggerRelease` calls, accepts arrays for polyphonic attacks, and defines a release envelope. This supports keydown-to-attack and keyup-to-release instead of fixed-duration one-shot playback: <https://tonejs.github.io/docs/15.1.22/classes/Sampler.html>.
- Tone.js `Reverb` defines `decay` as the time the signal reverberates and exposes wet mix and pre-delay controls. This gives the application a defensible acoustic tail duration: <https://tonejs.github.io/docs/15.1.22/classes/Reverb.html>.
- MDN's Web Audio examples construct an amplitude envelope with `GainNode` ramps. This reinforces treating attack and release as time-based audio state rather than UI animation: <https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques>.
- Steinway positions the Model D as its Concert Grand and presents the instrument through restrained, premium product hierarchy rather than game styling: <https://www.steinway.com/pianos/steinway/grand>.
- Deutsche Grammophon organizes a dense classical catalogue through English editorial hierarchy, artist/release metadata, and disciplined accent color: <https://www.deutschegrammophon.com/en>.

These sources guide behavior and art direction only. No third-party layout, copy, media, or code is copied.

## Language Contract

All user interface text must be English, including:

- wordmark, navigation, hero, search, catalogue, loading, errors, player controls, keyboard explanations, feedback, mobile fallback, completion copy, accessible names, metadata, favicon title context, and social preview;
- displayed song titles, artists, versions, piano names, and empty states;
- the HTML document language and Open Graph metadata.

Only lyric content may be Chinese. Chinese lyric containers must declare `lang="zh-CN"`. English lyrics remain supported and use their first-letter mapping. Chinese catalogue aliases remain searchable without being displayed, so a user may search `小星星` and see `Twinkle, Twinkle, Little Star`.

## International Art Direction

The visual target is an independent European classical label and private recital programme, not an arcade game and not Chinese calligraphic luxury.

- Brand: `MOONLIT RECORDS`.
- Palette: carbon black, oxblood, parchment ivory, and restrained antique brass.
- Typography: high-contrast international editorial serif for display; clean grotesk/system sans for interface; mono only for timings and micro-labels. Chinese lyrics retain a compatible Song-serif fallback.
- Layout: generous negative space, strong English typographic scale, catalogue rows that resemble a release index, precise hairlines, and asymmetrical editorial balance.
- Motion: restrained entrance and record rotation; no neon, particle fields, glassmorphism, or game-score spectacle.
- Keyboard: remains the primary physical object and uses realistic stagger, widths, press depth, target illumination, and wrong-key red.
- Social card: regenerate once with English-only `MOONLIT RECORDS` and `YOUR KEYBOARD, IN CONCERT`, matching the finished palette and motifs.

## Song Display Data

Extend `SongPackage` with `searchAliases: string[]`. Display fields become:

- `Hello, Moonlight` — `Moonlit Records · Original` — `Nocturne Practice Edition`
- `Twinkle, Twinkle, Little Star` — `Traditional` — `Public-Domain Folk Song`
- `Ode to Joy · Excerpt` — `Ludwig van Beethoven` — `Public-Domain Melody · Instrumental`

Chinese lyric phrases and individual lyric tokens remain unchanged.

Each calibrated song carries a deliberately curated premium recommendation:

- `Hello, Moonlight` → `Felt Grand`: intimate hammers, warm upper-mid contour, and a long but close room tail.
- `Twinkle, Twinkle, Little Star` → `Studio Grand`: clean articulation, lyrical brightness without harshness, and a medium recital-room tail.
- `Ode to Joy · Excerpt` → `Concert Grand`: full harmonic range, broad dynamics, and the longest concert-hall tail.

The catalogue labels the choice as `RECOMMENDED`, the entrance names the prepared piano, and the player initializes to that voice. The user can still override it during a performance.

## Piano-Key Behavior

### Input lifecycle

1. A safe physical keydown calls `attack(note, velocity)` once.
2. Keyboard auto-repeat is ignored.
3. The note remains active for as long as the physical key is held.
4. Keyup calls `release(note)` for the exact note attacked by that physical key.
5. Multiple keys may remain active simultaneously and must release independently.
6. Wrong keys still sound their default pitch, flash red, and do not advance the lyric target.
7. Correct keys sound the song note and advance the lyric target.
8. Function keys remain reserved for browser and operating-system behavior.

### Concert voice

The voice selected by the song package becomes the initial voice. All four voices use the Salamander Grand samples as the consistent high-quality acoustic source; the profiles change acoustic presentation rather than substituting synthetic tones.

`Concert Grand` uses:

- sampler attack near 4 ms;
- sampler release within Tone.js's supported release range;
- a warm low-pass contour that preserves upper harmonics;
- concert reverb around 5.8–6.2 seconds;
- pre-delay around 24–32 ms for perceived hall depth;
- wet mix around 0.30–0.34 so the instrument remains intelligible.

Other voices remain selectable as `Felt Grand`, `Studio Grand`, and `Vintage Upright`. Every voice must sound premium and retain a natural release:

- `Felt Grand`: warm low-pass contour, restrained transient, 4.6–5.0 second room decay.
- `Studio Grand`: open but controlled upper harmonics, 3.2–3.8 second recital-room decay.
- `Vintage Upright`: focused, woody contour, 2.4–3.0 second chamber decay.
- `Concert Grand`: full, singing contour, 5.8–6.2 second hall decay.

The selector order puts the song's recommended voice first visually without changing stable voice identifiers.

The audio engine must expose `tailMs()` for the current voice. Tail values derive from the configured sampler release, reverb decay, pre-delay, and a small safety margin; the UI must not duplicate these numbers.

## Acoustic Completion State

Add a `ringing` player status between `playing` and `complete`.

1. The final correct lyric key moves the player to `ringing`, not `complete`.
2. The stage removes the target and shows `LET IT RING` / `The hall is holding your final note.`
3. The full playable keyboard remains active for an optional encore or improvisation. These notes are `free` sounds and do not change lyric progress.
4. No finish timer runs while any physical key is held.
5. When the final held key is released, start a timer using `piano.tailMs()`.
6. Any new note cancels the timer. Releasing the new final note starts a fresh full-tail timer.
7. When the timer expires with no held notes, call `finishRinging()` and then show the completion card.
8. Pause, restart, exit, blur, and visibility changes cancel pending completion timers and release active notes safely.

This makes completion depend on acoustic idleness, including encore notes, rather than the lyric index alone.

## Components and Interfaces

- `app/lib/song.ts`: add searchable aliases.
- `app/lib/songs.ts`: English display metadata, Chinese hidden aliases, and per-song curated voice recommendations.
- `app/lib/player-machine.ts`: add `ringing` and `finishRinging(state)`; allow safe free notes during ringing.
- `app/audio/piano-engine.ts`: add `tailMs(): number`; centralize voice profiles and configure sampler, filter, pre-delay, decay, and wet mix.
- `app/components/SearchHome.tsx`: English UI and alias-aware search.
- `app/components/LyricStage.tsx`: English stage labels, explicit Chinese lyric language.
- `app/components/ScreenKeyboard.tsx`: English explanation and accessible labels.
- `app/components/PlayerShell.tsx`: held-note tracking, chord-safe independent release, acoustic completion timer, English feedback and controls.
- `app/components/CompletionCard.tsx`: English completion language.
- `app/MoonlitPiano.tsx`: English loading/entrance/error surfaces.
- `app/layout.tsx`: English document metadata and language.
- `app/globals.css`: international editorial typography and refined catalogue/player styling.
- `public/og.png`: one English-only regenerated social card.

## Error and Interruption Handling

- Loading or audio-context failure presents an English retry path.
- Window blur and hidden-document events release active notes, cancel finish timers, and pause only an actively playing guided performance.
- Returning to the catalogue releases active notes and cancels all pending acoustic completion work.
- Component unmount clears feedback and tail timers.

## Test Contract

Automated tests must prove:

- no non-lyric Chinese copy remains in rendered catalogue, entrance, player, completion, metadata, or accessible names;
- a Chinese alias finds an English-displayed title;
- keydown attacks once, holding does not release, and keyup releases the matching note;
- simultaneous keys release independently;
- the last lyric note enters `ringing` and does not complete immediately;
- a held final key prevents the tail timer;
- an encore note during `ringing` cancels and resets the tail timer;
- completion occurs only after all keys are released and the engine-provided tail duration elapses;
- wrong-key behavior remains sound-without-progress;
- all existing responsive and server-rendering expectations are updated to English.

Final validation requires the full unit suite, TypeScript, production build, server-render test, production dependency audit, and a fresh private Sites deployment.

## Scope Boundary

This update does not add global song ingestion, copyrighted lyric scraping, upload transcription, MIDI devices, sustain-pedal input, accounts, or persistence. It improves the approved calibrated-song experience and leaves those systems for later work.
