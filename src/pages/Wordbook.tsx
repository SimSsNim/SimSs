import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import s from '../styles/ui.module.css';
import { useLessons } from '../lib/lessons';
import { db } from '../lib/db';
import { mergeWords, type WordItem } from '../lib/words';
import { FilterChips, WordRow, matchFilter, type WordFilter } from '../components/WordList';
import { Flashcards } from '../components/Flashcards';
import { useSettings } from '../lib/settings';
import { TRACK_LABEL, type Track } from '../lib/types';
import { isDue } from '../lib/leitner';
import { kstDate } from '../lib/date';
import { autoCheck } from '../lib/progress';
import { pickToday } from '../lib/lessons';

export type TrackFilter = 'all' | Track;
export function TrackFilterSeg({ value, onChange }: { value: TrackFilter; onChange: (v: TrackFilter) => void }) {
  return (
    <div className={s.seg} role="group" aria-label="트랙 필터">
      {(['all', 'general', 'toeic'] as const).map((t) => (
        <button key={t} type="button" className={s.segBtn} aria-pressed={value === t} onClick={() => onChange(t)}>{t === 'all' ? '전체' : TRACK_LABEL[t]}</button>
      ))}
    </div>
  );
}

export type LevelFilter = 'all' | number;
export function LevelFilterChips({ value, onChange, counts }: { value: LevelFilter; onChange: (v: LevelFilter) => void; counts?: Record<string, number> }) {
  return (
    <div className={s.chips} role="group" aria-label="레벨 필터" style={{ paddingBottom: 2 }}>
      {(['all', 1, 2, 3, 4] as const).map((l) => (
        <button key={l} type="button" className={s.chip} aria-pressed={value === l} onClick={() => onChange(l)} style={{ minHeight: 36 }}>{l === 'all' ? '전체' : `L${l}`}{counts ? ` ${counts[l] ?? 0}` : ''}</button>
      ))}
    </div>
  );
}

type Sort = 'recent' | 'ko' | 'abc' | 'wrong';

/** 복습 탭의 '단어장' 칸 */
export function WordbookPanel({ trackF, level }: { trackF: TrackFilter; level: LevelFilter }) {
  const settings = useSettings();
  const [params] = useSearchParams();
  const { lessons, summaries } = useLessons();
  const [filter, setFilter] = useState<WordFilter>('all');
  const [view, setView] = useState<'list' | 'flash' | 'review'>(params.get('review') ? 'review' : 'list');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const myWords = useLiveQuery(() => db.myWords.toArray(), []);
  const rows = useLiveQuery(() => db.wordState.toArray(), []);
  const states = useMemo(() => new Map((rows ?? []).map((r) => [r.key, r])), [rows]);
  const all = useMemo(() => mergeWords(Object.values(lessons), myWords ?? []), [lessons, myWords]);
  const lessonTrack = (lk?: string) => lk?.split('/')[0];
  const today = kstDate();

  const scoped = all.filter((w: WordItem) => {
    if (trackF !== 'all') {
      const tracks = w.mine ? [lessonTrack(myWords?.find((m) => m.id === w.myWordId)?.lessonKey)] : w.sources.map((x) => x.track);
      if (!w.mine && !tracks.includes(trackF)) return false;
      if (w.mine && tracks[0] && tracks[0] !== trackF) return false;
    }
    if (level !== 'all' && !w.sources.some((x) => x.level === level)) return false;
    if (from && !w.sources.some((x) => x.date >= from)) return false;
    if (to && !w.sources.some((x) => x.date <= to)) return false;
    if (q) {
      const n = q.toLowerCase();
      if (!w.term.toLowerCase().includes(n) && !w.meaningKo.includes(q) && !w.synonyms.some((x) => x.toLowerCase().includes(n))) return false;
    }
    return true;
  });
  const shown = scoped.filter((w) => matchFilter(filter, states.get(w.key))).sort((a, b) => {
    if (sort === 'abc') return a.term.localeCompare(b.term);
    if (sort === 'ko') return a.meaningKo.localeCompare(b.meaningKo, 'ko');
    if (sort === 'wrong') return (states.get(b.key)?.wrongCount ?? 0) - (states.get(a.key)?.wrongCount ?? 0);
    return b.createdAt - a.createdAt;
  });
  const due = all.filter((w) => { const r = states.get(w.key); return r && isDue(r, today); });

  return (
    <>
        <div className={s.seg} role="tablist" aria-label="보기">
          <button type="button" role="tab" className={s.segBtn} aria-selected={view === 'list'} onClick={() => setView('list')}>목록</button>
          <button type="button" role="tab" className={s.segBtn} aria-selected={view === 'flash'} onClick={() => setView('flash')}>플래시카드</button>
          <button type="button" role="tab" className={s.segBtn} aria-selected={view === 'review'} onClick={() => setView('review')} data-testid="review-btn">복습 {due.length}</button>
        </div>
        {view === 'review' ? (
          due.length ? (
            <Flashcards items={due} deckKey="review" title="오늘 복습할 단어" onFinish={(n) => {
              if (n === 0) return;
              const t = pickToday(summaries, settings.track, settings.levelByTrack[settings.track] ?? 1).lessons[0];
              if (t) void autoCheck(t.key, 'review');
            }} />
          ) : <p className={s.empty}>오늘 복습할 단어가 없어요 🎉</p>
        ) : (
          <>
            <div className={s.row} style={{ marginTop: 10 }}>
              <input className={s.input + ' ' + s.grow} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="단어·뜻 검색" aria-label="단어 검색" style={{ minWidth: 140 }} />
              <select className={s.select} style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="정렬">
                <option value="recent">최근</option><option value="ko">가나다</option><option value="abc">abc</option><option value="wrong">틀린 횟수</option>
              </select>
            </div>
            <details style={{ margin: '6px 0' }}>
              <summary className={s.small} style={{ minHeight: 36, cursor: 'pointer' }}>범위: 날짜</summary>
              <div className={s.row}>
                <input className={s.input} style={{ width: 'auto' }} type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="시작 날짜" />
                <input className={s.input} style={{ width: 'auto' }} type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="끝 날짜" />
              </div>
            </details>
            <FilterChips items={scoped} states={states} value={filter} onChange={setFilter} />
            {view === 'list' ? (
              <ul className={s.list}>
                {shown.map((w) => <WordRow key={w.key} item={w} state={states.get(w.key)} showSources />)}
                {shown.length === 0 && <li className={s.empty}>단어가 없어요.</li>}
              </ul>
            ) : (
              <Flashcards items={shown} deckKey={`${filter}|${trackF}|${level}|${from}|${to}|${q}|${sort}`} />
            )}
          </>
        )}
    </>
  );
}
