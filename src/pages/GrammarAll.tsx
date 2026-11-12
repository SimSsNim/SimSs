import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import s from '../styles/ui.module.css';
import { DatePick } from '../components/DatePick';
import { AppHeader } from '../components/AppHeader';
import { useLessons } from '../lib/lessons';
import { db } from '../lib/db';
import { GrammarCard, ExamplesToggleAll } from '../components/GrammarCard';
import { useSettings } from '../lib/settings';
import { lessonKeyOf } from '../lib/types';
import { TrackFilterSeg, LevelFilterChips, type TrackFilter, type LevelFilter } from './Wordbook';

export function GrammarAll() {
  const settings = useSettings();
  const { lessons } = useLessons();
  const [trackF, setTrackF] = useState<TrackFilter>(settings.track);
  const [levelF, setLevelF] = useState<LevelFilter>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [day, setDay] = useState('');
  const states = useLiveQuery(() => db.grammarState.toArray(), []);
  const stMap = new Map((states ?? []).map((x) => [x.key, x]));
  const points = useMemo(() => Object.values(lessons)
    .filter((l) => (trackF === 'all' || l.track === trackF) && (levelF === 'all' || l.level === levelF) && (!day || l.date === day))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .flatMap((l) => l.grammar.map((g) => ({ l, g, lk: lessonKeyOf(l.track, l.id) }))), [lessons, trackF, levelF, day]);
  const tags = new Map<string, number>();
  for (const p of points) for (const t of p.g.tags) tags.set(t, (tags.get(t) ?? 0) + 1);
  const shown = points.filter((p) => (!tag || p.g.tags.includes(tag)) && (!reviewOnly || stMap.get(`${p.lk}:${p.g.id}`)?.review));
  return (
    <>
      <AppHeader right={<TrackFilterSeg value={trackF} onChange={setTrackF} />} />
      <main className={s.page}>
        <h1 className={s.title}>문법 모음 <span className={s.muted + ' ' + s.small}>{points.length}개</span></h1>
        <DatePick value={day} onChange={setDay} dates={Object.values(lessons).filter((l) => trackF === 'all' || l.track === trackF).map((l) => l.date)} />
        <LevelFilterChips value={levelF} onChange={setLevelF} />
        <div className={s.chips} role="group" aria-label="태그">
          <button type="button" className={s.chip} aria-pressed={tag === null} onClick={() => setTag(null)}>전체 {points.length}</button>
          {[...tags.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => (
            <button key={t} type="button" className={s.chip} aria-pressed={tag === t} onClick={() => setTag(t)}>#{t} {n}</button>
          ))}
        </div>
        <label className={s.check}><input type="checkbox" checked={reviewOnly} onChange={(e) => setReviewOnly(e.target.checked)} />"다시 볼래요"만 보기</label>
        <ExamplesToggleAll />
        <ul className={s.list}>
          {shown.map((p) => <GrammarCard key={`${p.lk}:${p.g.id}`} lesson={p.l} g={p.g} lessonKey={p.lk} state={stMap.get(`${p.lk}:${p.g.id}`)} showLesson />)}
          {shown.length === 0 && <li className={s.empty}>문법 포인트가 없어요.</li>}
        </ul>
      </main>
    </>
  );
}
