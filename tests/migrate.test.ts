import { describe, it, expect } from 'vitest';
import Dexie from 'dexie';
import { PilsaDB } from '../src/lib/db';
import { migrateLessonKey, migrateCompoundKey } from '../src/lib/migrate';
import { parseBackup, importBackup } from '../src/lib/backup';
import { db } from '../src/lib/db';
import { applyAnswer, initialLeitner, isDue, WRONG_NOTE_SCHEME } from '../src/lib/leitner';

describe('레슨 키 변환', () => {
  it('v1 → v2', () => {
    expect(migrateLessonKey('general/2026-11-12')).toBe('general/2026-11-12-L1');
    expect(migrateLessonKey('toeic/2026-11-12')).toBe('toeic/2026-11-12-L1-part7');
    expect(migrateLessonKey('general/2026-11-12-L2')).toBe('general/2026-11-12-L2'); // 이미 v2
    expect(migrateCompoundKey('toeic/2026-11-12:s3')).toBe('toeic/2026-11-12-L1-part7:s3');
  });
});

describe('Dexie v1 → v2 업그레이드', () => {
  it('저장된 기록의 키를 옮긴다', async () => {
    const name = 'pilsa-migrate-test';
    const old = new Dexie(name);
    old.version(1).stores({
      settings: 'key', lessonCache: 'key, track, source', wordState: 'key, status, due, starred', myWords: '++id, term, createdAt',
      lessonProgress: 'key', sentenceMarks: 'key, lessonKey', grammarState: 'key, lessonKey', audioMarks: 'key',
      practiceLog: '++id, lessonKey, track, kind, date, at', dailyLog: 'date', recordings: '++id, lessonKey, at',
    });
    await old.open();
    await old.table('lessonProgress').bulkPut([
      { key: 'general/2026-11-12', checklist: { read: true } },
      { key: 'toeic/2026-11-12', checklist: { listen: true } },
    ]);
    await old.table('sentenceMarks').put({ key: 'toeic/2026-11-12:s2', lessonKey: 'toeic/2026-11-12', sentenceId: 's2', bookmark: true, hard: false, memo: '' });
    await old.table('practiceLog').add({ lessonKey: 'general/2026-11-12', track: 'general', kind: 'typing', score: 100, durationSec: 1, at: 1, date: '2026-11-12' });
    await old.table('wordState').put({ key: 'settle', lessonKeys: ['general/2026-11-12'], status: 'known' });
    await old.table('dailyLog').put({ date: '2026-11-12', seconds: 60, lessonsTouched: ['toeic/2026-11-12'], actions: {} });
    await old.table('settings').put({ key: 'lastLesson', value: { general: { id: '2026-11-12', tab: 'vocab' } } });
    await old.table('lessonCache').put({ key: 'general/2026-11-12', track: 'general', id: '2026-11-12', lesson: {}, source: 'repo' });
    old.close();

    const v2 = new PilsaDB(name);
    await v2.open();
    expect((await v2.lessonProgress.toArray()).map((r) => r.key).sort()).toEqual(['general/2026-11-12-L1', 'toeic/2026-11-12-L1-part7']);
    expect(await v2.sentenceMarks.get('toeic/2026-11-12-L1-part7:s2')).toMatchObject({ lessonKey: 'toeic/2026-11-12-L1-part7', bookmark: true });
    expect((await v2.practiceLog.toArray())[0].lessonKey).toBe('general/2026-11-12-L1');
    expect((await v2.wordState.get('settle'))!.lessonKeys).toEqual(['general/2026-11-12-L1']);
    expect((await v2.dailyLog.get('2026-11-12'))!.lessonsTouched).toEqual(['toeic/2026-11-12-L1-part7']);
    expect((await v2.settings.get('lastLesson'))!.value).toEqual({ general: { id: '2026-11-12-L1', tab: 'vocab' } });
    expect(await v2.lessonCache.count()).toBe(0);
    expect(v2.tables.map((t) => t.name)).toEqual(expect.arrayContaining(['quizAttempt', 'questionState', 'dismissedTips']));
    v2.close();
    await Dexie.delete(name);
  });
});

describe('백업 v1 → v2 가져오기', () => {
  it('키를 바꿔서 가져온다', async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    const v1 = {
      app: 'pilsa', version: 1, exportedAt: '2026-11-12T00:00:00Z',
      tables: {
        lessonProgress: [{ key: 'toeic/2026-11-12', checklist: { read: true } }],
        practiceLog: [{ lessonKey: 'general/2026-11-12', track: 'general', kind: 'typing', score: 90, durationSec: 5, at: 5, date: '2026-11-12' }],
      },
      importedLessons: [{ key: 'general/2026-11-13', lesson: {} }],
    };
    const b = parseBackup(JSON.stringify(v1));
    expect(b.version).toBe(2);
    await importBackup(b, 'overwrite');
    expect((await db.lessonProgress.toArray())[0].key).toBe('toeic/2026-11-12-L1-part7');
    expect((await db.practiceLog.toArray())[0].lessonKey).toBe('general/2026-11-12-L1');
    expect(await db.lessonCache.count()).toBe(0); // v1 형식 레슨은 버림
  });
});

describe('오답노트 졸업 일정 (1일 → 3일 → 졸업, KST 날짜)', () => {
  it('틀림 → 다음 날 → 맞힘 → 3일 뒤 → 맞힘 → 졸업', () => {
    let s = applyAnswer(initialLeitner(), 'unknown', '2026-11-12', WRONG_NOTE_SCHEME);
    expect(s).toMatchObject({ box: 1, due: '2026-11-13' });
    // 예정일 전에 맞히면 인정 안 함
    expect(applyAnswer(s, 'known', '2026-11-12', WRONG_NOTE_SCHEME)).toEqual(s);
    s = applyAnswer(s, 'known', '2026-11-13', WRONG_NOTE_SCHEME);
    expect(s).toMatchObject({ box: 2, due: '2026-11-16' });
    expect(isDue(s, '2026-11-15')).toBe(false);
    s = applyAnswer(s, 'known', '2026-11-16', WRONG_NOTE_SCHEME);
    expect(s).toMatchObject({ status: 'known', due: null });
  });
  it('중간에 틀리면 처음부터(1일)', () => {
    let s = applyAnswer(initialLeitner(), 'unknown', '2026-11-30', WRONG_NOTE_SCHEME);
    s = applyAnswer(s, 'known', '2026-12-01', WRONG_NOTE_SCHEME);
    s = applyAnswer(s, 'unknown', '2026-12-04', WRONG_NOTE_SCHEME);
    expect(s).toMatchObject({ box: 1, due: '2026-12-05', wrongCount: 2 });
  });
});
