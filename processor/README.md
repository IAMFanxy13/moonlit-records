# Moonlit local analysis worker

This directory defines an optional, entirely free and open-source analysis chain for people who want more detail than the browser's built-in PCM sketch. The web app does not depend on this worker: a decodable, audible import always receives a playable sketch even when every advanced adapter is absent or fails.

## The borrowed shoulders

| Stage | Free local tools | Failure behaviour |
| --- | --- | --- |
| Decode / identify | FFmpeg, Chromaprint/AcoustID, MusicBrainz | Keep filename metadata |
| Stem separation | Demucs-compatible adapter | Analyse the original mix |
| Lyrics / alignment | Whisper, optional WhisperX | Keep instrumental events or open lyric evidence |
| Melody | Spotify Basic Pitch | Keep the browser pitch contour |
| Harmony / pulse | Essentia | Keep browser onset and key estimates |
| Arrangement | Moonlit evidence merge | Return the deterministic browser sketch |

Every adapter is an isolated failure boundary. It returns versioned evidence or a typed recoverable warning. No adapter is allowed to erase a usable earlier result.

## Install for contract development

Use Python 3.11 in a dedicated environment:

```powershell
py -3.11 -m venv .venv
.venv\Scripts\python -m pip install -e ".[dev]"
.venv\Scripts\python -m pytest
```

## Optional advanced local models

The full optional group is exact and explicit:

```powershell
.venv\Scripts\python -m pip install -e ".[advanced]"
```

FFmpeg and Chromaprint are operating-system binaries and remain separate from Python packaging. Model weights for Demucs, Whisper/WhisperX, and Basic Pitch are downloaded only after the user deliberately installs and runs those adapters on a machine they control. Moonlit never calls a paid inference API, silently starts a cloud job, or requires an account.

This scaffold intentionally injects adapters rather than importing heavyweight packages at module import time. Contract tests therefore run without FFmpeg, models, GPUs, network access, or downloads.
