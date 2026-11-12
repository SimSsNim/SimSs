import { useSyncExternalStore } from 'react';
import { db } from './db';
import { validateLesson } from './validateLesson';
import { toViewLesson, GENRE_KO } from './lessonAdapter';
import { lessonKeyOf, isTrack, type Chapter, type IndexEntry, type Lesson, type LessonIndex, type Level, type RawLesson, type Track } from './types';
import { getSettings, setSetting } from './settings';
import { kstDate } from './date';

export interface LessonSummary {
  key: string;
  track: Track;
  chapter: Chapter | null;
  id: string;
  date: string;
  level: Level;
  title: string;
  titleKo: string;
  genre: string;
  genreKo: string;
  wordCount: number;
  hasAudio: boolean;
  questionCount: number;
  grammarTags: string[];
  source: 'repo' | 'import';
  errors: string[] | null;
}

interface LessonsState {
  status: 'loading' | 'ready' | 'offline';
  summaries: LessonSummary[]; // 날짜 역순 → 레벨 → Part
  lessons: Record<string, Lesson>;
  newKeys: string[];
  loadedAt: number;
}

let state: LessonsState = { status: 'loading', summaries: [], lessons: {}, newKeys: [], loadedAt: 0 };
const listeners = new Set<() => void>();
const emit = (patch: Partial<LessonsState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

function summarize(l: Lesson, source: 'repo' | 'import'): LessonSummary {
  return {
    key: lessonKeyOf(l.track, l.id), track: l.track, chapter: l.chapter, id: l.id, date: l.date, level: l.level,
    title: l.title, titleKo: l.titleKo, genre: l.genre, genreKo: l.genreKo, wordCount: l.wordCount, hasAudio: !!l.audio,
    questionCount: l.questions.length, grammarTags: [...new Set(l.grammar.flatMap((g) => g.tags))].sort(), source, errors: null,
  };
}
function summarizeEntry(e: IndexEntry, errors: string[] | null = null): LessonSummary {
  return {
    key: lessonKeyOf(e.track, e.id), track: e.track, chapter: e.chapter ?? null, id: e.id, date: e.date, level: (e.level ?? 1) as Level,
    title: e.title, titleKo: e.titleKo ?? '', genre: e.genre ?? '', genreKo: GENRE_KO[e.genre ?? ''] ?? e.genre ?? '',
    wordCount: e.wordCount ?? 0, hasAudio: !!e.hasAudio, questionCount: e.questionCount ?? 0, grammarTags: e.grammarTags ?? [],
    source: 'repo', errors,
  };
}
const CH_ORDER: Record<string, number> = { part5: 0, part6: 1, part7: 2 };
export const sortSummaries = (a: LessonSummary, b: LessonSummary) =>
  a.date !== b.date ? (a.date < b.date ? 1 : -1)
    : a.track !== b.track ? (a.track < b.track ? -1 : 1)
      : a.level !== b.level ? a.level - b.level
        : a.chapter || b.chapter ? (CH_ORDER[a.chapter ?? ''] ?? 0) - (CH_ORDER[b.chapter ?? ''] ?? 0)
          : storyNo(a.id) - storyNo(b.id);
/** 같은 날 같은 레벨 이야기 순서: -L1 = 1, -L1-2 = 2 … 뉴스는 그 뒤 */
export const storyNo = (id: string) => {
  const m = /-L\d(?:-(news)?(\d)?)?$/.exec(id);
  if (!m) return 0;
  return (m[1] ? 100 : 0) + (m[2] ? Number(m[2]) : 1);
};

const base = () => import.meta.env.BASE_URL || './';

async function mapLimit<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

let loading: Promise<void> | null = null;
export function loadLessons(): Promise<void> {
  loading ??= doLoad().finally(() => {
    loading = null;
  });
  return loading;
}

function fromCache(raw: RawLesson): Lesson | null {
  return validateLesson(raw).length ? null : toViewLesson(raw);
}

async function doLoad() {
  const cached = await db.lessonCache.toArray().catch(() => []);
  const lessons: Record<string, Lesson> = { ...state.lessons };
  const byKey = new Map<string, LessonSummary>();
  for (const r of cached) {
    const l = fromCache(r.lesson);
    if (!l) continue;
    lessons[r.key] = l;
    byKey.set(r.key, summarize(l, r.source));
  }
  if (state.status === 'loading') emit({ summaries: [...byKey.values()].sort(sortSummaries), lessons });

  let index: LessonIndex | null = null;
  try {
    const res = await fetch(`${base()}lessons/index.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(String(res.status));
    index = (await res.json()) as LessonIndex;
  } catch {
    index = null;
  }
  if (!index || !Array.isArray(index.lessons)) {
    emit({ status: 'offline', summaries: [...byKey.values()].sort(sortSummaries), lessons, loadedAt: Date.now() });
    return;
  }

  const repoKeys = new Set<string>();
  const entries = index.lessons.filter((e) => isTrack(e.track));
  for (const e of entries) {
    const key = lessonKeyOf(e.track, e.id);
    repoKeys.add(key);
    byKey.set(key, lessons[key] && byKey.get(key)?.source === 'repo' ? byKey.get(key)! : summarizeEntry(e));
  }
  for (const r of cached) {
    if (r.source === 'repo' && !repoKeys.has(r.key)) {
      byKey.delete(r.key);
      delete lessons[r.key];
      void db.lessonCache.delete(r.key);
    }
  }
  emit({ status: 'ready', summaries: [...byKey.values()].sort(sortSummaries), lessons, loadedAt: Date.now() });

  await mapLimit(entries, 4, async (e) => {
    const key = lessonKeyOf(e.track, e.id);
    try {
      const res = await fetch(`${base()}lessons/${e.file}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json();
      const [folder, file] = e.file.split('/');
      const errors = validateLesson(data, { folderTrack: folder, fileStem: file.replace(/\.json$/, ''), requireGlossary: true });
      if (errors.length) {
        byKey.set(key, summarizeEntry(e, errors));
      } else {
        const raw = data as RawLesson;
        const l = toViewLesson(raw);
        lessons[key] = l;
        byKey.set(key, summarize(l, 'repo'));
        void db.lessonCache.put({ key, track: raw.track, id: raw.id, lesson: raw, source: 'repo', savedAt: Date.now() });
      }
    } catch (err) {
      if (!lessons[key]) byKey.set(key, summarizeEntry(e, [`레슨 파일을 불러오지 못했습니다: ${String(err)}`]));
    }
    emit({ summaries: [...byKey.values()].sort(sortSummaries), lessons: { ...lessons } });
  });

  const all = [...byKey.keys()];
  const known = getSettings().knownLessonKeys;
  if (known === null) setSetting('knownLessonKeys', all);
  else emit({ newKeys: all.filter((k) => !known.includes(k)) });
}

export function markTrackSeen(track: Track) {
  if (getSettings().knownLessonKeys === null) return;
  const keys = state.summaries.filter((s) => s.track === track).map((s) => s.key);
  const known = new Set(getSettings().knownLessonKeys ?? []);
  let changed = false;
  for (const k of keys) if (!known.has(k)) { known.add(k); changed = true; }
  if (changed) setSetting('knownLessonKeys', [...known]);
  const nk = state.newKeys.filter((k) => !k.startsWith(`${track}/`));
  if (nk.length !== state.newKeys.length) emit({ newKeys: nk });
}

export function useLessons(): LessonsState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}
export const getLessonsState = () => state;

// ---- 묶기·찾기: track → level → date → chapter ----
export interface DayGroup { date: string; lessons: LessonSummary[] } // 그 날짜의 레슨(레벨·Part 순)
export function groupByDate(list: LessonSummary[]): DayGroup[] {
  const map = new Map<string, LessonSummary[]>();
  for (const s of list) (map.get(s.date) ?? map.set(s.date, []).get(s.date)!).push(s);
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([date, lessons]) => ({ date, lessons: lessons.sort(sortSummaries) }));
}

export interface TodayPick { date: string | null; isToday: boolean; lessons: LessonSummary[] }
/** 오늘(KST) 그 트랙·레벨 레슨. 없으면 가장 최근 날짜. toeic 은 Part 5·6·7 묶음 */
/** 그날 볼 레슨. 이야기 트랙은 news=true면 뉴스(레벨 무관), 아니면 그 레벨의 이야기(뉴스 제외) */
export function pickToday(summaries: LessonSummary[], track: Track, level: Level, today = kstDate(), news = false): TodayPick {
  const mine = summaries.filter((s) => s.track === track && !s.errors && (
    track !== 'general' ? s.level === level : news ? s.genre === 'news' : s.genre !== 'news' && s.level === level));
  const todays = mine.filter((s) => s.date === today);
  if (todays.length) return { date: today, isToday: true, lessons: todays.sort(sortSummaries) };
  const past = mine.filter((s) => s.date <= today);
  const date = (past[0] ?? mine[0])?.date ?? null;
  return { date, isToday: false, lessons: mine.filter((s) => s.date === date).sort(sortSummaries) };
}
export const levelsOn = (summaries: LessonSummary[], track: Track, date: string | null) =>
  new Set(summaries.filter((s) => s.track === track && s.date === date && !s.errors).map((s) => s.level));

export interface ImportResult { name: string; ok: boolean; key?: string; errors: string[]; shadowed?: boolean }

export async function importLessonTexts(files: { name: string; text: string }[]): Promise<ImportResult[]> {
  const out: ImportResult[] = [];
  for (const f of files) {
    let data: unknown;
    try {
      data = JSON.parse(f.text);
    } catch (e) {
      out.push({ name: f.name, ok: false, errors: [`JSON 형식 오류: ${(e as Error).message}`] });
      continue;
    }
    // 가져오기는 파일 이름이 바뀌어 있을 수 있어서(다운로드 "(1)" 등) 파일 이름 검사는 하지 않는다. id 형식은 검사한다.
    const errors = validateLesson(data);
    if (errors.length) {
      out.push({ name: f.name, ok: false, errors });
      continue;
    }
    const raw = data as RawLesson;
    const key = lessonKeyOf(raw.track, raw.id);
    const existing = state.summaries.find((s) => s.key === key);
    const shadowed = existing?.source === 'repo';
    if (!shadowed) {
      const l = toViewLesson(raw);
      await db.lessonCache.put({ key, track: raw.track, id: raw.id, lesson: raw, source: 'import', savedAt: Date.now() });
      const summaries = state.summaries.filter((s) => s.key !== key).concat(summarize(l, 'import')).sort(sortSummaries);
      emit({ summaries, lessons: { ...state.lessons, [key]: l } });
    }
    out.push({ name: f.name, ok: true, key, errors: [], shadowed });
  }
  return out;
}

export function importSummaryText(r: ImportResult[]): string {
  const ok = r.filter((x) => x.ok).length;
  const bad = r.filter((x) => !x.ok);
  return `${r.length}개 중 ${ok}개 추가` + (bad.length ? `, ${bad.length}개 오류(${bad.map((b) => `${b.name}: ${b.errors[0]}`).join(' / ')})` : '');
}

export async function removeImported(key: string) {
  await db.lessonCache.delete(key);
  const lessons = { ...state.lessons };
  delete lessons[key];
  emit({ summaries: state.summaries.filter((s) => s.key !== key), lessons });
}

export function resetLessonsState() {
  state = { status: 'loading', summaries: [], lessons: {}, newKeys: [], loadedAt: 0 };
  listeners.forEach((l) => l());
}
