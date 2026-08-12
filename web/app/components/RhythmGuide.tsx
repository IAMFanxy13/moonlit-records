import type { CSSProperties } from "react";

import { labelForCode } from "../lib/keyboard";
import type { SongEvent, SongPackage } from "../lib/song";

const DIGIT_LANES = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0"];
const LETTER_LANES = Array.from({ length: 26 }, (_, index) => `Key${String.fromCharCode(65 + index)}`);
const VISIBLE_EVENTS = 8;

interface RhythmGuideProps {
  song: SongPackage;
  eventIndex: number;
  pressedCodes: ReadonlySet<string>;
}

interface RhythmStyle extends CSSProperties {
  "--rhythm-left": string;
  "--rhythm-bottom": string;
  "--rhythm-height": string;
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
  return (durationMs / 1000).toFixed(1);
}

export function RhythmGuide({ song, eventIndex, pressedCodes }: RhythmGuideProps) {
  const current = song.events[eventIndex];
  if (!current) return null;

  const digitMode = current.targetCode.startsWith("Digit");
  const lanes = digitMode ? DIGIT_LANES : LETTER_LANES;
  const visible = song.events.slice(eventIndex, eventIndex + VISIBLE_EVENTS);
  const currentDuration = durationFor(current);
  const currentLabel = labelForCode(current.targetCode);
  const instruction = current.kind === "hold"
    ? `HOLD ${secondsLabel(currentDuration)}s · ${currentLabel}`
    : `TAP · ${currentLabel}`;

  return (
    <section className="rhythm-guide" aria-label="Rhythm guide" data-lane-mode={digitMode ? "digits" : "letters"}>
      <header className="rhythm-caption">
        <span>NOTE HIGHWAY</span>
        <strong>{instruction}</strong>
        <small>Length is literal — hold until the bar completes.</small>
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
          const active = isCurrent && pressedCodes.has(event.targetCode);
          const label = labelForCode(event.targetCode);
          const timing = event.kind === "hold" ? `hold ${secondsLabel(durationMs)} seconds` : `tap ${secondsLabel(durationMs)} seconds`;
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
              data-active={active}
              data-kind={event.kind}
              data-duration-ms={durationMs}
              data-offset-ms={offsetMs}
              aria-label={`${isCurrent ? "Current" : "Next"} key ${label}, ${timing}`}
            >
              <i aria-hidden="true" />
              <b>{label}</b>
            </span>
          );
        })}
      </div>
    </section>
  );
}
