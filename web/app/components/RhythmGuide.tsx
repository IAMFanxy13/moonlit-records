import type { CSSProperties } from "react";

import { labelForCode } from "../lib/keyboard";
import type { SongEvent, SongPackage } from "../lib/song";

const DIGIT_LANES = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0"];
const LETTER_LANES = Array.from({ length: 26 }, (_, index) => `Key${String.fromCharCode(65 + index)}`);
const VISIBLE_EVENTS = 8;

interface RhythmGuideProps {
  song: SongPackage;
  eventIndex: number;
  restRemainingMs?: number;
}

interface RhythmStyle extends CSSProperties {
  "--rhythm-left": string;
  "--rhythm-bottom": string;
  "--rhythm-height": string;
  "--rhythm-hold-ms": string;
}

interface SharedDurationStyle extends CSSProperties {
  "--rhythm-hold-ms": string;
}

function durationFor(event: SongEvent): number {
  if (event.kind === "hold" && event.holdMs) return event.holdMs;
  if (event.sourceStartMs !== undefined && event.sourceEndMs !== undefined) {
    return Math.max(80, event.sourceEndMs - event.sourceStartMs);
  }
  return 240;
}

function offsetFor(current: SongEvent, event: SongEvent, ordinal: number): number {
  if (current.sourceStartMs !== undefined && event.sourceStartMs !== undefined) {
    return Math.max(0, event.sourceStartMs - current.sourceStartMs);
  }
  return ordinal * 640;
}

function secondsLabel(durationMs: number): string {
  return (Math.round(durationMs / 100) / 10).toFixed(1);
}

interface SharedDurationBarProps {
  event: SongEvent;
  active: boolean;
  resting: boolean;
}

export function SharedDurationBar({ event, active, resting }: SharedDurationBarProps) {
  const durationMs = durationFor(event);
  const label = labelForCode(event.targetCode);
  const countdown = resting ? "resting" : active ? "draining" : "ready";
  const style: SharedDurationStyle = { "--rhythm-hold-ms": `${durationMs}ms` };

  return (
    <section
      className="shared-duration-guide"
      data-testid="shared-duration-bar"
      data-countdown={countdown}
      data-event-id={event.id}
      aria-label={`Shared duration guide for key ${label}, ${secondsLabel(durationMs)} seconds`}
      style={style}
    >
      <div className="shared-duration-copy">
        <span>DURATION GUIDE</span>
        <strong>{resting ? "REST" : label}</strong>
      </div>
      <div className="shared-duration-track" aria-hidden="true">
        <i />
      </div>
      <div className="shared-duration-time">
        <strong>{secondsLabel(durationMs)}s</strong>
        <span>{resting ? "WAIT" : active ? "HOLDING" : "PRESS TO START"}</span>
      </div>
    </section>
  );
}

export function RhythmGuide({ song, eventIndex, restRemainingMs = 0 }: RhythmGuideProps) {
  const current = song.events[eventIndex];
  if (!current) return null;

  const digitMode = current.targetCode.startsWith("Digit");
  const lanes = digitMode ? DIGIT_LANES : LETTER_LANES;
  const visible = song.events.slice(eventIndex, eventIndex + VISIBLE_EVENTS);
  const currentDuration = durationFor(current);
  const currentLabel = labelForCode(current.targetCode);
  const resting = restRemainingMs > 0;
  const instruction = resting
    ? `REST ${secondsLabel(restRemainingMs)}s`
    : `GUIDE ${secondsLabel(currentDuration)}s · ${currentLabel}`;

  return (
    <section
      className="rhythm-guide"
      aria-label="Rhythm guide"
      data-lane-mode={digitMode ? "digits" : "letters"}
      data-resting={resting}
    >
      <header className="rhythm-caption">
        <span>NOTE HIGHWAY</span>
        <strong>{instruction}</strong>
        <small>
          {resting
            ? "No key is suggested until the rest completes."
            : "Hold to drain the bar; release whenever you choose."}
        </small>
      </header>
      <div className="rhythm-track">
        <div className="rhythm-lanes" aria-hidden="true">
          {lanes.map((code) => (
            <span key={code} data-testid={`rhythm-lane-${code}`}>{labelForCode(code)}</span>
          ))}
        </div>
        <div className="rhythm-judgment" aria-hidden="true"><i /></div>
        {visible.map((event, ordinal) => {
          const laneIndex = Math.max(0, lanes.indexOf(event.targetCode));
          const durationMs = durationFor(event);
          const offsetMs = offsetFor(current, event, ordinal);
          const isCurrent = ordinal === 0;
          const label = labelForCode(event.targetCode);
          const timing = `suggested hold ${secondsLabel(durationMs)} seconds`;
          const style: RhythmStyle = {
            "--rhythm-left": `${((laneIndex + 0.5) / lanes.length) * 100}%`,
            "--rhythm-bottom": `${12 + Math.min(82, offsetMs / 42)}px`,
            "--rhythm-height": `${Math.max(18, Math.min(68, durationMs / 18))}px`,
            "--rhythm-hold-ms": `${durationMs}ms`,
          };
          return (
            <span
              key={event.id}
              className="rhythm-note"
              style={style}
              data-testid={`rhythm-event-${eventIndex + ordinal}`}
              data-current={isCurrent}
              data-kind={event.kind}
              data-duration-ms={durationMs}
              data-offset-ms={offsetMs}
              aria-label={`${isCurrent ? "Current" : "Next"} key ${label}, ${timing}`}
            >
              <i aria-hidden="true" />
              <b>{label}{" "}<small>{secondsLabel(durationMs)}s</small></b>
            </span>
          );
        })}
      </div>
    </section>
  );
}
