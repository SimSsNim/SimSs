import { useEffect, useRef, useState } from 'react';
import { strokePath, strokeWidth, hitStrokes, eraseAtPoint, isScribble, strokesUnderScribble, PEN_W, HL_W, HL_COLOR, type InkStroke } from '../lib/ink';

export type InkTool = 'pen' | 'hl' | 'eraser';
export type EraseMode = 'stroke' | 'part';

/**
 * 손글씨 층(SVG). 부모 칸을 꽉 덮는다(부모는 position: relative).
 * 입력은 부모 칸에서 받는다 → 그리지 않는 손가락 탭·스크롤은 아래 글자에 그대로 간다.
 * - active: 메모 모드(마우스·펜, fingerDraw 면 손가락도 그림)
 * - penAlways: 메모 모드가 아니어도 애플펜슬이 닿으면 바로 그림(onPenStart 로 알림)
 * 좌표는 칸 너비를 1 로 둔 비율 → 화면 폭이 바뀌어도 비율대로 따라감
 */
export function InkSurface({ strokes, onChange, active, tool, color, fingerDraw, penAlways = false, onPenStart, eraseMode = 'stroke', size = 1, onPenDoubleTap, locked = false, onPenActivity, scribbleErase = false, onMultiDoubleTap, testid = 'ink-surface' }: {
  strokes: InkStroke[]; onChange: (next: InkStroke[]) => void; active: boolean; tool: InkTool; color: string; fingerDraw: boolean; eraseMode?: EraseMode;
  /** 굵기 배수 */ size?: number;
  /** 펜슬 끝으로 화면을 빠르게 두 번 톡 */ onPenDoubleTap?: () => void;
  penAlways?: boolean; onPenStart?: () => void; testid?: string;
  /** 펜 글씨 잠금: 아무것도 그리지 않음(펜슬은 손가락처럼) */ locked?: boolean;
  /** 펜슬이 닿거나 가까이 있을 때마다(자동 완료 타이머용) */ onPenActivity?: () => void;
  /** 여러 번 긁으면 그 아래 글씨를 지움 */ scribbleErase?: boolean;
  /** 손가락 2개·3개로 두 번 톡 */ onMultiDoubleTap?: (fingers: 2 | 3) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [W, setW] = useState(0);
  const [live, setLive] = useState<InkStroke | null>(null);
  /** 지우는 중 미리보기(손을 뗄 때 한 번에 저장 → '이전'이 지우개 한 번을 통째로 되돌림) */
  const [preview, setPreview] = useState<InkStroke[] | null>(null);
  const cur = useRef<{ id: number; stroke: InkStroke | null; erased: InkStroke[] | null; pen: boolean; at: number; x0: number; y0: number; far: boolean } | null>(null);
  const lastEnd = useRef({ at: 0, x: 0, y: 0 });
  // 리스너에서 최신 값을 쓰도록
  const st = useRef({ strokes, onChange, active, tool, color, fingerDraw, penAlways, onPenStart, eraseMode, size, onPenDoubleTap, locked, onPenActivity, scribbleErase, onMultiDoubleTap });
  st.current = { strokes, onChange, active, tool, color, fingerDraw, penAlways, onPenStart, eraseMode, size, onPenDoubleTap, locked, onPenActivity, scribbleErase, onMultiDoubleTap };
  /** 펜슬로 톡 친 점: 두 번째 톡이 오는지 잠깐 기다렸다 저장 */
  const tapWait = useRef<{ at: number; x: number; y: number; stroke: InkStroke | null; timer: number } | null>(null);
  /** 잠금 중 펜슬 톡(두 번 톡으로 잠금 풀기용): 그리지 않고 지켜보기만 */
  const lockTap = useRef<{ id: number; at: number; x: number; y: number } | null>(null);
  const lockLast = useRef<{ at: number; x: number; y: number } | null>(null);
  /** 마지막으로 '글씨'(톡이 아닌 획)를 쓴 시각: 쓰는 중에 찍은 점은 두 번 톡으로 보지 않음 */
  const lastWrite = useRef(0);
  /** 여러 손가락 톡 */
  const multi = useRef<{ start: number; max: number; pts: Map<number, [number, number]>; moved: boolean } | null>(null);
  const multiLast = useRef<{ n: number; at: number } | null>(null);

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
      if (s.locked) return false;
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
      if (st.current.locked && e.pointerType === 'pen' && st.current.onPenDoubleTap) {
        lockTap.current = { id: e.pointerId, at: performance.now(), x: e.clientX, y: e.clientY };
        return;
      }
      if (e.pointerType === 'touch' && cur.current && !cur.current.pen && cur.current.id !== e.pointerId) {
        // 손가락이 하나 더 닿음(두 손가락 톡·확대): 쓰던 것은 버림
        cur.current = null;
        setLive(null);
        setPreview(null);
        return;
      }
      if (!accept(e) || e.button > 0) return;
      e.preventDefault();
      e.stopPropagation();
      const s = st.current;
      if (e.pointerType === 'pen') s.onPenActivity?.();
      if (!s.active && e.pointerType === 'pen') s.onPenStart?.(); // 펜슬이 닿으면 메모 모드 켜짐
      try { box.setPointerCapture(e.pointerId); } catch { /* */ }
      const [x, y, p] = pt(e);
      const meta = { pen: e.pointerType === 'pen', at: performance.now(), x0: x, y0: y, far: false };
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
      if (e.pointerType === 'pen') st.current.onPenActivity?.(); // 펜슬이 닿아 있거나 가까이 떠 있음
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
      const lt = lockTap.current;
      if (lt && lt.id === e.pointerId) {
        lockTap.current = null;
        const s = st.current;
        if (!s.locked || performance.now() - lt.at > 250 || Math.hypot(e.clientX - lt.x, e.clientY - lt.y) > 10) { lockLast.current = null; return; }
        const prev = lockLast.current;
        if (prev && performance.now() - prev.at < 400 && Math.hypot(lt.x - prev.x, lt.y - prev.y) < 30) {
          lockLast.current = null;
          lastEnd.current = { at: performance.now(), x: e.clientX, y: e.clientY }; // 두 번째 톡의 click 은 막음
          s.onPenDoubleTap?.();
        } else lockLast.current = { at: performance.now(), x: lt.x, y: lt.y };
        return;
      }
      const c = cur.current;
      if (!c || c.id !== e.pointerId) return;
      cur.current = null;
      lastEnd.current = { at: performance.now(), x: e.clientX, y: e.clientY };
      const s = st.current;
      // 두 번 톡 후보: 짧게 콕 + (첫 톡이면) 직전 0.7초 동안 글씨를 쓰지 않았음 → 글씨 쓰다 찍는 점(i, 마침표, 콜론)은 그냥 점
      const quick = c.pen && !c.far && performance.now() - c.at < 220 && !!s.onPenDoubleTap;
      const isTap = quick && (!!tapWait.current || c.at - lastWrite.current > 700);
      if (!isTap && c.stroke) lastWrite.current = performance.now();
      if (isTap) {
        const w = tapWait.current;
        if (w && performance.now() - w.at < 350 && Math.hypot(c.x0 - w.x, c.y0 - w.y) < 0.03) {
          // 두 번 톡: 점은 남기지 않고 설정한 기능 실행
          clearTimeout(w.timer);
          tapWait.current = null;
          setLive(null);
          if (c.erased) s.onChange(c.erased);
          setPreview(null);
          s.onPenDoubleTap?.();
          return;
        }
        if (w) {
          // 두 번째 톡이 멀리 찍힘: 둘 다 그냥 점(쓰는 중)
          clearTimeout(w.timer);
          tapWait.current = null;
          lastWrite.current = performance.now();
          setLive(null);
          if (w.stroke) s.onChange([...st.current.strokes, w.stroke, ...(c.stroke ? [c.stroke] : [])]);
          else if (c.stroke) s.onChange([...st.current.strokes, c.stroke]);
          setPreview(null);
          return;
        }
        // 첫 톡: 점(또는 지운 것)은 잠깐 뒤에 저장
        if (c.erased) s.onChange(c.erased);
        setPreview(null);
        const stroke = c.stroke;
        tapWait.current = {
          at: performance.now(), x: c.x0, y: c.y0, stroke,
          timer: window.setTimeout(() => {
            tapWait.current = null;
            setLive(null);
            if (stroke) st.current.onChange([...st.current.strokes, stroke]);
          }, 350),
        };
        return;
      }
      setLive(null);
      if (c.stroke && s.scribbleErase && c.stroke.t === 'pen' && isScribble(c.stroke.p)) {
        // 낙서 지우기: 여러 번 왔다 갔다 긁은 자리의 글씨를 지우고, 긁은 선은 남기지 않음
        const hit = strokesUnderScribble(s.strokes, c.stroke.p);
        if (hit.length) {
          s.onChange(s.strokes.filter((_, i) => !hit.includes(i)));
          setPreview(null);
          return;
        }
      }
      if (c.stroke) s.onChange([...s.strokes, c.stroke]);
      else if (c.erased) s.onChange(c.erased);
      setPreview(null);
    };
    const cancel = () => { const c = cur.current; cur.current = null; setLive(null); if (c?.erased) st.current.onChange(c.erased); setPreview(null); };
    // 그린 직후 따라오는 click(단어 창 열림)을 막는다
    const click = (e: MouseEvent) => {
      const l = lastEnd.current;
      if (performance.now() - l.at < 400 && Math.hypot(e.clientX - l.x, e.clientY - l.y) < 24) { e.preventDefault(); e.stopPropagation(); }
    };
    // iPad Safari: 펜슬이 닿으면 스크롤 대신 그리기(손가락은 그대로 스크롤)
    const touch = (e: TouchEvent) => {
      const s = st.current;
      const t = e.touches[0] as (Touch & { touchType?: string }) | undefined;
      if (s.locked) return;
      if (t?.touchType === 'stylus' ? s.active || s.penAlways : s.active && s.fingerDraw) e.preventDefault();
    };
    // 손가락 2·3개로 두 번 톡(펜슬 터치는 빼고 셈)
    const fingers = (l: TouchList) => Array.from(l).filter((x) => (x as Touch & { touchType?: string }).touchType !== 'stylus');
    const mStart = (e: TouchEvent) => {
      const ts = fingers(e.touches);
      if (!ts.length) return;
      const m = multi.current ?? { start: performance.now(), max: 0, pts: new Map(), moved: false };
      for (const x of ts) if (!m.pts.has(x.identifier)) m.pts.set(x.identifier, [x.clientX, x.clientY]);
      m.max = Math.max(m.max, ts.length);
      multi.current = m;
    };
    const mMove = (e: TouchEvent) => {
      const m = multi.current;
      if (!m) return;
      for (const x of fingers(e.changedTouches)) {
        const p0 = m.pts.get(x.identifier);
        if (p0 && Math.hypot(x.clientX - p0[0], x.clientY - p0[1]) > 14) m.moved = true;
      }
    };
    const mEnd = (e: TouchEvent) => {
      const m = multi.current;
      if (!m || fingers(e.touches).length) return;
      multi.current = null;
      const now = performance.now();
      if (m.max < 2 || m.moved || now - m.start > 350) { multiLast.current = null; return; }
      const n = Math.min(3, m.max) as 2 | 3;
      const prev = multiLast.current;
      if (prev && prev.n === n && now - prev.at < 450) {
        multiLast.current = null;
        st.current.onMultiDoubleTap?.(n);
      } else multiLast.current = { n, at: now };
    };
    box.addEventListener('touchstart', mStart, { passive: true });
    box.addEventListener('touchmove', mMove, { passive: true });
    box.addEventListener('touchend', mEnd, { passive: true });
    box.addEventListener('touchcancel', mEnd, { passive: true });
    box.addEventListener('pointerdown', down, { capture: true });
    box.addEventListener('pointermove', move, { capture: true });
    box.addEventListener('pointerup', up, { capture: true });
    box.addEventListener('pointercancel', cancel, { capture: true });
    box.addEventListener('click', click, { capture: true });
    box.addEventListener('touchstart', touch, { passive: false });
    box.addEventListener('touchmove', touch, { passive: false });
    return () => {
      box.removeEventListener('touchstart', mStart);
      box.removeEventListener('touchmove', mMove);
      box.removeEventListener('touchend', mEnd);
      box.removeEventListener('touchcancel', mEnd);
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
