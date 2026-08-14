# Moonlit Records Web Piano

The web app is a local-first, lyric-guided concert piano for a standard computer keyboard. It keeps the performer in control of every attack while using score-aware voicing, release, overlap, and resonance to produce a fuller two-hand result.

## Performance controls

| Input | Guided-song behavior | Free-play behavior |
| --- | --- | --- |
| `A–Z` | Right-hand lyric melody or written voicing | Stable chromatic piano note |
| `Space` | Left-hand bass or harmony at the displayed star | No song progress outside a left-hand target |
| `Shift` | Lyric-free right-hand/interlude gesture | No song progress outside an instrumental target |

- Chinese lyrics use pinyin initials; English lyrics use word initials.
- If one lyric token owns several melody events, repeat the same initial with a real release between presses. The lyric appears once and its progress dots show the remaining notes.
- A true repeated lyric such as `爱爱爱` remains three separate lyric tokens.
- A simultaneous two-hand event explicitly asks for `LETTER + SPACE`; a between-lyrics Space cue asks only for `SPACE`.
- Wrong letters sound as ordinary free-play notes, flash as wrong, and leave the expected event waiting.
- Browser keyboard repeat is ignored. Each new musical attack requires a fresh physical keydown.

## Musical behavior

- A correct keydown attacks immediately and advances the score as soon as every required hand part for that event has been pressed.
- Keyup ends physical-key ownership; guided notes follow the score-aware release plan instead of being hard-cut.
- Adjacent voices may overlap for legato, and releasing one physical key never stops another active voice.
- The duration rail is a preparation cue, not a scoring system and not a demand for precise key release.
- Single-note guided right-hand gestures can be expanded with a lighter octave; single-note guided left-hand gestures can be expanded to an open bass voicing. Explicit written chords remain authoritative.
- Pause, restart, replay, page hide, and window blur release all active handles to prevent stuck notes.

## Score-code import

The import screen accepts declarative music data only:

- `MOONLIT-SCORE/2` is the current format for exact two-hand gestures, timing, velocities, articulation, and lyric ownership.
- `MOONLIT-SCORE/1` remains supported and is normalized to the current internal song model.
- Imported records are stored on the device and can be renamed or deleted from the repertoire.
- The parser validates the schema and never evaluates pasted script code.

See [`docs/moonlit-score-2-authoring-guide.md`](docs/moonlit-score-2-authoring-guide.md) and [`docs/gpt-piano-arrangement-prompt.md`](docs/gpt-piano-arrangement-prompt.md).

## Development

Requires Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>.

Run the complete local verification suite:

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
npm run test:render
npm audit --omit=dev --audit-level=high
```

## Important source areas

- `app/components/PlayerShell.tsx` — physical input, score cursor, audio handles, and lifecycle cleanup.
- `app/components/LyricStage.tsx` — single-line lyrics, initials, multi-note dots, and Space stars.
- `app/lib/player-machine.ts` — correct/wrong input and multi-part event advancement.
- `app/lib/song-normalizer.ts` — legacy compatibility and lyric-token ownership.
- `app/import/moonlit-score-v2.ts` — Score/2 validation and compilation.
- `app/audio/piano-engine.ts` — sample attack/release, polyphony, and voice channels.
- `app/lib/piano-performance.ts` — score-target duration and musical release planning.

For a complete Chinese behavior reference, see [`CURRENT_LOGIC_ZH.md`](CURRENT_LOGIC_ZH.md).

## Audio rights

The local piano files are a compact subset of Salamander Grand Piano V3, used under CC BY 3.0. Full attribution is in [`public/audio/ATTRIBUTION.md`](public/audio/ATTRIBUTION.md).
