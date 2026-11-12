// 실전 모드에서는 풀이가 끝나기 전까지 다른 탭의 완성 문장·번역을 가린다. 연습 모드에서는 푼 문제의 문장만 공개.
import { useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { useSettings } from './settings';
import { lessonKeyOf, type Lesson } from './types';

const revealed = new Set<string>();
const ls = new Set<() => void>();
let ver = 0;
export function revealLesson(key: string) {
  revealed.add(key);
  ver++;
  ls.forEach((l) => l());
}

export interface QuizGate {
  /** 탭 전체를 가릴지 */
  gated: boolean;
  /** 아직 공개하지 않은 문장(빈칸 문장으로 보여 줌) */
  hidden: Set<string>;
  mode: 'practice' | 'exam';
  reveal: () => void;
}

const NONE: QuizGate = { gated: false, hidden: new Set(), mode: 'practice', reveal: () => undefined };

export function useQuizGate(lesson: Lesson | undefined): QuizGate {
  useSyncExternalStore((l) => (ls.add(l), () => ls.delete(l)), () => ver, () => ver);
  const st = useSettings();
  const key = lesson ? lessonKeyOf(lesson.track, lesson.id) : '';
  const attempts = useLiveQuery(() => (key ? db.quizAttempt.where('lessonKey').equals(key).toArray() : []), [key]);
  if (!lesson || lesson.track !== 'toeic' || !attempts) return NONE;
  if (revealed.has(key) || attempts.some((a) => a.inProgress === 0)) return NONE;
  const open = attempts.find((a) => a.inProgress === 1);
  const mode = open?.mode ?? st.quizMode;
  const checked = new Set(open?.checked ?? []);
  const hidden = new Set(lesson.questions.filter((q) => q.blank && !checked.has(q.id)).map((q) => q.blank!.sentenceId));
  const reveal = () => revealLesson(key);
  if (mode === 'exam') return { gated: true, hidden, mode, reveal };
  return { gated: false, hidden, mode, reveal };
}
