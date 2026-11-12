import { db, type WordStateRow } from './db';
import { applyAnswer, initialLeitner, isDue, type Answer, type WordStatus } from './leitner';
import { kstDate } from './date';
import { wordKey } from './text';
import { autoCheck, logAction } from './progress';
import type { Lesson, Track, Vocab } from './types';
import { lessonKeyOf } from './types';

export function emptyWordState(term: string): WordStateRow {
  return { key: wordKey(term), term, ...initialLeitner(), starred: false, lessonKeys: [], updatedAt: 0 };
}

export async function answerWord(term: string, a: Answer, lessonKey?: string) {
  const key = wordKey(term);
  const today = kstDate();
  await db.transaction('rw', db.wordState, async () => {
    const cur = (await db.wordState.get(key)) ?? emptyWordState(term);
    const next = applyAnswer(cur, a, today);
    const lessonKeys = lessonKey && !cur.lessonKeys.includes(lessonKey) ? [...cur.lessonKeys, lessonKey] : cur.lessonKeys;
    await db.wordState.put({ ...cur, ...next, lessonKeys, updatedAt: Date.now() });
  });
  void logAction(`word:${a}`, lessonKey);
}

/** 레슨 단어가 모두 분류되면 체크리스트 '단어' 자동 체크 */
export async function checkLessonVocabDone(lesson: Lesson) {
  const keys = lesson.vocab.map((v) => wordKey(v.term));
  const rows = await db.wordState.bulkGet(keys);
  if (rows.every((r) => r && r.status !== 'new')) await autoCheck(lessonKeyOf(lesson.track, lesson.id), 'vocab');
}

/** 단어 상태를 '새 단어'로 되돌리기(복습 일정도 지움). 되돌리기용으로 이전 행을 돌려준다 */
export async function resetWord(term: string): Promise<WordStateRow | undefined> {
  const key = wordKey(term);
  const cur = await db.wordState.get(key);
  if (!cur) return undefined;
  await db.wordState.put({ ...cur, ...initialLeitner(), updatedAt: Date.now() });
  return cur;
}
export const restoreWord = (row: WordStateRow) => db.wordState.put(row);

export async function toggleStar(term: string) {
  const key = wordKey(term);
  await db.transaction('rw', db.wordState, async () => {
    const cur = (await db.wordState.get(key)) ?? emptyWordState(term);
    await db.wordState.put({ ...cur, starred: !cur.starred, updatedAt: Date.now() });
  });
}

export async function addMyWord(w: { term: string; meaningKo: string; note?: string; sentence?: string; lessonKey?: string }) {
  await db.myWords.add({ ...w, term: w.term.trim(), createdAt: Date.now() });
}

export interface WordItem {
  key: string;
  term: string;
  pos: string;
  ipa?: string;
  meaningKo: string;
  synonyms: string[];
  example?: { en: string; ko: string };
  sentence?: string; // 본문 문장
  matchText?: string;
  sources: { lessonKey: string; track: Track; date: string; level: number; title: string; vocabId: string }[];
  mine: boolean;
  myWordId?: number;
  createdAt: number; // 정렬용(가장 최근 출처 날짜)
}

/** 모든 레슨 단어를 term 기준으로 합친다 + 내 단어 */
export function mergeWords(lessons: Lesson[], myWords: { id?: number; term: string; meaningKo: string; note?: string; sentence?: string; lessonKey?: string; createdAt: number }[]): WordItem[] {
  const map = new Map<string, WordItem>();
  const sorted = lessons.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const l of sorted) {
    const sents = new Map(l.paragraphs.flatMap((p) => p.sentences).map((s) => [s.id, s.en]));
    for (const v of l.vocab) {
      const key = wordKey(v.term);
      const src = { lessonKey: lessonKeyOf(l.track, l.id), track: l.track, date: l.date, level: l.level, title: l.title, vocabId: v.id };
      const ex = map.get(key);
      if (ex) {
        ex.sources.push(src);
        for (const s of v.synonyms ?? []) if (!ex.synonyms.includes(s)) ex.synonyms.push(s);
      } else {
        map.set(key, {
          key, term: v.term, pos: v.pos, ipa: v.ipa ?? undefined, meaningKo: v.meaningKo, synonyms: [...(v.synonyms ?? [])], example: v.example,
          sentence: sents.get(v.sentenceId), matchText: v.matchText, sources: [src], mine: false, createdAt: Date.parse(l.date),
        });
      }
    }
  }
  for (const w of myWords) {
    const key = wordKey(w.term);
    if (map.has(key)) continue;
    map.set(key, {
      key, term: w.term, pos: '', meaningKo: w.meaningKo || '(뜻 미입력)', synonyms: [], sentence: w.sentence,
      sources: [], mine: true, myWordId: w.id, createdAt: w.createdAt,
    });
  }
  return [...map.values()];
}

export function vocabToItem(l: Lesson, v: Vocab): WordItem {
  const s = l.paragraphs.flatMap((p) => p.sentences).find((x) => x.id === v.sentenceId);
  return {
    key: wordKey(v.term), term: v.term, pos: v.pos, ipa: v.ipa ?? undefined, meaningKo: v.meaningKo, synonyms: v.synonyms ?? [], example: v.example,
    sentence: s?.en, matchText: v.matchText,
    sources: [{ lessonKey: lessonKeyOf(l.track, l.id), track: l.track, date: l.date, level: l.level, title: l.title, vocabId: v.id }],
    mine: false, createdAt: Date.parse(l.date),
  };
}

export const statusOf = (r: WordStateRow | undefined): WordStatus => r?.status ?? 'new';
export const STATUS_LABEL: Record<WordStatus, string> = { new: '새 단어', unknown: '모르는 단어', confused: '헷갈리는 단어', known: '아는 단어' };
export const dueCount = (rows: WordStateRow[], today = kstDate()) => rows.filter((r) => isDue(r, today)).length;
