import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { Track } from './types';

const LESSON_PATH = /^\/(general|toeic)\/lesson\//;
let lastOutside: string | null = null;

/** 레슨 밖에서 마지막으로 본 화면을 기억한다(레슨 안 탭·링크 이동은 무시) */
export function useBackTracker() {
  const loc = useLocation();
  useEffect(() => {
    if (!LESSON_PATH.test(loc.pathname)) lastOutside = loc.pathname + loc.search;
  }, [loc.pathname, loc.search]);
}

/** 레슨 화면 ‹ 버튼이 갈 곳: 레슨에 들어오기 직전 화면, 없으면 그 트랙의 오늘 화면 */
export function backTarget(track: Track): string {
  const m = lastOutside?.match(/^\/(general|toeic)(\/|\?|$)/);
  if (!lastOutside || (m && m[1] !== track)) return `/${track}`;
  return lastOutside;
}
