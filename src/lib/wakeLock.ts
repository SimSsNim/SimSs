import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSettings } from './settings';

type Sentinel = { released: boolean; release: () => Promise<void>; addEventListener: (t: 'release', f: () => void) => void };
type WakeLockNav = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<Sentinel> } };

export const wakeLockSupported = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator;

let sentinel: Sentinel | null = null;
let want = false;

async function acquire() {
  if (!want || sentinel || document.visibilityState !== 'visible') return;
  try {
    const s = await (navigator as WakeLockNav).wakeLock!.request('screen');
    sentinel = s;
    s.addEventListener('release', () => {
      if (sentinel === s) sentinel = null;
    });
  } catch {
    /* 저전력 모드 등으로 거절될 수 있음 */
  }
}
async function release() {
  const s = sentinel;
  sentinel = null;
  if (s && !s.released) await s.release().catch(() => undefined);
}

/** 설정 '화면 꺼짐 방지': 항상 / 레슨 볼 때만 / 끔. 앱이 다시 보이면 다시 건다 */
export function useWakeLock() {
  const { keepAwake } = useSettings();
  const { pathname } = useLocation();
  const active = keepAwake === 'always' || (keepAwake === 'lesson' && /^\/(general|toeic)\/lesson\//.test(pathname));
  useEffect(() => {
    if (!wakeLockSupported()) return;
    want = active;
    if (active) void acquire();
    else void release();
  }, [active]);
  useEffect(() => {
    if (!wakeLockSupported()) return;
    const vis = () => { if (document.visibilityState === 'visible') void acquire(); };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, []);
}
