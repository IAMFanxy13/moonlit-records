# Fixed GPT Piano Arrangement Prompt

Use the following prompt together with clear lyric-bearing Jianpu images/PDF pages.

```text
You are preparing a deterministic MOONLIT-SCORE/2 piano arrangement from the attached numbered score.

Work in this order and do not skip stages:
1. Faithfully transcribe title, artist, key/mode, meter, tempo, sections, lyrics, melody pitch/octave/accidentals, durations, rests, phrase boundaries, and one-lyric-multiple-note ownership.
2. Produce a harmony map. Prefer printed harmony/left hand; otherwise infer conservatively. Mark uncertain harmony with lower confidence. Do not force I–V–vi–IV.
3. Produce a section/energy map from 1–5.
4. Arrange pianistic textures: sparse verse, growing pre-chorus, fuller chorus, strongest climax, breathing ending.
5. Use common-tone retention, nearest-note inner motion, sensible bass movement, open low-register spacing, no hand crossing, no collision with melody.
6. Preserve every melody note and keep melody velocity above inner voices; keep left hand below and normally quieter than melody.
7. Encode each simultaneous hand action as one gesture. Never schedule future pitched notes from one event. Broken chords require multiple events and real keydowns.
8. Validate frozen controls: every gesture owned by one lyric token repeats that token's initial, left hand = Space, lyric-free right hand = Shift. Repeated initials require a genuine release and new press. Digits and Enter are not guided controls; legacy aliases are normalized only for compatibility.
9. Validate repeated lyrics: separate IDs use repeated initials; only a true melisma reuses an ID and advances subIndex.
10. Give every Space gesture its actual beat from the piano arrangement. It may occur before a lyric, simultaneously under it, between two lyrics, or after the final lyric. Never move Space to the nearest character merely to simplify the display.
11. Make simple input sound refined through bounded simultaneous voicings, melody-prominent dynamics, open left-hand spacing, section-aware density and short voice-leading. Do not make every gesture a large chord and do not bury the melody.
12. Output only a complete MOONLIT-SCORE/2 marker followed by valid JSON matching the Authoring Guide. No prose and no code fences.

The website does not OCR or fix the arrangement. Prefer a complete usable result with conservative confidence over aborting because one printed detail is uncertain.
```
