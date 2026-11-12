import type { ChecklistKey } from './db';

export const CHECKLIST: { key: ChecklistKey; label: string; tab: string; hint: string }[] = [
  { key: 'listen', label: '듣기', tab: 'listen', hint: '음원(또는 TTS)을 80% 이상 들으면 자동 체크' },
  { key: 'read', label: '전체 읽기', tab: 'full', hint: '전체 문장을 끝까지 읽거나 한 문장씩을 마치면 체크' },
  { key: 'vocab', label: '단어', tab: 'vocab', hint: '단어 5개를 모두 아는/모르는 단어로 분류하면 체크' },
  { key: 'grammar', label: '문법·구조', tab: 'grammar', hint: '문법 포인트를 모두 [이해함]/[다시 볼래요]로 표시하면 체크' },
  { key: 'transcribe', label: '필사', tab: 'practice', hint: '종이 필사 완료 또는 타이핑 필사를 끝내면 체크' },
  { key: 'review', label: '복습', tab: 'practice', hint: '단어 복습을 마치거나 연습(받아쓰기·빈칸·배열·해석)을 하나 끝내면 체크' },
];

export const QUIZ_TAB = { id: 'quiz', label: '문제' };
export const tabsFor = (track: 'general' | 'toeic') => (track === 'toeic' ? [QUIZ_TAB, ...TABS] : TABS);
export const defaultTab = (track: 'general' | 'toeic') => (track === 'toeic' ? 'quiz' : 'full');

export const TABS: { id: string; label: string }[] = [
  { id: 'full', label: '전체 문장' },
  { id: 'one', label: '한 문장씩' },
  { id: 'vocab', label: '단어' },
  { id: 'grammar', label: '문법' },
  { id: 'structure', label: '문장+문법' },
  { id: 'listen', label: '듣기' },
  { id: 'practice', label: '필사·연습' },
];
