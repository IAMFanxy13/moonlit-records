import type { CSSProperties } from "react";

import { eventInputCodes, eventInputLabel, labelForCode, remainingEventInputLabel } from "../lib/keyboard";
import { getScoreTargetDurationMs } from "../lib/piano-performance";
import type { SongEvent, SongPackage } from "../lib/song";

const LETTER_LANES = Array.from({ length: 26 }, (_, index) => `Key${String.fromCharCode(65 + index)}`);
const VISIBLE_EVENTS = 8;

interface RhythmGuideProps {
  song: SongPackage;
  eventIndex: number;
  restRemainingMs?: number;
  completedCodes?: string[];
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
  durationMs: number;
  active: boolean;
  resting: boolean;
  positionLabel?: string;
}

export function SharedDurationBar({ event, durationMs, active, resting, positionLabel }: SharedDurationBarProps) {
  const label = eventInputLabel(event);
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
        <span>{positionLabel ? `LEFT HAND · ${positionLabel}` : "NEXT ATTACK WINDOW"}</span>
        <strong>{resting ? "REST" : label}</strong>
      </div>
      <div className="shared-duration-track" aria-hidden="true">
        <i />
      </div>
      <div className="shared-duration-time">
        <strong>{secondsLabel(durationMs)}s</strong>
        <span>{resting ? "WAIT" : active ? "LISTEN · THEN PLAY" : "NEXT GESTURE"}</span>
      </div>
    </section>
  );
}

export function RhythmGuide({ song, eventIndex, restRemainingMs = 0, completedCodes = [] }: RhythmGuideProps) {
  const current = song.events[eventIndex];
  if (!current) return null;

  const currentCodes = eventInputCodes(current).filter((code) => !completedCodes.includes(code));
  const handMode = currentCodes.some((code) => ["Space", "Shift"].includes(code));
  const lanes = handMode ? currentCodes : LETTER_LANES;
  const visible = song.events.slice(eventIndex, eventIndex + VISIBLE_EVENTS);
  const currentDuration = getScoreTargetDurationMs(song, eventIndex);
  const currentLabel = remainingEventInputLabel(current, completedCodes);
  const resting = restRemainingMs > 0;
  const instruction = resting
    ? `REST ${secondsLabel(restRemainingMs)}s`
    : `GUIDE ${secondsLabel(currentDuration)}s · ${currentLabel}`;

  return (
    <section
      className="rhythm-guide"
      aria-label="Rhythm guide"
      data-lane-mode={handMode ? "hands" : "letters"}
      data-resting={resting}
    >
      <header className="rhythm-caption">
        <span>NOTE HIGHWAY</span>
        <strong>{instruction}</strong>
        <small>
          {resting
            ? "No key is suggested until the rest completes."
            : "The score shapes note length; your next keydown shapes the connection."}
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
          const laneIndex = Math.max(0, lanes.indexOf(eventInputCodes(event)[0]));
          const absoluteIndex = eventIndex + ordinal;
          const durationMs = getScoreTargetDurationMs(song, absoluteIndex);
          const offsetMs = offsetFor(current, event, ordinal);
          const isCurrent = ordinal === 0;
          const label = isCurrent
            ? remainingEventInputLabel(event, completedCodes)
            : eventInputLabel(event);
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
              data-testid={`rhythm-event-${absoluteIndex}`}
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
