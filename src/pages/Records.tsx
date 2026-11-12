import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import s from '../styles/ui.module.css';
import { DatePick } from '../components/DatePick';
import { AppHeader } from '../components/AppHeader';
import { db } from '../lib/db';
import { kstDate, addDays, weekdayOf, formatKo } from '../lib/date';
import { isStudyDay } from '../lib/progress';
import { useLessons } from '../lib/lessons';
import { TRACK_LABEL } from '../lib/types';
import { SettingsPanel } from './SettingsPanel';
import { BackupPanel, ImportPanel, ResetPanel, StudyResetPanel } from './DataPanels';
import { LevelFilterChips, type LevelFilter } from './Wordbook';
import { quizStats, weakest, pct } from '../lib/stats';
import { CHAPTERS, CHAPTER_LABEL, LEVELS } from '../lib/types';
import { Link } from 'react-router-dom';
import { mmss } from './lesson/practice/Transcribe';

const SECTIONS = [
  { id: 'stats', label: '기록' },
  { id: 'settings', label: '설정' },
  { id: 'backup', label: '백업' },
  { id: 'import', label: '레슨 가져오기' },
] as const;

export function Records() {
  const { section = 'stats' } = useParams();
  const nav = useNavigate();
  return (
    <>
      <AppHeader />
      <main className={s.page}>
        <div className={s.chips} role="tablist" aria-label="기록/설정">
          {SECTIONS.map((x) => (
            <button key={x.id} type="button" role="tab" className={s.chip} aria-selected={section === x.id} onClick={() => nav(`/records/${x.id}`, { replace: true })}>{x.label}</button>
          ))}
        </div>
        {section === 'stats' && <><StudyResetPanel /><div style={{ height: 10 }} /><Stats /></>}
        {section === 'settings' && <SettingsPanel />}
        {section === 'backup' && <><BackupPanel /><ResetPanel /></>}
        {section === 'import' && <ImportPanel />}
      </main>
    </>
  );
}

const ACTION_LABEL: Record<string, string> = {
  open: '레슨 열기', 'check:listen': '듣기 완료', 'check:read': '읽기 완료', 'check:vocab': '단어 완료', 'check:grammar': '문법 완료',
  'check:transcribe': '필사 완료', 'check:review': '복습 완료', 'word:known': '알아요', 'word:unknown': '몰라요', 'word:confused': '헷갈려요',
  'practice:paper': '종이 필사', 'practice:typing': '타이핑 필사', 'practice:dictation': '받아쓰기', 'practice:blank': '빈칸', 'practice:arrange': '문장 배열',
  'practice:translate': '해석 연습', 'practice:shadow': '섀도잉', 'practice:grammarQuiz': '문법 퀴즈',
};

function Stats() {
  const [levelF, setLevelF] = useState<LevelFilter>('all');
  const daily = useLiveQuery(() => db.dailyLog.toArray(), []);
  const progress = useLiveQuery(() => db.lessonProgress.toArray(), []);
  const words = useLiveQuery(() => db.wordState.toArray(), []);
  const practice = useLiveQuery(() => db.practiceLog.toArray(), []);
  const { summaries } = useLessons();
  const [picked, setPicked] = useState<string | null>(null);
  const today = kstDate();
  const byDate = new Map((daily ?? []).map((d) => [d.date, d]));
  const weeks = 12;
  const lastSunday = addDays(today, -weekdayOf(today));
  const start = addDays(lastSunday, -7 * (weeks - 1));
  const cells: { date: string; level: number }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i);
    const r = byDate.get(d);
    const m = (r?.seconds ?? 0) / 60;
    cells.push({ date: d, level: d > today ? -1 : !isStudyDay(r) ? 0 : m < 10 ? 1 : m < 20 ? 2 : m < 30 ? 3 : 4 });
  }
  const completed = (progress ?? []).filter((p) => p.completedAt).length;
  const known = (words ?? []).filter((w) => w.status === 'known');
  const totalMin = Math.round((daily ?? []).reduce((a, d) => a + d.seconds, 0) / 60);

  // 아는 단어 수 추이(최근 8주, 주 단위 누적)
  const knownTrend = Array.from({ length: 8 }, (_, i) => {
    const end = addDays(today, -7 * (7 - i));
    return { label: end.slice(5), value: known.filter((w) => (w.lastReviewed ?? '0') <= end).length };
  });
  // 연습 정확도 추이(최근 10회, 타이핑·받아쓰기)
  const acc = (practice ?? []).filter((x) => (x.kind === 'typing' || x.kind === 'dictation') && x.score !== null).sort((a, b) => a.at - b.at).slice(-10)
    .map((x) => ({ label: x.date.slice(5), value: x.score ?? 0 }));
  // 최근 14일 학습 시간
  const minutes = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today, i - 13);
    return { label: d.slice(8), value: Math.round((byDate.get(d)?.seconds ?? 0) / 60) };
  });
  const pickedLog = picked ? byDate.get(picked) : undefined;
  const pickedPractice = (practice ?? []).filter((x) => x.date === picked);

  return (
    <div className={s.stack}>
      <LevelFilterChips value={levelF} onChange={setLevelF} />
      <QuizStatsSection levelF={levelF} />
      <GeneralLevelSection levelF={levelF} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <Tile label="완료한 레슨" value={completed} />
        <Tile label="아는 단어" value={known.length} />
        <Tile label="총 학습(분)" value={totalMin} />
      </div>
      <section className={s.card}>
        <b>학습 캘린더</b> <span className={s.small + ' ' + s.muted}>최근 {weeks}주 · 날짜를 누르면 그날 한 일</span>
        <div role="group" aria-label="학습 캘린더" style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gridAutoFlow: 'column', gap: 3, marginTop: 8, maxWidth: 520 }}>
          {cells.map((c) => (
            <button key={c.date} type="button" disabled={c.level < 0} onClick={() => setPicked(c.date)}
              aria-label={`${c.date} ${c.level > 0 ? '학습함' : '학습 안 함'}`} aria-pressed={picked === c.date}
              style={{
                width: '100%', aspectRatio: '1', minWidth: 24, border: picked === c.date ? '2px solid var(--text)' : '1px solid var(--line)', borderRadius: 3, padding: 0, cursor: 'pointer',
                background: c.level < 0 ? 'transparent' : c.level === 0 ? 'var(--surface-2)' : `color-mix(in srgb, var(--accent) ${[0, 35, 55, 75, 100][c.level]}%, var(--surface))`,
              }} />
          ))}
        </div>
        <DatePick value={picked ?? ''} onChange={(d) => setPicked(d || null)} label="기록 날짜" />
        <div className={s.row + ' ' + s.small + ' ' + s.muted} style={{ marginTop: 6 }}>적게 {[0, 1, 2, 3, 4].map((l) => <span key={l} aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 3, display: 'inline-block', background: l === 0 ? 'var(--surface-2)' : `color-mix(in srgb, var(--accent) ${[0, 35, 55, 75, 100][l]}%, var(--surface))` }} />)} 많이 (10·20·30분)</div>
        {picked && (
          <div style={{ marginTop: 10 }} aria-live="polite">
            <b>{formatKo(picked)}</b>
            {!pickedLog ? <p className={s.muted}>기록이 없어요.</p> : (
              <ul className={s.small}>
                <li>학습 시간 {Math.round(pickedLog.seconds / 60)}분</li>
                {pickedLog.lessonsTouched.map((k) => {
                  const sm = summaries.find((x) => x.key === k);
                  return <li key={k}>{TRACK_LABEL[k.split('/')[0] as 'general']} · {sm?.title ?? k}</li>;
                })}
                {Object.entries(pickedLog.actions).map(([a, n]) => <li key={a}>{ACTION_LABEL[a] ?? a} × {n}</li>)}
                {pickedPractice.filter((x) => x.score !== null).map((x) => <li key={x.id}>{ACTION_LABEL[`practice:${x.kind}`]} {x.score}점</li>)}
              </ul>
            )}
          </div>
        )}
      </section>
      <section className={s.card}><b>최근 14일 학습 시간(분)</b><BarChart data={minutes} /></section>
      <section className={s.card}><b>아는 단어 수 추이(주)</b><LineChart data={knownTrend} /></section>
      <section className={s.card}><b>타이핑·받아쓰기 정확도(최근 10회)</b>{acc.length ? <LineChart data={acc} max={100} unit="%" /> : <p className={s.muted + ' ' + s.small}>아직 기록이 없어요.</p>}</section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className={s.card} style={{ textAlign: 'center', padding: 10 }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{value}</div>
      <div className={s.small + ' ' + s.muted}>{label}</div>
    </div>
  );
}

type Pt = { label: string; value: number };
function BarChart({ data }: { data: Pt[] }) {
  const W = 320, H = 120, pad = 18;
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = (W - pad) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={data.map((d) => `${d.label}일 ${d.value}분`).join(', ')}>
      {data.map((d, i) => {
        const h = (d.value / max) * (H - 34);
        return (
          <g key={i}>
            <rect x={pad + i * bw + 2} y={H - 18 - h} width={bw - 4} height={Math.max(h, 1)} rx={3} fill="var(--accent)" opacity={d.value ? 1 : 0.25} />
            {d.value > 0 && <text x={pad + i * bw + bw / 2} y={H - 22 - h} textAnchor="middle" fontSize="9" fill="var(--muted)">{d.value}</text>}
            <text x={pad + i * bw + bw / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--muted)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
function LineChart({ data, max: maxIn, unit = '' }: { data: Pt[]; max?: number; unit?: string }) {
  const W = 320, H = 120, pad = 24;
  const max = maxIn ?? Math.max(1, ...data.map((d) => d.value));
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, data.length - 1);
  const y = (v: number) => H - 20 - (v / max) * (H - 40);
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={data.map((d) => `${d.label} ${d.value}${unit}`).join(', ')}>
      <line x1={pad} x2={W - pad} y1={H - 20} y2={H - 20} stroke="var(--line)" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d.value)} r={3.5} fill="var(--accent)" />
          <text x={x(i)} y={y(d.value) - 7} textAnchor="middle" fontSize="9" fill="var(--text)">{d.value}{unit}</text>
          <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--muted)">{d.label}</text>
        </g>
      ))}
    </svg>
  );
}

function RateBar({ label, ok, n, testid }: { label: string; ok: number; n: number; testid?: string }) {
  const p = n ? Math.round((ok / n) * 100) : 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '8.5em 1fr 5.5em', gap: 8, alignItems: 'center', fontSize: 14 }} data-testid={testid}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <div className={s.progressBar} aria-hidden="true"><span style={{ width: `${p}%` }} /></div>
      <span style={{ textAlign: 'right' }}>{n ? `${p}% (${ok}/${n})` : '–'}</span>
    </div>
  );
}

/** 토익: Part별·유형별·레벨별 정답률, 풀이 시간 vs 권장, 이번 주 약점 (첫 시도 기준) */
function QuizStatsSection({ levelF }: { levelF: LevelFilter }) {
  const attempts = useLiveQuery(() => db.quizAttempt.toArray(), []);
  const { lessons } = useLessons();
  if (!attempts) return null;
  const st = quizStats(attempts, lessons, (a) => levelF === 'all' || a.level === levelF);
  const weekAgo = Date.now() - 7 * 86400000;
  const week = quizStats(attempts, lessons, (a) => (a.finishedAt ?? 0) >= weekAgo && (levelF === 'all' || a.level === levelF));
  const weak = weakest(week.bySkill);
  return (
    <section className={s.card + ' ' + s.stack} data-testid="quiz-stats">
      <b>토익 문제 풀이 <span className={s.small + ' ' + s.muted}>첫 시도 기준 · {st.attempts}세트</span></b>
      {st.attempts === 0 ? <p className={s.small + ' ' + s.muted} style={{ margin: 0 }}>아직 푼 세트가 없어요.</p> : (
        <>
          <div className={s.small} style={{ fontWeight: 700 }}>Part별 정답률</div>
          {CHAPTERS.map((c) => { const r = st.byChapter.get(c); return <RateBar key={c} label={CHAPTER_LABEL[c]} ok={r?.ok ?? 0} n={r?.n ?? 0} testid={`rate-${c}`} />; })}
          <div className={s.small} style={{ fontWeight: 700 }}>레벨별 정답률</div>
          {LEVELS.map((l) => { const r = st.byLevel.get(l); return r ? <RateBar key={l} label={`L${l}`} ok={r.ok} n={r.n} /> : null; })}
          <div className={s.small} style={{ fontWeight: 700 }}>유형별 정답률</div>
          {[...st.bySkill.entries()].sort((a, b) => pct(a[1]) - pct(b[1])).map(([k, r]) => <RateBar key={k} label={k} ok={r.ok} n={r.n} />)}
          <div className={s.small} style={{ fontWeight: 700 }}>평균 풀이 시간 / 권장 시간</div>
          <table className={s.table}><tbody>
            {CHAPTERS.map((c) => { const t = st.time.get(c); return t ? <tr key={c}><td>{CHAPTER_LABEL[c]}</td><td>{mmss(t.avgSec)} / {mmss(t.recSec)}</td><td style={{ color: t.avgSec > t.recSec ? 'var(--danger)' : 'var(--ok)' }}>{t.avgSec > t.recSec ? '느림' : '여유'}</td></tr> : null; })}
          </tbody></table>
        </>
      )}
      <div className={s.small} style={{ fontWeight: 700 }}>이번 주 약점</div>
      {weak.length === 0 ? <p className={s.small + ' ' + s.muted} style={{ margin: 0 }}>이번 주 약점 유형이 아직 없어요(유형마다 2문제 이상 풀면 나와요).</p> : (
        <div className={s.row}>
          {weak.map(([k, r]) => <Link key={k} className={s.chip} to={`/drill?skill=${encodeURIComponent(k)}`} data-testid="weak-skill">{k} {pct(r)}% ›</Link>)}
        </div>
      )}
    </section>
  );
}

/** 일반: 레벨별 학습 레슨 수 */
function GeneralLevelSection({ levelF }: { levelF: LevelFilter }) {
  const progress = useLiveQuery(() => db.lessonProgress.where('key').startsWith('general/').toArray(), []);
  if (!progress) return null;
  const lv = (k: string) => Number(/-L(\d)/.exec(k)?.[1] ?? 0);
  return (
    <section className={s.card}>
      <b>이야기: 레벨별 학습 레슨</b>
      <table className={s.table} style={{ marginTop: 6 }}><thead><tr><th>레벨</th><th>연 레슨</th><th>완료</th></tr></thead><tbody>
        {LEVELS.filter((l) => levelF === 'all' || l === levelF).map((l) => {
          const rows = progress.filter((p) => lv(p.key) === l);
          return <tr key={l}><td>L{l}</td><td>{rows.filter((p) => p.openedAt).length}</td><td>{rows.filter((p) => p.completedAt).length}</td></tr>;
        })}
      </tbody></table>
    </section>
  );
}
