import { db } from './db';

export async function toggleSentenceMark(lessonKey: string, sentenceId: string, field: 'bookmark' | 'hard') {
  const key = `${lessonKey}:${sentenceId}`;
  await db.transaction('rw', db.sentenceMarks, async () => {
    const cur = (await db.sentenceMarks.get(key)) ?? { key, lessonKey, sentenceId, bookmark: false, hard: false, memo: '' };
    const on = !cur[field];
    await db.sentenceMarks.put({ ...cur, [field]: on, ...(field === 'bookmark' && on ? { bookmarkedAt: Date.now() } : {}) });
  });
}
export async function setMemo(lessonKey: string, sentenceId: string, memo: string) {
  const key = `${lessonKey}:${sentenceId}`;
  await db.transaction('rw', db.sentenceMarks, async () => {
    const cur = (await db.sentenceMarks.get(key)) ?? { key, lessonKey, sentenceId, bookmark: false, hard: false, memo: '' };
    await db.sentenceMarks.put({ ...cur, memo });
  });
}
export async function setGrammarState(lessonKey: string, grammarId: string, patch: { understood?: boolean; review?: boolean }) {
  const key = `${lessonKey}:${grammarId}`;
  await db.transaction('rw', db.grammarState, async () => {
    const cur = (await db.grammarState.get(key)) ?? { key, lessonKey, grammarId, understood: false, review: false };
    await db.grammarState.put({ ...cur, ...patch });
  });
}
export async function toggleGrammarStar(lessonKey: string, grammarId: string) {
  const key = `${lessonKey}:${grammarId}`;
  await db.transaction('rw', db.grammarState, async () => {
    const cur = (await db.grammarState.get(key)) ?? { key, lessonKey, grammarId, understood: false, review: false };
    await db.grammarState.put({ ...cur, starred: !cur.starred, starredAt: Date.now() });
  });
}
