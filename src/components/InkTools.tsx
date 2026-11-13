import { useEffect, useRef, useState } from 'react';
import s from '../styles/ui.module.css';
import { INK_COLORS, loadInk, saveInk, type InkStroke } from '../lib/ink';
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

/** 펜 도구 줄: 색·형광펜·지우개·되돌리기·모두 지우기·손가락으로도 쓰기 */
export function InkToolbar({ tool, setTool, color, setColor, fingerDraw, setFingerDraw, onUndo, onRedo, canUndo, canRedo, eraseMode, setEraseMode, onClear, extra }: {
  tool: InkTool; setTool: (t: InkTool) => void; color: string; setColor: (c: string) => void;
  fingerDraw: boolean; setFingerDraw: (v: boolean) => void; onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean;
  eraseMode: EraseMode; setEraseMode: (m: EraseMode) => void; onClear: () => void; extra?: React.ReactNode;
}) {
  const btn = { flex: 'none', minWidth: 34, padding: '0 8px', justifyContent: 'center' } as const;
  return (
    <div className={s.chips} role="toolbar" aria-label="펜 도구" data-testid="ink-toolbar" style={{ alignItems: 'center', paddingBottom: 2, flexWrap: 'wrap', overflow: 'visible' }}>
      {INK_COLORS.map((c) => (
        <button key={c} type="button" className={s.chip} aria-pressed={tool === 'pen' && color === c} aria-label={`펜 ${c}`} data-testid={`ink-pen-${c.slice(1)}`}
          onClick={() => { setTool('pen'); setColor(c); }} style={{ ...btn, minWidth: 32, padding: 0 }}>
          <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: 8, background: c, display: 'block', outline: tool === 'pen' && color === c ? '2px solid var(--accent-ink)' : 'none' }} />
        </button>
      ))}
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
  );
}
