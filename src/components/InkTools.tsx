import { useEffect, useRef, useState } from 'react';
import s from '../styles/ui.module.css';
import { INK_COLORS, PEN_SIZES, PEN_SIZE_LABEL, loadInk, saveInk, type InkStroke } from '../lib/ink';
import { getSettings } from '../lib/settings';
import { toast } from './Toast';
import type { InkTool, EraseMode } from './InkSurface';
import type { InkNoteRow } from '../lib/db';

/** 메모 한 장: 불러오기·저장·되돌리기 */
export function useInkNote(key: string, meta: { lessonKey: string; kind: 'screen' | 'hw'; ref: string; view?: Record<string, unknown> }) {
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [row, setRow] = useState<InkNoteRow | undefined>();
  const [loaded, setLoaded] = useState(false);
  const hist = useRef<InkStroke[][]>([]); // 이전으로 돌아갈 상태들
  const future = useRef<InkStroke[][]>([]); // 되살릴 상태들
  const [, bump] = useState(0);
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const cur = useRef<InkStroke[]>([]);
  cur.current = strokes;
  useEffect(() => {
    let alive = true;
    setLoaded(false);
    hist.current = [];
    future.current = [];
    void loadInk(key).then((r) => {
      if (!alive) return;
      setRow(r);
      setStrokes(r?.strokes ?? []);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [key]);
  const save = (next: InkStroke[]) => {
    setStrokes(next);
    cur.current = next;
    const m = metaRef.current;
    void saveInk({ key, lessonKey: m.lessonKey, kind: m.kind, ref: m.ref, strokes: next, view: m.view });
    bump((n) => n + 1);
  };
  return {
    strokes, row, loaded,
    /** 새로 쓰거나 지움: 이전 기록에 넣고, 되살리기 목록은 비움 */
    set: (next: InkStroke[]) => { hist.current.push(cur.current); future.current = []; save(next); },
    /** 이전: 직전 한 번(획 하나 또는 지우개 한 번)을 되돌림 */
    undo: () => { const prev = hist.current.pop(); if (!prev) return; future.current.push(cur.current); save(prev); },
    /** 되살리기: 이전으로 되돌린 것을 다시 */
    redo: () => { const next = future.current.pop(); if (!next) return; hist.current.push(cur.current); save(next); },
    clear: () => { hist.current.push(cur.current); future.current = []; save([]); },
    canUndo: hist.current.length > 0,
    canRedo: future.current.length > 0,
  };
}

const PREF_KEY = 'pilsa.pen';
function loadPref(): { color: string; size: number } {
  try { return { color: INK_COLORS[0], size: 1, ...(JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') as object) }; } catch { return { color: INK_COLORS[0], size: 1 }; }
}

/** 펜 상태: 도구·색·굵기·지우개 방식·손가락. 색과 굵기는 기억해 둔다 */
export function usePen() {
  const [tool, setToolRaw] = useState<InkTool>('pen');
  const [color, setColorRaw] = useState<string>(() => loadPref().color);
  const [size, setSizeRaw] = useState<number>(() => loadPref().size);
  const [eraseMode, setEraseMode] = useState<EraseMode>('stroke');
  const [finger, setFinger] = useState(false);
  const prevTool = useRef<InkTool>('pen');
  const save = (p: Partial<{ color: string; size: number }>) => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ ...loadPref(), ...p })); } catch { /* */ }
  };
  const setTool = (t: InkTool) => { setToolRaw((cur) => { if (cur !== 'eraser' && cur !== t) prevTool.current = cur; return t; }); };
  const setColor = (c: string) => { setColorRaw(c); save({ color: c }); };
  const setSize = (n: number) => { setSizeRaw(n); save({ size: n }); };
  /** 펜슬 두 번 톡: 설정한 기능 */
  const doubleTap = (note: { undo: () => void }) => {
    const act = getSettings().penDoubleTap;
    if (act === 'undo') { note.undo(); toast('↶ 이전', { ms: 900 }); return; }
    if (act === 'eraser') {
      setToolRaw((cur) => {
        if (cur === 'eraser') { toast('✏️ 펜으로', { ms: 900 }); return prevTool.current; }
        prevTool.current = cur;
        toast('🧽 지우개로', { ms: 900 });
        return 'eraser';
      });
      return;
    }
    if (act === 'hl') {
      setToolRaw((cur) => { const next = cur === 'hl' ? 'pen' : 'hl'; toast(next === 'hl' ? '🖍 형광펜으로' : '✏️ 펜으로', { ms: 900 }); return next; });
    }
  };
  return { tool, setTool, color, setColor, size, setSize, eraseMode, setEraseMode, finger, setFinger, doubleTap };
}

/** 펜 도구 줄: 색·형광펜·지우개·되돌리기·모두 지우기·손가락으로도 쓰기 */
export function InkToolbar({ tool, setTool, color, setColor, size, setSize, fingerDraw, setFingerDraw, onUndo, onRedo, canUndo, canRedo, eraseMode, setEraseMode, onClear, extra, done }: {
  tool: InkTool; setTool: (t: InkTool) => void; color: string; setColor: (c: string) => void; size: number; setSize: (n: number) => void;
  fingerDraw: boolean; setFingerDraw: (v: boolean) => void; onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean;
  eraseMode: EraseMode; setEraseMode: (m: EraseMode) => void; onClear: () => void; extra?: React.ReactNode;
  /** 첫째 줄 끝(완료 등) */ done?: React.ReactNode;
}) {
  const btn = { flex: 'none', minWidth: 34, padding: '0 8px', justifyContent: 'center' } as const;
  return (
    <div role="toolbar" aria-label="펜 도구" data-testid="ink-toolbar" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <div className={s.chips} data-testid="ink-row1" style={{ alignItems: 'center', padding: 0, flexWrap: 'nowrap', overflow: 'visible', gap: 3 }}>
      {INK_COLORS.map((c) => (
        <button key={c} type="button" className={s.chip} aria-pressed={tool === 'pen' && color === c} aria-label={`펜 ${c}`} data-testid={`ink-pen-${c.slice(1)}`}
          onClick={() => { setTool('pen'); setColor(c); }} style={{ ...btn, minWidth: 29, padding: 0 }}>
          <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: 8, background: c, display: 'block', outline: tool === 'pen' && color === c ? '2px solid var(--accent-ink)' : 'none' }} />
        </button>
      ))}
      <label className={s.chip} aria-pressed={tool === 'pen' && !INK_COLORS.includes(color as never)} title="색 직접 고르기" style={{ ...btn, position: 'relative', gap: 2, padding: '0 6px' }} data-testid="ink-color-custom">
        <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: 8, display: 'block', background: INK_COLORS.includes(color as never) ? 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' : color }} />🎨
        <input type="color" value={color} aria-label="펜 색 직접 고르기" data-testid="ink-color-input" onChange={(e) => { setTool('pen'); setColor(e.target.value); }}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
      </label>
      <span role="group" aria-label="굵기" style={{ display: 'inline-flex', gap: 2, flex: 'none', marginLeft: 3 }}>
        {PEN_SIZES.map((n, i) => (
          <button key={n} type="button" className={s.chip} aria-pressed={Math.abs(size - n) < 0.01} aria-label={`굵기 ${PEN_SIZE_LABEL[i]}`} title={PEN_SIZE_LABEL[i]}
            onClick={() => setSize(n)} data-testid={`ink-size-${i}`} style={{ ...btn, minWidth: 27, padding: 0 }}>
            <span aria-hidden="true" style={{ width: 4 + i * 4, height: 4 + i * 4, borderRadius: 99, background: 'currentColor', display: 'block' }} />
          </button>
        ))}
      </span>
      {done}
    </div>
    <div className={s.chips} data-testid="ink-row2" style={{ alignItems: 'center', padding: 0, flexWrap: 'wrap', overflow: 'visible' }}>
      <button type="button" className={s.chip} aria-pressed={tool === 'hl'} onClick={() => setTool('hl')} style={btn} data-testid="ink-hl">🖍 형광펜</button>
      <button type="button" className={s.chip} aria-pressed={tool === 'eraser' && eraseMode === 'stroke'} onClick={() => { setTool('eraser'); setEraseMode('stroke'); }} style={btn} data-testid="ink-eraser" title="닿은 획을 통째로 지움">지우개(획)</button>
      <button type="button" className={s.chip} aria-pressed={tool === 'eraser' && eraseMode === 'part'} onClick={() => { setTool('eraser'); setEraseMode('part'); }} style={btn} data-testid="ink-eraser-part" title="지우개가 지나간 부분만 지움">지우개(부분)</button>
      <button type="button" className={s.chip} onClick={onUndo} disabled={!canUndo} style={btn} data-testid="ink-undo" title="직전에 쓴 획(또는 지운 것)을 되돌림">↶ 이전</button>
      <button type="button" className={s.chip} onClick={onRedo} disabled={!canRedo} style={btn} data-testid="ink-redo" title="되돌린 것을 다시">↷ 되살리기</button>
      <button type="button" className={s.chip} onClick={() => { if (confirm('이 메모를 모두 지울까요?')) onClear(); }} style={btn} data-testid="ink-clear">모두 지우기</button>
      <button type="button" className={s.chip} aria-pressed={fingerDraw} onClick={() => setFingerDraw(!fingerDraw)} style={btn} title="펜슬이 없을 때 손가락으로 쓰기(켜 둔 동안은 화면이 스크롤되지 않아요)" data-testid="ink-finger">
        ✋ 손가락
      </button>
      {extra}
    </div>
    </div>
  );
}
