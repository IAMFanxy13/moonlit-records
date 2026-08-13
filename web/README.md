# Moonlit Records

An English-first, lyric-guided concert piano that turns a standard computer keyboard into a free instrument.

## The experience

- Search the curated catalogue by English display metadata or hidden Chinese aliases.
- Play every safe keyboard key freely at any time; each key owns a stable default piano note.
- Follow Chinese pinyin initials or English word initials to play a song melody through familiar typing gestures. If one lyric token owns several melody notes, play its initial once and use fresh Space presses for the continuation notes.
- See KTV-style current and next lyric lines, with the required key illuminated on a full screen keyboard.
- Hear wrong keys as ordinary free-play notes. They mark red but do not advance the lyric; the expected key continues waiting.
- A correct physical keydown sounds the note and opens the next score event immediately. Keyup only releases that physical key, so independent held keys can overlap for legato or form real chords.
- Correct melody notes use bounded phrase-aware damper resonance: releasing a key can leave a short connected tail, while repeated pitches, printed rests and phrase boundaries clear stale resonance before the next attack.
- Resonance never creates an attack by itself, keeps at most four released gestures for at most 2.4 seconds, and is cleared on pause, restart, replay, exit or focus loss.
- The duration rail is guidance only: it begins draining when the key is pressed, but early release and over-holding are both allowed and never scored.
- Continue improvising after the final lyric note. Completion waits until every held key is released and the selected hall tail has fully faded.

## Score-code atelier

- Paste declarative `MOONLIT-SCORE/1` code prepared from lyric-bearing Jianpu images or PDFs.
- The website validates and compiles only this versioned music grammar; it never evaluates pasted script code.
- The compiler derives Chinese pinyin initials and English word initials, preserves rests, chords, octaves and printed note lengths, and produces the same arrangement from the same code every time. Grouped notation such as `[3:.5 4:.5 5:1]{爱}` creates one lyric token and the input route `A, SPACE, SPACE`.
- A note highway shows the next key, its literal hold length and silent rests. Tempo can be changed from 50–120 BPM without changing pitch.
- Private imported scores can be renamed or permanently deleted from the repertoire.

## Piano voices

Moonlit Records recommends a voice per arrangement while keeping all four available during performance:

- **Felt Grand** — intimate, softened and lyrical; recommended for *Hello, Moonlight*.
- **Studio Grand** — clear, articulate and close; recommended for *Twinkle, Twinkle, Little Star*.
- **Vintage Upright** — dry, characterful and nostalgic.
- **Concert Grand** — open, resonant and hall-sized; recommended for *Ode to Joy · Excerpt*.

All voices use local Salamander Grand samples. The sample playback, short per-source damper release, bounded phrase resonance and room reverb are separate stages; completion-tail timing remains independent per voice.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Verification:

```bash
npm test
npm run test:render
npm run build
```

## Audio and rights

The piano samples come from Salamander Grand Piano under CC BY 3.0; see `public/audio/ATTRIBUTION.md`. The included score fragments are original material or manually calibrated public-domain melodies. The application does not scrape or hotlink copyrighted lyrics or audio.
