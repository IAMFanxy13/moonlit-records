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
          <i /><span>月光<br />唱片</span>
        </div>
        <p className="eyebrow">THE LAST NOTE IS STILL HERE</p>
        <h1>这一遍，属于你。</h1>
        <p className="completion-copy">《{song.title}》已经落下最后一个音。<br />弹错的那些，也算作你今晚留下的指纹。</p>

        <div className="performance-stats">
          <div><span className="sr-only">{state.correctCount} 个歌词音符</span><strong aria-hidden="true">{state.correctCount}</strong><span aria-hidden="true">个歌词音符</span></div>
          <div><span className="sr-only">{state.mistakes.length} 次自由试音</span><strong aria-hidden="true">{state.mistakes.length}</strong><span aria-hidden="true">次自由试音</span></div>
          <div><span className="sr-only">{song.phrases.length} 句月光</span><strong aria-hidden="true">{song.phrases.length}</strong><span aria-hidden="true">句月光</span></div>
        </div>

        <div className="completion-actions">
          <button className="primary-button" type="button" onClick={onAgain}>再弹一遍</button>
          <button className="secondary-button" type="button" onClick={onCatalog}>回到曲库</button>
        </div>
        <small>不评分，不排名。只把这一遍还给你。</small>
      </section>
    </main>
  );
}
