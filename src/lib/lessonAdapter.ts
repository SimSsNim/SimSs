import type { Lesson, Level, RawLesson } from './types';

export const GENRE_KO: Record<string, string> = {
  fable: '우화', 'fairy-tale': '동화', 'short-story': '단편', speech: '연설', essay: '수필', news: '뉴스',
  email: '이메일', letter: '편지', memo: '메모', notice: '공지', announcement: '안내', advertisement: '광고',
  article: '기사', review: '후기', schedule: '일정표', chat: '채팅', form: '양식', sentences: '문장 10개',
};

export const POS_SHORT: Record<string, string> = {
  noun: 'n.', verb: 'v.', adjective: 'adj.', adverb: 'adv.', preposition: 'prep.', conjunction: 'conj.',
  phrase: '구', idiom: '숙어', 'phrasal-verb': '구동사',
};

/** 검증을 통과한 원본 레슨 → 화면용 형태. 원문 문자열은 바꾸지 않는다. */
export function toViewLesson(raw: RawLesson): Lesson {
  const byId = new Map(raw.sentences.map((s) => [s.id, s]));
  const paragraphs = raw.paragraphs.map((p) => {
    const sentences = p.sentenceIds.map((id) => byId.get(id)!).filter(Boolean);
    return { id: p.id, ko: p.ko, sentences, en: sentences.map((s) => s.en).join(' ') };
  });
  const a = raw.audio;
  return {
    schemaVersion: 2,
    id: raw.id,
    track: raw.track,
    chapter: raw.chapter ?? null,
    date: raw.date,
    level: raw.level as Level,
    title: raw.title,
    titleKo: raw.titleKo,
    genre: raw.genre,
    genreKo: GENRE_KO[raw.genre] ?? raw.genre,
    tags: raw.tags ?? [],
    wordCount: raw.wordCount,
    source: raw.source,
    audio: a ? { mp3: a.mp3, mp3Low: a.mp3Low, reader: a.reader, durationSec: a.durationSec, librivoxUrl: a.pageUrl, startSec: a.startSec, endSec: a.endSec, note: a.note } : null,
    paragraphs,
    vocab: raw.vocab,
    structures: raw.structures.map((s) => ({ id: s.id, sentenceId: s.sentenceId, chunks: s.chunks, skeleton: s.skeleton, explanationKo: s.explanation })),
    grammar: raw.grammar.map((g) => ({
      id: g.id, title: g.title, tags: g.tags, sentenceId: g.sentenceId, highlight: g.highlight,
      explanationKo: g.explanation, examples: g.example ? [g.example] : [], note: g.note ?? undefined,
    })),
    questions: raw.questions ?? [],
    raw,
  };
}
