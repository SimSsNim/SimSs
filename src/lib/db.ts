import Dexie, { type Table } from 'dexie';
import type { ChoiceKey, Chapter, QuestionType, RawLesson, Track } from './types';
import type { WordStatus } from './leitner';
import { migrateRow } from './migrate';

/** IndexedDB 버전 = 백업 파일 버전 */
export const DB_VERSION = 2;

export interface SettingRow { key: string; value: unknown }
export interface LessonCacheRow { key: string; track: Track; id: string; lesson: RawLesson; source: 'repo' | 'import'; savedAt: number }
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
export interface SentenceMarkRow { key: string; lessonKey: string; sentenceId: string; bookmark: boolean; hard: boolean; memo: string; bookmarkedAt?: number }
export interface GrammarStateRow { key: string; lessonKey: string; grammarId: string; understood: boolean; review: boolean; starred?: boolean; starredAt?: number }
export interface AudioMarkRow { key: string; introSkipSec?: number | null; sentenceStarts: Record<string, number> }
export interface PracticeLogRow { id?: number; lessonKey: string; track: Track; kind: string; score: number | null; durationSec: number; detail?: unknown; at: number; date: string }
export interface DailyLogRow { date: string; seconds: number; lessonsTouched: string[]; actions: Record<string, number> }
export interface QuizAttemptRow {
  id?: number; lessonKey: string; track: Track; level: number; chapter: Chapter; attemptNo: number; mode: 'practice' | 'exam';
  startedAt: number; finishedAt: number | null; durationSec: number; answers: Record<string, ChoiceKey>;
  /** 연습 모드에서 확인(채점)한 문제 */ checked: string[];
  score: number; total: number; inProgress: 0 | 1; remainingSec: number | null; date: string;
  /** 일부 문제만 다시 풀 때(틀린 문제만). 없으면 전체 */ questionIds?: string[];
}
export interface QuestionStateRow {
  key: string; lessonKey: string; qid: string; wrongCount: number; lastAnswer: ChoiceKey | null; lastCorrect: boolean;
  inWrongNote: 0 | 1; unsure: boolean; box: number; due: string | null; status: WordStatus; lastReviewed: string | null;
  graduatedAt: number | null; skill: string; type: QuestionType; chapter: Chapter; level: number; addedAt: number; updatedAt: number;
  /** 즐겨찾기 */ starred?: boolean; starredAt?: number;
}
export interface DismissedTipRow { key: string; date: string }
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
  quizAttempt!: Table<QuizAttemptRow, number>;
  questionState!: Table<QuestionStateRow, string>;
  dismissedTips!: Table<DismissedTipRow, string>;

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
    // v2: 레벨·Part가 들어간 레슨 키로 옮기고, 문제 풀이 테이블 추가.
    this.version(2)
      .stores({
        quizAttempt: '++id, lessonKey, track, level, chapter, inProgress, date',
        questionState: 'key, lessonKey, inWrongNote, due, chapter, level',
        dismissedTips: 'key',
      })
      .upgrade(async (tx) => {
        await tx.table('lessonCache').clear(); // v1 형식 레슨 사본은 다시 받는다
        for (const name of ['lessonProgress', 'audioMarks', 'sentenceMarks', 'grammarState']) {
          const t = tx.table(name);
          const rows = await t.toArray();
          await t.clear();
          await t.bulkPut(rows.map((r) => migrateRow(name, r)));
        }
        for (const name of ['practiceLog', 'recordings', 'myWords', 'wordState', 'dailyLog', 'settings']) {
          await tx.table(name).toCollection().modify((r: Record<string, unknown>) => {
            Object.assign(r, migrateRow(name, r));
          });
        }
      });
  }
}

export const db = new PilsaDB();

/** 백업 대상 테이블(녹음·레슨 캐시 중 저장소 것은 제외) */
export const BACKUP_TABLES = [
  'settings', 'wordState', 'myWords', 'lessonProgress', 'sentenceMarks', 'grammarState', 'audioMarks', 'practiceLog', 'dailyLog',
  'quizAttempt', 'questionState', 'dismissedTips',
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export const emptyChecklist = (): Record<ChecklistKey, boolean> => ({
  listen: false, read: false, vocab: false, grammar: false, transcribe: false, review: false,
});
