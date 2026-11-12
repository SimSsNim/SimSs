// lesson.schema.json 을 그대로 옮긴 타입. 스키마를 바꾸면 여기도 바꾼다(tests/validate.test.ts 가 샘플로 확인).
export type Track = 'general' | 'toeic';
export const TRACKS: Track[] = ['general', 'toeic'];
export type Role = 'S' | 'V' | 'O' | 'C' | 'M' | 'CONJ';

export interface Sentence {
  id: string;
  en: string;
  ko: string;
  audioStartSec?: number | null;
  audioEndSec?: number | null;
}
export interface Paragraph {
  id: string;
  en: string;
  ko: string;
  sentences: Sentence[];
}
export interface Example {
  en: string;
  ko: string;
}
export interface Vocab {
  id: string;
  term: string;
  pos: string;
  ipa?: string;
  meaningKo: string;
  sentenceId: string;
  matchText: string;
  example?: Example;
  synonyms?: string[];
}
export interface Chunk {
  text: string;
  role: Role;
  sub?: boolean;
  ko: string;
}
export interface Structure {
  sentenceId: string;
  chunks: Chunk[];
  skeleton: string;
  explanationKo: string;
}
export interface GrammarPoint {
  id: string;
  title: string;
  tags: string[];
  sentenceId: string;
  highlight: string[];
  explanationKo: string;
  examples?: Example[];
  note?: string;
}
export interface Audio {
  mp3: string;
  mp3Low?: string | null;
  reader?: string;
  durationSec?: number | null;
  librivoxUrl?: string | null;
}
export interface Source {
  author?: string;
  work?: string;
  translator?: string;
  year?: number;
  url?: string;
  license: 'public-domain' | 'us-government-work' | 'original';
  note?: string;
}
export interface Lesson {
  schemaVersion: 1;
  id: string;
  track: Track;
  date: string;
  level: number;
  title: string;
  titleKo: string;
  genre: string;
  genreKo?: string;
  wordCount: number;
  source: Source;
  audio: Audio | null;
  paragraphs: Paragraph[];
  vocab: Vocab[];
  structures: Structure[];
  grammar: GrammarPoint[];
}

export interface IndexEntry {
  track: Track;
  id: string;
  file: string;
  date: string;
  level?: number;
  title: string;
  titleKo?: string;
  genre?: string;
  genreKo?: string | null;
  wordCount?: number;
  hasAudio?: boolean;
  errors?: string[];
}
export interface LessonIndex {
  version: number;
  generatedAt: string;
  lessons: IndexEntry[];
}

export const lessonKeyOf = (track: Track, id: string) => `${track}/${id}`;
export const isTrack = (v: unknown): v is Track => v === 'general' || v === 'toeic';
export const TRACK_LABEL: Record<Track, string> = { general: '일반 필사', toeic: '토익' };
