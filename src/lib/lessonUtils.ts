import type { Lesson, Sentence, Structure, GrammarPoint, Vocab } from './types';
import { wordTokens } from './text';

export const flatSentences = (l: Lesson): Sentence[] => l.paragraphs.flatMap((p) => p.sentences);
export const structureOf = (l: Lesson, sid: string): Structure | undefined => l.structures.find((x) => x.sentenceId === sid);
export const grammarOf = (l: Lesson, sid: string): GrammarPoint[] => l.grammar.filter((g) => g.sentenceId === sid);
export const vocabOf = (l: Lesson, sid: string): Vocab[] => l.vocab.filter((v) => v.sentenceId === sid);

export interface Piece {
  text: string;
  start: number;
  vocabId?: string;
  grammarId?: string;
  word?: string; // 이 조각이 속한 단어
  slashBefore?: boolean;
}

/** 문장을 하이라이트·단어·끊어 읽기 경계로 쪼갠다. 조각을 이으면 원문과 같다. */
export function segmentSentence(
  en: string,
  o: { vocab?: Vocab[]; grammar?: GrammarPoint[]; structure?: Structure; slashes?: boolean },
): Piece[] {
  const n = en.length;
  const cuts = new Set<number>([0, n]);
  const vocabR: { s: number; e: number; id: string }[] = [];
  const gramR: { s: number; e: number; id: string }[] = [];
  for (const v of o.vocab ?? []) {
    const i = en.indexOf(v.matchText);
    if (i >= 0) vocabR.push({ s: i, e: i + v.matchText.length, id: v.id });
  }
  for (const g of o.grammar ?? []) {
    for (const h of g.highlight) {
      const i = en.indexOf(h);
      if (i >= 0) gramR.push({ s: i, e: i + h.length, id: g.id });
    }
  }
  const words = wordTokens(en);
  const slashAt = new Set<number>();
  if (o.slashes && o.structure) {
    let pos = 0;
    o.structure.chunks.forEach((c, i) => {
      if (i > 0) slashAt.add(pos);
      pos += c.text.length + 1;
    });
  }
  for (const r of [...vocabR, ...gramR]) {
    cuts.add(r.s);
    cuts.add(r.e);
  }
  for (const w of words) {
    cuts.add(w.start);
    cuts.add(w.end);
  }
  for (const p of slashAt) cuts.add(p);
  const sorted = [...cuts].filter((x) => x >= 0 && x <= n).sort((a, b) => a - b);
  const out: Piece[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (a === b) continue;
    const piece: Piece = { text: en.slice(a, b), start: a };
    const v = vocabR.find((r) => r.s <= a && b <= r.e);
    if (v) piece.vocabId = v.id;
    const g = gramR.find((r) => r.s <= a && b <= r.e);
    if (g) piece.grammarId = g.id;
    const w = words.find((t) => t.start <= a && b <= t.end);
    if (w) piece.word = w.text;
    if (slashAt.has(a)) piece.slashBefore = true;
    out.push(piece);
  }
  return out;
}
