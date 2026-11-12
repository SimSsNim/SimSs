import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 70; // 이만큼(감쇠 후 px) 당기면 새로고침
const MAX = 110;

/** 맨 위에서 화면을 아래로 끌어당기면 새로고침(홈 화면 앱에는 브라우저 기본 기능이 없어서 직접 만든다) */
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const st = useRef<{ x: number; y: number; active: boolean; locked: boolean } | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    const set = (v: number) => { pullRef.current = v; setPull(v); };
    const onStart = (e: TouchEvent) => {
      if (busy || e.touches.length !== 1 || window.scrollY > 0) { st.current = null; return; }
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest('input, textarea, select, [contenteditable], [role="dialog"], [data-no-ptr]')) { st.current = null; return; }
      st.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, active: false, locked: false };
    };
    const onMove = (e: TouchEvent) => {
      const s = st.current;
      if (!s || s.locked) return;
      const dx = e.touches[0].clientX - s.x;
      const dy = e.touches[0].clientY - s.y;
      if (!s.active) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        // 아래로, 세로 방향일 때만(가로 칩 스크롤과 겹치지 않게)
        if (dy <= 0 || Math.abs(dy) < Math.abs(dx) * 1.5 || window.scrollY > 0) { s.locked = true; return; }
        s.active = true;
      }
      if (e.cancelable) e.preventDefault();
      set(Math.min(MAX, Math.max(0, dy) * 0.5));
    };
    const onEnd = () => {
      const s = st.current;
      st.current = null;
      if (!s?.active) return;
      if (pullRef.current >= THRESHOLD) {
        setBusy(true);
        set(THRESHOLD);
        void refresh();
      } else set(0);
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [busy]);

  if (!pull && !busy) return null;
  const ready = pull >= THRESHOLD;
  return (
    <div role="status" aria-live="polite" data-testid="ptr"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', justifyContent: 'center', pointerEvents: 'none',
        transform: `translateY(${pull - 44}px)`, transition: st.current ? 'none' : 'transform .2s' }}>
      <span style={{ marginTop: 'env(safe-area-inset-top)', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 999,
        padding: '6px 14px', fontSize: 13, fontWeight: 700, color: 'var(--accent)', boxShadow: '0 2px 8px rgba(0,0,0,.12)' }}>
        {busy ? '⟳ 새로고침 중…' : ready ? '↻ 놓으면 새로고침' : '↓ 당겨서 새로고침'}
      </span>
    </div>
  );
}

async function refresh() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    // 새 버전 앱이 있으면 받아 두고(최대 1.5초) 다시 불러온다
    await Promise.race([reg?.update(), new Promise((r) => setTimeout(r, 1500))]);
  } catch { /* 오프라인 등 */ }
  window.location.reload();
}
