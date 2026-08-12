"use client";

import { useState } from "react";

import { compileMoonlitScoreCode } from "../import/moonlit-score-code";
import type { PrivateSongRecord } from "../import/types";
import type { SongPackage } from "../lib/song";

interface ImportStudioProps {
  onImported: (record: PrivateSongRecord) => void;
  onPerform: (song: SongPackage) => void;
}

export function ImportStudio({ onImported, onPerform }: ImportStudioProps) {
  const [code, setCode] = useState("");
  const [record, setRecord] = useState<PrivateSongRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const prepareCode = (source: string) => {
    setRecord(null);
    setError(null);
    try {
      const nextRecord = compileMoonlitScoreCode(source);
      setRecord(nextRecord);
      onImported(nextRecord);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This score code could not be prepared.");
    }
  };

  return (
    <section className="import-studio score-code-studio" aria-labelledby="import-title">
      <p className="eyebrow">PRIVATE SCORE ATELIER</p>
      <h1 id="import-title">Paste your score code</h1>
      <p className="import-intro">
        Bring a Moonlit Score Code prepared for you. The instrument reads only its versioned music grammar, then saves the arrangement on this device.
      </p>

      <div className="score-code-editor">
        <div className="score-code-heading">
          <span>MOONLIT SCORE CODE</span>
          <small>VERSIONED · LOCAL · DECLARATIVE</small>
        </div>
        <textarea
          aria-label="Paste Moonlit Score Code"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={`MOONLIT-SCORE/1\ntitle: ...\nartist: ...\nkey: C\nmeter: 4/4\ntempo: 72\nvoice: felt`}
          spellCheck={false}
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setRecord(null);
            setError(null);
          }}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData("text");
            if (!pasted) return;
            event.preventDefault();
            setCode(pasted);
            prepareCode(pasted);
          }}
        />
        <div className="score-code-actions">
          <span>{code ? `${code.split(/\r?\n/u).length} LINES` : "WAITING FOR CODE"}</span>
          <button type="button" disabled={!code.trim()} onClick={() => prepareCode(code)}>
            Prepare this code
          </button>
        </div>
      </div>

      <p className="import-privacy">NO WI-FI REQUIRED · NO SCRIPT EXECUTION · SAVED ON THIS DEVICE</p>

      {error && <p className="import-error" role="alert">{error}</p>}

      {record && (
        <div className="import-result" role="status">
          <span>READY TO PERFORM</span>
          <div>
            <strong>{record.song.title}</strong>
            <small>{record.song.artist} · MOONLIT SCORE CODE</small>
          </div>
          <p>{record.song.events.length} playable notes · {record.song.durationLabel} · {record.song.tempoBpm} BPM</p>
          <button type="button" onClick={() => onPerform(record.song)}>Perform this score</button>
        </div>
      )}
    </section>
  );
}
