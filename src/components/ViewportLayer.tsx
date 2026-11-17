import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

interface VV { scale: number; x: number; y: number; w: number; h: number }
function read(): VV {
  const v = typeof window !== 'undefined' ? window.visualViewport : null;
  return v ? { scale: v.scale, x: v.offsetLeft, y: v.offsetTop, w: v.width, h: v.height } : { scale: 1, x: 0, y: 0, w: 0, h: 0 };
}

/** 두 손가락으로 화면을 확대했을 때의 보이는 영역 */
export function useVisualViewport(): VV {
  const [v, setV] = useState(read);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setV(read())); };
    vv.addEventListener('resize', on);
    vv.addEventListener('scroll', on);
    on();
    return () => { cancelAnimationFrame(raf); vv.removeEventListener('resize', on); vv.removeEventListener('scroll', on); };
  }, []);
  return v;
}

/**
 * 화면을 확대해도 떠 있는 버튼·창이 '보이는 영역'에 붙어 있고, 크기도 그대로이게 한다.
 * 확대 안 했을 때는 아무 일도 안 함(display: contents). 안의 position: fixed 요소는 확대 중엔 이 층 기준.
 */
export function ViewportLayer({ children, zIndex = 36 }: { children: ReactNode; zIndex?: number }) {
  const v = useVisualViewport();
  const zoomed = v.scale > 1.02;
  const style: CSSProperties = zoomed
    ? {
        position: 'fixed', left: 0, top: 0, width: v.w * v.scale, height: v.h * v.scale, zIndex, pointerEvents: 'none',
        transform: `translate(${v.x}px, ${v.y}px) scale(${1 / v.scale})`, transformOrigin: '0 0',
        // 확대 중엔 아래 메뉴·플레이어가 보이는 영역 밖일 때가 많아 그 높이만큼 띄우지 않음
        ['--nav-h' as string]: '0px', ['--player-h' as string]: '0px',
      }
    : { display: 'contents' };
  return (
    <div style={style} data-testid={zoomed ? 'viewport-layer-zoomed' : undefined}>
      <div style={{ display: 'contents', pointerEvents: 'auto' }}>{children}</div>
    </div>
  );
}
