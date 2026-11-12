// 단어 key, 문장 비교, 토큰 나누기
export function wordKey(term: string): string {
  return term
    .normalize('NFC')
    .replace(/[’‘]/g, "'")
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function normalizeQuotes(s: string): string {
  return s.replace(/[“”„‟]/g, '"').replace(/[‘’‚‛]/g, "'").replace(/[–—]/g, '-');
}

export interface CompareOptions {
  ignoreCase: boolean;
  ignorePunctuation: boolean;
}

const PUNCT_RE = /[.,!?;:"'()\[\]{}…\-–—“”‘’]/g;

export function normalizeForCompare(s: string, o: CompareOptions): string {
  let t = normalizeQuotes(s.normalize('NFC'));
  if (o.ignorePunctuation) t = t.replace(PUNCT_RE, ' ');
  if (o.ignoreCase) t = t.toLowerCase();
  return t.replace(/\s+/g, ' ').trim();
}

/** 글자 단위 비교 결과: 입력한 위치까지 원문 각 글자가 맞는지 */
export interface CharDiff {
  ch: string;
  state: 'ok' | 'bad' | 'pending';
}

/**
 * 타이핑 필사 실시간 비교. 원문 글자 하나하나에 대해 입력이 같은지 본다.
 * 따옴표 모양은 항상 같게 본다(“ ” ‘ ’ = " ').
 */
export function diffChars(target: string, typed: string, o: CompareOptions): CharDiff[] {
  const out: CharDiff[] = [];
  const eq = (a: string, b: string) => {
    if (/\s/.test(a) && /\s/.test(b)) return true;
    let x = normalizeQuotes(a);
    let y = normalizeQuotes(b);
    if (o.ignoreCase) {
      x = x.toLowerCase();
      y = y.toLowerCase();
    }
    if (o.ignorePunctuation && PUNCT_RE.test(x)) {
      PUNCT_RE.lastIndex = 0;
      return true;
    }
    PUNCT_RE.lastIndex = 0;
    return x === y;
  };
  for (let i = 0; i < target.length; i++) {
    if (i >= typed.length) out.push({ ch: target[i], state: 'pending' });
    else out.push({ ch: target[i], state: eq(target[i], typed[i]) ? 'ok' : 'bad' });
  }
  return out;
}

export interface TypingResult {
  accuracy: number; // 0..100
  wrongWords: string[];
  totalWords: number;
}

/** 단어 단위 정렬(LCS)로 정확도 계산. 원문을 그대로 입력하면 100. */
export function scoreTyping(target: string, typed: string, o: CompareOptions): TypingResult {
  const tw = normalizeForCompare(target, o).split(' ').filter(Boolean);
  const uw = normalizeForCompare(typed, o).split(' ').filter(Boolean);
  const origWords = target.split(/\s+/).filter(Boolean);
  const n = tw.length;
  const m = uw.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = tw[i] === uw[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const matched = new Array<boolean>(n).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (tw[i] === uw[j]) {
      matched[i] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const lcs = dp[0][0];
  const denom = Math.max(n, m);
  const wordAcc = denom === 0 ? 100 : (lcs / denom) * 100;
  // 글자 수준 차이도 반영: 단어가 다 맞아도 문자열이 다르면 100 미만
  const exact = normalizeForCompare(target, o) === normalizeForCompare(typed, o);
  const accuracy = exact ? 100 : Math.min(99.9, Math.round(wordAcc * 10) / 10);
  const wrongWords: string[] = [];
  const mapIdx = origWords.length === n;
  matched.forEach((ok, k) => {
    if (!ok) wrongWords.push((mapIdx ? origWords[k] : tw[k]).replace(/^[“"‘'(]+|[”"’'),.!?;:]+$/g, ''));
  });
  return { accuracy, wrongWords: [...new Set(wrongWords.filter(Boolean))], totalWords: n };
}

/** 영어 단어 토큰 위치 */
export function wordTokens(s: string): { start: number; end: number; text: string }[] {
  const re = /[A-Za-z0-9]+(?:[’'\-][A-Za-z0-9]+)*/g;
  const out: { start: number; end: number; text: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  return out;
}

export function shuffle<T>(arr: T[], rand: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const answerEq = (a: string, b: string) =>
  normalizeQuotes(a).trim().replace(/\s+/g, ' ').toLowerCase() === normalizeQuotes(b).trim().replace(/\s+/g, ' ').toLowerCase();
