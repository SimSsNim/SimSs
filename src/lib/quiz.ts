// 문제 풀이: 시도 기록(quizAttempt), 문항 상태·오답노트(questionState). 채점은 데이터의 answer 그대로.
import { db, type QuestionStateRow, type QuizAttemptRow } from './db';
import { applyAnswer, initialLeitner, WRONG_NOTE_SCHEME, isDue } from './leitner';
import { kstDate } from './date';
import { logPractice, autoCheck } from './progress';
import { lessonKeyOf, CHAPTER_SEC_PER_Q, type ChoiceKey, type Lesson, type Question } from './types';

export const isCorrect = (q: Question, a: ChoiceKey | undefined | null) => !!a && a === q.answer;

export function scoreAnswers(questions: Question[], answers: Record<string, ChoiceKey>) {
  return questions.filter((q) => isCorrect(q, answers[q.id])).length;
}

export const recommendedSec = (lesson: Lesson) => (lesson.chapter ? CHAPTER_SEC_PER_Q[lesson.chapter] * lesson.questions.length : 0);

export async function attemptsOf(lessonKey: string): Promise<QuizAttemptRow[]> {
  return (await db.quizAttempt.where('lessonKey').equals(lessonKey).toArray()).sort((a, b) => a.attemptNo - b.attemptNo);
}

/** 이어 풀기용: 진행 중 시도가 있으면 그것, 없으면 새로 만든다 */
export async function getOrStartAttempt(lesson: Lesson, mode: 'practice' | 'exam'): Promise<QuizAttemptRow> {
  const key = lessonKeyOf(lesson.track, lesson.id);
  const all = await attemptsOf(key);
  const open = all.find((a) => a.inProgress === 1);
  if (open) return open;
  return startAttempt(lesson, mode, all.length + 1);
}

export const questionsOf = (lesson: Lesson, a: Pick<QuizAttemptRow, 'questionIds'> | null | undefined) =>
  a?.questionIds ? lesson.questions.filter((q) => a.questionIds!.includes(q.id)) : lesson.questions;

export async function startAttempt(lesson: Lesson, mode: 'practice' | 'exam', attemptNo?: number, questionIds?: string[]): Promise<QuizAttemptRow> {
  const key = lessonKeyOf(lesson.track, lesson.id);
  const no = attemptNo ?? (await attemptsOf(key)).length + 1;
  // 진행 중이던 다른 시도는 버린다(한 레슨에 진행 중 시도는 하나)
  const open = (await attemptsOf(key)).filter((a) => a.inProgress === 1);
  if (open.length) await db.quizAttempt.bulkDelete(open.map((a) => a.id!));
  const row: QuizAttemptRow = {
    lessonKey: key, track: lesson.track, level: lesson.level, chapter: lesson.chapter!, attemptNo: no, mode,
    startedAt: Date.now(), finishedAt: null, durationSec: 0, answers: {}, checked: [], score: 0, total: questionIds?.length ?? lesson.questions.length,
    inProgress: 1, remainingSec: mode === 'exam' ? recommendedSec(lesson) : null, date: kstDate(), ...(questionIds ? { questionIds } : {}),
  };
  row.id = await db.quizAttempt.add(row);
  return row;
}

export async function saveAttempt(id: number, patch: Partial<QuizAttemptRow>) {
  await db.quizAttempt.update(id, patch);
}

/** 채점 끝: 점수 저장, 틀린 문제 → 오답노트, practiceLog 에 'quiz' 기록 */
export async function finishAttempt(lesson: Lesson, attempt: QuizAttemptRow, durationSec: number): Promise<QuizAttemptRow> {
  const qs = questionsOf(lesson, attempt);
  const score = scoreAnswers(qs, attempt.answers);
  const done: QuizAttemptRow = { ...attempt, score, total: qs.length, durationSec, finishedAt: Date.now(), inProgress: 0, checked: qs.map((q) => q.id) };
  await db.quizAttempt.put(done);
  const today = kstDate();
  for (const q of qs) await recordQuestion(lesson, q, attempt.answers[q.id] ?? null, today);
  await logPractice({
    lessonKey: attempt.lessonKey, track: lesson.track, kind: 'quiz', score: Math.round((score / qs.length) * 100), durationSec,
    detail: { chapter: lesson.chapter, level: lesson.level, attemptNo: attempt.attemptNo, mode: attempt.mode, score, total: qs.length },
  });
  await autoCheck(attempt.lessonKey, 'review');
  return done;
}

const qKey = (lessonKey: string, qid: string) => `${lessonKey}:${qid}`;

function baseState(lesson: Lesson, q: Question): QuestionStateRow {
  return {
    key: qKey(lessonKeyOf(lesson.track, lesson.id), q.id), lessonKey: lessonKeyOf(lesson.track, lesson.id), qid: q.id,
    lastAnswer: null, lastCorrect: false, inWrongNote: 0, unsure: false, ...initialLeitner(),
    graduatedAt: null, skill: q.skill ?? '', type: q.type, chapter: lesson.chapter!, level: lesson.level, addedAt: Date.now(), updatedAt: Date.now(),
  };
}

/** 문제 풀이 결과 반영(시도 채점 때). 틀리면 오답노트에 넣는다 */
async function recordQuestion(lesson: Lesson, q: Question, answer: ChoiceKey | null, today: string) {
  const key = qKey(lessonKeyOf(lesson.track, lesson.id), q.id);
  await db.transaction('rw', db.questionState, async () => {
    const cur = (await db.questionState.get(key)) ?? baseState(lesson, q);
    const correct = isCorrect(q, answer);
    let next: QuestionStateRow = { ...cur, lastAnswer: answer, lastCorrect: correct, updatedAt: Date.now() };
    if (!correct) {
      const l = applyAnswer(cur, 'unknown', today, WRONG_NOTE_SCHEME);
      next = { ...next, ...l, inWrongNote: 1, graduatedAt: null, addedAt: cur.inWrongNote ? cur.addedAt : Date.now() };
    }
    await db.questionState.put(next);
  });
}

/** 약점 유형 연습 등: 결과 반영(틀리면 오답노트) */
export const recordQuestionResult = (lesson: Lesson, q: Question, answer: ChoiceKey) => recordQuestion(lesson, q, answer, kstDate());

/** 맞혔지만 "헷갈렸어요" → 오답노트에 넣기 */
export async function markUnsure(lesson: Lesson, q: Question) {
  const key = qKey(lessonKeyOf(lesson.track, lesson.id), q.id);
  const today = kstDate();
  await db.transaction('rw', db.questionState, async () => {
    const cur = (await db.questionState.get(key)) ?? baseState(lesson, q);
    const l = applyAnswer(cur, 'confused', today, WRONG_NOTE_SCHEME);
    await db.questionState.put({ ...cur, ...l, unsure: true, inWrongNote: 1, graduatedAt: null, updatedAt: Date.now(), addedAt: cur.inWrongNote ? cur.addedAt : Date.now() });
  });
}

/** 오답노트 다시 풀기 결과: 간격을 두고 2번 연속 맞히면 졸업 */
export async function reviewQuestion(key: string, correct: boolean, answer: ChoiceKey) {
  const today = kstDate();
  await db.transaction('rw', db.questionState, async () => {
    const cur = await db.questionState.get(key);
    if (!cur) return;
    const l = applyAnswer(cur, correct ? 'known' : 'unknown', today, WRONG_NOTE_SCHEME);
    const graduated = l.status === 'known';
    await db.questionState.put({ ...cur, ...l, lastAnswer: answer, lastCorrect: correct, graduatedAt: graduated ? Date.now() : null, inWrongNote: graduated ? 0 : 1, updatedAt: Date.now() });
  });
}

export const wrongNoteDue = (rows: QuestionStateRow[], today = kstDate()) => rows.filter((r) => r.inWrongNote === 1 && isDue(r, today));

/** 보기 섞기(오답노트): 화면 표시 순서. 채점은 원래 key 로 */
export function shuffledChoices(q: Question, seed: number) {
  const arr = q.choices.slice();
  let x = seed || 1;
  for (let i = arr.length - 1; i > 0; i--) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const j = x % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 첫 시도 기준 통계용: 레슨마다 첫 번째로 끝난 시도 */
export function firstAttempts(rows: QuizAttemptRow[]): QuizAttemptRow[] {
  const byLesson = new Map<string, QuizAttemptRow>();
  for (const r of rows.filter((x) => x.inProgress === 0).sort((a, b) => a.attemptNo - b.attemptNo)) if (!byLesson.has(r.lessonKey)) byLesson.set(r.lessonKey, r);
  return [...byLesson.values()];
}
