import { useSyncExternalStore } from 'react';
import { db } from './db';
import { validateLesson } from './validateLesson';
import { lessonKeyOf, isTrack, type IndexEntry, type Lesson, type LessonIndex, type Track } from './types';
import { getSettings, setSetting } from './settings';

export interface LessonSummary {
  key: string;
  track: Track;
  id: string;
  date: string;
  level: number | null;
  title: string;
  titleKo: string;
  genre: string;
  genreKo: string;
  wordCount: number;
  hasAudio: boolean;
  source: 'repo' | 'import';
  errors: string[] | null;
}

interface LessonsState {
  status: 'loading' | 'ready' | 'offline';
  summaries: LessonSummary[]; // 날짜 역순
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

export const GENRE_KO: Record<string, string> = {
  fable: '우화', story: '단편', 'fairy-tale': '동화', 'short-story': '단편', news: '뉴스', speech: '연설', essay: '수필', poem: '시', letter: '편지',
  email: '이메일', notice: '공지', advertisement: '광고', article: '기사', memo: '메모', chat: '채팅',
  review: '후기', schedule: '일정표', form: '양식', announcement: '안내',
};

function summarize(l: Lesson, source: 'repo' | 'import'): LessonSummary {
  return {
    key: lessonKeyOf(l.track, l.id), track: l.track, id: l.id, date: l.date, level: l.level,
    title: l.title, titleKo: l.titleKo, genre: l.genre, genreKo: l.genreKo ?? GENRE_KO[l.genre] ?? l.genre,
    wordCount: l.wordCount, hasAudio: !!l.audio, source, errors: null,
  };
}
function summarizeEntry(e: IndexEntry): LessonSummary {
  return {
    key: lessonKeyOf(e.track, e.id), track: e.track, id: e.id, date: e.date, level: e.level ?? null,
    title: e.title, titleKo: e.titleKo ?? '', genre: e.genre ?? '', genreKo: e.genreKo ?? GENRE_KO[e.genre ?? ''] ?? e.genre ?? '',
    wordCount: e.wordCount ?? 0, hasAudio: !!e.hasAudio, source: 'repo', errors: e.errors?.length ? e.errors : null,
  };
}
const sortSummaries = (a: LessonSummary, b: LessonSummary) => (a.date === b.date ? (a.key < b.key ? 1 : -1) : a.date < b.date ? 1 : -1);

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

async function doLoad() {
  // 1) 기기 캐시로 먼저 화면을 채운다(오프라인 대비)
  const cached = await db.lessonCache.toArray().catch(() => []);
  const lessons: Record<string, Lesson> = { ...state.lessons };
  const byKey = new Map<string, LessonSummary>();
  for (const r of cached) {
    lessons[r.key] = r.lesson;
    byKey.set(r.key, summarize(r.lesson, r.source));
  }
  if (state.status === 'loading') emit({ summaries: [...byKey.values()].sort(sortSummaries), lessons });

  // 2) index.json
  let index: LessonIndex | null = null;
  try {
    const res = await fetch(`${base()}lessons/index.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(String(res.status));
    index = (await res.json()) as LessonIndex;
  } catch {
    index = null;
  }
  if (!index) {
    emit({ status: 'offline', summaries: [...byKey.values()].sort(sortSummaries), lessons, loadedAt: Date.now() });
    return;
  }

  const repoKeys = new Set<string>();
  const entries = (index.lessons ?? []).filter((e) => isTrack(e.track));
  for (const e of entries) {
    const key = lessonKeyOf(e.track, e.id);
    repoKeys.add(key);
    // 저장소 것이 가져온 것보다 우선
    byKey.set(key, summarizeEntry(e));
  }
  // 저장소에서 사라진 레슨 캐시는 지운다(가져온 것은 유지)
  for (const r of cached) {
    if (r.source === 'repo' && !repoKeys.has(r.key)) {
      byKey.delete(r.key);
      delete lessons[r.key];
      void db.lessonCache.delete(r.key);
    }
  }
  emit({ status: 'ready', summaries: [...byKey.values()].sort(sortSummaries), lessons, loadedAt: Date.now() });

  // 3) 레슨 본문
  await mapLimit(entries.filter((e) => !e.errors?.length), 4, async (e) => {
    const key = lessonKeyOf(e.track, e.id);
    try {
      const res = await fetch(`${base()}lessons/${e.file}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json();
      const errors = validateLesson(data, { folderTrack: e.track, fileStem: e.id });
      if (errors.length) {
        byKey.set(key, { ...summarizeEntry(e), errors });
      } else {
        const l = data as Lesson;
        lessons[key] = l;
        byKey.set(key, summarize(l, 'repo'));
        void db.lessonCache.put({ key, track: l.track, id: l.id, lesson: l, source: 'repo', savedAt: Date.now() });
      }
    } catch (err) {
      if (!lessons[key]) byKey.set(key, { ...summarizeEntry(e), errors: [`레슨 파일을 불러오지 못했습니다: ${String(err)}`] });
    }
    emit({ summaries: [...byKey.values()].sort(sortSummaries), lessons: { ...lessons } });
  });

  // 4) 새 지문 표시
  const all = [...byKey.keys()];
  const known = getSettings().knownLessonKeys;
  if (known === null) setSetting('knownLessonKeys', all);
  else emit({ newKeys: all.filter((k) => !known.includes(k)) });
}

export function markTrackSeen(track: Track) {
  if (getSettings().knownLessonKeys === null) return; // 첫 로딩이 끝나기 전
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

export interface ImportResult {
  name: string;
  ok: boolean;
  key?: string;
  errors: string[];
  shadowed?: boolean;
}

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
    const errors = validateLesson(data);
    if (errors.length) {
      out.push({ name: f.name, ok: false, errors });
      continue;
    }
    const l = data as Lesson;
    const key = lessonKeyOf(l.track, l.id);
    const existing = state.summaries.find((s) => s.key === key);
    const shadowed = existing?.source === 'repo';
    if (!shadowed) {
      await db.lessonCache.put({ key, track: l.track, id: l.id, lesson: l, source: 'import', savedAt: Date.now() });
      const summaries = state.summaries.filter((s) => s.key !== key).concat(summarize(l, 'import')).sort(sortSummaries);
      emit({ summaries, lessons: { ...state.lessons, [key]: l } });
    }
    out.push({ name: f.name, ok: true, key, errors: [], shadowed });
  }
  return out;
}

export async function removeImported(key: string) {
  await db.lessonCache.delete(key);
  const lessons = { ...state.lessons };
  delete lessons[key];
  emit({ summaries: state.summaries.filter((s) => s.key !== key), lessons });
}

/** 테스트·초기화용 */
export function resetLessonsState() {
  state = { status: 'loading', summaries: [], lessons: {}, newKeys: [], loadedAt: 0 };
  listeners.forEach((l) => l());
}
