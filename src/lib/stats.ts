// 토익 통계: 모두 '첫 시도' 기준
import type { QuizAttemptRow } from './db';
import { firstAttempts, isCorrect, questionsOf } from './quiz';
import { CHAPTER_SEC_PER_Q, QUESTION_TYPE_LABEL, type Chapter, type Lesson } from './types';

export interface Rate { ok: number; n: number }
export const pct = (r: Rate) => (r.n ? Math.round((r.ok / r.n) * 100) : 0);
const add = (m: Map<string, Rate>, k: string, ok: boolean) => {
  const v = m.get(k) ?? { ok: 0, n: 0 };
  v.n++;
  if (ok) v.ok++;
  m.set(k, v);
};

export interface QuizStats {
  byChapter: Map<Chapter, Rate>;
  bySkill: Map<string, Rate>;
  byLevel: Map<number, Rate>;
  time: Map<Chapter, { avgSec: number; recSec: number; count: number }>;
  attempts: number;
}

/** 유형 이름: 데이터의 skill(있으면) 아니면 문제 type */
export const skillOf = (q: { skill?: string; type: keyof typeof QUESTION_TYPE_LABEL }) => q.skill || QUESTION_TYPE_LABEL[q.type];

export function quizStats(rows: QuizAttemptRow[], lessons: Record<string, Lesson>, filter?: (a: QuizAttemptRow) => boolean): QuizStats {
  const firsts = firstAttempts(rows).filter((a) => !a.questionIds && (!filter || filter(a)));
  const byChapter = new Map<Chapter, Rate>();
  const bySkill = new Map<string, Rate>();
  const byLevel = new Map<number, Rate>();
  const t = new Map<Chapter, { sum: number; q: number; count: number }>();
  for (const a of firsts) {
    const l = lessons[a.lessonKey];
    const r = byChapter.get(a.chapter) ?? { ok: 0, n: 0 };
    r.ok += a.score;
    r.n += a.total;
    byChapter.set(a.chapter, r);
    const lv = byLevel.get(a.level) ?? { ok: 0, n: 0 };
    lv.ok += a.score;
    lv.n += a.total;
    byLevel.set(a.level, lv);
    const tt = t.get(a.chapter) ?? { sum: 0, q: 0, count: 0 };
    tt.sum += a.durationSec;
    tt.q += a.total;
    tt.count++;
    t.set(a.chapter, tt);
    if (l) for (const q of questionsOf(l, a)) add(bySkill, skillOf(q), isCorrect(q, a.answers[q.id]));
  }
  const time = new Map<Chapter, { avgSec: number; recSec: number; count: number }>();
  for (const [c, v] of t) time.set(c, { avgSec: Math.round(v.sum / v.count), recSec: Math.round((CHAPTER_SEC_PER_Q[c] * v.q) / v.count), count: v.count });
  return { byChapter, bySkill, byLevel, time, attempts: firsts.length };
}

/** 가장 약한 유형 3개(2문제 이상 푼 유형 중 정답률 낮은 순) */
export function weakest(bySkill: Map<string, Rate>, n = 3): [string, Rate][] {
  return [...bySkill.entries()].filter(([, r]) => r.n >= 2 && r.ok < r.n).sort((a, b) => pct(a[1]) - pct(b[1]) || b[1].n - a[1].n).slice(0, n);
}
