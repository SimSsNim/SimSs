import Dexie, { type Table } from 'dexie';
import type { Lesson, Track } from './types';
import type { WordStatus } from './leitner';

export const DB_VERSION = 1;

export interface SettingRow { key: string; value: unknown }
export interface LessonCacheRow { key: string; track: Track; id: string; lesson: Lesson; source: 'repo' | 'import'; savedAt: number }
export interface WordStateRow {
  key: string; term: string; status: WordStatus; box: number; due: string | null;
  lastReviewed: string | null; wrongCount: number; starred: boolean; lessonKeys: string[]; updatedAt: number;
}
export interface MyWordRow { id?: number; term: string; meaningKo: string; note?: string; sentence?: string; lessonKey?: string; createdAt: number }
export type ChecklistKey = 'listen' | 'read' | 'vocab' | 'grammar' | 'transcribe' | 'review';
export const CHECKLIST_KEYS: ChecklistKey[] = ['listen', 'read', 'vocab', 'grammar', 'transcribe', 'review'];
export interface LessonProgressRow {
  key: string; checklist: Record<ChecklistKey, boolean>; lastTab?: string; lastSentenceIndex?: number;
  completedAt?: number | null; openedAt?: number; listenCoverage?: number;
}
export interface SentenceMarkRow { key: string; lessonKey: string; sentenceId: string; bookmark: boolean; hard: boolean; memo: string }
export interface GrammarStateRow { key: string; lessonKey: string; grammarId: string; understood: boolean; review: boolean }
export interface AudioMarkRow { key: string; introSkipSec?: number | null; sentenceStarts: Record<string, number> }
export interface PracticeLogRow { id?: number; lessonKey: string; track: Track; kind: string; score: number | null; durationSec: number; detail?: unknown; at: number; date: string }
export interface DailyLogRow { date: string; seconds: number; lessonsTouched: string[]; actions: Record<string, number> }
export interface RecordingRow { id?: number; lessonKey: string; sentenceId: string; blob: Blob; mime: string; at: number }

export class PilsaDB extends Dexie {
  settings!: Table<SettingRow, string>;
  lessonCache!: Table<LessonCacheRow, string>;
  wordState!: Table<WordStateRow, string>;
  myWords!: Table<MyWordRow, number>;
  lessonProgress!: Table<LessonProgressRow, string>;
  sentenceMarks!: Table<SentenceMarkRow, string>;
  grammarState!: Table<GrammarStateRow, string>;
  audioMarks!: Table<AudioMarkRow, string>;
  practiceLog!: Table<PracticeLogRow, number>;
  dailyLog!: Table<DailyLogRow, string>;
  recordings!: Table<RecordingRow, number>;

  constructor(name = 'pilsa') {
    super(name);
    // 스키마를 바꿀 때는 version(2).stores(...).upgrade(...) 를 추가하고 DB_VERSION 을 올린다.
    this.version(1).stores({
      settings: 'key',
      lessonCache: 'key, track, source',
      wordState: 'key, status, due, starred',
      myWords: '++id, term, createdAt',
      lessonProgress: 'key',
      sentenceMarks: 'key, lessonKey',
      grammarState: 'key, lessonKey',
      audioMarks: 'key',
      practiceLog: '++id, lessonKey, track, kind, date, at',
      dailyLog: 'date',
      recordings: '++id, lessonKey, at',
    });
  }
}

export const db = new PilsaDB();

/** 백업 대상 테이블(녹음·레슨 캐시 중 저장소 것은 제외) */
export const BACKUP_TABLES = [
  'settings', 'wordState', 'myWords', 'lessonProgress', 'sentenceMarks', 'grammarState', 'audioMarks', 'practiceLog', 'dailyLog',
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export const emptyChecklist = (): Record<ChecklistKey, boolean> => ({
  listen: false, read: false, vocab: false, grammar: false, transcribe: false, review: false,
});
