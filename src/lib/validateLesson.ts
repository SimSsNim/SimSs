// scripts/validate_lessons.py 와 같은 규칙. 둘 중 하나를 바꾸면 다른 쪽도 바꾼다.
import type { Lesson, Track } from './types';

const ROLES = new Set(['S', 'V', 'O', 'C', 'M', 'CONJ']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LICENSE_BY_TRACK: Record<Track, string[]> = { general: ['public-domain', 'us-government-work'], toeic: ['original'] };
const TOP_KEYS = new Set([
  'schemaVersion', 'id', 'track', 'date', 'level', 'title', 'titleKo', 'genre', 'genreKo',
  'wordCount', 'source', 'audio', 'paragraphs', 'vocab', 'structures', 'grammar',
]);

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown, allowEmpty = false): v is string => typeof v === 'string' && (allowEmpty || v.length > 0);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

export interface ValidateOptions {
  folderTrack?: string;
  fileStem?: string;
}

export function validateLesson(data: unknown, opts: ValidateOptions = {}): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);
  if (!isObj(data)) return ['레슨 최상위는 객체여야 합니다'];

  for (const k of TOP_KEYS) if (k !== 'genreKo' && !(k in data)) err(`필수 항목 '${k}' 이(가) 없습니다`);
  for (const k of Object.keys(data)) if (!TOP_KEYS.has(k)) err(`알 수 없는 항목 '${k}'`);
  if (errors.length) return errors;

  if (data.schemaVersion !== 1) err('schemaVersion 은 1 이어야 합니다');
  if (!(isStr(data.id) && DATE_RE.test(data.id))) err('id 는 YYYY-MM-DD 형식이어야 합니다');
  if (!(isStr(data.date) && DATE_RE.test(data.date))) err('date 는 YYYY-MM-DD 형식이어야 합니다');
  const track = data.track as Track;
  if (track !== 'general' && track !== 'toeic') err(`track 은 general 또는 toeic 이어야 합니다 (현재: ${JSON.stringify(track)})`);
  if (opts.folderTrack !== undefined && track !== opts.folderTrack) err(`track(${track}) 이 폴더 이름(${opts.folderTrack}) 과 다릅니다`);
  if (opts.fileStem !== undefined && data.id !== opts.fileStem) err(`id(${String(data.id)}) 가 파일 이름(${opts.fileStem}) 과 다릅니다`);
  if (!(Number.isInteger(data.level) && (data.level as number) >= 1 && (data.level as number) <= 5)) err('level 은 1~5 정수여야 합니다');
  for (const k of ['title', 'titleKo', 'genre']) if (!isStr(data[k])) err(`${k} 는 비어 있지 않은 문자열이어야 합니다`);

  const src = data.source;
  if (!isObj(src) || !('license' in src)) err('source.license 가 없습니다');
  else if (LICENSE_BY_TRACK[track] && !LICENSE_BY_TRACK[track].includes(src.license as string)) {
    err(`${track} 트랙의 source.license 는 ${LICENSE_BY_TRACK[track].join(', ')} 만 허용됩니다 (현재: ${JSON.stringify(src.license)})`);
  }

  const audio = data.audio;
  if (audio !== null) {
    if (track === 'toeic') err('toeic 트랙의 audio 는 null 이어야 합니다');
    if (!isObj(audio) || !isStr(audio.mp3)) err('audio.mp3 가 없습니다');
    else if (!audio.mp3.startsWith('https://')) err('audio.mp3 는 https:// 로 시작해야 합니다');
  }

  const sentences = new Map<string, string>();
  let paragraphs = data.paragraphs as unknown[];
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
    err('paragraphs 는 1개 이상이어야 합니다');
    paragraphs = [];
  }
  const allEn: string[] = [];
  const paraIds = new Set<string>();
  paragraphs.forEach((p, pi) => {
    const where = `paragraphs[${pi}]`;
    if (!isObj(p)) return err(`${where} 는 객체여야 합니다`);
    const pid = p.id;
    if (!isStr(pid)) err(`${where}.id 가 없습니다`);
    else if (paraIds.has(pid)) err(`문단 id '${pid}' 가 중복됩니다`);
    else paraIds.add(pid);
    const sents = p.sentences;
    if (!Array.isArray(sents) || sents.length === 0) return err(`${where}.sentences 는 1개 이상이어야 합니다`);
    const texts: string[] = [];
    sents.forEach((s, si) => {
      const sw = `${where}.sentences[${si}]`;
      if (!isObj(s)) return err(`${sw} 는 객체여야 합니다`);
      const sid = s.id;
      if (!isStr(sid)) return err(`${sw}.id 가 없습니다`);
      if (sentences.has(sid)) err(`문장 id '${sid}' 가 중복됩니다`);
      let en = s.en;
      if (!isStr(en)) {
        err(`문장 ${sid}: en 이 비어 있습니다`);
        en = '';
      } else if (en !== en.trim()) err(`문장 ${sid}: en 앞뒤에 공백이 있습니다`);
      if (!isStr(s.ko)) err(`문장 ${sid}: ko 가 비어 있습니다`);
      for (const k of ['audioStartSec', 'audioEndSec']) {
        const v = s[k];
        if (v !== undefined && v !== null && (!isNum(v) || v < 0)) err(`문장 ${sid}: ${k} 는 0 이상 숫자 또는 null 이어야 합니다`);
      }
      sentences.set(sid, en as string);
      texts.push(en as string);
    });
    if (p.en !== texts.join(' ')) err(`문단 ${String(pid)}: 문장들을 공백 하나로 이은 값이 문단 en 과 다릅니다`);
    allEn.push(isStr(p.en, true) ? p.en : '');
  });

  const wc = countWords(allEn.join(' '));
  if (data.wordCount !== wc) err(`wordCount(${String(data.wordCount)}) 가 실제 단어 수(${wc}) 와 다릅니다`);

  const needSentence = (sid: unknown, where: string): string | null => {
    if (!isStr(sid) || !sentences.has(sid)) {
      err(`${where}: 없는 sentenceId '${String(sid)}'`);
      return null;
    }
    return sentences.get(sid)!;
  };

  let vocab = data.vocab as unknown[];
  if (!Array.isArray(vocab) || vocab.length === 0) {
    err('vocab 는 1개 이상이어야 합니다');
    vocab = [];
  }
  const vids = new Set<unknown>();
  vocab.forEach((v, vi) => {
    const where = `vocab[${vi}]`;
    if (!isObj(v)) return err(`${where} 는 객체여야 합니다`);
    for (const k of ['id', 'term', 'pos', 'meaningKo', 'sentenceId', 'matchText']) {
      if (!isStr(v[k], k === 'pos')) err(`${where}.${k} 가 없습니다`);
    }
    if (vids.has(v.id)) err(`단어 id '${String(v.id)}' 가 중복됩니다`);
    vids.add(v.id);
    const en = needSentence(v.sentenceId, `${where}(${String(v.term)})`);
    if (en !== null && isStr(v.matchText) && !en.includes(v.matchText)) {
      err(`${where}(${String(v.term)}): matchText '${v.matchText}' 가 문장 ${String(v.sentenceId)} 에 없습니다`);
    }
    if (v.synonyms !== undefined && (!Array.isArray(v.synonyms) || !v.synonyms.every((x) => isStr(x)))) {
      err(`${where}.synonyms 는 문자열 배열이어야 합니다`);
    }
  });

  let structures = data.structures as unknown[];
  if (!Array.isArray(structures)) {
    err('structures 는 배열이어야 합니다');
    structures = [];
  }
  const seenStruct = new Set<unknown>();
  structures.forEach((st, ti) => {
    const where = `structures[${ti}]`;
    if (!isObj(st)) return err(`${where} 는 객체여야 합니다`);
    const sid = st.sentenceId;
    if (seenStruct.has(sid)) err(`${where}: 문장 ${String(sid)} 의 구조 분석이 두 번 있습니다`);
    seenStruct.add(sid);
    const en = needSentence(sid, where);
    const chunks = st.chunks;
    if (!Array.isArray(chunks) || chunks.length < 2) return err(`${where}.chunks 는 2개 이상이어야 합니다`);
    const texts: string[] = [];
    chunks.forEach((c, ci) => {
      if (!isObj(c) || !isStr(c.text)) return err(`${where}.chunks[${ci}].text 가 없습니다`);
      if (!ROLES.has(c.role as string)) err(`${where}.chunks[${ci}].role '${String(c.role)}' 은(는) S/V/O/C/M/CONJ 중 하나여야 합니다`);
      if ('sub' in c && typeof c.sub !== 'boolean') err(`${where}.chunks[${ci}].sub 는 true/false 여야 합니다`);
      if (typeof c.ko !== 'string') err(`${where}.chunks[${ci}].ko 가 없습니다`);
      texts.push(c.text);
    });
    if (en !== null && texts.join(' ') !== en) err(`${where}: 청크를 공백 하나로 이은 값이 문장 ${String(sid)} 과 다릅니다`);
    if (!isStr(st.skeleton)) err(`${where}.skeleton 이 없습니다`);
    if (typeof st.explanationKo !== 'string') err(`${where}.explanationKo 가 없습니다`);
  });

  let grammar = data.grammar as unknown[];
  if (!Array.isArray(grammar)) {
    err('grammar 는 배열이어야 합니다');
    grammar = [];
  }
  const gids = new Set<unknown>();
  grammar.forEach((g, gi) => {
    const where = `grammar[${gi}]`;
    if (!isObj(g)) return err(`${where} 는 객체여야 합니다`);
    for (const k of ['id', 'title', 'sentenceId', 'explanationKo']) if (!isStr(g[k])) err(`${where}.${k} 가 없습니다`);
    if (gids.has(g.id)) err(`문법 id '${String(g.id)}' 가 중복됩니다`);
    gids.add(g.id);
    const tags = g.tags;
    if (!Array.isArray(tags) || tags.length === 0 || !tags.every((t) => isStr(t))) err(`${where}.tags 는 1개 이상의 문자열이어야 합니다`);
    const en = needSentence(g.sentenceId, where);
    const hl = g.highlight;
    if (!Array.isArray(hl) || hl.length === 0) err(`${where}.highlight 는 1개 이상이어야 합니다`);
    else if (en !== null) {
      for (const h of hl) if (!isStr(h) || !en.includes(h)) err(`${where}: highlight '${String(h)}' 가 문장 ${String(g.sentenceId)} 에 없습니다`);
    }
  });

  return errors;
}

export function asLesson(data: unknown, opts?: ValidateOptions): { lesson: Lesson | null; errors: string[] } {
  const errors = validateLesson(data, opts);
  return { lesson: errors.length ? null : (data as Lesson), errors };
}
