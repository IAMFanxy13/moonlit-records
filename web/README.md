# Moonlit Records

An English-first, lyric-guided concert piano that turns a standard computer keyboard into a free instrument.

## The experience

- Search the curated catalogue by English display metadata or hidden Chinese aliases.
- Play every safe keyboard key freely at any time; each key owns a stable default piano note.
- Follow Chinese pinyin initials or English word initials to play a song melody through familiar typing gestures.
- See KTV-style current and next lyric lines, with the required key illuminated on a full screen keyboard.
- Hear wrong keys as ordinary free-play notes. They mark red but do not advance the lyric; the expected key continues waiting.
- Hold a physical key to sustain its exact note and release that same key to begin the natural envelope. Independent held keys form real chords.
- Continue improvising after the final lyric note. Completion waits until every held key is released and the selected hall tail has fully faded.

## Score-code atelier

- Paste declarative `MOONLIT-SCORE/1` code prepared from lyric-bearing Jianpu images or PDFs.
- The website validates and compiles only this versioned music grammar; it never evaluates pasted script code.
- The compiler derives Chinese pinyin initials and English word initials, preserves rests, chords, octaves and printed note lengths, and produces the same arrangement from the same code every time.
- A note highway shows the next key, its literal hold length and silent rests. Tempo can be changed from 50–120 BPM without changing pitch.
- Private imported scores can be renamed or permanently deleted from the repertoire.

## Piano voices

Moonlit Records recommends a voice per arrangement while keeping all four available during performance:

- **Felt Grand** — intimate, softened and lyrical; recommended for *Hello, Moonlight*.
- **Studio Grand** — clear, articulate and close; recommended for *Twinkle, Twinkle, Little Star*.
- **Vintage Upright** — dry, characterful and nostalgic.
- **Concert Grand** — open, resonant and hall-sized; recommended for *Ode to Joy · Excerpt*.

All voices use local Salamander Grand samples with individual filtering, release, pre-delay, reverb and completion-tail profiles.

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
