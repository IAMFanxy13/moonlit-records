"""Fail-soft orchestration for free, user-controlled analysis adapters."""

from __future__ import annotations

from collections.abc import Callable, Mapping, MutableMapping
from typing import Any

from .contracts import AnalysisEvidence, AnalysisJob, AnalysisResult, PipelineWarning, StageName

Adapter = Callable[[AnalysisJob, Mapping[str, Any]], AnalysisEvidence]

FREE_STAGE_GUIDE: Mapping[StageName, str] = {
    "identify": "FFmpeg metadata + Chromaprint/AcoustID + MusicBrainz",
    "separate": "Demucs-compatible local source separation",
    "lyrics": "Whisper + optional WhisperX alignment",
    "melody": "Spotify Basic Pitch candidate notes",
    "harmony": "Essentia key, chord, pulse, and energy features",
    "arrange": "Moonlit evidence-aware piano arranger",
    "sketch": "Browser-compatible deterministic PCM sketch",
}


class OpenSourcePipeline:
    """Runs every useful stage while treating each advanced adapter as optional.

    No stage calls a hosted inference endpoint. Adapters are injected so model-backed
    work can run on a user-controlled machine and contract tests need no model files.
    """

    analysis_stages: tuple[StageName, ...] = ("identify", "separate", "lyrics", "melody", "harmony")

    def __init__(self, adapters: Mapping[StageName, Adapter] | None = None):
        self.adapters = dict(adapters or {})

    def run(self, job: AnalysisJob) -> AnalysisResult:
        context: MutableMapping[str, Any] = {}
        evidence: list[AnalysisEvidence] = []
        warnings: list[PipelineWarning] = []

        for stage in self.analysis_stages:
            self._run_optional(stage, job, context, evidence, warnings)

        arranged = self._run_optional("arrange", job, context, evidence, warnings)
        song_package = self._song_from(arranged)
        if song_package is None:
            sketch = self._run_optional("sketch", job, context, evidence, warnings)
            song_package = self._song_from(sketch) or self._built_in_sketch(job)
            warnings.append(PipelineWarning(
                stage="sketch",
                code="fallback_used",
                detail="The advanced arrangement was unavailable; a playable local sketch was returned.",
            ))

        return AnalysisResult(
            status="degraded" if warnings else "ready",
            song_package=song_package,
            evidence=tuple(evidence),
            warnings=tuple(warnings),
        )

    def _run_optional(
        self,
        stage: StageName,
        job: AnalysisJob,
        context: MutableMapping[str, Any],
        evidence: list[AnalysisEvidence],
        warnings: list[PipelineWarning],
    ) -> AnalysisEvidence | None:
        adapter = self.adapters.get(stage)
        if adapter is None:
            warnings.append(PipelineWarning(
                stage=stage,
                code="adapter_unavailable",
                detail=f"{FREE_STAGE_GUIDE[stage]} is not installed; processing continued.",
            ))
            return None
        try:
            result = adapter(job, dict(context))
        except Exception as reason:  # Every optional adapter is an isolated failure boundary.
            warnings.append(PipelineWarning(
                stage=stage,
                code="adapter_failed",
                detail=f"{type(reason).__name__}: {reason}",
            ))
            return None
        if result.stage != stage:
            warnings.append(PipelineWarning(
                stage=stage,
                code="adapter_failed",
                detail=f"Adapter returned evidence for {result.stage}, not {stage}.",
            ))
            return None
        evidence.append(result)
        context[stage] = dict(result.payload)
        return result

    @staticmethod
    def _song_from(evidence: AnalysisEvidence | None) -> Mapping[str, Any] | None:
        if evidence is None:
            return None
        candidate = evidence.payload.get("songPackage")
        return candidate if isinstance(candidate, Mapping) else None

    @staticmethod
    def _built_in_sketch(job: AnalysisJob) -> Mapping[str, Any]:
        if job.embedded_sketch is not None:
            return dict(job.embedded_sketch)
        title = job.source_name.rsplit(".", 1)[0] or "Private Recording"
        return {
            "schemaVersion": "moonlit.song-package.v2",
            "id": f"import-{job.checksum[:12]}",
            "title": title,
            "artist": "Private recording",
            "quality": "sketch",
            "events": [{
                "id": "sketch-1",
                "code": "Digit1",
                "notes": ["C4"],
                "kind": "tap",
                "provenance": "browser-pcm-fallback",
                "confidence": 0.1,
            }],
        }
