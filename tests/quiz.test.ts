import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from '../src/lib/db';
import { toViewLesson } from '../src/lib/lessonAdapter';
import { finishAttempt, startAttempt, scoreAnswers, shuffledChoices, reviewQuestion, firstAttempts, markUnsure, unmarkUnsure, removeFromWrongNote, restoreWrongNote } from '../src/lib/quiz';
import { quizStats, weakest, pct } from '../src/lib/stats';
import { kstDate } from '../src/lib/date';
import type { ChoiceKey, RawLesson } from '../src/lib/types';

const p5 = toViewLesson(JSON.parse(readFileSync(resolve(process.cwd(), 'public/lessons/toeic/2026-11-12-L1-part5.json'), 'utf-8')) as RawLesson);
const key = 'toeic/2026-11-12-L1-part5';
const ALL: ChoiceKey[] = ['B', 'C', 'B', 'A', 'C', 'B', 'D', 'B', 'A', 'C'];
const answersFrom = (arr: ChoiceKey[]) => Object.fromEntries(p5.questions.map((q, i) => [q.id, arr[i]]));

describe('채점', () => {
  beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); });
  it('샘플 정답 = 10/10, 하나 틀리면 9/10', () => {
    expect(scoreAnswers(p5.questions, answersFrom(ALL))).toBe(10);
    const one = [...ALL]; one[0] = 'A';
    expect(scoreAnswers(p5.questions, answersFrom(one))).toBe(9);
  });
  it('틀린 문제는 오답노트로, 통계는 첫 시도 기준', async () => {
    const wrong = [...ALL]; wrong[0] = 'A'; wrong[2] = 'A';
    const a1 = await startAttempt(p5, 'practice');
    await finishAttempt(p5, { ...a1, answers: answersFrom(wrong) }, 100);
    const a2 = await startAttempt(p5, 'practice');
    expect(a2.attemptNo).toBe(2);
    await finishAttempt(p5, { ...a2, answers: answersFrom(ALL) }, 60);
    const rows = await db.quizAttempt.toArray();
    expect(firstAttempts(rows).map((a) => a.score)).toEqual([8]);
    const st = quizStats(rows, { [key]: p5 });
    expect(pct(st.byChapter.get('part5')!)).toBe(80);
    expect(st.time.get('part5')).toMatchObject({ avgSec: 100, recSec: 200 });
    expect(weakest(st.bySkill).map(([k]) => k)).toEqual(expect.arrayContaining(['형용사 자리']));
    const notes = await db.questionState.where('inWrongNote').equals(1).toArray();
    expect(notes.map((n) => n.qid).sort()).toEqual(['q1', 'q3']);
    expect(notes[0].due! > kstDate()).toBe(true);
    // 오답노트 다시 풀기: 예정일 전에 맞혀도 졸업 안 함
    await reviewQuestion(`${key}:q1`, true, 'B');
    expect((await db.questionState.get(`${key}:q1`))!.inWrongNote).toBe(1);
  });
  it('보기 섞기: 같은 보기들, 정답 key 유지', () => {
    const q = p5.questions[0];
    const sh = shuffledChoices(q, 12345);
    expect(sh.map((c) => c.key).sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(sh.find((c) => c.key === q.answer)!.text).toBe('easy');
  });
});

describe('헷갈림·삭제', () => {
  beforeEach(async () => { await Promise.all(db.tables.map((t) => t.clear())); });
  it('헷갈렸어요 → 오늘 바로 복습, 취소하면 오답노트에서 빠짐', async () => {
    const q = p5.questions[1];
    await markUnsure(p5, q);
    const row = (await db.questionState.get(`${key}:q2`))!;
    expect(row).toMatchObject({ inWrongNote: 1, unsure: true, due: kstDate() });
    await unmarkUnsure(p5, q);
    expect((await db.questionState.get(`${key}:q2`))!).toMatchObject({ inWrongNote: 0, unsure: false });
  });
  it('틀린 적 있는 문제는 헷갈림만 지우고 오답노트에 남김', async () => {
    const wrong = [...ALL]; wrong[1] = 'A';
    const a = await startAttempt(p5, 'practice');
    await finishAttempt(p5, { ...a, answers: answersFrom(wrong) }, 10);
    await markUnsure(p5, p5.questions[1]);
    await unmarkUnsure(p5, p5.questions[1]);
    expect((await db.questionState.get(`${key}:q2`))!).toMatchObject({ inWrongNote: 1, unsure: false });
  });
  it('삭제와 되돌리기', async () => {
    await markUnsure(p5, p5.questions[0]);
    const prev = (await removeFromWrongNote(`${key}:q1`))!;
    expect((await db.questionState.get(`${key}:q1`))!.inWrongNote).toBe(0);
    await restoreWrongNote(prev);
    expect((await db.questionState.get(`${key}:q1`))!).toMatchObject({ inWrongNote: 1, unsure: true });
  });
});
