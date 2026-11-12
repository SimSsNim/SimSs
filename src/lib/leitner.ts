import { addDays } from './date';

// 단어장과 오답노트가 함께 쓰는 복습 엔진(간격 반복). 칸 수와 간격만 다르다.
export type WordStatus = 'new' | 'unknown' | 'confused' | 'known';
export type Answer = 'known' | 'unknown' | 'confused';

export interface ReviewScheme {
  /** 칸별 간격(일). 길이 = 칸 수. 마지막 칸에서 [알아요] → 졸업 */
  intervals: number[];
  /** 아직 상자 밖(새 항목)에서 [알아요]면 바로 졸업할지 */
  newKnownGraduates: boolean;
  /** 예정일 전에 맞히면 칸을 올리지 않음(간격을 두고 맞혀야 인정) */
  requireDue: boolean;
}
/** 단어: Leitner 5칸 1·2·4·7·15일 */
export const WORD_SCHEME: ReviewScheme = { intervals: [1, 2, 4, 7, 15], newKnownGraduates: true, requireDue: false };
/** 오답노트: 틀림 → 1일 뒤 → 맞힘 → 3일 뒤 → 맞힘 → 졸업 */
export const WRONG_NOTE_SCHEME: ReviewScheme = { intervals: [1, 3], newKnownGraduates: true, requireDue: true };

export const BOX_INTERVALS = WORD_SCHEME.intervals;
export const intervalOf = (box: number, scheme: ReviewScheme = WORD_SCHEME) =>
  scheme.intervals[Math.min(Math.max(box, 1), scheme.intervals.length) - 1];

export interface LeitnerState {
  status: WordStatus;
  box: number; // 0 = 아직 복습 상자 밖
  due: string | null; // KST 날짜
  lastReviewed: string | null;
  wrongCount: number;
}

export const initialLeitner = (): LeitnerState => ({ status: 'new', box: 0, due: null, lastReviewed: null, wrongCount: 0 });

/**
 * [몰라요] → 1칸(다음 날), [헷갈려요] → 현재 칸 유지, [알아요] → 한 칸 위로. 마지막 칸에서 [알아요] → 졸업('known').
 */
export function applyAnswer(s: LeitnerState, a: Answer, today: string, scheme: ReviewScheme = WORD_SCHEME): LeitnerState {
  const max = scheme.intervals.length;
  const base = { ...s, lastReviewed: today };
  if (a === 'unknown') {
    return { ...base, status: 'unknown', box: 1, due: addDays(today, intervalOf(1, scheme)), wrongCount: s.wrongCount + 1 };
  }
  if (a === 'confused') {
    const box = Math.max(s.box, 1);
    return { ...base, status: 'confused', box, due: addDays(today, intervalOf(box, scheme)) };
  }
  // known
  if (s.status === 'known') return { ...base, status: 'known', box: max, due: null };
  if (s.status === 'new' || s.box === 0) {
    return scheme.newKnownGraduates ? { ...base, status: 'known', box: max, due: null } : { ...base, box: 1, due: addDays(today, intervalOf(1, scheme)) };
  }
  if (scheme.requireDue && s.due !== null && s.due > today) return s; // 간격 전에 맞힌 건 세지 않음
  if (s.box >= max) return { ...base, status: 'known', box: max, due: null };
  const box = s.box + 1;
  return { ...base, box, due: addDays(today, intervalOf(box, scheme)) };
}

export const isDue = (s: Pick<LeitnerState, 'status' | 'box' | 'due'>, today: string) =>
  s.status !== 'known' && s.box >= 1 && s.due !== null && s.due <= today;
