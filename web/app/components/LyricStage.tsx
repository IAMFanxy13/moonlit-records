import { eventInputLabel, remainingEventInputLabel } from "../lib/keyboard";
import { buildLeftHandCues, leftHandCuePositionLabel, projectLeftHandCuePercent, type LeftHandCue } from "../lib/left-hand-cues";
import type { LyricToken, SongPackage } from "../lib/song";
import { normalizeSongPackage } from "../lib/song-normalizer";
import { useLyricStageLayout } from "./use-lyric-stage-layout";

interface LyricStageProps {
  song: SongPackage;
  eventIndex: number;
  completedCodes?: string[];
}

const INSTRUMENTAL_ROUTE_LENGTH = 10;
const LYRIC_UNIT = /\p{Script=Han}|[A-Za-z]+(?:'[A-Za-z]+)?|[^\p{Script=Han}A-Za-z]+/gu;
const PLAYABLE_LYRIC_UNIT = /^(?:\p{Script=Han}|[A-Za-z]+(?:'[A-Za-z]+)?)$/u;

type LyricPiece =
  | { id: string; text: string; token: LyricToken }
  | { id: string; text: string; token?: undefined };

function tokenState(token: LyricToken, eventIndex: number): "done" | "current" | "upcoming" {
  if (token.endEvent < eventIndex) return "done";
  if (token.startEvent <= eventIndex && eventIndex <= token.endEvent) return "current";
  return "upcoming";
}

function lyricEventIndexes(song: SongPackage, token: LyricToken): number[] {
  const ownedIndexes = song.events.flatMap((event, index) => event.lyricTokenId === token.id ? [index] : []);
  if (ownedIndexes.length > 0) return ownedIndexes;
  const fallbackIndexes: number[] = [];
  for (let index = token.startEvent; index <= token.endEvent; index += 1) {
    if (song.events[index]?.parts?.some((part) => part.hand === "right")) fallbackIndexes.push(index);
  }
  return fallbackIndexes;
}

function inputState(eventIndexes: readonly number[], eventIndex: number): "done" | "current" | "upcoming" {
  if (eventIndexes.includes(eventIndex)) return "current";
  if (eventIndexes.length > 0 && eventIndexes.every((index) => index < eventIndex)) return "done";
  return "upcoming";
}

function cueState(
  cue: LeftHandCue,
  eventIndex: number,
  completedCodes: readonly string[],
): "done" | "current" | "upcoming" {
  if (cue.eventIndex < eventIndex || (cue.eventIndex === eventIndex && completedCodes.includes("Space"))) {
    return "done";
  }
  return cue.eventIndex === eventIndex ? "current" : "upcoming";
}

function cueRelation(cue: LeftHandCue): string {
  if (cue.position === "under") return "with lyric";
  if (cue.position === "between") return "between lyrics";
  if (cue.position === "before") return "before lyric";
  return "after lyric";
}

function accessibleCueState(state: ReturnType<typeof cueState>): string {
  return state === "done" ? "completed" : state;
}

export function LyricStage({ song, eventIndex, completedCodes = [] }: LyricStageProps) {
  const displaySong = song.lyricTokens ? song : normalizeSongPackage(song);
  const safeEventIndex = Math.min(eventIndex, Math.max(displaySong.events.length - 1, 0));
  const currentPhraseIndex = displaySong.events[safeEventIndex]?.phraseIndex ?? displaySong.phrases.length - 1;
  const currentPhrase = displaySong.phrases[currentPhraseIndex];
  const nextPhrase = displaySong.phrases[currentPhraseIndex + 1];
  const phraseEvents = displaySong.events.slice(currentPhrase.startEvent, currentPhrase.endEvent + 1);
  const lyricPieces: LyricPiece[] = [];
  const instrumentalPhrase = phraseEvents.every((event) => event.token == null);
  const phraseTokens = (displaySong.lyricTokens ?? [])
    .filter((token) => token.phraseIndex === currentPhraseIndex)
    .sort((left, right) => left.tokenIndex - right.tokenIndex);
  const leftHandCues = instrumentalPhrase ? [] : buildLeftHandCues(displaySong, currentPhraseIndex);
  const relativeEventIndex = Math.max(0, safeEventIndex - currentPhrase.startEvent);
  const instrumentalPageStart = Math.floor(relativeEventIndex / INSTRUMENTAL_ROUTE_LENGTH) * INSTRUMENTAL_ROUTE_LENGTH;
  const visibleInstrumentalEvents = phraseEvents.slice(
    instrumentalPageStart,
    instrumentalPageStart + INSTRUMENTAL_ROUTE_LENGTH,
  );
  const nextInstrumentalEvents = phraseEvents.slice(
    instrumentalPageStart + INSTRUMENTAL_ROUTE_LENGTH,
    instrumentalPageStart + INSTRUMENTAL_ROUTE_LENGTH * 2,
  );
  const nextLineText = instrumentalPhrase
    ? nextInstrumentalEvents.length > 0
      ? nextInstrumentalEvents.map(eventInputLabel).join(" ")
      : "Let the final note find the room."
    : nextPhrase?.text ?? "Let the final note find the room.";
  const { lineRef, anchorPercentById } = useLyricStageLayout(currentPhrase.id);
  const phraseTokenIds = phraseTokens.map((token) => token.id);

  if (instrumentalPhrase) {
    visibleInstrumentalEvents.forEach((event, index) => {
      const absoluteIndex = currentPhrase.startEvent + instrumentalPageStart + index;
      lyricPieces.push({
        id: event.id,
        text: eventInputLabel(event),
        token: {
          id: event.id,
          phraseIndex: currentPhraseIndex,
          tokenIndex: instrumentalPageStart + index,
          text: eventInputLabel(event),
          startEvent: absoluteIndex,
          endEvent: absoluteIndex,
        },
      });
    });
  } else {
    const units = currentPhrase.text.match(LYRIC_UNIT) ?? [];
    let tokenOffset = 0;

    units.forEach((unit, unitIndex) => {
      if (PLAYABLE_LYRIC_UNIT.test(unit)) {
        const token = phraseTokens[tokenOffset];
        if (token?.text === unit) {
          lyricPieces.push({ id: token.id, text: unit, token });
          tokenOffset += 1;
          return;
        }
      }
      lyricPieces.push({ id: `${currentPhrase.id}-punctuation-${unitIndex}`, text: unit });
    });

    phraseTokens.slice(tokenOffset).forEach((token) => {
      lyricPieces.push({ id: token.id, text: token.text, token });
    });
  }

  return (
    <section className="lyric-stage" aria-label="Lyric-guided performance">
      <div className="lyric-meta">
        <span>CURRENT LINE</span>
        <span>{String(currentPhraseIndex + 1).padStart(2, "0")} / {String(displaySong.phrases.length).padStart(2, "0")}</span>
      </div>

      <div className="current-lyric" data-phrase-layout="single-line">
        <p className="lyric-line sr-only" lang={displaySong.lyricLanguage}>{currentPhrase.text}</p>
        {leftHandCues.length > 0 && (
          <div className="left-hand-star-track" aria-label="Left hand Space positions">
            {leftHandCues.map((cue) => {
              const state = cueState(cue, eventIndex, completedCodes);
              return (
                <span
                  aria-label={`Space ${cueRelation(cue)}, ${accessibleCueState(state)}`}
                  className="left-hand-star"
                  data-cue-inferred={cue.inferred ? "true" : "false"}
                  data-cue-position={cue.position}
                  data-cue-ratio={String(cue.ratio)}
                  data-cue-state={state}
                  key={cue.id}
                  style={{ left: `${projectLeftHandCuePercent(cue, anchorPercentById, phraseTokenIds)}%` }}
                >
                  <i aria-hidden="true" />
                  {state === "current" && <b>SPACE</b>}
                  {(cue.position === "before" || cue.position === "after") && (
                    <small>{leftHandCuePositionLabel(cue.position)}</small>
                  )}
                </span>
              );
            })}
          </div>
        )}
        <div
          className="lyric-progress"
          data-layout="single-line"
          lang={displaySong.lyricLanguage}
          aria-label={`Current lyric: ${currentPhrase.text}`}
          ref={lineRef}
          style={{ whiteSpace: "nowrap" }}
        >
          {lyricPieces.map((piece) => {
            if (!piece.token) {
              return <span className="lyric-punctuation" aria-hidden="true" key={piece.id}>{piece.text}</span>;
            }
            const state = tokenState(piece.token, eventIndex);
            const tokenEventIndexes = lyricEventIndexes(displaySong, piece.token);
            const keyState = inputState(tokenEventIndexes, eventIndex);
            const labelEventIndex = tokenEventIndexes.includes(eventIndex)
              ? eventIndex
              : tokenEventIndexes[0] ?? piece.token.startEvent;
            const tokenEvent = displaySong.events[labelEventIndex];
            const inputLabel = tokenEvent
              ? labelEventIndex === eventIndex
                ? remainingEventInputLabel(tokenEvent, completedCodes)
                : eventInputLabel(tokenEvent)
              : "";
            const noteCount = Math.max(tokenEventIndexes.length, 1);
            return (
              <span key={piece.id} className="lyric-token-wrap" data-lyric-token-id={piece.token.id}>
                <span className="lyric-token" data-token-state={state}>{piece.text}</span>
                {noteCount > 1 && (
                  <span className="lyric-note-progress" aria-label={`${noteCount} notes for ${piece.text}`}>
                    {Array.from({ length: noteCount }, (_, subIndex) => {
                      const absoluteIndex = tokenEventIndexes[subIndex] ?? piece.token.startEvent;
                      const noteState = absoluteIndex < eventIndex
                        ? "done"
                        : absoluteIndex === eventIndex
                          ? "current"
                          : "upcoming";
                      return (
                        <i
                          aria-label={`Note ${subIndex + 1} of ${noteCount}, ${noteState}`}
                          data-note-state={noteState}
                          key={`${piece.token.id}-note-${subIndex}`}
                        />
                      );
                    })}
                  </span>
                )}
                {inputLabel && (
                  <span
                    className="lyric-key"
                    data-key-state={keyState}
                    aria-label={keyState === "current" ? `Press ${inputLabel}` : `Input ${inputLabel} for ${piece.text}`}
                  >
                    {inputLabel}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>

      <div className="next-lyric">
        <span>NEXT LINE</span>
        <p className="next-line" lang={instrumentalPhrase ? "en" : nextPhrase ? displaySong.lyricLanguage : "en"}>{nextLineText}</p>
      </div>
    </section>
  );
}
