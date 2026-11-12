import { Link } from 'react-router-dom';
import s from '../styles/ui.module.css';
import type { GrammarPoint, Lesson } from '../lib/types';
import type { GrammarStateRow } from '../lib/db';
import { setGrammarState, toggleGrammarStar } from '../lib/marks';
import { Icon } from './Icon';
import { SpeakBtn } from './SentenceView';

export function highlightMany(text: string, parts: string[]) {
  const ranges: [number, number][] = [];
  for (const h of parts) {
    const i = text.indexOf(h);
    if (i >= 0) ranges.push([i, i + h.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const out: React.ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([a, b], k) => {
    if (a < pos) return;
    out.push(text.slice(pos, a));
    out.push(<mark key={k} className={s.hlGrammar} style={{ color: 'inherit' }}>{text.slice(a, b)}</mark>);
    pos = b;
  });
  out.push(text.slice(pos));
  return out;
}

export function GrammarCard({ lesson, g, state, lessonKey, onChange, showLesson }: { lesson: Lesson; g: GrammarPoint; state?: GrammarStateRow; lessonKey: string; onChange?: () => void; showLesson?: boolean }) {
  const sent = lesson.paragraphs.flatMap((p) => p.sentences).find((x) => x.id === g.sentenceId);
  const set = async (patch: { understood?: boolean; review?: boolean }) => {
    await setGrammarState(lessonKey, g.id, patch);
    onChange?.();
  };
  return (
    <li className={s.card} data-testid="grammar-card">
      <div className={s.between}>
        <b style={{ fontSize: 17 }}>{g.title}</b>
        <button type="button" className={s.iconBtn} aria-pressed={!!state?.starred} aria-label={state?.starred ? '문법 즐겨찾기 해제' : '문법 즐겨찾기'} data-testid="grammar-star"
          onClick={async () => { await toggleGrammarStar(lessonKey, g.id); onChange?.(); }} style={{ color: state?.starred ? 'var(--warn)' : undefined, flex: 'none' }}>
          <Icon name="star" filled={!!state?.starred} />
        </button>
      </div>
      <div className={s.row} style={{ margin: '4px 0 8px' }}>
        {g.tags.map((t) => <span key={t} className={s.badgeAccent}>#{t}</span>)}
        {showLesson && <Link className={s.small} to={`/${lesson.track}/lesson/${lesson.id}/grammar`}>{lesson.date} {lesson.title}</Link>}
      </div>
      {sent && <p className={s.reading} lang="en" style={{ margin: '0 0 6px', fontSize: 'calc(var(--read-size) - 2px)' }}>{highlightMany(sent.en, g.highlight)}</p>}
      {sent && <p className={s.ko} style={{ margin: '0 0 10px' }}>{sent.ko}</p>}
      <p style={{ margin: '0 0 8px' }}>{g.explanationKo}</p>
      {g.examples?.map((ex, i) => (
        <div key={i} className={s.row} style={{ flexWrap: 'nowrap' }}>
          <div className={s.grow}>
            <div lang="en" style={{ fontFamily: 'var(--serif)' }}>{ex.en}</div>
            <div className={s.small + ' ' + s.muted}>{ex.ko}</div>
          </div>
          <SpeakBtn text={ex.en} label="예문 듣기" />
        </div>
      ))}
      {g.note && <p className={s.small} style={{ color: 'var(--warn)' }}>⚠️ 주의: {g.note}</p>}
      <div className={s.row} style={{ marginTop: 8 }}>
        <Link className={s.btn} to={`/${lesson.track}/lesson/${lesson.id}/structure?s=${g.sentenceId}`}>문장으로 이동</Link>
        <button type="button" className={s.btn} aria-pressed={!!state?.understood} onClick={() => void set({ understood: !state?.understood, review: false })}>
          {state?.understood ? '✓ 이해함' : '이해함'}
        </button>
        <button type="button" className={s.btn} aria-pressed={!!state?.review} onClick={() => void set({ review: !state?.review, understood: false })}>
          {state?.review ? '↺ 다시 볼래요 ✓' : '다시 볼래요'}
        </button>
      </div>
    </li>
  );
}
