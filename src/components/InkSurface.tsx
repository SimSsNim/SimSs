import { useEffect, useRef, useState } from 'react';
import { strokePath, strokeWidth, hitStrokes, eraseAtPoint, PEN_W, HL_W, HL_COLOR, type InkStroke } from '../lib/ink';

export type InkTool = 'pen' | 'hl' | 'eraser';
export type EraseMode = 'stroke' | 'part';

/**
 * 손글씨 층(SVG). 부모 칸을 꽉 덮는다(부모는 position: relative).
 * 입력은 부모 칸에서 받는다 → 그리지 않는 손가락 탭·스크롤은 아래 글자에 그대로 간다.
 * - active: 메모 모드(마우스·펜, fingerDraw 면 손가락도 그림)
 * - penAlways: 메모 모드가 아니어도 애플펜슬이 닿으면 바로 그림(onPenStart 로 알림)
 * 좌표는 칸 너비를 1 로 둔 비율 → 화면 폭이 바뀌어도 비율대로 따라감
 */
export function InkSurface({ strokes, onChange, active, tool, color, fingerDraw, penAlways = false, onPenStart, eraseMode = 'stroke', size = 1, onPenDoubleTap, testid = 'ink-surface' }: {
  strokes: InkStroke[]; onChange: (next: InkStroke[]) => void; active: boolean; tool: InkTool; color: string; fingerDraw: boolean; eraseMode?: EraseMode;
  /** 굵기 배수 */ size?: number;
  /** 펜슬 끝으로 화면을 빠르게 두 번 톡 */ onPenDoubleTap?: () => void;
  penAlways?: boolean; onPenStart?: () => void; testid?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [W, setW] = useState(0);
  const [live, setLive] = useState<InkStroke | null>(null);
  /** 지우는 중 미리보기(손을 뗄 때 한 번에 저장 → '이전'이 지우개 한 번을 통째로 되돌림) */
  const [preview, setPreview] = useState<InkStroke[] | null>(null);
  const cur = useRef<{ id: number; stroke: InkStroke | null; erased: InkStroke[] | null; pen: boolean; at: number; x0: number; y0: number; far: boolean } | null>(null);
  const lastEnd = useRef({ at: 0, x: 0, y: 0 });
  // 리스너에서 최신 값을 쓰도록
  const st = useRef({ strokes, onChange, active, tool, color, fingerDraw, penAlways, onPenStart, eraseMode, size, onPenDoubleTap });
  st.current = { strokes, onChange, active, tool, color, fingerDraw, penAlways, onPenStart, eraseMode, size, onPenDoubleTap };
  /** 펜슬로 톡 친 점: 두 번째 톡이 오는지 잠깐 기다렸다 저장 */
  const tapWait = useRef<{ at: number; x: number; y: number; stroke: InkStroke | null; timer: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.getBoundingClientRect().width));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const svg = ref.current;
    const box = svg?.parentElement;
    if (!svg || !box) return;
    const accept = (e: PointerEvent) => {
      const s = st.current;
      if (e.pointerType === 'pen') return s.active || s.penAlways;
      return s.active && (e.pointerType === 'mouse' || (e.pointerType === 'touch' && s.fingerDraw));
    };
    const pt = (e: { clientX: number; clientY: number; pressure: number; pointerType: string }) => {
      const r = svg.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.width, e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5];
    };
    const eraseAt = (x: number, y: number) => {
      const c = cur.current!;
      const base = c.erased ?? st.current.strokes;
      let next: InkStroke[] | null = null;
      if (st.current.eraseMode === 'part') next = eraseAtPoint(base, x, y, 0.014);
      else {
        const hit = hitStrokes(base, x, y, 0.02);
        if (hit.length) next = base.filter((_, i) => !hit.includes(i));
      }
      if (next) {
        c.erased = next;
        setPreview(next);
      }
    };
    const down = (e: PointerEvent) => {
      if (!accept(e) || e.button > 0) return;
      e.preventDefault();
      e.stopPropagation();
      const s = st.current;
      if (!s.active && e.pointerType === 'pen') s.onPenStart?.(); // 펜슬이 닿으면 메모 모드 켜짐
      try { box.setPointerCapture(e.pointerId); } catch { /* */ }
      const [x, y, p] = pt(e);
      const meta = { pen: e.pointerType === 'pen', at: Date.now(), x0: x, y0: y, far: false };
      if (s.tool === 'eraser') {
        cur.current = { id: e.pointerId, stroke: null, erased: null, ...meta };
        eraseAt(x, y);
        return;
      }
      const stroke: InkStroke = s.tool === 'hl' ? { t: 'hl', c: HL_COLOR, w: HL_W * s.size, p: [x, y, p] } : { t: 'pen', c: s.color, w: PEN_W * s.size, p: [x, y, p] };
      cur.current = { id: e.pointerId, stroke, erased: null, ...meta };
      setLive({ ...stroke });
    };
    const move = (e: PointerEvent) => {
      const c = cur.current;
      if (!c || c.id !== e.pointerId) return;
      e.preventDefault();
      const evs = e.getCoalescedEvents?.().length ? e.getCoalescedEvents() : [e];
      { const [mx, my] = pt(e); if (Math.hypot(mx - c.x0, my - c.y0) > 0.012) c.far = true; }
      if (!c.stroke) {
        for (const ev of evs) { const [x, y] = pt(ev); eraseAt(x, y); }
        return;
      }
      for (const ev of evs) c.stroke.p.push(...pt(ev));
      setLive({ ...c.stroke, p: c.stroke.p.slice() });
    };
    const up = (e: PointerEvent) => {
      const c = cur.current;
      if (!c || c.id !== e.pointerId) return;
      cur.current = null;
      lastEnd.current = { at: Date.now(), x: e.clientX, y: e.clientY };
      const s = st.current;
      const isTap = c.pen && !c.far && Date.now() - c.at < 250 && !!s.onPenDoubleTap;
      if (isTap) {
        const w = tapWait.current;
        if (w && Date.now() - w.at < 400 && Math.hypot(c.x0 - w.x, c.y0 - w.y) < 0.04) {
          // 두 번 톡: 점은 남기지 않고 설정한 기능 실행
          clearTimeout(w.timer);
          tapWait.current = null;
          setLive(null);
          if (c.erased) s.onChange(c.erased);
          setPreview(null);
          s.onPenDoubleTap?.();
          return;
        }
        if (w) { clearTimeout(w.timer); if (w.stroke) s.onChange([...st.current.strokes, w.stroke]); }
        // 첫 톡: 점(또는 지운 것)은 잠깐 뒤에 저장
        if (c.erased) s.onChange(c.erased);
        setPreview(null);
        const stroke = c.stroke;
        tapWait.current = {
          at: Date.now(), x: c.x0, y: c.y0, stroke,
          timer: window.setTimeout(() => {
            tapWait.current = null;
            setLive(null);
            if (stroke) st.current.onChange([...st.current.strokes, stroke]);
          }, 400),
        };
        return;
      }
      setLive(null);
      if (c.stroke) s.onChange([...s.strokes, c.stroke]);
      else if (c.erased) s.onChange(c.erased);
      setPreview(null);
    };
    const cancel = () => { const c = cur.current; cur.current = null; setLive(null); if (c?.erased) st.current.onChange(c.erased); setPreview(null); };
    // 그린 직후 따라오는 click(단어 창 열림)을 막는다
    const click = (e: MouseEvent) => {
      const l = lastEnd.current;
      if (Date.now() - l.at < 400 && Math.hypot(e.clientX - l.x, e.clientY - l.y) < 24) { e.preventDefault(); e.stopPropagation(); }
    };
    // iPad Safari: 펜슬이 닿으면 스크롤 대신 그리기(손가락은 그대로 스크롤)
    const touch = (e: TouchEvent) => {
      const s = st.current;
      const t = e.touches[0] as (Touch & { touchType?: string }) | undefined;
      if (t?.touchType === 'stylus' ? s.active || s.penAlways : s.active && s.fingerDraw) e.preventDefault();
    };
    box.addEventListener('pointerdown', down, { capture: true });
    box.addEventListener('pointermove', move, { capture: true });
    box.addEventListener('pointerup', up, { capture: true });
    box.addEventListener('pointercancel', cancel, { capture: true });
    box.addEventListener('click', click, { capture: true });
    box.addEventListener('touchstart', touch, { passive: false });
    box.addEventListener('touchmove', touch, { passive: false });
    return () => {
      box.removeEventListener('pointerdown', down, { capture: true });
      box.removeEventListener('pointermove', move, { capture: true });
      box.removeEventListener('pointerup', up, { capture: true });
      box.removeEventListener('pointercancel', cancel, { capture: true });
      box.removeEventListener('click', click, { capture: true });
      box.removeEventListener('touchstart', touch);
      box.removeEventListener('touchmove', touch);
    };
  }, []);

  return (
    <svg ref={ref} data-ink="1" data-testid={testid} aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 5, overflow: 'visible', pointerEvents: 'none' }}>
      {W > 0 && [...(preview ?? strokes), ...(live ? [live] : [])].map((s, i) => (
        <path key={i} d={strokePath(s.p, W)} fill="none" stroke={s.c} strokeWidth={strokeWidth(s, W)} strokeLinecap="round" strokeLinejoin="round"
          opacity={s.t === 'hl' ? 0.35 : 1} data-testid="ink-stroke" />
      ))}
    </svg>
  );
}
