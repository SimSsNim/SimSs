import s from '../styles/ui.module.css';
import w from '../styles/words.module.css';
import type { WordStateRow } from '../lib/db';
import { answerWord, toggleStar, STATUS_LABEL, type WordItem } from '../lib/words';
import type { WordStatus } from '../lib/leitner';
import { SpeakBtn } from './SentenceView';
import { Icon } from './Icon';
import { Link } from 'react-router-dom';

export type WordFilter = 'all' | WordStatus | 'star';
export const FILTERS: { id: WordFilter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'unknown', label: '모르는' },
  { id: 'confused', label: '헷갈리는' },
  { id: 'known', label: '아는' },
  { id: 'new', label: '새' },
  { id: 'star', label: '★' },
];

export function matchFilter(f: WordFilter, st?: WordStateRow) {
  if (f === 'all') return true;
  if (f === 'star') return !!st?.starred;
  return (st?.status ?? 'new') === f;
}

export function FilterChips({ items, states, value, onChange }: { items: WordItem[]; states: Map<string, WordStateRow>; value: WordFilter; onChange: (f: WordFilter) => void }) {
  return (
    <div className={s.chips} role="group" aria-label="상태 필터">
      {FILTERS.map((f) => {
        const n = items.filter((it) => matchFilter(f.id, states.get(it.key))).length;
        return (
          <button key={f.id} type="button" className={s.chip} aria-pressed={value === f.id} onClick={() => onChange(f.id)} data-testid={`filter-${f.id}`}>
            {f.label} <span data-testid={`count-${f.id}`}>{n}</span>
          </button>
        );
      })}
    </div>
  );
}

export function highlightIn(sentence: string, match?: string) {
  if (!match) return sentence;
  const i = sentence.indexOf(match);
  if (i < 0) return sentence;
  return (
    <>
      {sentence.slice(0, i)}
      <b>{match}</b>
      {sentence.slice(i + match.length)}
    </>
  );
}

export function WordRow({ item, state, lessonKey, onAnswered, showSources }: { item: WordItem; state?: WordStateRow; lessonKey?: string; onAnswered?: () => void; showSources?: boolean }) {
  const status = state?.status ?? 'new';
  const lk = lessonKey ?? item.sources[0]?.lessonKey;
  const answer = async (a: 'known' | 'unknown') => {
    await answerWord(item.term, a, lk);
    onAnswered?.();
  };
  return (
    <li className={`${s.card} ${w.item}`} data-testid="word-row">
      <div className={s.between}>
        <div className={s.row}>
          <span className={w.term} lang="en">{item.term}</span>
          {item.pos && <span className={s.muted}>{item.pos}</span>}
          {item.ipa && <span className={s.muted + ' ' + s.small}>[{item.ipa}]</span>}
        </div>
        <div className={s.row}>
          <SpeakBtn text={item.term} />
          <button type="button" className={s.iconBtn} aria-pressed={!!state?.starred} aria-label={state?.starred ? '즐겨찾기 해제' : '즐겨찾기'}
            onClick={() => void toggleStar(item.term)} style={{ color: state?.starred ? 'var(--warn)' : undefined }}>
            <Icon name="star" filled={!!state?.starred} />
          </button>
        </div>
      </div>
      <div className={s.row}>
        <span style={{ fontWeight: 700 }}>{item.meaningKo}</span>
        <span className={`${w.status} ${w['st_' + status]}`}>{STATUS_LABEL[status]}</span>
        {item.mine && <span className={s.badge}>내 단어</span>}
        {state && state.wrongCount > 0 && <span className={s.small + ' ' + s.muted}>틀림 {state.wrongCount}</span>}
      </div>
      {item.synonyms.length > 0 && <div className={s.small}>바꿔 쓰기: <span lang="en">{item.synonyms.join(', ')}</span></div>}
      {item.sentence && <div className={w.sent} lang="en">{highlightIn(item.sentence, item.matchText)}</div>}
      {item.example && (
        <div className={s.small}>
          <span lang="en" style={{ fontFamily: 'var(--serif)' }}>예) {item.example.en}</span> <span className={s.muted}>{item.example.ko}</span>
        </div>
      )}
      {showSources && item.sources.length > 0 && (
        <div className={s.small + ' ' + s.muted}>
          출처: {item.sources.map((src, i) => (
            <span key={src.lessonKey}>{i > 0 && ', '}<Link to={`/${src.track}/lesson/${src.lessonKey.split('/')[1]}/vocab`}>{src.date} {src.title}</Link></span>
          ))}
        </div>
      )}
      <div className={s.row}>
        <button type="button" className={s.btn + ' ' + s.grow} onClick={() => void answer('known')} aria-pressed={status === 'known'} data-testid="btn-known">알아요</button>
        <button type="button" className={s.btn + ' ' + s.grow} onClick={() => void answer('unknown')} aria-pressed={status === 'unknown'} data-testid="btn-unknown">몰라요</button>
      </div>
    </li>
  );
}
