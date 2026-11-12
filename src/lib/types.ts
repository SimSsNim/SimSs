// lesson.schema.json(schemaVersion 2)을 그대로 옮긴 원본 타입(Raw*) + 화면에서 쓰는 형태(Lesson).
// 원본 → 화면 형태 변환은 src/lib/lessonAdapter.ts 한 곳에서만 한다.
export type Track = 'general' | 'toeic';
export const TRACKS: Track[] = ['general', 'toeic'];
export type Chapter = 'part5' | 'part6' | 'part7';
export const CHAPTERS: Chapter[] = ['part5', 'part6', 'part7'];
export type Level = 1 | 2 | 3 | 4;
export const LEVELS: Level[] = [1, 2, 3, 4];
export type Role = 'S' | 'V' | 'O' | 'IO' | 'C' | 'OC' | 'M' | 'CONJ';
export type ChoiceKey = 'A' | 'B' | 'C' | 'D';
export const CHOICE_KEYS: ChoiceKey[] = ['A', 'B', 'C', 'D'];
export type QuestionType =
  | 'part5-word-form' | 'part5-grammar' | 'part5-vocabulary' | 'part5-connector'
  | 'part6-word' | 'part6-sentence'
  | 'part7-purpose' | 'part7-detail' | 'part7-inference' | 'part7-not-true' | 'part7-synonym';

export interface Example { en: string; ko: string }

export interface RawSource {
  work: string; author: string; translator?: string | null; year: number; edition?: string;
  url: string | null; license: 'public-domain' | 'us-government-work' | 'original'; excerptNote?: string | null;
}
export interface RawAudio {
  mp3: string; mp3Low?: string | null; pageUrl: string; reader: string; durationSec: number;
  startSec?: number | null; endSec?: number | null; note?: string | null;
}
export interface RawParagraph { id: string; sentenceIds: string[]; ko: string }
export interface Sentence { id: string; paragraphId?: string; en: string; ko: string; audioStartSec?: number | null; audioEndSec?: number | null }
export interface Vocab {
  id: string; term: string; pos: string; meaningKo: string; ipa?: string | null; synonyms?: string[];
  matchText: string; sentenceId: string; example?: Example;
}
export interface GlossEntry { lemma: string; pos: string; ko: string; form?: string | null }
export type Glossary = Record<string, GlossEntry>;
export interface Chunk { text: string; role: Role; sub?: boolean; ko: string }
export interface RawStructure { id: string; sentenceId: string; chunks: Chunk[]; skeleton: string; explanation: string }
export interface RawGrammar { id: string; title: string; tags: string[]; sentenceId: string; highlight: string[]; explanation: string; example: Example; note?: string | null }
export interface Question {
  id: string; number: number; type: QuestionType; prompt: string | null;
  blank?: { sentenceId: string; answerText: string };
  evidenceSentenceIds?: string[];
  choices: { key: ChoiceKey; text: string }[];
  answer: ChoiceKey; explanationKo: string;
  choiceNotesKo?: Partial<Record<ChoiceKey, string>>; skill?: string;
}
export interface RawLesson {
  schemaVersion: 2; track: Track; chapter?: Chapter; id: string; date: string; level: number;
  title: string; titleKo: string; genre: string; tags?: string[];
  source: RawSource; audio: RawAudio | null; wordCount: number;
  paragraphs: RawParagraph[]; sentences: Sentence[]; vocab: Vocab[];
  structures: RawStructure[]; grammar: RawGrammar[]; glossary?: Glossary; questions?: Question[];
}

// ---- 화면에서 쓰는 형태 ----
export interface Paragraph { id: string; en: string; ko: string; sentences: Sentence[] }
export interface Structure { id: string; sentenceId: string; chunks: Chunk[]; skeleton: string; explanationKo: string }
export interface GrammarPoint { id: string; title: string; tags: string[]; sentenceId: string; highlight: string[]; explanationKo: string; examples: Example[]; note?: string }
export interface Audio { mp3: string; mp3Low?: string | null; reader?: string; durationSec?: number | null; librivoxUrl?: string | null; startSec?: number | null; endSec?: number | null; note?: string | null }
export interface Lesson {
  schemaVersion: 2; id: string; track: Track; chapter: Chapter | null; date: string; level: Level;
  title: string; titleKo: string; genre: string; genreKo: string; tags: string[]; wordCount: number;
  source: RawSource; audio: Audio | null;
  paragraphs: Paragraph[]; vocab: Vocab[]; structures: Structure[]; grammar: GrammarPoint[]; glossary: Glossary; questions: Question[];
  raw: RawLesson;
}

export interface IndexEntry {
  track: Track; chapter: Chapter | null; id: string; date: string; level: number; genre: string;
  title: string; titleKo: string; wordCount: number; hasAudio: boolean; questionCount: number; grammarTags: string[]; file: string;
}
export interface LessonIndex { schemaVersion: 2; lessons: IndexEntry[] }

export const lessonKeyOf = (track: Track, id: string) => `${track}/${id}`;
export const isTrack = (v: unknown): v is Track => v === 'general' || v === 'toeic';
export const isChapter = (v: unknown): v is Chapter => v === 'part5' || v === 'part6' || v === 'part7';
export const TRACK_LABEL: Record<Track, string> = { general: '이야기', toeic: '토익' };
export const CHAPTER_LABEL: Record<Chapter, string> = { part5: 'Part 5', part6: 'Part 6', part7: 'Part 7' };
export const CHAPTER_COUNT: Record<Chapter, number> = { part5: 10, part6: 5, part7: 3 };
/** 권장 풀이 시간(초/문항) */
export const CHAPTER_SEC_PER_Q: Record<Chapter, number> = { part5: 20, part6: 30, part7: 60 };
export const LEVEL_DESC: Record<Track, Record<Level, string>> = {
  general: { 1: '중1~2', 2: '중3', 3: '고1~2', 4: '고3·수능' },
  toeic: { 1: '500~600', 2: '600~750', 3: '750~850', 4: '850+' },
};
export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  'part5-word-form': '품사', 'part5-grammar': '문법', 'part5-vocabulary': '어휘', 'part5-connector': '전치사·접속사',
  'part6-word': '빈칸 어휘·문법', 'part6-sentence': '문장 넣기',
  'part7-purpose': '목적', 'part7-detail': '세부', 'part7-inference': '추론', 'part7-not-true': '사실 아님', 'part7-synonym': '동의어',
};
