from pathlib import Path

from moonlit_processor.contracts import AnalysisEvidence, AnalysisJob
from moonlit_processor.pipeline import OpenSourcePipeline


def job(**overrides):
    values = {
        "media_path": Path("private-song.wav"),
        "checksum": "abc123abc123abc123",
        "source_name": "Artist - Night Song.wav",
    }
    values.update(overrides)
    return AnalysisJob(**values)


def successful(stage, payload=None):
    return lambda _job, _context: AnalysisEvidence(
        stage=stage,
        provider=f"fake-{stage}",
        payload=payload or {"ok": True},
        confidence=0.9,
    )


def failed(message):
    def adapter(_job, _context):
        raise RuntimeError(message)
    return adapter


def test_all_successful_stages_return_the_evidence_arrangement():
    expected_song = {"schemaVersion": "moonlit.song-package.v2", "id": "arranged", "events": []}
    adapters = {
        stage: successful(stage)
        for stage in ("identify", "separate", "lyrics", "melody", "harmony")
    }
    adapters["arrange"] = successful("arrange", {"songPackage": expected_song})

    result = OpenSourcePipeline(adapters).run(job())

    assert result.status == "ready"
    assert result.song_package == expected_song
    assert [item.stage for item in result.evidence] == [
        "identify", "separate", "lyrics", "melody", "harmony", "arrange"
    ]
    assert result.warnings == ()


def test_every_advanced_failure_still_returns_a_playable_sketch():
    stages = ("identify", "separate", "lyrics", "melody", "harmony", "arrange")
    embedded = {"schemaVersion": "moonlit.song-package.v2", "id": "browser-sketch", "events": [{"id": "1"}]}
    adapters = {stage: failed(f"{stage} unavailable") for stage in stages}

    result = OpenSourcePipeline(adapters).run(job(embedded_sketch=embedded))

    assert result.status == "degraded"
    assert result.song_package == embedded
    assert {warning.stage for warning in result.warnings if warning.code == "adapter_failed"} == set(stages)
    assert any(warning.code == "fallback_used" for warning in result.warnings)


def test_missing_optional_models_need_no_download_and_use_built_in_sketch():
    result = OpenSourcePipeline().run(job())

    assert result.status == "degraded"
    assert result.song_package["quality"] == "sketch"
    assert result.song_package["events"][0]["code"] == "Digit1"
    assert all(warning.recoverable for warning in result.warnings)
