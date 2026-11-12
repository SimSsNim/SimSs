import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import s from '../styles/ui.module.css';
import { AppHeader } from '../components/AppHeader';
import { DatePick } from '../components/DatePick';
import { GridTabs } from '../components/GridTabs';
import { TrackFilterSeg, type TrackFilter } from './Wordbook';
import { useLessons } from '../lib/lessons';
import { useSettings } from '../lib/settings';
import { db } from '../lib/db';
import { mergeWords, STATUS_LABEL, statusOf, type WordItem } from '../lib/words';
import { WordRow } from '../components/WordList';
import { formatKo } from '../lib/date';
import type { WordStateRow } from '../lib/db';

type GroupBy = 'none' | 'level' | 'date' | 'lesson' | 'status' | 'pos';
const GROUPS: [GroupBy, string][] = [['none', '전체'], ['level', '레벨'], ['date', '날짜'], ['lesson', '지문'], ['status', '상태'], ['pos', '품사']];
const POS_KO: Record<string, string> = {
  'n.': '명사', 'v.': '동사', 'adj.': '형용사', 'adv.': '부사', 'prep.': '전치사', 'conj.': '접속사', 구: '구', 숙어: '숙어', 구동사: '구동사',
};
const STATUS_ORDER = ['unknown', 'confused', 'new', 'known'];

interface Group { id: string; label: string; order: string; words: WordItem[] }

/** 하단 탭 '단어': 모든 지문의 단어를 한곳에서. 전체 또는 레벨·날짜·지문·상태·품사 묶음으로 */
export function Words() {
  const settings = useSettings();
  const { lessons, status } = useLessons();
  const [trackF, setTrackF] = useState<TrackFilter>(settings.track);
  const [day, setDay] = useState('');
  const [q, setQ] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [sel, setSel] = useState('all');
  const myWords = useLiveQuery(() => db.myWords.toArray(), []);
  const rows = useLiveQuery(() => db.wordState.toArray(), []);
  const states = useMemo(() => new Map((rows ?? []).map((r) => [r.key, r])), [rows]);
  const all = useMemo(() => mergeWords(Object.values(lessons), myWords ?? []), [lessons, myWords]);

  const scoped = all.filter((w) => {
    if (trackF !== 'all' && !w.mine && !w.sources.some((x) => x.track === trackF)) return false;
    if (day && !w.sources.some((x) => x.date === day)) return false;
    if (q) {
      const n = q.toLowerCase();
      if (!w.term.toLowerCase().includes(n) && !w.meaningKo.includes(q) && !w.synonyms.some((x) => x.toLowerCase().includes(n))) return false;
    }
    return true;
  }).sort((a, b) => b.createdAt - a.createdAt);

  const groups = useMemo(() => groupWords(scoped, groupBy, states, trackF, day), [scoped, groupBy, states, trackF, day]);
  const pick = (g: GroupBy) => { setGroupBy(g); setSel('all'); };
  const shownGroups = sel === 'all' ? groups : groups.filter((g) => g.id === sel);

  return (
    <>
      <AppHeader right={<TrackFilterSeg value={trackF} onChange={setTrackF} />} />
      <main className={s.page} data-testid="words-page">
        <h1 className={s.title}>단어 <span className={s.muted + ' ' + s.small}>{scoped.length}개</span></h1>
        <DatePick value={day} onChange={setDay} dates={Object.values(lessons).filter((l) => trackF === 'all' || l.track === trackF).map((l) => l.date)} />
        <input className={s.input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="단어·뜻 검색" aria-label="단어 검색" />
        <div style={{ marginTop: 8 }}>
          <GridTabs label="묶어 보기" value={groupBy} onChange={pick} options={GROUPS} testid="group" />
        </div>
        {groupBy !== 'none' && (
          <div className={s.chips} role="group" aria-label="묶음 고르기" style={{ marginTop: 6 }}>
            <button type="button" className={s.chip} aria-pressed={sel === 'all'} onClick={() => setSel('all')} data-testid="gsel-all">모두 {scoped.length}</button>
            {groups.map((g) => (
              <button key={g.id} type="button" className={s.chip} aria-pressed={sel === g.id} onClick={() => setSel(g.id)} data-testid={`gsel-${g.id}`}>{g.label} {g.words.length}</button>
            ))}
          </div>
        )}

        {scoped.length === 0 ? (
          <p className={s.empty}>{status === 'loading' ? '불러오는 중…' : '조건에 맞는 단어가 없어요.'}</p>
        ) : groupBy === 'none' ? (
          <ul className={s.list}>
            {scoped.map((w) => <WordRow key={w.key} item={w} state={states.get(w.key)} showSources />)}
          </ul>
        ) : (
          shownGroups.map((g) => (
            <section key={g.id} aria-label={g.label} data-testid="word-group">
              <h2 className={s.h2}>{g.label} <span className={s.muted + ' ' + s.small}>{g.words.length}</span></h2>
              <ul className={s.list}>
                {g.words.map((w) => <WordRow key={w.key} item={w} state={states.get(w.key)} showSources />)}
              </ul>
            </section>
          ))
        )}
      </main>
    </>
  );
}

function groupWords(words: WordItem[], by: GroupBy, states: Map<string, WordStateRow>, trackF: TrackFilter, day: string): Group[] {
  if (by === 'none') return [];
  const map = new Map<string, Group>();
  const add = (id: string, label: string, order: string, w: WordItem) => {
    const g = map.get(id) ?? { id, label, order, words: [] };
    if (!g.words.includes(w)) g.words.push(w);
    map.set(id, g);
  };
  for (const w of words) {
    // 같은 단어가 여러 지문에 나오면 각 묶음에 모두 넣는다(레벨·날짜·지문)
    const srcs = w.sources.filter((x) => (trackF === 'all' || x.track === trackF) && (!day || x.date === day));
    if (by === 'status') {
      const st = statusOf(states.get(w.key));
      add(st, STATUS_LABEL[st], String(STATUS_ORDER.indexOf(st)), w);
    } else if (by === 'pos') {
      const p = w.pos || '기타';
      add(`pos-${p}`, POS_KO[p] ?? p, POS_KO[p] ? String(Object.keys(POS_KO).indexOf(p)).padStart(2, '0') : '99', w);
    } else if (!srcs.length) {
      add('mine', '내 단어', 'zzz', w);
    } else {
      for (const x of srcs) {
        if (by === 'level') add(`L${x.level}`, `L${x.level}`, String(x.level), w);
        else if (by === 'date') add(x.date, formatKo(x.date), String(99999999 - Number(x.date.replace(/-/g, ''))), w);
        else add(x.lessonKey.replace(/[^\w-]/g, '_'), `${x.date.slice(5)} ${x.title}`, `${99999999 - Number(x.date.replace(/-/g, ''))}${x.title}`, w);
      }
    }
  }
  return [...map.values()].sort((a, b) => a.order.localeCompare(b.order));
}
