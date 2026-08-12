# Moonlit Score Code Design

## Goal

Let the user ask Codex to convert a supplied lyric-bearing Jianpu score into a portable text block, paste that block into Moonlit Records, and immediately receive a local playable arrangement.

## Format

Moonlit Score Code is declarative data, never JavaScript. Version 1 begins with `MOONLIT-SCORE/1`, followed by required `title`, `artist`, `key`, `meter`, `tempo`, and `voice` headers. Music is grouped into `line:` and `notes:` pairs.

Each note uses `pitch:beats{lyric}`. Pitch is Jianpu degree `1`-`7`, `^` marks the upper octave, `,` marks the lower octave, `0` is a rest, and `+` combines degrees into a chord played by one computer key. Lyric braces are optional. Chinese tokens derive a pinyin initial, English tokens derive a word initial, and lyric-free events use the repeating `1`-`0` route.

Example:

```text
MOONLIT-SCORE/1
title: 花海
artist: 周杰伦
key: F
meter: 4/4
tempo: 72
voice: felt

line: 静止了
notes: 1:1{静} 3:1{止} 3:2{了}
```

## Import Experience

The score atelier becomes a dedicated `Paste Moonlit Score Code` area. Image/PDF recognition is removed from the website surface: Codex reads the user's supplied score and generates the code, while the website only validates, compiles, persists, and performs that code. Pasting does not execute anything. `Prepare this code` is also available as a manual fallback.

Errors include a stable line number and a useful correction. Invalid input remains in the textarea. Importing the same normalized code again replaces the matching private record through its deterministic checksum instead of creating a duplicate.

## Safety and Compatibility

The parser accepts only the documented grammar, caps input, line, event, duration, and tempo sizes, and rejects unknown versions. The version header keeps future formats compatible. No `eval`, dynamic module loading, network access, or HTML rendering occurs.

## Testing

Pure tests cover valid Chinese, English, rests, chords, octave marks, fallback digits, deterministic identity, and line-numbered failures. Component tests cover paste, invalid feedback, library persistence callback, and immediate performance handoff. Full unit, type, lint, build, and local-browser verification complete the feature.
