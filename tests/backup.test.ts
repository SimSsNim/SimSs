import { describe, it, expect, beforeEach } from 'vitest';
import { db, BACKUP_TABLES } from '../src/lib/db';
import { exportBackup, importBackup, parseBackup } from '../src/lib/backup';
import { answerWord } from '../src/lib/words';
import { setChecklist, logPractice } from '../src/lib/progress';

async function snapshot() {
  const out: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) out[t] = (await db.table(t).toArray()).map((r: Record<string, unknown>) => {
    const { id: _id, ...rest } = r;
    void _id;
    return rest;
  });
  return out;
}

describe('백업 왕복', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
  it('내보내기 → 지우기 → 가져오기 = 같은 데이터', async () => {
    await answerWord('settle', 'unknown', 'general/2026-11-12');
    await answerWord('surpass', 'known', 'general/2026-11-12');
    await setChecklist('toeic/2026-11-12', 'read', true);
    await logPractice({ lessonKey: 'toeic/2026-11-12', track: 'toeic', kind: 'typing', score: 97.5, durationSec: 60 });
    await db.settings.put({ key: 'theme', value: 'dark' });
    const before = await snapshot();
    const json = JSON.stringify(await exportBackup());
    await Promise.all(db.tables.map((t) => t.clear()));
    await importBackup(parseBackup(json), 'overwrite');
    expect(await snapshot()).toEqual(before);
    // 합치기를 한 번 더 해도 중복되지 않는다
    await importBackup(parseBackup(json), 'merge');
    expect(await snapshot()).toEqual(before);
  });
  it('다른 파일은 거부', () => {
    expect(() => parseBackup('{"a":1}')).toThrow();
    expect(() => parseBackup('nope')).toThrow();
  });
});
