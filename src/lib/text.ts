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
 * 타이핑 필사 실시간 비교. 단어 단위로 맞춰 본 뒤 단어 안에서 글자를 비교한다
 * (한 글자를 빠뜨려도 뒤 단어들이 줄줄이 틀리지 않게).
 * 따옴표 모양은 항상 같게 본다(“ ” ‘ ’ = " ').
 */
export function diffChars(target: string, typed: string, o: CompareOptions): CharDiff[] {
  const eqCh = (a: string, b: string) => {
    let x = normalizeQuotes(a);
    let y = normalizeQuotes(b);
    if (o.ignoreCase) {
      x = x.toLowerCase();
      y = y.toLowerCase();
    }
    PUNCT_RE.lastIndex = 0;
    if (o.ignorePunctuation && PUNCT_RE.test(x)) {
      PUNCT_RE.lastIndex = 0;
      return true;
    }
    PUNCT_RE.lastIndex = 0;
    return x === y;
  };
  const tTok = [...target.matchAll(/\S+/g)].map((m) => ({ s: m.index!, text: m[0] }));
  const uTok = typed.split(/\s+/).filter((w, i, a) => w !== '' || i === a.length - 1);
  const typedEndsWithSpace = /\s$/.test(typed);
  const done = typed.trim() === '' ? 0 : typedEndsWithSpace ? uTok.filter(Boolean).length : uTok.filter(Boolean).length - 1;
  const out: CharDiff[] = [...target].map((ch) => ({ ch, state: 'pending' as CharDiff['state'] }));
  const words = uTok.filter(Boolean);
  tTok.forEach((tk, i) => {
    const u = words[i];
    if (u === undefined) return;
    const complete = i < done;
    for (let k = 0; k < tk.text.length; k++) {
      const pos = tk.s + k;
      if (k < u.length) out[pos].state = eqCh(tk.text[k], u[k]) ? 'ok' : 'bad';
      else if (complete) out[pos].state = 'bad';
    }
    if (complete && u.length > tk.text.length) out[tk.s + tk.text.length - 1].state = 'bad';
    // 단어 뒤 공백
    const after = tk.s + tk.text.length;
    if (complete && after < target.length) out[after].state = 'ok';
  });
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
