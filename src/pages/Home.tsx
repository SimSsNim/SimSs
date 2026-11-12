import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import s from '../styles/ui.module.css';
import { AppHeader } from '../components/AppHeader';
import { useLessons, markTrackSeen, type LessonSummary } from '../lib/lessons';
import { TRACKS, TRACK_LABEL, type Track } from '../lib/types';
import { db, CHECKLIST_KEYS, emptyChecklist } from '../lib/db';
import { CHECKLIST } from '../lib/checklist';
import { kstDate, addDays, weekdayOf, formatKo } from '../lib/date';
import { setChecklist, computeStreak, isStudyDay } from '../lib/progress';
import { isDue } from '../lib/leitner';
import { useSettings, setSetting } from '../lib/settings';
import { toast } from '../components/Toast';

export function pickToday(summaries: LessonSummary[], track: Track): { lesson: LessonSummary | null; isToday: boolean } {
  const list = summaries.filter((x) => x.track === track && !x.errors);
  const today = kstDate();
  const t = list.find((x) => x.date === today);
  if (t) return { lesson: t, isToday: true };
  const past = list.filter((x) => x.date <= today);
  return { lesson: past[0] ?? list[0] ?? null, isToday: false };
}

export function LevelBadge({ level }: { level: number | null }) {
  if (!level) return null;
  return <span className={s.badgeAccent}>레벨 {level}</span>;
}

export function Home() {
  const { track: tp } = useParams();
  const track = tp as Track;
  const { summaries, status } = useLessons();
  const settings = useSettings();
  const today = kstDate();
  const picks = Object.fromEntries(TRACKS.map((t) => [t, pickToday(summaries, t)])) as Record<Track, ReturnType<typeof pickToday>>;
  const mine = picks[track];
  const keys = TRACKS.map((t) => picks[t].lesson?.key).filter(Boolean) as string[];
  const progress = useLiveQuery(() => db.lessonProgress.bulkGet(keys), [keys.join(',')]);
  const daily = useLiveQuery(() => db.dailyLog.toArray(), []);
  const dueWords = useLiveQuery(() => db.wordState.where('due').belowOrEqual(today).toArray(), [today]);

  useEffect(() => {
    if (status !== 'loading') markTrackSeen(track);
  }, [track, status, summaries.length]);

  // 백업 알림(14일)
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

  const progOf = (key?: string) => progress?.find((p) => p?.key === key);
  const mineProg = progOf(mine.lesson?.key);
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const checklist = { ...(mineProg?.checklist ?? emptyChecklist()), ...optimistic };
  useEffect(() => setOptimistic({}), [mineProg, track]);

  return (
    <>
      <AppHeader track={track} />
      <main className={s.page}>
        <section aria-label="두 트랙 요약" className={s.stack} style={{ marginTop: 8 }}>
          {TRACKS.map((t) => {
            const l = picks[t].lesson;
            const p = progOf(l?.key);
            const done = p ? CHECKLIST_KEYS.filter((k) => p.checklist[k]).length : 0;
            return (
              <Link key={t} to={`/${t}`} onClick={() => setSetting('track', t)} className={s.small}
                style={{ color: 'inherit', textDecoration: 'none', fontWeight: t === track ? 700 : 400 }} data-testid={`summary-${t}`}>
                {TRACK_LABEL[t]}: {l ? <>「{l.title}」 {done === 6 ? '✓완료' : `${done}/6 단계`}</> : '지문 없음'}
              </Link>
            );
          })}
        </section>

        <h1 className={s.title}>{formatKo(today)} · {TRACK_LABEL[track]}</h1>

        {!mine.lesson ? (
          <div className={s.card}>
            <p className={s.empty}>{status === 'loading' ? '지문을 불러오는 중…' : '아직 지문이 없어요. 레슨 파일이 추가되면 여기에 나와요. (기록/설정 → 레슨 가져오기도 가능)'}</p>
          </div>
        ) : (
          <>
            {!mine.isToday && <p className={s.muted} role="note">오늘 지문은 아직 도착하지 않았어요. 가장 최근 지문을 보여 드려요.</p>}
            <Link to={`/${track}/lesson/${mine.lesson.id}`} className={s.cardLink} data-testid="today-card">
              <div className={s.row} style={{ marginBottom: 6 }}>
                <LevelBadge level={mine.lesson.level} />
                <span className={s.badge}>{mine.lesson.genreKo}</span>
                <span className={s.badge}>{mine.lesson.wordCount}단어</span>
                <span className={s.badge}>{mine.lesson.hasAudio ? '🔊 원음' : '🗣 TTS'}</span>
                {track === 'toeic' && <span className={s.badge}>AI 작성 연습 지문</span>}
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700 }}>{mine.lesson.title}</div>
              <div className={s.muted}>{mine.lesson.titleKo} · {formatKo(mine.lesson.date)}</div>
            </Link>

            <h2 className={s.h2}>오늘의 학습 순서</h2>
            <ol className={s.list} style={{ counterReset: 'none' }}>
              {CHECKLIST.map((c, i) => (
                <li key={c.key} className={s.card} style={{ padding: '6px 12px' }}>
                  <div className={s.between}>
                    <label className={s.check} title={c.hint}>
                      <input type="checkbox" checked={checklist[c.key]} data-testid={`check-${c.key}`}
                        onChange={(e) => {
                        setOptimistic({ ...optimistic, [c.key]: e.target.checked });
                        void setChecklist(mine.lesson!.key, c.key, e.target.checked);
                      }} />
                      <span>{'①②③④⑤⑥'[i]} {c.label}</span>
                    </label>
                    <Link className={s.ghost} to={`/${track}/lesson/${mine.lesson!.id}/${c.tab}`}>하기 ›</Link>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}

        <h2 className={s.h2}>기록</h2>
        <div className={s.row} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <Stat label="연속 학습" value={`${streak}일`} />
          <Link to="/words?review=1" style={{ textDecoration: 'none', color: 'inherit' }}><Stat label="오늘 복습 단어" value={`${due}개`} /></Link>
          <Stat label="이번 주" value={`${weekDays}/7일`} />
        </div>
      </main>
    </>
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
