import { db, BACKUP_TABLES, DB_VERSION, type BackupTable, type LessonCacheRow } from './db';

export interface BackupFile {
  app: 'pilsa';
  version: number;
  exportedAt: string;
  tables: Record<BackupTable, unknown[]>;
  importedLessons: LessonCacheRow[];
}

export async function exportBackup(): Promise<BackupFile> {
  const tables = {} as Record<BackupTable, unknown[]>;
  for (const t of BACKUP_TABLES) tables[t] = await db.table(t).toArray();
  const importedLessons = await db.lessonCache.where('source').equals('import').toArray();
  return { app: 'pilsa', version: DB_VERSION, exportedAt: new Date().toISOString(), tables, importedLessons };
}

export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('JSON 형식이 아닙니다');
  }
  const b = data as Partial<BackupFile>;
  if (!b || b.app !== 'pilsa' || typeof b.version !== 'number' || typeof b.tables !== 'object') {
    throw new Error('이 앱의 백업 파일이 아닙니다');
  }
  if (b.version > DB_VERSION) throw new Error(`더 새로운 버전(${b.version})의 백업입니다. 앱을 먼저 업데이트하세요`);
  return b as BackupFile;
}

/** mode: 'merge' = 기존 기록에 합치기(같은 키는 더 최근 것), 'overwrite' = 지우고 백업으로 바꾸기 */
export async function importBackup(b: BackupFile, mode: 'merge' | 'overwrite'): Promise<void> {
  const tableNames = [...BACKUP_TABLES, 'lessonCache'] as const;
  await db.transaction('rw', tableNames.map((t) => db.table(t)), async () => {
    if (mode === 'overwrite') {
      for (const t of BACKUP_TABLES) await db.table(t).clear();
      await db.lessonCache.where('source').equals('import').delete();
    }
    for (const t of BACKUP_TABLES) {
      const rows = (b.tables[t] ?? []) as Record<string, unknown>[];
      const table = db.table(t);
      if (t === 'practiceLog' || t === 'myWords') {
        const existing = mode === 'merge' ? await table.toArray() : [];
        const sig = (r: Record<string, unknown>) =>
          t === 'practiceLog' ? `${String(r.lessonKey)}|${String(r.kind)}|${String(r.at)}` : `${String(r.term)}|${String(r.createdAt)}`;
        const seen = new Set(existing.map(sig));
        const add = rows.filter((r) => !seen.has(sig(r))).map((r) => {
          const { id: _id, ...rest } = r;
          void _id;
          return rest;
        });
        await table.bulkAdd(add);
        continue;
      }
      if (mode === 'merge' && t === 'wordState') {
        for (const r of rows) {
          const cur = await table.get(r.key as string);
          if (!cur || ((r.updatedAt as number) ?? 0) >= (cur.updatedAt ?? 0)) await table.put(r);
        }
        continue;
      }
      if (mode === 'merge' && t === 'dailyLog') {
        for (const r of rows) {
          const cur = await table.get(r.date as string);
          if (!cur) await table.put(r);
          else {
            const actions: Record<string, number> = { ...cur.actions };
            for (const [k, v] of Object.entries((r.actions as Record<string, number>) ?? {})) actions[k] = Math.max(actions[k] ?? 0, v);
            await table.put({
              date: cur.date,
              seconds: Math.max(cur.seconds, (r.seconds as number) ?? 0),
              lessonsTouched: [...new Set([...cur.lessonsTouched, ...((r.lessonsTouched as string[]) ?? [])])],
              actions,
            });
          }
        }
        continue;
      }
      await table.bulkPut(rows);
    }
    if (b.importedLessons?.length) await db.lessonCache.bulkPut(b.importedLessons);
  });
}
