// v1(레벨·Part 없는 레슨 키) → v2 키. Dexie 업그레이드와 백업 v1 가져오기가 같이 쓴다.
const V1_KEY = /^(general|toeic)\/(\d{4}-\d{2}-\d{2})$/;

/** 'general/2026-11-12' → 'general/2026-11-12-L1', 'toeic/2026-11-12' → 'toeic/2026-11-12-L1-part7' */
export function migrateLessonKey(key: string): string {
  const m = V1_KEY.exec(key);
  if (!m) return key;
  return m[1] === 'general' ? `${key}-L1` : `${key}-L1-part7`;
}
/** 'toeic/2026-11-12:s3' 같은 복합 키 */
export function migrateCompoundKey(key: string): string {
  const i = key.indexOf(':');
  return i < 0 ? migrateLessonKey(key) : migrateLessonKey(key.slice(0, i)) + key.slice(i);
}
export function migrateLessonId(track: string, id: string): string {
  return migrateLessonKey(`${track}/${id}`).split('/')[1];
}

type Row = Record<string, unknown>;
const mapArr = (v: unknown) => (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? migrateLessonKey(x) : x)) : v);

/** 테이블 이름별 행 변환(키 필드만 바꾼다) */
export function migrateRow(table: string, r: Row): Row {
  switch (table) {
    case 'lessonProgress':
    case 'audioMarks':
      return { ...r, key: migrateLessonKey(String(r.key)) };
    case 'sentenceMarks':
    case 'grammarState':
      return { ...r, key: migrateCompoundKey(String(r.key)), lessonKey: migrateLessonKey(String(r.lessonKey)) };
    case 'practiceLog':
    case 'recordings':
      return { ...r, lessonKey: migrateLessonKey(String(r.lessonKey)) };
    case 'myWords':
      return r.lessonKey ? { ...r, lessonKey: migrateLessonKey(String(r.lessonKey)) } : r;
    case 'wordState':
      return { ...r, lessonKeys: mapArr(r.lessonKeys) };
    case 'dailyLog':
      return { ...r, lessonsTouched: mapArr(r.lessonsTouched) };
    case 'settings': {
      if (r.key === 'knownLessonKeys') return { ...r, value: mapArr(r.value) };
      if (r.key === 'lastLesson' && r.value && typeof r.value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [t, v] of Object.entries(r.value as Record<string, { id: string; tab: string }>)) out[t] = { ...v, id: migrateLessonId(t, v.id) };
        return { ...r, value: out };
      }
      return r;
    }
    default:
      return r;
  }
}
