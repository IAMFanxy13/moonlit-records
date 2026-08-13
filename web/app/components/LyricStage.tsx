import { labelForCode } from "../lib/keyboard";
import type { LyricToken, SongPackage } from "../lib/song";
import { normalizeSongPackage } from "../lib/song-normalizer";

interface LyricStageProps {
  song: SongPackage;
  eventIndex: number;
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

export function LyricStage({ song, eventIndex }: LyricStageProps) {
  const displaySong = normalizeSongPackage(song);
  const safeEventIndex = Math.min(eventIndex, Math.max(displaySong.events.length - 1, 0));
  const currentPhraseIndex = displaySong.events[safeEventIndex]?.phraseIndex ?? displaySong.phrases.length - 1;
  const currentPhrase = displaySong.phrases[currentPhraseIndex];
  const nextPhrase = displaySong.phrases[currentPhraseIndex + 1];
  const phraseEvents = displaySong.events.slice(currentPhrase.startEvent, currentPhrase.endEvent + 1);
  const lyricPieces: LyricPiece[] = [];
  const instrumentalPhrase = phraseEvents.every((event) => event.token == null);
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
      ? nextInstrumentalEvents.map((event) => labelForCode(event.targetCode)).join(" ")
      : "Let the final note find the room."
    : nextPhrase?.text ?? "Let the final note find the room.";

  if (instrumentalPhrase) {
    visibleInstrumentalEvents.forEach((event, index) => {
      const absoluteIndex = currentPhrase.startEvent + instrumentalPageStart + index;
      lyricPieces.push({
        id: event.id,
        text: labelForCode(event.targetCode),
        token: {
          id: event.id,
          phraseIndex: currentPhraseIndex,
          tokenIndex: instrumentalPageStart + index,
          text: labelForCode(event.targetCode),
          startEvent: absoluteIndex,
          endEvent: absoluteIndex,
        },
      });
    });
  } else {
    const phraseTokens = (displaySong.lyricTokens ?? [])
      .filter((token) => token.phraseIndex === currentPhraseIndex)
      .sort((left, right) => left.tokenIndex - right.tokenIndex);
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

      <div className="current-lyric">
        <p className="lyric-line sr-only" lang={displaySong.lyricLanguage}>{currentPhrase.text}</p>
        <div className="lyric-progress" lang={displaySong.lyricLanguage} aria-label={`Current lyric: ${currentPhrase.text}`}>
          {lyricPieces.map((piece) => {
            if (!piece.token) {
              return <span className="lyric-punctuation" aria-hidden="true" key={piece.id}>{piece.text}</span>;
            }
            const state = tokenState(piece.token, eventIndex);
            const event = state === "current" ? displaySong.events[eventIndex] : undefined;
            const noteCount = piece.token.endEvent - piece.token.startEvent + 1;
            return (
              <span key={piece.id} className="lyric-token-wrap">
                <span className="lyric-token" data-token-state={state}>{piece.text}</span>
                {noteCount > 1 && (
                  <span className="lyric-note-progress" aria-label={`${noteCount} notes for ${piece.text}`}>
                    {Array.from({ length: noteCount }, (_, subIndex) => {
                      const absoluteIndex = piece.token.startEvent + subIndex;
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
                {event && (
                  <span className="lyric-key" aria-label={`Press ${labelForCode(event.targetCode)}`}>
                    {labelForCode(event.targetCode)}
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
