import { useEffect, useRef } from 'react';

/** 좌우/위 스와이프 */
export function useSwipe(handlers: { left?: () => void; right?: () => void; up?: () => void; tap?: () => void }) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    },
    onPointerUp: (e: React.PointerEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? handlers.left : handlers.right)?.();
      else if (dy < -60 && Math.abs(dy) > Math.abs(dx)) handlers.up?.();
      else if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && Date.now() - s.t < 500) handlers.tap?.();
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}

/** 키보드 단축키(입력창에서는 무시) */
export function useKeys(map: Record<string, (e: KeyboardEvent) => void>, deps: unknown[]) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const fn = ref.current[e.key === ' ' ? 'Space' : e.key];
      if (fn) {
        if (t?.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
        e.preventDefault();
        fn(e);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
