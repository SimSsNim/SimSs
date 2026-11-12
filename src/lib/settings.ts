import { useSyncExternalStore } from 'react';
import { db } from './db';
import type { Track } from './types';

export type Theme = 'system' | 'light' | 'dark';
export type DisplayMode = 'en' | 'ko' | 'both-sentence' | 'both-paragraph';
export type Accent = 'en-US' | 'en-GB' | 'en-AU' | 'en-CA';

export interface Settings {
  track: Track;
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
  dailyGoalLessons: number;
  lastBackupAt: number | null;
  backupReminderShownAt: number | null;
  installHintShown: boolean;
  knownLessonKeys: string[] | null;
  lastLesson: Partial<Record<Track, { id: string; tab: string }>>;
}

export const DEFAULT_SETTINGS: Settings = {
  track: 'general',
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
