// scripts/validate_lessons.py 의 check() 를 그대로 옮긴 것. 둘 중 하나를 바꾸면 다른 쪽도 바꾼다.
// tests/validate.test.ts 가 같은 파일(정상 샘플 + tests/fixtures/broken)로 파이썬과 결과가 같은지 확인한다.
import schema from '../../lesson.schema.json';
import { validateSchema } from './jsonSchema';
import type { RawLesson } from './types';
import { wordKey, wordTokens } from './text';

const TOL = 15;
const WORDS: Record<string, Record<number, [number, number]>> = {
  general: { 1: [100, 150], 2: [150, 200], 3: [200, 250], 4: [250, 300] },
  news: { 1: [100, 200], 2: [150, 250], 3: [200, 300], 4: [250, 350] },
  part7: { 1: [100, 150], 2: [150, 200], 3: [200, 250], 4: [250, 300] },
  part6: { 1: [80, 130], 2: [100, 150], 3: [120, 170], 4: [140, 190] },
  part5: { 1: [80, 150], 2: [100, 180], 3: [120, 220], 4: [150, 260] },
};
const Q_COUNT: Record<string, number> = { part5: 10, part6: 5, part7: 3 };
export const BLANK = '-------';

export const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

export interface ValidateOptions {
  /** 들어 있는 폴더 이름(= track 이어야 함). 가져오기처럼 경로가 없으면 생략 */
  folderTrack?: string;
  /** 파일 이름(확장자 제외, = id 여야 함) */
  fileStem?: string;
  /** glossary(모든 단어 뜻)가 아예 없어도 오류로 볼지. 저장소 파일은 true(파이썬 검사기와 같음), 가져오기·옛 캐시는 false */
  requireGlossary?: boolean;
}

export function validateLesson(data: unknown, opts: ValidateOptions = {}): string[] {
  const schemaErrs = validateSchema(schema as Record<string, unknown>, data);
  if (schemaErrs.length) return schemaErrs.map((e) => `스키마: ${e.path}: ${e.message}`);
  const d = data as RawLesson;
  const errs: string[] = [];
  const err = (m: string) => errs.push(m);
  const track = d.track;
  const lv = d.level;
  const kind = track === 'toeic' ? (d.chapter as string) : d.genre === 'news' ? 'news' : 'general';

  const base = `${d.date}-L${lv}`;
  let expId: string;
  let idOk: boolean;
  if (track === 'toeic') {
    expId = `${base}-${d.chapter}`;
    idOk = d.id === expId;
  } else {
    // 이야기: base, base-2 … base-9 / 뉴스(genre=news): base-news, base-news2 …
    expId = base + (kind === 'news' ? '-news(2~9)' : '(-2~9)');
    const sfx = d.id.startsWith(base) ? d.id.slice(base.length) : null;
    idOk = sfx !== null && (kind === 'news' ? /^-news[2-9]?$/ : /^(-[2-9])?$/).test(sfx);
  }
  if (!idOk) err(`id는 ${expId} 이어야 함 (현재 ${d.id})`);
  if (opts.fileStem !== undefined && opts.fileStem !== d.id) err(`파일명(${opts.fileStem})과 id가 다름`);
  if (opts.folderTrack !== undefined && opts.folderTrack !== track) err(`폴더(${opts.folderTrack})와 track(${track})이 다름`);

  const lic = d.source.license;
  if (track === 'general' && lic === 'original') err('일반 필사는 퍼블릭 도메인 원문만');
  if (track === 'toeic' && lic !== 'original') err('토익은 직접 쓴 지문만 (license=original)');
  if (lic !== 'original' && !d.source.url) err('원문 링크(source.url) 없음');

  for (const key of ['paragraphs', 'sentences', 'vocab', 'structures', 'grammar', 'questions'] as const) {
    const ids = ((d[key] ?? []) as { id: string }[]).map((x) => x.id);
    const dup = [...new Set(ids.filter((i, k) => ids.indexOf(i) !== k))].sort();
    if (dup.length) err(`${key} id 중복: ${JSON.stringify(dup)}`);
  }

  const sents = new Map(d.sentences.map((s) => [s.id, s]));
  const paras = new Map(d.paragraphs.map((p) => [p.id, p]));
  const order: string[] = [];
  for (const p of d.paragraphs) {
    for (const sid of p.sentenceIds) {
      const s = sents.get(sid);
      if (!s) err(`${p.id}: 없는 문장 ${sid}`);
      else if (s.paragraphId !== p.id) err(`${sid}.paragraphId가 ${p.id}가 아님`);
      order.push(sid);
    }
  }
  if (order.join('\u0000') !== d.sentences.map((s) => s.id).join('\u0000')) err('paragraphs.sentenceIds 순서가 sentences 순서와 다름');
  for (const s of d.sentences) {
    if (!paras.has(s.paragraphId!)) err(`${s.id}: 없는 문단 ${s.paragraphId}`);
    if (s.en !== s.en.trim() || s.en.includes('  ')) err(`${s.id}: 앞뒤 공백이나 이중 공백`);
    const a = s.audioStartSec;
    const b = s.audioEndSec;
    if (a != null && b != null && b <= a) err(`${s.id}: audioEndSec <= audioStartSec`);
  }

  const wc = countWords(d.sentences.map((s) => s.en).join(' '));
  if (wc !== d.wordCount) err(`wordCount ${d.wordCount} != 실제 ${wc}`);
  const [lo, hi] = WORDS[kind][lv];
  if (!(lo - TOL <= wc && wc <= hi + TOL)) err(`단어 수 ${wc}가 ${kind} 레벨 ${lv} 범위 ${lo}~${hi}(±${TOL}) 밖`);

  for (const v of d.vocab) {
    const s = sents.get(v.sentenceId);
    if (!s) err(`${v.id}: 없는 문장 ${v.sentenceId}`);
    else if (!s.en.includes(v.matchText)) err(`${v.id}: matchText '${v.matchText}'가 ${v.sentenceId}에 없음`);
    if (track === 'toeic' && !(1 <= (v.synonyms ?? []).length && (v.synonyms ?? []).length <= 3)) err(`${v.id}: 토익 단어는 synonyms 1~3개`);
    // 저장소 레슨(requireGlossary): 모든 단어에 발음기호와 유사 단어. 가져오기·옛 사본은 검사 안 함
    if (opts.requireGlossary) {
      if (!v.ipa) err(`${v.id}: ipa(발음기호) 없음`);
      if (track === 'general' && !(1 <= (v.synonyms ?? []).length && (v.synonyms ?? []).length <= 3)) err(`${v.id}: synonyms(유사 단어) 1~3개`);
    }
  }
  const nv = d.vocab.length;
  if (kind === 'part5') {
    if (!(3 <= nv && nv <= 5)) err(`part5 vocab은 3~5개 (현재 ${nv})`);
  } else if (nv !== 5) err(`vocab은 5개 (현재 ${nv})`);

  // 모든 단어 뜻(glossary): key 목록이 지문 단어와 정확히 같아야 함
  const gkeys = d.glossary || opts.requireGlossary ? glossaryKeys(d) : [];
  const gl = d.glossary ?? {};
  const missing = gkeys.filter((k) => !(k in gl));
  const extra = Object.keys(gl).filter((k) => !gkeys.includes(k));
  if (missing.length) err(`glossary에 없는 단어 ${missing.length}개: ${missing.slice(0, 20).join(', ')}`);
  if (extra.length) err(`glossary에 지문에 없는 단어: ${extra.slice(0, 20).join(', ')}`);

  for (const st of d.structures) {
    const s = sents.get(st.sentenceId);
    if (!s) {
      err(`${st.id}: 없는 문장 ${st.sentenceId}`);
      continue;
    }
    const joined = st.chunks.map((c) => c.text).join(' ');
    if (joined !== s.en) err(`${st.id}: chunks를 이은 문장이 원문과 다름\n    chunks: ${joined}\n    원문  : ${s.en}`);
  }
  const loSt = kind === 'part5' ? 1 : 2;
  if (!(loSt <= d.structures.length && d.structures.length <= 3)) err(`structures는 ${loSt}~3개`);

  for (const g of d.grammar) {
    const s = sents.get(g.sentenceId);
    if (!s) {
      err(`${g.id}: 없는 문장 ${g.sentenceId}`);
      continue;
    }
    for (const h of g.highlight) if (!s.en.includes(h)) err(`${g.id}: highlight '${h}'가 ${g.sentenceId}에 없음`);
  }
  if (!(2 <= d.grammar.length && d.grammar.length <= 3)) err('grammar는 2~3개');

  if (track === 'toeic') {
    const qs = d.questions ?? [];
    if (qs.length !== Q_COUNT[kind]) err(`${kind} 문제는 ${Q_COUNT[kind]}개 (현재 ${qs.length})`);
    if (qs.map((q) => q.number).join(',') !== qs.map((_, i) => i + 1).join(',')) err('questions.number는 1부터 차례대로');
    const usedBlank: string[] = [];
    for (const q of qs) {
      const tag = q.id;
      if (!q.type.startsWith(`${kind}-`)) err(`${tag}: type ${q.type}은 ${kind}에 맞지 않음`);
      if (q.choices.map((c) => c.key).join(',') !== 'A,B,C,D') err(`${tag}: 보기 key는 A,B,C,D 순서`);
      const texts = q.choices.map((c) => c.text.trim().toLowerCase());
      if (new Set(texts).size !== 4) err(`${tag}: 같은 보기가 있음`);
      const ans = q.choices.find((c) => c.key === q.answer)?.text;
      if (kind === 'part5' || kind === 'part6') {
        const b = q.blank;
        if (!b) {
          err(`${tag}: Part 5·6은 blank 필요`);
          continue;
        }
        if (q.prompt !== null && q.prompt !== undefined && q.prompt !== '') err(`${tag}: Part 5·6은 prompt를 null로 (앱이 빈칸 문장을 만듦)`);
        const s = sents.get(b.sentenceId);
        if (!s) {
          err(`${tag}: 없는 문장 ${b.sentenceId}`);
          continue;
        }
        const cnt = countOccurrences(s.en, b.answerText);
        if (cnt !== 1) err(`${tag}: answerText '${b.answerText}'가 ${b.sentenceId}에 ${cnt}번 있음 (정확히 1번이어야 빈칸 위치가 정해짐)`);
        if (ans === undefined || ans.trim().toLowerCase() !== b.answerText.trim().toLowerCase()) err(`${tag}: 정답 보기 '${ans}'와 answerText '${b.answerText}'가 다름`);
        if (q.type === 'part6-sentence' && b.answerText !== s.en) err(`${tag}: 문장 넣기 문제는 answerText가 문장 전체여야 함`);
        if (usedBlank.includes(b.sentenceId) && kind === 'part5') err(`${tag}: Part 5는 문장 하나에 문제 하나`);
        usedBlank.push(b.sentenceId);
      } else {
        if (!q.prompt) err(`${tag}: Part 7은 질문(prompt) 필요`);
        const ev = q.evidenceSentenceIds ?? [];
        if (!ev.length) err(`${tag}: Part 7은 근거 문장(evidenceSentenceIds) 필요`);
        for (const sid of ev) if (!sents.has(sid)) err(`${tag}: 없는 근거 문장 ${sid}`);
      }
    }
    if (kind === 'part5') {
      if (d.sentences.length !== 10 || d.paragraphs.some((p) => p.sentenceIds.length !== 1)) err('Part 5는 문장 10개, 문단마다 문장 1개');
      if ([...usedBlank].sort().join(',') !== [...sents.keys()].sort().join(',')) err('Part 5는 모든 문장에 문제가 하나씩');
    }
    if (kind === 'part6' && qs.filter((q) => q.type === 'part6-sentence').length !== 1) err('Part 6은 문장 넣기 문제(part6-sentence)가 정확히 1개');
    if (kind === 'part6') {
      const idx = new Map(d.sentences.map((s, i) => [s.id, i]));
      const pos = qs.filter((q) => q.blank).map((q) => idx.get(q.blank!.sentenceId) ?? -1);
      if (pos.join(',') !== [...pos].sort((a, b) => a - b).join(',')) err('Part 6 문제 순서는 지문 속 빈칸 순서와 같아야 함');
    }
    const answers = qs.map((q) => q.answer);
    if (qs.length >= 5 && Math.max(...['A', 'B', 'C', 'D'].map((k) => answers.filter((a) => a === k).length)) > Math.floor(qs.length / 2)) {
      err(`정답이 한 보기에 몰림: ${JSON.stringify(answers)}`);
    }
  }

  const au = d.audio;
  if (track === 'toeic' && au !== null) err('토익은 audio = null (앱 TTS 사용)');
  if (au && au.startSec != null && au.endSec != null) {
    if (au.endSec <= au.startSec || au.endSec > au.durationSec + 1) err('audio startSec/endSec 범위 오류');
  }
  return errs;
}

/** 파이썬 str.count 와 같게: 겹치지 않는 횟수 */
export function countOccurrences(s: string, sub: string): number {
  if (!sub) return s.length + 1;
  let n = 0;
  let i = s.indexOf(sub);
  while (i >= 0) {
    n++;
    i = s.indexOf(sub, i + sub.length);
  }
  return n;
}

/** 빈칸 문장 만들기: answerText(정확히 한 번)를 -------로 */
export function blankedSentence(en: string, answerText: string): string {
  const i = en.indexOf(answerText);
  if (i < 0) return en;
  return en.slice(0, i) + BLANK + en.slice(i + answerText.length);
}

/** glossary 에 있어야 할 단어 key(지문 등장 순서). scripts/glossary_words.py 의 glossary_keys 와 같다. */
export function glossaryKeys(d: Pick<RawLesson, 'sentences'>): string[] {
  const out: string[] = [];
  for (const s of d.sentences) {
    for (const t of wordTokens(s.en)) {
      const k = wordKey(t.text);
      if (/^[0-9]+$/.test(k) || out.includes(k)) continue;
      out.push(k);
    }
  }
  return out;
}
