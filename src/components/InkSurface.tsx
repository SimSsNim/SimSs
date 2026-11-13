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
export function InkSurface({ strokes, onChange, active, tool, color, fingerDraw, penAlways = false, onPenStart, eraseMode = 'stroke', testid = 'ink-surface' }: {
  strokes: InkStroke[]; onChange: (next: InkStroke[]) => void; active: boolean; tool: InkTool; color: string; fingerDraw: boolean; eraseMode?: EraseMode;
  penAlways?: boolean; onPenStart?: () => void; testid?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [W, setW] = useState(0);
  const [live, setLive] = useState<InkStroke | null>(null);
  /** 지우는 중 미리보기(손을 뗄 때 한 번에 저장 → '이전'이 지우개 한 번을 통째로 되돌림) */
  const [preview, setPreview] = useState<InkStroke[] | null>(null);
  const cur = useRef<{ id: number; stroke: InkStroke | null; erased: InkStroke[] | null } | null>(null);
  const lastEnd = useRef({ at: 0, x: 0, y: 0 });
  // 리스너에서 최신 값을 쓰도록
  const st = useRef({ strokes, onChange, active, tool, color, fingerDraw, penAlways, onPenStart, eraseMode });
  st.current = { strokes, onChange, active, tool, color, fingerDraw, penAlways, onPenStart, eraseMode };

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
      if (s.tool === 'eraser' && s.active) {
        cur.current = { id: e.pointerId, stroke: null, erased: null };
        eraseAt(x, y);
        return;
      }
      const tool = s.active ? s.tool : 'pen';
      const stroke: InkStroke = tool === 'hl' ? { t: 'hl', c: HL_COLOR, w: HL_W, p: [x, y, p] } : { t: 'pen', c: s.color, w: PEN_W, p: [x, y, p] };
      cur.current = { id: e.pointerId, stroke, erased: null };
      setLive({ ...stroke });
    };
    const move = (e: PointerEvent) => {
      const c = cur.current;
      if (!c || c.id !== e.pointerId) return;
      e.preventDefault();
      const evs = e.getCoalescedEvents?.().length ? e.getCoalescedEvents() : [e];
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
      setLive(null);
      lastEnd.current = { at: Date.now(), x: e.clientX, y: e.clientY };
      if (c.stroke) st.current.onChange([...st.current.strokes, c.stroke]);
      else if (c.erased) st.current.onChange(c.erased);
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
