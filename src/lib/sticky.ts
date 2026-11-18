import { useState, type Dispatch, type SetStateAction } from 'react';

/**
 * 화면을 떠났다 돌아와도 그대로인 상태(하위 탭·필터·보던 카드 등).
 * 앱을 켜 둔 동안 기억(sessionStorage 에도 남겨 새로 고침 뒤에도 유지).
 */
const mem = new Map<string, unknown>();
const SS = 'pilsa.sticky';
try {
  const raw = sessionStorage.getItem(SS);
  if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, unknown>)) mem.set(k, v);
} catch { /* */ }
let saveT: number | undefined;
function persist() {
  clearTimeout(saveT);
  saveT = window.setTimeout(() => {
    try { sessionStorage.setItem(SS, JSON.stringify(Object.fromEntries(mem))); } catch { /* */ }
  }, 200);
}

export function getSticky<T>(key: string, init: T): T {
  return mem.has(key) ? (mem.get(key) as T) : init;
}
export function setSticky<T>(key: string, v: T) {
  mem.set(key, v);
  persist();
}

export function useSticky<T>(key: string, init: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [v, setV] = useState<T>(() => (mem.has(key) ? (mem.get(key) as T) : typeof init === 'function' ? (init as () => T)() : init));
  const set: Dispatch<SetStateAction<T>> = (next) => {
    setV((cur) => {
      const val = typeof next === 'function' ? (next as (c: T) => T)(cur) : next;
      mem.set(key, val);
      persist();
      return val;
    });
  };
  return [v, set];
}
