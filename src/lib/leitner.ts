import { addDays } from './date';

export type WordStatus = 'new' | 'unknown' | 'confused' | 'known';
export type Answer = 'known' | 'unknown' | 'confused';

export const BOX_INTERVALS = [1, 2, 4, 7, 15]; // 1~5칸
export const intervalOf = (box: number) => BOX_INTERVALS[Math.min(Math.max(box, 1), 5) - 1];

export interface LeitnerState {
  status: WordStatus;
  box: number; // 0 = 아직 복습 상자 밖, 1~5
  due: string | null; // KST 날짜
  lastReviewed: string | null;
  wrongCount: number;
}

export const initialLeitner = (): LeitnerState => ({ status: 'new', box: 0, due: null, lastReviewed: null, wrongCount: 0 });

/**
 * [몰라요] → 1칸(다음 날), [헷갈려요] → 현재 칸 유지, [알아요] → 한 칸 위로.
 * 칸별 간격 1·2·4·7·15일. 5칸에서 [알아요] → '아는 단어'로 졸업.
 * 아직 상자에 들어가지 않은 새 단어에서 [알아요] → 바로 '아는 단어'.
 */
export function applyAnswer(s: LeitnerState, a: Answer, today: string): LeitnerState {
  const base = { ...s, lastReviewed: today };
  if (a === 'unknown') {
    return { ...base, status: 'unknown', box: 1, due: addDays(today, intervalOf(1)), wrongCount: s.wrongCount + 1 };
  }
  if (a === 'confused') {
    const box = Math.max(s.box, 1);
    return { ...base, status: 'confused', box, due: addDays(today, intervalOf(box)) };
  }
  // known
  if (s.status === 'new' || s.status === 'known' || s.box === 0 || s.box >= 5) {
    return { ...base, status: 'known', box: 5, due: null };
  }
  const box = s.box + 1;
  return { ...base, box, due: addDays(today, intervalOf(box)) };
}

export const isDue = (s: Pick<LeitnerState, 'status' | 'box' | 'due'>, today: string) =>
  s.status !== 'known' && s.box >= 1 && s.due !== null && s.due <= today;
