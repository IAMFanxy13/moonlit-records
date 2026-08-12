"use client";

import { useRef, useState } from "react";

import { analyzeScoreFiles } from "../import/browser-score-analyzer";
import { IMPORT_STAGE_LABELS, type ImportProgress, type PrivateSongRecord } from "../import/types";
import type { SongPackage } from "../lib/song";

type AnalyzeScore = (
  files: File[],
  onProgress: (progress: ImportProgress) => void,
) => Promise<PrivateSongRecord>;

interface ImportStudioProps {
  analyze?: AnalyzeScore;
  onImported: (record: PrivateSongRecord) => void;
  onPerform: (song: SongPackage) => void;
}

export function ImportStudio({
  analyze = analyzeScoreFiles,
  onImported,
  onPerform,
}: ImportStudioProps) {
  const picker = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [record, setRecord] = useState<PrivateSongRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const importFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setError(null);
    setRecord(null);
    try {
      const finalRecord = await analyze(files, setProgress);
      setProgress({ stage: "ready", detail: "Your private piano score is ready.", fraction: 1 });
      setRecord(finalRecord);
      onImported(finalRecord);
    } catch (reason) {
      setProgress(null);
      setError(reason instanceof Error ? reason.message : "This score could not be prepared.");
    }
  };

  const busy = Boolean(progress && progress.stage !== "ready" && !record);

  return (
    <section className="import-studio" aria-labelledby="import-title">
      <p className="eyebrow">PRIVATE SCORE ATELIER</p>
      <h1 id="import-title">Bring your numbered score</h1>
      <p className="import-intro">
        Add one or more lyric-bearing Jianpu images, or a PDF. A bundled local reader turns the printed score into a piano path you perform yourself.
      </p>

      <button
        className="import-drop"
        data-dragging={dragging}
        disabled={busy}
        type="button"
        onClick={() => picker.current?.click()}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void importFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <span className="import-monogram" aria-hidden="true">＋</span>
        <span>
          <strong>{busy ? "Reading your printed score" : "Import score images or PDF"}</strong>
          <small>PNG · JPEG · WEBP · PDF · MULTIPLE PAGES WELCOME</small>
        </span>
        <i aria-hidden="true">BROWSE</i>
      </button>
      <input
        ref={picker}
        className="sr-only"
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,application/pdf,.png,.jpg,.jpeg,.webp,.pdf"
        aria-label="Choose score images or PDF"
        onChange={(event) => {
          void importFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />

      <p className="import-privacy">NO WI-FI REQUIRED · NO SUBSCRIPTION · YOUR PAGES STAY PRIVATE</p>

      {busy && progress && (
        <div className="import-progress" role="status">
          <span>{IMPORT_STAGE_LABELS[progress.stage]}</span>
          <i
            role="progressbar"
            aria-label="Local score recognition progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((progress.fraction ?? 0) * 100)}
          >
            <b style={{ width: `${Math.round((progress.fraction ?? 0) * 100)}%` }} />
          </i>
          <small>{progress.detail}</small>
        </div>
      )}

      {error && <p className="import-error" role="alert">{error}</p>}

      {record && (
        <div className="import-result" role="status">
          <span>READY TO PERFORM</span>
          <div>
            <strong>{record.song.title}</strong>
            <small>
              {record.song.artist} · {record.song.quality === "sketch" ? "ESTIMATED SCORE" : "LOCAL SCORE RECOGNITION"}
            </small>
          </div>
          {record.warnings.length > 0 && (
            <p>Unclear marks were resolved with conservative musical estimates; the result remains fully playable.</p>
          )}
          <button type="button" onClick={() => onPerform(record.song)}>Perform this score</button>
        </div>
      )}
    </section>
  );
}
