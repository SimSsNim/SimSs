import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DatePick } from '../components/DatePick';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import s from '../styles/ui.module.css';
import { AppHeader } from '../components/AppHeader';
import { useLessons, markTrackSeen, pickToday, type LessonSummary } from '../lib/lessons';
import { TRACKS, TRACK_LABEL, CHAPTER_LABEL, CHAPTER_COUNT, type Level, type Track } from '../lib/types';
import { db, CHECKLIST_KEYS, emptyChecklist, type QuizAttemptRow } from '../lib/db';
import { CHECKLIST } from '../lib/checklist';
import { kstDate, addDays, weekdayOf, formatKo, diffDays } from '../lib/date';
import { setChecklist, computeStreak, isStudyDay } from '../lib/progress';
import { isDue } from '../lib/leitner';
import { useSettings, setSetting } from '../lib/settings';
import { setMyLevel, useMyLevel, myLevel, isNewsView } from '../components/LevelChips';
import { firstAttempts } from '../lib/quiz';
import { toast } from '../components/Toast';
import { mmss } from './lesson/practice/Transcribe';

export function LevelBadge({ level }: { level: number | null }) {
  if (!level) return null;
  return <span className={s.badgeAccent}>L{level}</span>;
}

export function attemptStatus(rows: QuizAttemptRow[] | undefined, total: number) {
  const list = (rows ?? []).slice().sort((a, b) => a.attemptNo - b.attemptNo);
  const first = list.find((a) => a.inProgress === 0);
  const open = list.find((a) => a.inProgress === 1);
  if (first) return { kind: 'done' as const, text: `완료 ${first.score}/${first.total}`, sec: first.durationSec };
  if (open) {
    const n = open.mode === 'practice' ? open.checked.length : Object.keys(open.answers).length;
    return { kind: 'doing' as const, text: `푸는 중 ${n}/${total}`, sec: null };
  }
  return { kind: 'todo' as const, text: '안 풂', sec: null };
}

export function Home({ all = false }: { all?: boolean }) {
  const { track: tp } = useParams();
  const { summaries, status } = useLessons();
  const settings = useSettings();
  const track = (all ? settings.track : tp) as Track;
  // 전체 보기: 우선순위 트랙을 먼저
  const order: Track[] = settings.startTrack === 'general' || settings.startTrack === 'toeic' ? [settings.startTrack, ...TRACKS.filter((x) => x !== settings.startTrack)] : [...TRACKS];
  const today = kstDate();
  const [params, setParams] = useSearchParams();
  const day = params.get('d') || today;
  const setDay = (d: string) => setParams(d && d !== today ? { d } : {}, { replace: true });
  const lessonDates = summaries.filter((x) => (all || x.track === track) && !x.errors).map((x) => x.date);
  const news = isNewsView(settings, 'general');
  const picks = Object.fromEntries(TRACKS.map((t) => [t, pickToday(summaries, t, myLevel(t), day, t === 'general' && news)])) as Record<Track, ReturnType<typeof pickToday>>;
  const what = (t: Track) => (t === 'general' && news ? '뉴스' : `L${myLevel(t)}`);
  const toeicKeys = picks.toeic.lessons.map((l) => l.key);
  const allKeys = [...picks.general.lessons.map((l) => l.key), ...toeicKeys];
  const progress = useLiveQuery(() => db.lessonProgress.bulkGet(allKeys), [allKeys.join(',')]);
  const attempts = useLiveQuery(() => db.quizAttempt.where('lessonKey').anyOf(toeicKeys.length ? toeicKeys : ['-']).toArray(), [toeicKeys.join(',')]);
  const daily = useLiveQuery(() => db.dailyLog.toArray(), []);
  const dueWords = useLiveQuery(() => db.wordState.where('due').belowOrEqual(today).toArray(), [today]);
  const dueWrong = useLiveQuery(() => db.questionState.where('inWrongNote').equals(1).toArray(), []);

  useEffect(() => {
    if (status !== 'loading') (all ? TRACKS : [track]).forEach(markTrackSeen);
  }, [track, all, status, summaries.length]);

  useEffect(() => {
    const since = Math.max(settings.lastBackupAt ?? 0, settings.backupReminderShownAt ?? 0);
    if (since && Date.now() - since > 14 * 86400000) {
      setSetting('backupReminderShownAt', Date.now());
      toast('마지막 백업 후 14일이 지났어요. 기록/설정 → 백업에서 내보내 주세요.', { sticky: true });
    }
  }, [settings.lastBackupAt, settings.backupReminderShownAt]);

  const days = new Set((daily ?? []).filter(isStudyDay).map((d) => d.date));
  const streak = computeStreak(days, today);
  const wd = weekdayOf(today);
  const monday = addDays(today, -((wd + 6) % 7));
  let weekDays = 0;
  for (let i = 0; i < 7; i++) if (days.has(addDays(monday, i))) weekDays++;
  const due = (dueWords ?? []).filter((w) => isDue(w, today)).length;
  const wrongDue = (dueWrong ?? []).filter((w) => isDue(w, today)).length;
  const todayLog = (daily ?? []).find((d) => d.date === today);
  const todayMin = Math.round((todayLog?.seconds ?? 0) / 60);
  const progOf = (key?: string) => progress?.find((p) => p?.key === key);

  const summaryLine = (t: Track) => {
    const p = picks[t];
    const lv = what(t);
    if (!p.lessons.length) return `${TRACK_LABEL[t]} ${lv}: 지문 없음`;
    if (t === 'general') {
      if (p.lessons.length > 1) {
        const doneN = p.lessons.filter((l) => CHECKLIST_KEYS.every((k) => progOf(l.key)?.checklist[k])).length;
        return `${TRACK_LABEL[t]} ${lv}: ${p.lessons.length}편 중 ${doneN}편 완료`;
      }
      const pr = progOf(p.lessons[0].key);
      const done = pr ? CHECKLIST_KEYS.filter((k) => pr.checklist[k]).length : 0;
      return `${TRACK_LABEL[t]} ${lv}: 「${p.lessons[0].title}」 ${done === 6 ? '✓완료' : `${done}/6 단계`}`;
    }
    const parts = p.lessons.map((l) => {
      const st = attemptStatus(attempts?.filter((a) => a.lessonKey === l.key), l.questionCount);
      return `${CHAPTER_LABEL[l.chapter!].replace('Part ', 'P')} ${st.kind === 'done' ? st.text.replace('완료 ', '') : st.kind === 'doing' ? '…' : '–'}`;
    });
    return `${TRACK_LABEL[t]} ${lv}: ${parts.join(' · ')}`;
  };

  const trackContent = (t: Track) => {
    const p = picks[t];
    const lv = myLevel(t);
    const isNews = what(t) === '뉴스';
    if (!p.lessons.length) {
      return (
        <div className={s.card}>
          <p className={s.empty} data-testid="no-lesson">{status === 'loading' ? '지문을 불러오는 중…' : `${isNews ? '뉴스가' : `레벨 ${lv} 지문이`} 아직 없어요. 레슨 파일이 추가되면 여기에 나와요. (기록/설정 → 레슨 가져오기도 가능)`}</p>
        </div>
      );
    }
    return (
      <>
        {!p.isToday && <p className={s.muted} role="note" data-testid="not-arrived">{day === today ? '오늘 지문은 아직 도착하지 않았어요.' : `${formatKo(day)} ${isNews ? '뉴스가' : `레벨 ${lv} 지문이`} 없어요.`} 가장 가까운 이전({formatKo(p.date!)}) {isNews ? '뉴스' : `레벨 ${lv} 지문`}를 보여 드려요.</p>}
        {t === 'general' ? (
          <StoryPicker key={`${p.date}|${what(t)}`} lessons={p.lessons} checklistOf={(k) => progOf(k)?.checklist ?? emptyChecklist()} />
        ) : (
          <ToeicToday lessons={p.lessons} attempts={attempts ?? []} />
        )}
      </>
    );
  };

  return (
    <>
      <AppHeader track={all ? 'all' : track} levels={!all} />
      <main className={s.page}>
        {!all && <section aria-label="두 트랙 요약" className={s.stack} style={{ marginTop: 8, gap: 4 }}>
          {TRACKS.map((t) => (
            <Link key={t} to={`/${t}`} onClick={() => setSetting('track', t)} className={s.small}
              style={{ color: 'inherit', textDecoration: 'none', fontWeight: t === track ? 700 : 400, display: 'block', minHeight: 28, paddingTop: 4 }} data-testid={`summary-${t}`}>
              {summaryLine(t)}
            </Link>
          ))}
        </section>}

        <DatePick value={day} onChange={setDay} dates={[...lessonDates, today]} allowAll={false} todayBtn label="날짜 고르기" />
        <h1 className={s.title}>{formatKo(day)} · {all ? '전체' : `${TRACK_LABEL[track]} ${what(track)}`}</h1>
        {(all || track === 'toeic') && <LevelTip />}

        {all ? order.map((t) => (
          <section key={t} aria-label={TRACK_LABEL[t]} data-testid={`all-${t}`} style={{ marginBottom: 16 }}>
            <h2 className={s.h2}>
              <Link to={`/${t}`} onClick={() => { setSetting('track', t); setSetting('homeAll', false); }} style={{ color: 'inherit', textDecoration: 'none' }}>
                {TRACK_LABEL[t]} {what(t)} ›
              </Link>
            </h2>
            {trackContent(t)}
          </section>
        )) : trackContent(track)}

        <h2 className={s.h2}>기록</h2>
        <div className={s.card} style={{ padding: 10, marginBottom: 8 }} aria-label="하루 목표">
          <div className={s.between + ' ' + s.small}>
            <span>오늘 {todayMin}분 / 목표 {settings.dailyGoalMinutes}분</span>
            <span>레슨 {todayLog?.lessonsTouched.length ?? 0} / {settings.dailyGoalLessons}개</span>
          </div>
          <div className={s.progressBar} style={{ marginTop: 6 }}><span style={{ width: `${Math.min(100, (todayMin / settings.dailyGoalMinutes) * 100)}%` }} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          <Stat label="연속 학습" value={`${streak}일`} />
          <Stat label="이번 주" value={`${weekDays}/7일`} />
          <Link to="/review?tab=words&review=1" style={{ textDecoration: 'none', color: 'inherit' }}><Stat label="오늘 복습 단어" value={`${due}개`} /></Link>
          <Link to="/review?tab=wrong&review=1" style={{ textDecoration: 'none', color: 'inherit' }} data-testid="home-wrong-due"><Stat label="오늘 복습 오답" value={`${wrongDue}개`} /></Link>
        </div>
      </main>
    </>
  );
}

/** 같은 날 이야기가 여러 편이면 위에 고르는 칩 */
function StoryPicker({ lessons, checklistOf }: { lessons: LessonSummary[]; checklistOf: (key: string) => Record<string, boolean> }) {
  const [i, setI] = useState(0);
  const cur = lessons[Math.min(i, lessons.length - 1)];
  return (
    <>
      {lessons.length > 1 && (
        <div className={s.chips} role="group" aria-label="오늘의 이야기" style={{ marginBottom: 8 }}>
          {lessons.map((l, k) => {
            const done = CHECKLIST_KEYS.every((c) => checklistOf(l.key)[c]);
            return (
              <button key={l.key} type="button" className={s.chip} aria-pressed={l.key === cur.key} onClick={() => setI(k)} data-testid={`story-${k + 1}`}>
                {done ? '✓ ' : ''}{l.genre === 'news' ? `뉴스 ${k + 1}` : `이야기 ${k + 1}`}
              </button>
            );
          })}
        </div>
      )}
      <GeneralToday lesson={cur} checklist={checklistOf(cur.key)} />
    </>
  );
}

function GeneralToday({ lesson, checklist }: { lesson: LessonSummary; checklist: Record<string, boolean> }) {
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  useEffect(() => setOptimistic({}), [checklist, lesson.key]);
  const list = { ...checklist, ...optimistic };
  return (
    <>
      <Link to={`/general/lesson/${lesson.id}`} className={s.cardLink} data-testid="today-card">
        <div className={s.row} style={{ marginBottom: 6 }}>
          <LevelBadge level={lesson.level} />
          <span className={s.badge}>{lesson.genreKo}</span>
          <span className={s.badge}>{lesson.wordCount}단어</span>
          <span className={s.badge}>{lesson.hasAudio ? '🔊 원음' : '🗣 TTS'}</span>
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700 }}>{lesson.title}</div>
        <div className={s.muted}>{lesson.titleKo} · {formatKo(lesson.date)}</div>
      </Link>
      <h2 className={s.h2}>오늘의 학습 순서</h2>
      <ol className={s.list}>
        {CHECKLIST.map((c, i) => (
          <li key={c.key} className={s.card} style={{ padding: '6px 12px' }}>
            <div className={s.between}>
              <label className={s.check} title={c.hint}>
                <input type="checkbox" checked={!!list[c.key]} data-testid={`check-${c.key}`}
                  onChange={(e) => {
                    setOptimistic({ ...optimistic, [c.key]: e.target.checked });
                    void setChecklist(lesson.key, c.key, e.target.checked);
                  }} />
                <span>{'①②③④⑤⑥'[i]} {c.label}</span>
              </label>
              <Link className={s.ghost} to={`/general/lesson/${lesson.id}/${c.tab}`}>하기 ›</Link>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

function ToeicToday({ lessons, attempts }: { lessons: LessonSummary[]; attempts: QuizAttemptRow[] }) {
  const st = useSettings();
  const nav = useNavigate();
  const ordered = lessons.slice().sort((a, b) => (a.chapter! < b.chapter! ? -1 : 1));
  const first = ordered[0];
  return (
    <>
      <ul className={s.list} data-testid="part-cards">
        {ordered.map((l) => {
          const status = attemptStatus(attempts.filter((a) => a.lessonKey === l.key), l.questionCount);
          return (
            <li key={l.key}>
              <Link to={`/toeic/lesson/${l.id}/quiz`} className={s.cardLink} data-testid={`part-card-${l.chapter}`} onClick={() => setSetting('toeicChapter', l.chapter!)}
                style={st.toeicChapter === l.chapter ? { borderColor: 'var(--accent)', borderWidth: 2 } : undefined}>
                <div className={s.between}>
                  <b>{CHAPTER_LABEL[l.chapter!]} · {CHAPTER_COUNT[l.chapter!]}문제</b>
                  <span className={status.kind === 'done' ? s.badgeOk : status.kind === 'doing' ? s.badgeAccent : s.badge} data-testid={`part-status-${l.chapter}`}>{status.text}</span>
                </div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 700, marginTop: 4 }}>{l.title}</div>
                <div className={s.small + ' ' + s.muted}>
                  {l.titleKo} · {l.genreKo} · {l.wordCount}단어{status.sec !== null ? ` · ${mmss(status.sec)} 걸림` : ''}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className={s.small + ' ' + s.muted}>AI 작성 토익 스타일 연습 문제 · 실제 시험 문제가 아닙니다.</p>
      {first && (
        <button type="button" className={s.primary + ' ' + s.big + ' ' + s.full} data-testid="solve-all"
          onClick={() => nav(`/toeic/lesson/${first.id}/quiz?set=${ordered.map((l) => l.id).join(',')}`)}>
          ▶ 오늘 세트 전부 풀기 (Part 5 → 6 → 7)
        </button>
      )}
    </>
  );
}

/** 레벨 추천(제안만): 최근 5개 토익 레슨 첫 시도 정답률 */
function LevelTip() {
  const level = useMyLevel('toeic');
  const today = kstDate();
  const attempts = useLiveQuery(() => db.quizAttempt.where('track').equals('toeic').toArray(), []);
  const dismissed = useLiveQuery(() => db.dismissedTips.get('levelTip:toeic'), []);
  if (!attempts) return null;
  if (dismissed && diffDays(today, dismissed.date) < 7) return null;
  const firsts = firstAttempts(attempts.filter((a) => a.level === level)).sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)).slice(0, 5);
  if (firsts.length < 3) return null;
  const rate = firsts.reduce((x, a) => x + a.score, 0) / Math.max(1, firsts.reduce((x, a) => x + a.total, 0));
  let target: Level | null = null;
  let text = '';
  if (rate >= 0.9 && level < 4) {
    target = (level + 1) as Level;
    text = `최근 ${firsts.length}개 레슨 정답률 ${Math.round(rate * 100)}%! L${target}에 도전해 볼까요?`;
  } else if (rate < 0.5 && level > 1) {
    target = (level - 1) as Level;
    text = `최근 ${firsts.length}개 레슨 정답률 ${Math.round(rate * 100)}%. L${target}로 복습해 볼까요?`;
  }
  if (!target) return null;
  const close = () => void db.dismissedTips.put({ key: 'levelTip:toeic', date: today });
  return (
    <div className={s.card} role="status" data-testid="level-tip" style={{ marginBottom: 12, borderColor: 'var(--accent)' }}>
      <p style={{ margin: '0 0 8px' }}>{text}</p>
      <div className={s.row}>
        <button type="button" className={s.primary} onClick={() => { setMyLevel('toeic', target!); close(); }}>L{target}로 바꾸기</button>
        <button type="button" className={s.ghost} onClick={close}>닫기</button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.card} style={{ textAlign: 'center', padding: 10 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{value}</div>
      <div className={s.small + ' ' + s.muted}>{label}</div>
    </div>
  );
}
