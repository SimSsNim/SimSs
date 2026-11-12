import { useEffect } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import s from '../../styles/ui.module.css';
import { AppHeader } from '../../components/AppHeader';
import { useLessons } from '../../lib/lessons';
import { lessonKeyOf, type Lesson, type Track } from '../../lib/types';
import { TABS } from '../../lib/checklist';
import { db } from '../../lib/db';
import { getProgress, updateProgress, setActiveLesson, logAction } from '../../lib/progress';
import { getSettings, setSetting } from '../../lib/settings';
import { loadLesson, setSegments, buildSegments } from '../../store/player';
import { FullTextTab } from './FullTextTab';
import { OneByOneTab } from './OneByOneTab';
import { VocabTab } from './VocabTab';
import { GrammarTab } from './GrammarTab';
import { StructureTab } from './StructureTab';
import { ListenTab } from './ListenTab';
import { PracticeTab } from './PracticeTab';
import { useState } from 'react';

export interface TabProps {
  lesson: Lesson;
  lessonKey: string;
}

export function LessonRedirect() {
  const { track, id } = useParams();
  const [tab, setTab] = useState<string | null>(null);
  useEffect(() => {
    void getProgress(lessonKeyOf(track as Track, id!)).then((p) => setTab(p.lastTab && TABS.some((t) => t.id === p.lastTab) ? p.lastTab : 'full'));
  }, [track, id]);
  if (!tab) return null;
  return <Navigate to={`/${track}/lesson/${id}/${tab}`} replace />;
}

export function LessonPage() {
  const { track: tp, id, tab } = useParams();
  const track = tp as Track;
  const nav = useNavigate();
  const key = lessonKeyOf(track, id!);
  const { lessons, summaries, status } = useLessons();
  const lesson = lessons[key];
  const summary = summaries.find((x) => x.key === key);
  const marks = useLiveQuery(() => db.audioMarks.get(key), [key]);

  useEffect(() => {
    if (!lesson) return;
    void loadLesson(lesson);
    setActiveLesson(key);
    void logAction('open', key);
    void db.lessonProgress.get(key).then((p) => {
      if (!p?.openedAt) void updateProgress(key, { openedAt: Date.now() });
    });
    return () => setActiveLesson(undefined);
  }, [lesson, key]);

  useEffect(() => {
    if (!lesson) return;
    setSegments(buildSegments(lesson, marks?.sentenceStarts), marks?.introSkipSec ?? null);
  }, [lesson, marks]);

  useEffect(() => {
    if (!tab || !TABS.some((t) => t.id === tab)) return;
    void updateProgress(key, { lastTab: tab });
    setSetting('lastLesson', { ...getSettings().lastLesson, [track]: { id: id!, tab } });
    window.scrollTo(0, 0);
  }, [key, tab, track, id]);

  if (!TABS.some((t) => t.id === tab)) return <Navigate to={`/${track}/lesson/${id}/full`} replace />;

  let body;
  if (!lesson) {
    body = summary?.errors ? (
      <div className={s.card}>
        <span className={s.badgeDanger}>오류</span>
        <p>이 레슨 파일에 문제가 있어 열 수 없어요.</p>
        <ul className={s.small}>{summary.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
      </div>
    ) : (
      <p className={s.empty}>{status === 'loading' || summary ? '레슨을 불러오는 중…' : '레슨을 찾을 수 없어요.'}</p>
    );
  } else {
    const props = { lesson, lessonKey: key };
    body = {
      full: <FullTextTab {...props} />,
      one: <OneByOneTab {...props} />,
      vocab: <VocabTab {...props} />,
      grammar: <GrammarTab {...props} />,
      structure: <StructureTab {...props} />,
      listen: <ListenTab {...props} />,
      practice: <PracticeTab {...props} />,
    }[tab!];
  }

  return (
    <>
      <AppHeader track={track} target="stay" sticky={false}>
        <div className={s.row} style={{ flexWrap: 'nowrap', maxWidth: 760, margin: '6px auto 0' }}>
          <Link to={`/${track}/list`} className={s.iconBtn} aria-label="지문 목록으로" style={{ flex: 'none' }}>‹</Link>
          <div className={s.grow}>
            <div style={{ fontFamily: 'var(--serif)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} data-testid="lesson-title">
              {lesson?.title ?? summary?.title ?? id}
            </div>
            <div className={s.small + ' ' + s.muted} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {lesson?.titleKo} {lesson && `· 레벨 ${lesson.level}`} {track === 'toeic' && '· AI 작성 연습 지문'}
            </div>
          </div>
        </div>
      </AppHeader>
      <div className={s.stickyTabs}>
        <nav className={s.chips} aria-label="레슨 탭" role="tablist" style={{ maxWidth: 760, margin: '0 auto' }}>
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" className={s.chip} aria-selected={t.id === tab} data-testid={`tab-${t.id}`}
              onClick={() => nav(`/${track}/lesson/${id}/${t.id}`, { replace: true })}>
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      <main className={s.page}><div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>{body}</div></main>
    </>
  );
}
