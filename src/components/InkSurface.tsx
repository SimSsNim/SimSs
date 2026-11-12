import { useEffect, useRef, useState } from 'react';
import { strokePath, strokeWidth, hitStrokes, PEN_W, HL_W, HL_COLOR, type InkStroke } from '../lib/ink';

export type InkTool = 'pen' | 'hl' | 'eraser';

/**
 * 손글씨 층(SVG). 부모 칸을 꽉 덮는다(부모는 position: relative).
 * - 애플펜슬(pen)·마우스는 그리고, 손가락은 스크롤(fingerDraw 면 손가락도 그림)
 * - 좌표는 칸 너비를 1 로 둔 비율 → 화면 폭이 바뀌어도 비율대로 따라감
 */
export function InkSurface({ strokes, onChange, active, tool, color, fingerDraw, testid = 'ink-surface' }: {
  strokes: InkStroke[]; onChange: (next: InkStroke[]) => void; active: boolean; tool: InkTool; color: string; fingerDraw: boolean; testid?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [W, setW] = useState(0);
  const [live, setLive] = useState<InkStroke | null>(null);
  const cur = useRef<{ id: number; stroke: InkStroke | null; erased: InkStroke[] | null } | null>(null);
  const latest = useRef(strokes);
  latest.current = strokes;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.getBoundingClientRect().width));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // iPad Safari: 펜슬이 닿으면 스크롤 대신 그리기(손가락은 그대로 스크롤)
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;
    const stop = (e: TouchEvent) => {
      const t = e.touches[0] as (Touch & { touchType?: string }) | undefined;
      if (fingerDraw || t?.touchType === 'stylus') e.preventDefault();
    };
    el.addEventListener('touchstart', stop, { passive: false });
    el.addEventListener('touchmove', stop, { passive: false });
    return () => {
      el.removeEventListener('touchstart', stop);
      el.removeEventListener('touchmove', stop);
    };
  }, [active, fingerDraw]);

  const accept = (e: React.PointerEvent) => active && (e.pointerType === 'pen' || e.pointerType === 'mouse' || (e.pointerType === 'touch' && fingerDraw));
  const pt = (e: { clientX: number; clientY: number; pressure: number; pointerType: string }) => {
    const r = ref.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.width, e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5];
  };
  const eraseAt = (x: number, y: number) => {
    const c = cur.current!;
    const base = c.erased ?? latest.current;
    const hit = hitStrokes(base, x, y, 0.02);
    if (hit.length) {
      c.erased = base.filter((_, i) => !hit.includes(i));
      onChange(c.erased);
    }
  };

  return (
    <svg ref={ref} data-ink="1" data-testid={testid} aria-hidden="true"
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 5, overflow: 'visible',
        pointerEvents: active ? 'auto' : 'none', touchAction: active ? (fingerDraw ? 'none' : 'pan-x pan-y pinch-zoom') : 'auto',
        cursor: active ? (tool === 'eraser' ? 'cell' : 'crosshair') : 'auto',
      }}
      onPointerDown={(e) => {
        if (!accept(e)) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const [x, y, p] = pt(e);
        if (tool === 'eraser') {
          cur.current = { id: e.pointerId, stroke: null, erased: null };
          eraseAt(x, y);
          return;
        }
        const stroke: InkStroke = tool === 'hl' ? { t: 'hl', c: HL_COLOR, w: HL_W, p: [x, y, p] } : { t: 'pen', c: color, w: PEN_W, p: [x, y, p] };
        cur.current = { id: e.pointerId, stroke, erased: null };
        setLive({ ...stroke });
      }}
      onPointerMove={(e) => {
        const c = cur.current;
        if (!c || c.id !== e.pointerId) return;
        const evs = (e.nativeEvent.getCoalescedEvents?.() ?? []).length ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
        if (!c.stroke) {
          for (const ev of evs) { const [x, y] = pt(ev); eraseAt(x, y); }
          return;
        }
        for (const ev of evs) c.stroke.p.push(...pt(ev));
        setLive({ ...c.stroke, p: c.stroke.p.slice() });
      }}
      onPointerUp={(e) => {
        const c = cur.current;
        if (!c || c.id !== e.pointerId) return;
        cur.current = null;
        setLive(null);
        if (c.stroke) onChange([...latest.current, c.stroke]);
      }}
      onPointerCancel={() => { cur.current = null; setLive(null); }}
    >
      {W > 0 && [...strokes, ...(live ? [live] : [])].map((s, i) => (
        <path key={i} d={strokePath(s.p, W)} fill="none" stroke={s.c} strokeWidth={strokeWidth(s, W)} strokeLinecap="round" strokeLinejoin="round"
          opacity={s.t === 'hl' ? 0.35 : 1} data-testid="ink-stroke" />
      ))}
    </svg>
  );
}
