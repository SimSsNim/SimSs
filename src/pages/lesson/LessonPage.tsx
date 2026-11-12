import { useEffect } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import s from '../../styles/ui.module.css';
import { AppHeader } from '../../components/AppHeader';
import { useLessons } from '../../lib/lessons';
import { lessonKeyOf, type Lesson, type Track } from '../../lib/types';
import { tabsFor, defaultTab } from '../../lib/checklist';
import { QuizTab } from './QuizTab';
import { useQuizGate, type QuizGate } from '../../lib/quizGate';
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
import { backTarget } from '../../lib/backTarget';
import { LessonSteps } from '../../components/LessonSteps';
import { ScreenInk } from '../../components/ScreenInk';

export interface TabProps {
  lesson: Lesson;
  lessonKey: string;
  /** 토익: 풀이 전 가릴 문장 */
  gate?: QuizGate;
}

export function LessonRedirect() {
  const { track, id } = useParams();
  const [tab, setTab] = useState<string | null>(null);
  useEffect(() => {
    void getProgress(lessonKeyOf(track as Track, id!)).then((p) => setTab(p.lastTab && tabsFor(track as Track).some((t) => t.id === p.lastTab) ? p.lastTab : defaultTab(track as Track)));
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
  const gate = useQuizGate(lesson);
  const TABS = tabsFor(track);

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
    if (!tab || !tabsFor(track).some((t) => t.id === tab)) return;
    void updateProgress(key, { lastTab: tab });
    setSetting('lastLesson', { ...getSettings().lastLesson, [track]: { id: id!, tab } });
    window.scrollTo(0, 0);
  }, [key, tab, track, id]);

  if (!TABS.some((t) => t.id === tab)) return <Navigate to={`/${track}/lesson/${id}/${defaultTab(track)}`} replace />;

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
    const props = { lesson, lessonKey: key, gate };
    body = {
      quiz: <QuizTab {...props} />,
      full: <FullTextTab {...props} />,
      one: <OneByOneTab {...props} />,
      vocab: <VocabTab {...props} />,
      grammar: <GrammarTab {...props} />,
      structure: <StructureTab {...props} />,
      listen: <ListenTab {...props} />,
      practice: <PracticeTab {...props} />,
    }[tab!];
    // 실전 모드 풀이 중 / 연습 모드에서 아직 안 푼 문장이 있으면 다른 탭을 가린다(전체 문장·한 문장씩은 빈칸으로 보여 줌)
    const partial = tab === 'full' || tab === 'one';
    if (tab !== 'quiz' && (gate.gated || (!partial && gate.hidden.size > 0))) {
      body = (
        <div className={s.card} style={{ textAlign: 'center', padding: '40px 16px' }} data-testid="quiz-gate">
          <p style={{ fontWeight: 700 }}>문제를 먼저 풀어 보세요</p>
          <p className={s.small + ' ' + s.muted}>{gate.mode === 'exam' ? '실전 모드에서는 채점이 끝날 때까지 완성 문장과 번역을 가려요.' : '아직 안 푼 문제의 정답 문장이 들어 있어요.'}</p>
          <div className={s.row} style={{ justifyContent: 'center' }}>
            <button type="button" className={s.primary} onClick={() => nav(`/${track}/lesson/${id}/quiz`, { replace: true })}>문제 풀러 가기</button>
            <button type="button" className={s.btn} onClick={gate.reveal} data-testid="gate-reveal">그냥 보기</button>
          </div>
        </div>
      );
    }
  }

  return (
    <>
      <AppHeader track={track} target="stay" sticky={false}>
        <div className={s.row} style={{ flexWrap: 'nowrap', maxWidth: 760, margin: '6px auto 0' }}>
          <Link to={backTarget(track)} className={s.iconSm} aria-label="뒤로" style={{ flex: 'none' }}>‹</Link>
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
        {track === 'general' && <LessonSteps lessonKey={key} track={track} id={id!} tab={tab} />}
      </div>
      <main className={s.page}><div role="tabpanel" key={key} aria-label={TABS.find((t) => t.id === tab)?.label}>
        {lesson ? <ScreenInk key={`${key}:${tab}`} lesson={lesson} lessonKey={key} tab={tab!} tabLabel={TABS.find((t) => t.id === tab)?.label ?? ''}>{body}</ScreenInk> : body}
      </div></main>
    </>
  );
}
