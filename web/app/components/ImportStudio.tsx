"use client";

import { useRef, useState } from "react";

import type { TrackEnrichment } from "../enrichment/types";
import { analyzeMediaFile } from "../import/browser-media-analyzer";
import { applyLyricsToSketch } from "../import/lyric-mapper";
import { IMPORT_STAGE_LABELS, type ImportProgress, type PrivateSongRecord } from "../import/types";
import type { SongPackage } from "../lib/song";

type AnalyzeMedia = (
  file: File,
  onProgress: (progress: ImportProgress) => void,
) => Promise<PrivateSongRecord>;

type EnrichRecord = (record: PrivateSongRecord, signal?: AbortSignal) => Promise<PrivateSongRecord>;

interface ImportStudioProps {
  analyze?: AnalyzeMedia;
  enrich?: EnrichRecord;
  enrichmentTimeoutMs?: number;
  onImported: (record: PrivateSongRecord) => void;
  onPerform: (song: SongPackage) => void;
}

async function enrichFromFreeSources(record: PrivateSongRecord, signal?: AbortSignal): Promise<PrivateSongRecord> {
  const query = new URLSearchParams({
    title: record.metadata.title,
    artist: record.metadata.artist,
    durationMs: String(record.metadata.durationMs ?? 0),
  });
  const response = await fetch(`/api/enrich?${query}`, { signal });
  if (!response.ok) throw new Error("Enrichment unavailable");
  const enrichment = await response.json() as TrackEnrichment;
  const metadata = {
    ...record.metadata,
    title: enrichment.fields.title?.value ?? record.metadata.title,
    artist: enrichment.fields.artist?.value ?? record.metadata.artist,
    album: enrichment.fields.album?.value ?? record.metadata.album,
    coverUrl: enrichment.fields.coverUrl?.value ?? record.metadata.coverUrl,
  };
  let song = {
    ...record.song,
    title: metadata.title,
    artist: metadata.artist,
  };
  const lyricText = enrichment.lyrics?.plain;
  if (lyricText) song = applyLyricsToSketch(song, lyricText);
  return {
    ...record,
    metadata,
    song,
    warnings: [...record.warnings, ...enrichment.warnings],
  };
}

export function ImportStudio({
  analyze = analyzeMediaFile,
  enrich = enrichFromFreeSources,
  enrichmentTimeoutMs = 6000,
  onImported,
  onPerform,
}: ImportStudioProps) {
  const picker = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [record, setRecord] = useState<PrivateSongRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlineWarning, setOnlineWarning] = useState(false);
  const [dragging, setDragging] = useState(false);

  const importFile = async (file?: File) => {
    if (!file) return;
    setError(null);
    setRecord(null);
    setOnlineWarning(false);
    try {
      const localRecord = await analyze(file, setProgress);
      let finalRecord = localRecord;
      setProgress({ stage: "enriching", detail: "Checking free metadata and lyric sources; the local arrangement is already safe.", fraction: 0.96, method: "online" });
      const controller = new AbortController();
      let enrichmentTimer: number | null = null;
      try {
        const timedOut = new Promise<never>((_resolve, reject) => {
          enrichmentTimer = window.setTimeout(() => {
            controller.abort();
            reject(new Error("Optional online enrichment timed out."));
          }, enrichmentTimeoutMs);
        });
        finalRecord = await Promise.race([enrich(localRecord, controller.signal), timedOut]);
      } catch {
        setOnlineWarning(true);
      } finally {
        if (enrichmentTimer !== null) window.clearTimeout(enrichmentTimer);
      }
      setProgress({ stage: "ready", detail: "Your private piano arrangement is ready.", fraction: 1 });
      setRecord(finalRecord);
      onImported(finalRecord);
    } catch (reason) {
      setProgress(null);
      setError(reason instanceof Error ? reason.message : "This recording could not be prepared.");
    }
  };

  const busy = Boolean(progress && progress.stage !== "ready" && !record);

  return (
    <section className="import-studio" aria-labelledby="import-title">
      <p className="eyebrow">PRIVATE ARRANGEMENT STUDIO</p>
      <h1 id="import-title">Bring your own recording</h1>
      <p className="import-intro">
        Audio or video becomes a piano path you perform yourself. No VIP stream, no paid API, no automatic backing track.
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
          void importFile(event.dataTransfer.files[0]);
        }}
      >
        <span className="import-monogram" aria-hidden="true">＋</span>
        <span>
          <strong>{busy ? "Preparing your arrangement" : "Import audio or video"}</strong>
          <small>MP3 · WAV · FLAC · M4A · OGG · MP4 · MOV · WEBM</small>
        </span>
        <i aria-hidden="true">BROWSE</i>
      </button>
      <input
        ref={picker}
        className="sr-only"
        type="file"
        accept="audio/*,video/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.mp4,.mov,.webm"
        aria-label="Choose audio or video"
        onChange={(event) => {
          void importFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <p className="import-privacy">NO SUBSCRIPTION · NO PAID API · YOUR FILE STAYS PRIVATE</p>

      {busy && progress && (
        <div className="import-progress" role="status">
          <span>{IMPORT_STAGE_LABELS[progress.stage]}</span>
          <i
            role="progressbar"
            aria-label="Local analysis progress"
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
            <small>{record.song.artist} · {record.song.quality.toUpperCase()} ARRANGEMENT</small>
          </div>
          {onlineWarning && <p>Online details were unavailable; your private local arrangement is still complete.</p>}
          <button type="button" onClick={() => onPerform(record.song)}>Perform this arrangement</button>
        </div>
      )}
    </section>
  );
}
