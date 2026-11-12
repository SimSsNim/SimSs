import { describe, it, expect } from 'vitest';
import { wordKey, scoreTyping, diffChars, answerEq } from '../src/lib/text';

describe('wordKey', () => {
  it('소문자·공백·따옴표 정리', () => {
    expect(wordKey('  Lift   Up ')).toBe('lift up');
    expect(wordKey('Don’t')).toBe("don't");
    expect(wordKey('Certificate of\tCompletion')).toBe('certificate of completion');
  });
});

describe('타이핑 비교', () => {
  const target = '“That’s for me, as I am a Fox,” said Master Reynard.';
  const strict = { ignoreCase: false, ignorePunctuation: false };
  it('원문 그대로 → 100', () => {
    expect(scoreTyping(target, target, strict).accuracy).toBe(100);
  });
  it('곧은 따옴표도 같게 본다', () => {
    expect(scoreTyping(target, '"That\'s for me, as I am a Fox," said Master Reynard.', strict).accuracy).toBe(100);
  });
  it('한 글자 틀리면 100 미만', () => {
    const r = scoreTyping(target, '“That’s for me, as I am a Fax,” said Master Reynard.', strict);
    expect(r.accuracy).toBeLessThan(100);
    expect(r.wrongWords).toContain('Fox');
  });
  it('대소문자 옵션', () => {
    const t = 'said Master Reynard.';
    expect(scoreTyping(t, 'said master reynard.', strict).accuracy).toBeLessThan(100);
    expect(scoreTyping(t, 'said master reynard.', { ...strict, ignoreCase: true }).accuracy).toBe(100);
  });
  it('구두점 옵션', () => {
    const t = 'Good-day, Mistress Crow.';
    expect(scoreTyping(t, 'Good day Mistress Crow', strict).accuracy).toBeLessThan(100);
    expect(scoreTyping(t, 'Good day Mistress Crow', { ...strict, ignorePunctuation: true }).accuracy).toBe(100);
  });
  it('글자 단위 실시간 비교', () => {
    const d = diffChars('A “b”', 'A "c', strict);
    expect(d.map((x) => x.state)).toEqual(['ok', 'ok', 'ok', 'bad', 'pending']);
  });
  it('빈칸 정답 비교', () => {
    expect(answerEq('  The Moment she ', 'the moment she')).toBe(true);
  });
});

describe('단어 단위 실시간 비교', () => {
  const strict = { ignoreCase: false, ignorePunctuation: false };
  it('한 글자 빠뜨려도 뒤 단어는 맞게 본다', () => {
    const t = 'piece of cheese in its beak';
    const d = diffChars(t, 'piece of chese in its beak', strict);
    const bad = d.map((x, i) => (x.state === 'bad' ? i : -1)).filter((i) => i >= 0);
    // 'cheese' 안에서만 틀림 표시
    expect(bad.every((i) => i >= t.indexOf('cheese') && i < t.indexOf('cheese') + 6)).toBe(true);
    expect(d[t.indexOf('beak')].state).toBe('ok');
  });
  it('입력 중인 단어는 남은 글자가 대기 상태', () => {
    const d = diffChars('said Master', 'said Mas', strict);
    expect(d.map((x) => x.state).join(',')).toBe('ok,ok,ok,ok,ok,ok,ok,ok,pending,pending,pending');
  });
});
