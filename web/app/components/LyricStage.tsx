import { labelForCode } from "../lib/keyboard";
import type { SongPackage } from "../lib/song";

interface LyricStageProps {
  song: SongPackage;
  eventIndex: number;
}

const INSTRUMENTAL_ROUTE_LENGTH = 10;

export function LyricStage({ song, eventIndex }: LyricStageProps) {
  const safeEventIndex = Math.min(eventIndex, Math.max(song.events.length - 1, 0));
  const currentEvent = song.events[safeEventIndex];
  const currentPhraseIndex = currentEvent?.phraseIndex ?? song.phrases.length - 1;
  const currentPhrase = song.phrases[currentPhraseIndex];
  const nextPhrase = song.phrases[currentPhraseIndex + 1];
  const phraseEvents = song.events.slice(currentPhrase.startEvent, currentPhrase.endEvent + 1);
  const lyricPieces: Array<{ id: string; text: string; absoluteIndex?: number }> = [];
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
  let eventOffset = 0;

  if (instrumentalPhrase) {
    visibleInstrumentalEvents.forEach((event, index) => {
      lyricPieces.push({
        id: event.id,
        text: labelForCode(event.targetCode),
        absoluteIndex: currentPhrase.startEvent + instrumentalPageStart + index,
      });
    });
  } else {
    Array.from(currentPhrase.text).forEach((character, characterIndex) => {
      const event = phraseEvents[eventOffset];
      if (
        event &&
        typeof event.token === "string" &&
        (event.token === character || event.token.startsWith(character))
      ) {
        lyricPieces.push({
          id: event.id,
          text: character,
          absoluteIndex: currentPhrase.startEvent + eventOffset,
        });
        eventOffset += 1;
      } else {
        lyricPieces.push({ id: `${currentPhrase.id}-punctuation-${characterIndex}`, text: character });
      }
    });
    phraseEvents.slice(eventOffset).forEach((event, remainingIndex) => {
      lyricPieces.push({
        id: event.id,
        text: event.token ?? labelForCode(event.targetCode),
        absoluteIndex: currentPhrase.startEvent + eventOffset + remainingIndex,
      });
    });
  }

  return (
    <section className="lyric-stage" aria-label="Lyric-guided performance">
      <div className="lyric-meta">
        <span>CURRENT LINE</span>
        <span>{String(currentPhraseIndex + 1).padStart(2, "0")} / {String(song.phrases.length).padStart(2, "0")}</span>
      </div>

      <div className="current-lyric">
        <p className="lyric-line sr-only" lang={song.lyricLanguage}>{currentPhrase.text}</p>
        <div className="lyric-progress" lang={song.lyricLanguage} aria-label={`Current lyric: ${currentPhrase.text}`}>
          {lyricPieces.map((piece) => {
            if (piece.absoluteIndex === undefined) {
              return <span className="lyric-punctuation" aria-hidden="true" key={piece.id}>{piece.text}</span>;
            }
            const event = song.events[piece.absoluteIndex];
            const absoluteIndex = piece.absoluteIndex;
            const tokenState = absoluteIndex < eventIndex
              ? "done"
              : absoluteIndex === eventIndex
                ? "current"
                : "upcoming";
            return (
              <span key={piece.id} className="lyric-token-wrap">
                <span className="lyric-token" data-token-state={tokenState}>{piece.text}</span>
                {tokenState === "current" && (
                  <span className="lyric-key" aria-label={`Press ${labelForCode(event.targetCode)}`}>
                    {labelForCode(event.targetCode)}
                  </span>
                )}
              </span>
            );
          })}
        </div>
        {currentEvent?.kind === "hold" && (
          <div
            className="hold-rail"
            aria-label="Hold this key"
            style={{ "--hold-ms": `${currentEvent.holdMs ?? 0}ms` } as React.CSSProperties}
          >
            <i />
            <span>HOLD · RELEASE WITH THE PHRASE</span>
          </div>
        )}
      </div>

      <div className="next-lyric">
        <span>NEXT LINE</span>
        <p className="next-line" lang={instrumentalPhrase ? "en" : nextPhrase ? song.lyricLanguage : "en"}>{nextLineText}</p>
      </div>
    </section>
  );
}
