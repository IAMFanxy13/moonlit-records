"""Versioned, JSON-safe contracts shared by optional local worker adapters."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Literal, Mapping

StageName = Literal["identify", "separate", "lyrics", "melody", "harmony", "arrange", "sketch"]


@dataclass(frozen=True)
class AnalysisJob:
    media_path: Path
    checksum: str
    source_name: str
    embedded_sketch: Mapping[str, Any] | None = None
    schema_version: Literal["moonlit.analysis-job.v1"] = "moonlit.analysis-job.v1"


@dataclass(frozen=True)
class AnalysisEvidence:
    stage: StageName
    provider: str
    payload: Mapping[str, Any]
    confidence: float = 0.5


@dataclass(frozen=True)
class PipelineWarning:
    stage: StageName
    code: Literal["adapter_unavailable", "adapter_failed", "fallback_used"]
    detail: str
    recoverable: bool = True


@dataclass(frozen=True)
class AnalysisResult:
    status: Literal["ready", "degraded"]
    song_package: Mapping[str, Any]
    evidence: tuple[AnalysisEvidence, ...] = field(default_factory=tuple)
    warnings: tuple[PipelineWarning, ...] = field(default_factory=tuple)
    schema_version: Literal["moonlit.analysis-result.v1"] = "moonlit.analysis-result.v1"

    def to_json_dict(self) -> dict[str, Any]:
        return asdict(self)
