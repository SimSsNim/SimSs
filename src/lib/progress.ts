import { db, emptyChecklist, CHECKLIST_KEYS, type ChecklistKey, type LessonProgressRow, type PracticeLogRow, type DailyLogRow } from './db';
import { kstDate, addDays } from './date';
import type { Track } from './types';

export async function getProgress(key: string): Promise<LessonProgressRow> {
  return (await db.lessonProgress.get(key)) ?? { key, checklist: emptyChecklist(), completedAt: null };
}

export async function updateProgress(key: string, patch: Partial<LessonProgressRow>) {
  await db.transaction('rw', db.lessonProgress, async () => {
    const cur = await getProgress(key);
    await db.lessonProgress.put({ ...cur, ...patch, key });
  });
}

export async function setChecklist(key: string, item: ChecklistKey, value: boolean) {
  await db.transaction('rw', db.lessonProgress, async () => {
    const cur = await getProgress(key);
    if (cur.checklist[item] === value) return;
    const checklist = { ...cur.checklist, [item]: value };
    const all = CHECKLIST_KEYS.every((k) => checklist[k]);
    await db.lessonProgress.put({ ...cur, checklist, completedAt: all ? cur.completedAt ?? Date.now() : null });
  });
  if (value) void logAction(`check:${item}`, key);
}

/** 자동 체크: 켜기만 한다(사용자가 끈 것을 다시 켜는 건 기준을 다시 채웠을 때뿐) */
export const autoCheck = (key: string, item: ChecklistKey) => setChecklist(key, item, true);

export async function logAction(action: string, lessonKey?: string) {
  const date = kstDate();
  await db.transaction('rw', db.dailyLog, async () => {
    const cur = (await db.dailyLog.get(date)) ?? { date, seconds: 0, lessonsTouched: [], actions: {} };
    cur.actions = { ...cur.actions, [action]: (cur.actions[action] ?? 0) + 1 };
    if (lessonKey && !cur.lessonsTouched.includes(lessonKey)) cur.lessonsTouched = [...cur.lessonsTouched, lessonKey];
    await db.dailyLog.put(cur);
  });
}

export async function addSeconds(sec: number, lessonKey?: string) {
  const date = kstDate();
  await db.transaction('rw', db.dailyLog, async () => {
    const cur = (await db.dailyLog.get(date)) ?? { date, seconds: 0, lessonsTouched: [], actions: {} };
    cur.seconds += sec;
    if (lessonKey && !cur.lessonsTouched.includes(lessonKey)) cur.lessonsTouched = [...cur.lessonsTouched, lessonKey];
    await db.dailyLog.put(cur);
  });
}

export async function logPractice(row: Omit<PracticeLogRow, 'id' | 'at' | 'date'> & { track: Track }) {
  await db.practiceLog.add({ ...row, at: Date.now(), date: kstDate() });
  await logAction(`practice:${row.kind}`, row.lessonKey);
}

/** 이야기 화면에 머문 것 기록(같은 날 같은 화면은 한 번) */
export async function logView(lessonKey: string, tab: string) {
  const date = kstDate();
  const v = `${lessonKey}|${tab}`;
  await db.transaction('rw', db.dailyLog, async () => {
    const cur = (await db.dailyLog.get(date)) ?? { date, seconds: 0, lessonsTouched: [], actions: {} };
    if ((cur.views ?? []).includes(v)) return;
    cur.views = [...(cur.views ?? []), v];
    if (!cur.lessonsTouched.includes(lessonKey)) cur.lessonsTouched = [...cur.lessonsTouched, lessonKey];
    await db.dailyLog.put(cur);
  });
}

/** 토익 문제를 푼 수 더하기 */
export async function logQuestions(n: number, lessonKey?: string) {
  if (n <= 0) return;
  const date = kstDate();
  await db.transaction('rw', db.dailyLog, async () => {
    const cur = (await db.dailyLog.get(date)) ?? { date, seconds: 0, lessonsTouched: [], actions: {} };
    cur.questions = (cur.questions ?? 0) + n;
    if (lessonKey && !cur.lessonsTouched.includes(lessonKey)) cur.lessonsTouched = [...cur.lessonsTouched, lessonKey];
    await db.dailyLog.put(cur);
  });
}

/** 그날 활동: 이야기 화면 수 + 토익 문제 수 */
export const viewsOf = (r?: DailyLogRow) => r?.views?.length ?? 0;
export const questionsOf = (r?: DailyLogRow) => r?.questions ?? 0;

/** 학습일 = 이야기 화면에 머물렀거나, 토익 문제를 풀었거나, 학습 단계를 체크·연습한 날(그냥 열어 보기만 한 건 아님) */
export const isStudyDay = (r?: DailyLogRow) =>
  !!r && (viewsOf(r) > 0 || questionsOf(r) > 0 || Object.keys(r.actions).some((a) => a !== 'open'));

export function computeStreak(days: Set<string>, today = kstDate()): number {
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// 화면이 보이는 동안만 학습 시간 세기
let currentLessonKey: string | undefined;
export const setActiveLesson = (k?: string) => {
  currentLessonKey = k;
};
let started = false;
export function startTimeTracking() {
  if (started) return;
  started = true;
  let last = Date.now();
  setInterval(() => {
    const now = Date.now();
    const dt = Math.min(30, Math.round((now - last) / 1000));
    last = now;
    if (document.visibilityState === 'visible' && dt > 0) void addSeconds(dt, currentLessonKey);
  }, 15000);
  document.addEventListener('visibilitychange', () => {
    last = Date.now();
  });
}
