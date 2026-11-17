import { useEffect, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import type { Track } from './types';

const LESSON_PATH = /^\/(general|toeic)\/lesson\//;
let lastOutside: string | null = null;

/** 읽거나 문제를 푸는 탭: 다른 곳(문법·단어·설정 등)으로 갔다가 '보던 화면으로' 돌아올 자리 */
export const READING_TABS = ['full', 'one', 'quiz', 'listen', 'practice'];
const READING_PATH = /^\/(general|toeic)\/lesson\/([^/]+)\/([^/]+)$/;
export interface ReadingSpot { path: string; track: Track; id: string; tab: string; scrollY: number }
let spot: ReadingSpot | null = null;
const spotListeners = new Set<() => void>();
const emit = () => spotListeners.forEach((l) => l());
export function useReadingSpot(): ReadingSpot | null {
  return useSyncExternalStore((l) => { spotListeners.add(l); return () => spotListeners.delete(l); }, () => spot, () => spot);
}
export function clearReadingSpot() { spot = null; emit(); }

/** 레슨 밖에서 마지막으로 본 화면, 마지막으로 읽던 자리를 기억한다 */
export function useBackTracker() {
  const loc = useLocation();
  useEffect(() => {
    if (!LESSON_PATH.test(loc.pathname)) lastOutside = loc.pathname + loc.search;
    const m = loc.pathname.match(READING_PATH);
    if (m && READING_TABS.includes(m[3]) && spot?.path !== loc.pathname) {
      spot = { path: loc.pathname, track: m[1] as Track, id: m[2], tab: m[3], scrollY: 0 };
      emit();
    }
  }, [loc.pathname, loc.search]);
  // 읽던 자리의 스크롤 위치
  useEffect(() => {
    const onScroll = () => { if (spot && spot.path === loc.pathname) spot.scrollY = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loc.pathname]);
}

/** 레슨 화면 ‹ 버튼이 갈 곳: 레슨에 들어오기 직전 화면, 없으면 그 트랙의 오늘 화면 */
export function backTarget(track: Track): string {
  const m = lastOutside?.match(/^\/(general|toeic)(\/|\?|$)/);
  if (!lastOutside || (m && m[1] !== track)) return `/${track}`;
  return lastOutside;
}
