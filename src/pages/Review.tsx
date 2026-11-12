import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import s from '../styles/ui.module.css';
import qz from '../styles/quiz.module.css';
import { DatePick } from '../components/DatePick';
import { AppHeader } from '../components/AppHeader';
import { WordbookPanel, TrackFilterSeg, LevelFilterChips, type TrackFilter, type LevelFilter } from './Wordbook';
import { useLessons } from '../lib/lessons';
import { useSettings } from '../lib/settings';
import { db, type QuestionStateRow } from '../lib/db';
import { isDue } from '../lib/leitner';
import { kstDate, formatKo } from '../lib/date';
import { isCorrect, reviewQuestion, shuffledChoices, recordQuestionResult, removeFromWrongNote, restoreWrongNote } from '../lib/quiz';
import { toast } from '../components/Toast';
import { blankedSentence } from '../lib/validateLesson';
import { CHAPTERS, CHAPTER_LABEL, lessonKeyOf, type ChoiceKey, type Lesson, type Question } from '../lib/types';
import { Choices, Passage, sentenceOf } from './lesson/QuizTab';
import { skillOf } from '../lib/stats';
import { FilterChipsGeneric } from '../components/FilterChipsGeneric';

/** 하단 탭 '복습': 단어장 | 오답노트 (같은 복습 엔진, 같은 화면 구성) */
export function Review() {
  const settings = useSettings();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'wrong' ? 'wrong' : 'words';
  const [trackF, setTrackF] = useState<TrackFilter>(settings.track);
  const [level, setLevel] = useState<LevelFilter>('all');
  const [day, setDay] = useState('');
  const { summaries } = useLessons();
  return (
    <>
      <AppHeader right={tab === 'words' ? <TrackFilterSeg value={trackF} onChange={setTrackF} /> : undefined} />
      <main className={s.page}>
        <div className={s.between} style={{ margin: '8px 0' }}>
          <h1 className={s.title} style={{ margin: 0 }}>복습</h1>
          <div className={s.seg} role="tablist" aria-label="복습 종류">
            <button type="button" role="tab" className={s.segBtn} aria-selected={tab === 'words'} onClick={() => setParams({ tab: 'words' }, { replace: true })} data-testid="review-words">단어장</button>
            <button type="button" role="tab" className={s.segBtn} aria-selected={tab === 'wrong'} onClick={() => setParams({ tab: 'wrong' }, { replace: true })} data-testid="review-wrong">오답노트</button>
          </div>
        </div>
        <DatePick value={day} onChange={setDay} dates={summaries.filter((x) => tab === 'words' || x.track === 'toeic').map((x) => x.date)} />
        {tab === 'words' ? (
          <>
            <LevelFilterChips value={level} onChange={setLevel} />
            <WordbookPanel trackF={trackF} level={level} day={day} />
          </>
        ) : <WrongNotePanel level={level} setLevel={setLevel} day={day} />}
      </main>
    </>
  );
}

export interface DrillItem { key: string; lesson: Lesson; q: Question; state?: QuestionStateRow }

function WrongNotePanel({ level, setLevel, day }: { level: LevelFilter; setLevel: (v: LevelFilter) => void; day: string }) {
  const [params] = useSearchParams();
  const { lessons, status } = useLessons();
  const rows = useLiveQuery(() => db.questionState.where('inWrongNote').equals(1).toArray(), []);
  const [onlyUnsure, setOnlyUnsure] = useState(false);
  const [view, setView] = useState<'list' | 'review'>(params.get('review') ? 'review' : 'list');
  const [chapter, setChapter] = useState<string>('all');
  const [skill, setSkill] = useState<string>('all');
  const [sort, setSort] = useState<'recent' | 'wrong'>('recent');
  const today = kstDate();
  const items: DrillItem[] = useMemo(() => {
    const out: DrillItem[] = [];
    for (const r of rows ?? []) {
      const lesson = lessons[r.lessonKey];
      const q = lesson?.questions.find((x) => x.id === r.qid);
      if (lesson && q) out.push({ key: r.key, lesson, q, state: r });
    }
    return out;
  }, [rows, lessons]);
  const filtered = items.filter((it) =>
    (level === 'all' || it.lesson.level === level) && (chapter === 'all' || it.lesson.chapter === chapter)
    && (skill === 'all' || skillOf(it.q) === skill) && (!day || it.lesson.date === day) && (!onlyUnsure || it.state!.unsure));
  const loading = rows === undefined || (rows.length > items.length && status === 'loading');
  const unsureCount = items.filter((it) => it.state!.unsure).length;
  const sorted = filtered.slice().sort((a, b) => (sort === 'wrong' ? b.state!.wrongCount - a.state!.wrongCount : b.state!.addedAt - a.state!.addedAt));
  const due = filtered.filter((it) => isDue(it.state!, today));
  const skills = [...new Set(items.map((it) => skillOf(it.q)))];
  // 칩 옆 개수: 레벨 칩은 Part 필터를, Part 칩은 레벨 필터를 반영
  const levelCounts: Record<string, number> = { all: 0 };
  const chapterCounts: Record<string, number> = { all: 0 };
  for (const it of items) {
    if (day && it.lesson.date !== day) continue;
    if (chapter === 'all' || it.lesson.chapter === chapter) {
      levelCounts.all++;
      levelCounts[it.lesson.level] = (levelCounts[it.lesson.level] ?? 0) + 1;
    }
    if (level === 'all' || it.lesson.level === level) {
      chapterCounts.all++;
      chapterCounts[it.lesson.chapter!] = (chapterCounts[it.lesson.chapter!] ?? 0) + 1;
    }
  }

  return (
    <div data-testid="wrong-note">
      <LevelFilterChips value={level} onChange={setLevel} counts={levelCounts} />
      <div className={s.seg} role="tablist" aria-label="보기">
        <button type="button" role="tab" className={s.segBtn} aria-selected={view === 'list'} onClick={() => setView('list')}>목록 {filtered.length}</button>
        <button type="button" role="tab" className={s.segBtn} aria-selected={view === 'review'} onClick={() => setView('review')} data-testid="wrong-review-btn">오늘 복습 {due.length}</button>
      </div>
      {view === 'review' ? (
        due.length ? <QuestionDrill items={due} title="오늘 복습할 오답" mode="wrongNote" />
          : <p className={s.empty}>오늘 복습할 오답이 없어요 🎉 틀린 문제는 다음 날부터 복습에 나와요.</p>
      ) : (
        <>
          <div className={s.chips} role="group" aria-label="오답 필터" style={{ marginTop: 8 }}>
            <FilterChipsGeneric value={chapter} onChange={setChapter} options={[['all', `모든 Part ${chapterCounts.all}`], ...CHAPTERS.map((c) => [c, `${CHAPTER_LABEL[c]} ${chapterCounts[c] ?? 0}`] as [string, string])]} />
            <select className={s.chip} value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="유형">
              <option value="all">모든 유형</option>
              {skills.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <select className={s.chip} value={sort} onChange={(e) => setSort(e.target.value as 'recent' | 'wrong')} aria-label="정렬">
              <option value="recent">최근</option><option value="wrong">많이 틀린 순</option>
            </select>
            <button type="button" className={s.chip} aria-pressed={onlyUnsure} onClick={() => setOnlyUnsure(!onlyUnsure)} data-testid="filter-unsure">🤔 헷갈림만 {unsureCount}</button>
          </div>
          <ul className={s.list}>
            {sorted.map((it) => <WrongRow key={it.key} it={it} />)}
            {sorted.length === 0 && <li className={s.empty}>{loading ? '불러오는 중…' : items.length ? '조건에 맞는 문제가 없어요.' : '오답노트가 비어 있어요. 틀린 문제와 "헷갈렸어요"를 누른 문제가 여기에 모여요.'}</li>}
          </ul>
        </>
      )}
    </div>
  );
}

function WrongRow({ it }: { it: DrillItem }) {
  const [retry, setRetry] = useState(false);
  const st = it.state!;
  return (
    <li className={s.card} data-testid="wrong-row">
      <div className={s.between}>
        <span className={s.small}>
          <span className={s.badgeAccent}>{CHAPTER_LABEL[it.lesson.chapter!]} {it.q.number}번</span> <span className={s.badge}>L{it.lesson.level}</span> <span className={s.badge}>{skillOf(it.q)}</span>
        </span>
        <span className={s.small + ' ' + s.muted}>틀림 {st.wrongCount} · {st.due ? `다음 복습 ${formatKo(st.due)}` : ''}</span>
      </div>
      {st.unsure && <span className={s.badgeAccent} style={{ alignSelf: 'flex-start' }}>🤔 헷갈림</span>}
      <QuestionContext lesson={it.lesson} q={it.q} />
      <div className={s.row}>
        <button type="button" className={s.btn} onClick={() => setRetry(!retry)}>{retry ? '접기' : '다시 풀기'}</button>
        <button type="button" className={s.btn} data-testid="wrong-delete" aria-label={`${CHAPTER_LABEL[it.lesson.chapter!]} ${it.q.number}번 오답노트에서 삭제`}
          onClick={async () => {
            const prev = await removeFromWrongNote(it.key);
            if (prev) toast('오답노트에서 뺐어요', { action: { label: '되돌리기', run: () => void restoreWrongNote(prev) }, ms: 6000 });
          }}>🗑 삭제</button>
        <Link className={s.ghost} to={`/toeic/lesson/${it.lesson.id}/quiz`}>{it.lesson.date} {it.lesson.title} ›</Link>
      </div>
      {retry && <QuestionDrill items={[it]} mode="wrongNote" compact />}
    </li>
  );
}

/** 문제 맥락: Part 5·6 빈칸 문장(정답 가림), Part 7 질문 */
export function QuestionContext({ lesson, q, showPassage = false }: { lesson: Lesson; q: Question; showPassage?: boolean }) {
  if (q.blank) {
    return (
      <>
        <p className={qz.qsentence} lang="en" data-testid="drill-sentence">{blankedSentence(sentenceOf(lesson, q.blank.sentenceId), q.blank.answerText)}</p>
        {lesson.chapter === 'part6' && showPassage && (
          <details><summary className={s.small} style={{ cursor: 'pointer' }}>지문 전체 보기(빈칸 [{q.number}] 자리)</summary>
            <p className={s.small + ' ' + s.muted} lang="en">{lesson.paragraphs.map((p) => p.sentences.map((x) => (x.id === q.blank!.sentenceId ? blankedSentence(x.en, q.blank!.answerText) : x.en)).join(' ')).join('\n\n')}</p>
          </details>
        )}
      </>
    );
  }
  return (
    <>
      {showPassage && (
        <details><summary className={s.small} style={{ cursor: 'pointer' }}>지문 보기</summary><Passage lesson={lesson} highlight={new Set()} /></details>
      )}
      <p className={qz.prompt} lang="en">{q.prompt}</p>
    </>
  );
}

/**
 * 문제 다시 풀기(보기 순서 섞음). mode='wrongNote' → 오답노트 일정(1일→3일→졸업), 'drill' → 약점 유형 연습(틀리면 오답노트에 추가)
 */
export function QuestionDrill({ items, title, mode, compact }: { items: DrillItem[]; title?: string; mode: 'wrongNote' | 'drill'; compact?: boolean }) {
  const [deck] = useState(items);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<ChoiceKey | null>(null);
  const [right, setRight] = useState(0);
  const [seed] = useState(() => Math.floor(Math.random() * 1e9) + 1);
  const it = deck[i];
  const order = useMemo(() => (it ? shuffledChoices(it.q, seed + i * 7919) : []), [it, seed, i]);
  if (!it) {
    return <div className={s.card} style={{ textAlign: 'center' }} data-testid="drill-done"><b>끝! {right}/{deck.length} 맞힘</b></div>;
  }
  const answer = async (k: ChoiceKey) => {
    if (picked) return;
    setPicked(k);
    const ok = isCorrect(it.q, k);
    if (ok) setRight((x) => x + 1);
    if (mode === 'wrongNote') await reviewQuestion(it.key, ok, k);
    else await recordQuestionResult(it.lesson, it.q, k);
  };
  return (
    <div className={compact ? '' : s.card} style={{ marginTop: 8 }} data-testid="drill">
      {title && <h2 className={s.h2} style={{ marginTop: 0 }}>{title} <span className={s.small + ' ' + s.muted}>{i + 1}/{deck.length}</span></h2>}
      {!compact && <div className={s.small + ' ' + s.muted}>{CHAPTER_LABEL[it.lesson.chapter!]} · L{it.lesson.level} · {skillOf(it.q)}</div>}
      {!compact && <QuestionContext lesson={it.lesson} q={it.q} showPassage />}
      <Choices q={it.q} order={order} selected={picked ?? undefined} reveal={!!picked} onSelect={(k) => void answer(k)} />
      {picked && (
        <div className={qz.feedback} role="status" data-testid="drill-feedback">
          <b style={{ color: isCorrect(it.q, picked) ? 'var(--ok)' : 'var(--danger)' }}>{isCorrect(it.q, picked) ? '○ 정답!' : '✕ 오답'}</b>
          <span lang="en"> — {it.q.choices.find((c) => c.key === it.q.answer)!.text}</span>
          <p style={{ margin: '6px 0' }}>{it.q.explanationKo}</p>
          {mode === 'wrongNote' && <p className={s.small + ' ' + s.muted} style={{ margin: 0 }}>간격을 두고 2번 연속 맞히면 오답노트에서 졸업해요(1일 → 3일).</p>}
          {i < deck.length && (deck.length > 1 || !compact) && (
            <button type="button" className={s.primary} style={{ marginTop: 8 }} onClick={() => { setI(i + 1); setPicked(null); }} data-testid="drill-next">{i < deck.length - 1 ? '다음 ›' : '끝내기'}</button>
          )}
        </div>
      )}
    </div>
  );
}

/** 약점 유형만 모아 풀기(지난 레슨 전체) */
export function Drill() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const skill = params.get('skill') ?? '';
  const { lessons } = useLessons();
  const items: DrillItem[] = useMemo(() => Object.values(lessons)
    .filter((l) => l.track === 'toeic')
    .flatMap((l) => l.questions.filter((q) => skillOf(q) === skill).map((q) => ({ key: `${lessonKeyOf(l.track, l.id)}:${q.id}`, lesson: l, q }))), [lessons, skill]);
  return (
    <>
      <AppHeader />
      <main className={s.page}>
        <div className={s.between}>
          <h1 className={s.title}>약점 유형: {skill}</h1>
          <button type="button" className={s.ghost} onClick={() => nav(-1)}>‹ 돌아가기</button>
        </div>
        {items.length ? <QuestionDrill key={skill} items={items} title={`${items.length}문제`} mode="drill" /> : <p className={s.empty}>이 유형 문제가 없어요.</p>}
      </main>
    </>
  );
}
