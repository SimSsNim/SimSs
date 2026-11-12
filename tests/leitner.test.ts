import { describe, it, expect } from 'vitest';
import { applyAnswer, initialLeitner, isDue } from '../src/lib/leitner';
import { kstDate, addDays, diffDays } from '../src/lib/date';

describe('KST 날짜', () => {
  it('자정 경계', () => {
    expect(kstDate(new Date('2026-11-12T14:59:59Z'))).toBe('2026-11-12');
    expect(kstDate(new Date('2026-11-12T15:00:00Z'))).toBe('2026-11-13');
  });
  it('날짜 더하기·빼기(월말, 윤년)', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 15)).toBe('2027-01-15');
    expect(diffDays('2026-12-01', '2026-11-30')).toBe(1);
    expect(diffDays('2027-03-01', '2027-02-01')).toBe(28);
  });
});

describe('Leitner 5칸', () => {
  const today = '2026-11-12';
  it('몰라요 → 1칸, 다음 날', () => {
    const s = applyAnswer(initialLeitner(), 'unknown', today);
    expect(s).toMatchObject({ status: 'unknown', box: 1, due: '2026-11-13', wrongCount: 1 });
    expect(isDue(s, today)).toBe(false);
    expect(isDue(s, '2026-11-13')).toBe(true);
  });
  it('알아요 → 한 칸씩, 간격 1·2·4·7·15', () => {
    let s = applyAnswer(initialLeitner(), 'unknown', today);
    const dues: (string | null)[] = [];
    let d = today;
    for (let i = 0; i < 4; i++) {
      d = s.due!;
      s = applyAnswer(s, 'known', d);
      dues.push(s.due);
    }
    expect(s.box).toBe(5);
    expect(dues).toEqual(['2026-11-15', '2026-11-19', '2026-11-26', '2026-12-11']);
    s = applyAnswer(s, 'known', s.due!);
    expect(s).toMatchObject({ status: 'known', due: null });
  });
  it('헷갈려요 → 현재 칸 유지', () => {
    let s = applyAnswer(initialLeitner(), 'unknown', today);
    s = applyAnswer(s, 'known', '2026-11-13'); // box 2
    s = applyAnswer(s, 'confused', '2026-11-15');
    expect(s).toMatchObject({ status: 'confused', box: 2, due: '2026-11-17' });
  });
  it('새 단어에서 알아요 → 바로 아는 단어', () => {
    expect(applyAnswer(initialLeitner(), 'known', today)).toMatchObject({ status: 'known', due: null });
  });
  it('아는 단어에서 몰라요 → 다시 1칸', () => {
    const s = applyAnswer(applyAnswer(initialLeitner(), 'known', today), 'unknown', today);
    expect(s).toMatchObject({ status: 'unknown', box: 1 });
  });
});
