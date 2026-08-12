import type { PlayerState } from "../lib/player-machine";
import type { SongPackage } from "../lib/song";

interface CompletionCardProps {
  song: SongPackage;
  state: PlayerState;
  onAgain: () => void;
  onCatalog: () => void;
}

export function CompletionCard({ song, state, onAgain, onCatalog }: CompletionCardProps) {
  return (
    <main className="completion-shell">
      <div className="completion-aura" aria-hidden="true" />
      <section className="completion-card">
        <div className="record-emblem" aria-hidden="true">
          <i /><span>MOONLIT<br />RECORDS</span>
        </div>
        <p className="eyebrow">THE HALL HAS RETURNED TO SILENCE</p>
        <h1>This performance was yours.</h1>
        <p className="completion-copy">The final resonance of <em>{song.title}</em> has settled.<br />Every detour belongs to the version only you played.</p>

        <div className="performance-stats">
          <div><span className="sr-only">{state.correctCount} lyric notes</span><strong aria-hidden="true">{state.correctCount}</strong><span aria-hidden="true">LYRIC NOTES</span></div>
          <div><span className="sr-only">{state.mistakes.length} free-play {state.mistakes.length === 1 ? "note" : "notes"}</span><strong aria-hidden="true">{state.mistakes.length}</strong><span aria-hidden="true">FREE-PLAY NOTES</span></div>
          <div><span className="sr-only">{song.phrases.length} lyric lines</span><strong aria-hidden="true">{song.phrases.length}</strong><span aria-hidden="true">LYRIC LINES</span></div>
        </div>

        <div className="completion-actions">
          <button className="primary-button" type="button" onClick={onAgain}>Play it again</button>
          <button className="secondary-button" type="button" onClick={onCatalog}>Return to catalogue</button>
        </div>
        <small>NO SCORE. NO RANKING. JUST THE PERFORMANCE YOU MADE.</small>
      </section>
    </main>
  );
}
