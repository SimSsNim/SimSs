import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import s from '../styles/ui.module.css';
import { DatePick } from '../components/DatePick';
import { AppHeader } from '../components/AppHeader';
import { useLessons, markTrackSeen, groupByDate, type LessonSummary } from '../lib/lessons';
import { LEVELS, CHAPTERS, CHAPTER_LABEL, type Chapter, type Level, type Track } from '../lib/types';
import { db } from '../lib/db';
import { formatKo } from '../lib/date';
import { LevelBadge } from './Home';
import { useMyLevel } from '../components/LevelChips';

export function LessonList() {
  const { track: tp } = useParams();
  const track = tp as Track;
  const my = useMyLevel(track);
  const { summaries, lessons, status } = useLessons();
  const [q, setQ] = useState('');
  const [level, setLevel] = useState<Level | 'all'>(my);
  const [chapter, setChapter] = useState<Chapter | 'all'>('all');
  const [genre, setGenre] = useState<string>('all');
  const [done, setDone] = useState<'all' | 'done' | 'todo'>('all');
  const [bm, setBm] = useState(false);
  const [view, setView] = useState<'list' | 'date'>('list');
  const [day, setDay] = useState('');
  useEffect(() => setLevel(my), [my, track]);
  useEffect(() => setChapter('all'), [track]);
  const progress = useLiveQuery(() => db.lessonProgress.where('key').startsWith(`${track}/`).toArray(), [track]);
  const attempts = useLiveQuery(() => db.quizAttempt.where('track').equals(track).toArray(), [track]);
  const marks = useLiveQuery(() => db.sentenceMarks.where('lessonKey').startsWith(`${track}/`).toArray(), [track]);

  useEffect(() => {
    if (status !== 'loading') markTrackSeen(track);
  }, [track, status, summaries.length]);

  const list = summaries.filter((x) => x.track === track);
  const genres = [...new Map(list.filter((x) => x.genre).map((x) => [x.genre, x.genreKo])).entries()];
  const doneSet = new Set([
    ...(progress ?? []).filter((p) => p.completedAt).map((p) => p.key),
    ...(attempts ?? []).filter((a) => a.inProgress === 0).map((a) => a.lessonKey),
  ]);
  const bmSet = new Set((marks ?? []).filter((m) => m.bookmark).map((m) => m.lessonKey));

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list.filter((x) => {
      if (view === 'list' && level !== 'all' && x.level !== level) return false;
      if (view === 'list' && track === 'toeic' && chapter !== 'all' && x.chapter !== chapter) return false;
      if (day && x.date !== day) return false;
      if (genre !== 'all' && x.genre !== genre) return false;
      if (done === 'done' && !doneSet.has(x.key)) return false;
      if (done === 'todo' && doneSet.has(x.key)) return false;
      if (bm && !bmSet.has(x.key)) return false;
      if (needle) {
        const l = lessons[x.key];
        const hay = [x.title, x.titleKo, ...(l ? l.paragraphs.flatMap((p) => [p.en, p.ko]) : []), ...(l ? l.vocab.flatMap((v) => [v.term, v.meaningKo]) : [])].join('\n').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [list, lessons, q, level, chapter, genre, done, bm, doneSet, bmSet, view, track, day]);

  return (
    <>
      <AppHeader track={track} target="list" levels />
      <main className={s.page}>
        <div className={s.between}>
          <h1 className={s.title}>지문 목록</h1>
          <div className={s.seg} role="group" aria-label="보기 방식">
            <button type="button" className={s.segBtn} aria-pressed={view === 'list'} onClick={() => setView('list')}>목록</button>
            <button type="button" className={s.segBtn} aria-pressed={view === 'date'} onClick={() => setView('date')} data-testid="view-date">날짜별</button>
          </div>
        </div>
        <DatePick value={day} onChange={setDay} dates={list.map((x) => x.date)} />
        <input className={s.input} type="search" placeholder="제목·본문·번역·단어 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="지문 검색" />
        <div className={s.chips} role="group" aria-label="필터">
          {view === 'list' && (
            <>
              <button type="button" className={s.chip} aria-pressed={level === 'all'} onClick={() => setLevel('all')} data-testid="list-level-all">전체 레벨</button>
              {LEVELS.map((lv) => (
                <button key={lv} type="button" className={s.chip} aria-pressed={level === lv} onClick={() => setLevel(lv)}>L{lv}{lv === my ? ' (내 레벨)' : ''}</button>
              ))}
              {track === 'toeic' && (
                <select className={s.chip} value={chapter} onChange={(e) => setChapter(e.target.value as Chapter | 'all')} aria-label="Part">
                  <option value="all">모든 Part</option>
                  {CHAPTERS.map((c) => <option key={c} value={c}>{CHAPTER_LABEL[c]}</option>)}
                </select>
              )}
            </>
          )}
          <select className={s.chip} value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="장르">
            <option value="all">모든 장르</option>
            {genres.map(([g, ko]) => <option key={g} value={g}>{ko}</option>)}
          </select>
          <select className={s.chip} value={done} onChange={(e) => setDone(e.target.value as typeof done)} aria-label="완료 여부">
            <option value="all">완료/미완료</option>
            <option value="done">완료</option>
            <option value="todo">미완료</option>
          </select>
          <button type="button" className={s.chip} aria-pressed={bm} onClick={() => setBm(!bm)}>북마크 있음</button>
        </div>
        {filtered.length === 0 ? (
          <p className={s.empty}>{list.length === 0 ? (status === 'loading' ? '불러오는 중…' : '아직 지문이 없어요.') : '조건에 맞는 지문이 없어요.'}</p>
        ) : view === 'date' ? (
          <ul className={s.list} data-testid="date-view">
            {groupByDate(filtered).map((g) => (
              <li key={g.date} className={s.card}>
                <b>{formatKo(g.date)}</b>
                {LEVELS.map((lv) => {
                  const items = g.lessons.filter((x) => x.level === lv);
                  return (
                    <div key={lv} className={s.row} style={{ marginTop: 6, flexWrap: 'nowrap' }}>
                      <span className={lv === my ? s.badgeAccent : s.badge} style={{ minWidth: 36 }}>L{lv}</span>
                      {items.length === 0 ? <span className={s.small + ' ' + s.muted}>아직 없음</span> : (
                        <div className={s.row} style={{ gap: 6 }}>
                          {items.map((x) => (
                            <Link key={x.key} to={`/${track}/lesson/${x.id}`} className={s.chip} style={{ minHeight: 36 }}>
                              {x.chapter ? CHAPTER_LABEL[x.chapter] : x.title}{doneSet.has(x.key) ? ' ✓' : ''}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </li>
            ))}
          </ul>
        ) : (
          <ul className={s.list} data-testid="lesson-list">
            {filtered.map((x, i) => {
              const older = filtered[i + 1];
              const levelStart = level === 'all' ? false : !!older && older.level < x.level;
              return (
                <Fragment key={x.key}>
                  <li><LessonItem x={x} done={doneSet.has(x.key)} bookmarked={bmSet.has(x.key)} /></li>
                  {levelStart && <li className={s.divider} aria-label={`레벨 ${x.level} 시작`}>레벨 {x.level} 시작!</li>}
                </Fragment>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}

function LessonItem({ x, done, bookmarked }: { x: LessonSummary; done: boolean; bookmarked: boolean }) {
  if (x.errors) {
    return (
      <div className={s.card}>
        <div className={s.row}><span className={s.badgeDanger}>오류</span><b>{x.title}</b><span className={s.muted}>{x.id}</span></div>
        <details><summary className={s.small}>오류 {x.errors.length}개 보기</summary>
          <ul className={s.small}>{x.errors.map((e, k) => <li key={k} style={{ whiteSpace: 'pre-wrap' }}>{e}</li>)}</ul>
        </details>
      </div>
    );
  }
  return (
    <Link to={`/${x.track}/lesson/${x.id}`} className={s.cardLink} data-testid="lesson-item">
      <div className={s.between}>
        <span className={s.small + ' ' + s.muted}>{formatKo(x.date)}</span>
        {done && <span className={s.badgeOk}>✓ 완료</span>}
      </div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 19, fontWeight: 700 }}>{x.title}</div>
      <div className={s.muted}>{x.titleKo}</div>
      <div className={s.row} style={{ marginTop: 6 }}>
        <LevelBadge level={x.level} />
        {x.chapter && <span className={s.badgeAccent}>{CHAPTER_LABEL[x.chapter]} · {x.questionCount}문제</span>}
        {x.genreKo && <span className={s.badge}>{x.genreKo}</span>}
        <span className={s.badge}>{x.wordCount}단어</span>
        <span className={s.badge} aria-label={x.hasAudio ? '원음 있음' : 'TTS'}>{x.hasAudio ? '🔊' : '🗣 TTS'}</span>
        {x.track === 'toeic' && <span className={s.badge}>AI 작성 연습 지문</span>}
        {x.source === 'import' && <span className={s.badge}>가져옴</span>}
        {bookmarked && <span className={s.badge}>🔖</span>}
      </div>
    </Link>
  );
}
