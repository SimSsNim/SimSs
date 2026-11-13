import { useSyncExternalStore } from 'react';
import { db } from './db';
import type { Chapter, Level, Track } from './types';

export type Theme = 'system' | 'light' | 'dark';
export type DisplayMode = 'en' | 'ko' | 'both-sentence' | 'both-paragraph';
export type Accent = 'en-US' | 'en-GB' | 'en-AU' | 'en-CA';

export interface Settings {
  track: Track;
  /** 트랙마다 따로 고른 '내 레벨'. null = 아직 안 고름(첫 실행 화면) */
  levelByTrack: Record<Track, Level | null>;
  toeicChapter: Chapter;
  quizMode: 'practice' | 'exam';
  theme: Theme;
  fontSize: 0 | 1 | 2 | 3;
  lineHeight: number;
  serif: boolean;
  displayMode: DisplayMode;
  hlVocab: boolean;
  hlGrammar: boolean;
  showSlashes: boolean;
  hideTranslation: boolean;
  alwaysShowTranslation: boolean;
  ttsRate: number;
  ttsAccent: Accent;
  ttsVoiceURI: string;
  ttsRotateAccent: boolean;
  autoAdvanceMode: 'perWord' | 'fixed' | 'audioEnd';
  autoPerWordSec: number;
  autoFixedSec: number;
  flashFrontSec: number;
  flashBackSec: number;
  audioQuality: 'auto' | 'high' | 'low';
  typingIgnoreCase: boolean;
  typingIgnorePunct: boolean;
  dailyGoalMinutes: number;
  /** 하루 목표: 이야기 화면 수(15초 넘게 머문 화면) */
  dailyGoalViews: number;
  /** 하루 목표: 토익 문제 수 */
  dailyGoalQuestions: number;
  dailyGoalLessons: number;
  lastBackupAt: number | null;
  backupReminderShownAt: number | null;
  installHintShown: boolean;
  knownLessonKeys: string[] | null;
  lastLesson: Partial<Record<Track, { id: string; tab: string }>>;
  /** 이야기 트랙에서 레벨 대신 '뉴스'를 보는 중 */
  generalView: 'level' | 'news';
  /** 앱을 열 때 먼저 볼 트랙('last' = 마지막에 본 것) */
  startTrack: 'last' | Track | 'all';
  /** 홈에서 두 트랙을 함께 보는 '전체' */
  homeAll: boolean;
  /** 앱을 열 때 먼저 볼 레벨(트랙별). 이야기는 'news'도 가능 */
  startLevel: Record<Track, 'last' | Level | 'news'>;
  /** 켜 둔 레벨(꺼진 레벨은 화면에 안 보임) */
  enabledLevels: Record<Track, Level[]>;
  /** 이야기 트랙의 뉴스 칩 켜기 */
  newsEnabled: boolean;
  /** 화면 꺼짐 방지 */
  keepAwake: 'off' | 'lesson' | 'always';
  /** 단어를 누르면 바로 발음 읽기(듣기 재생 중에는 안 읽음) */
  wordAutoSpeak: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  generalView: 'level',
  startTrack: 'last',
  homeAll: false,
  startLevel: { general: 'last', toeic: 'last' },
  enabledLevels: { general: [1, 2, 3, 4], toeic: [1, 2, 3, 4] },
  newsEnabled: true,
  keepAwake: 'lesson',
  wordAutoSpeak: true,
  track: 'general',
  levelByTrack: { general: null, toeic: null },
  toeicChapter: 'part5',
  quizMode: 'practice',
  theme: 'system',
  fontSize: 1,
  lineHeight: 1.8,
  serif: true,
  displayMode: 'en',
  hlVocab: true,
  hlGrammar: false,
  showSlashes: false,
  hideTranslation: false,
  alwaysShowTranslation: false,
  ttsRate: 0.9,
  ttsAccent: 'en-US',
  ttsVoiceURI: '',
  ttsRotateAccent: false,
  autoAdvanceMode: 'perWord',
  autoPerWordSec: 0.6,
  autoFixedSec: 5,
  flashFrontSec: 3,
  flashBackSec: 2,
  audioQuality: 'auto',
  typingIgnoreCase: false,
  typingIgnorePunct: false,
  dailyGoalMinutes: 20,
  dailyGoalViews: 6,
  dailyGoalQuestions: 18,
  dailyGoalLessons: 1,
  lastBackupAt: null,
  backupReminderShownAt: null,
  installHintShown: false,
  knownLessonKeys: null,
  lastLesson: {},
};

let current: Settings = { ...DEFAULT_SETTINGS };
const listeners = new Set<() => void>();

export async function loadSettings(): Promise<Settings> {
  try {
    const rows = await db.settings.toArray();
    const next = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
    for (const r of rows) if (r.key in DEFAULT_SETTINGS) next[r.key] = r.value;
    current = next as unknown as Settings;
  } catch {
    current = { ...DEFAULT_SETTINGS };
  }
  listeners.forEach((l) => l());
  return current;
}

export function getSettings(): Settings {
  return current;
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  current = { ...current, [key]: value };
  listeners.forEach((l) => l());
  void db.settings.put({ key, value }).catch(() => undefined);
}

export function subscribeSettings(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings);
}
