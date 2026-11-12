import { useEffect, useRef, useState } from 'react';
import s from '../styles/ui.module.css';
import { INK_COLORS, loadInk, saveInk, type InkStroke } from '../lib/ink';
import type { InkTool } from './InkSurface';
import type { InkNoteRow } from '../lib/db';

/** 메모 한 장: 불러오기·저장·되돌리기 */
export function useInkNote(key: string, meta: { lessonKey: string; kind: 'screen' | 'hw'; ref: string; view?: Record<string, unknown> }) {
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [row, setRow] = useState<InkNoteRow | undefined>();
  const [loaded, setLoaded] = useState(false);
  const hist = useRef<InkStroke[][]>([]);
  const metaRef = useRef(meta);
  metaRef.current = meta;
  useEffect(() => {
    let alive = true;
    setLoaded(false);
    hist.current = [];
    void loadInk(key).then((r) => {
      if (!alive) return;
      setRow(r);
      setStrokes(r?.strokes ?? []);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [key]);
  const commit = (next: InkStroke[], record = true) => {
    if (record) hist.current.push(strokes);
    setStrokes(next);
    const m = metaRef.current;
    void saveInk({ key, lessonKey: m.lessonKey, kind: m.kind, ref: m.ref, strokes: next, view: m.view });
  };
  return {
    strokes, row, loaded,
    set: (next: InkStroke[]) => commit(next),
    undo: () => { const prev = hist.current.pop(); if (prev) commit(prev, false); },
    clear: () => commit([]),
    canUndo: hist.current.length > 0,
  };
}

/** 펜 도구 줄: 색·형광펜·지우개·되돌리기·모두 지우기·손가락으로도 쓰기 */
export function InkToolbar({ tool, setTool, color, setColor, fingerDraw, setFingerDraw, onUndo, onClear, extra }: {
  tool: InkTool; setTool: (t: InkTool) => void; color: string; setColor: (c: string) => void;
  fingerDraw: boolean; setFingerDraw: (v: boolean) => void; onUndo: () => void; onClear: () => void; extra?: React.ReactNode;
}) {
  const btn = { flex: 'none', minWidth: 34, padding: '0 8px', justifyContent: 'center' } as const;
  return (
    <div className={s.chips} role="toolbar" aria-label="펜 도구" data-testid="ink-toolbar" style={{ alignItems: 'center', paddingBottom: 2 }}>
      {INK_COLORS.map((c) => (
        <button key={c} type="button" className={s.chip} aria-pressed={tool === 'pen' && color === c} aria-label={`펜 ${c}`} data-testid={`ink-pen-${c.slice(1)}`}
          onClick={() => { setTool('pen'); setColor(c); }} style={{ ...btn, minWidth: 32, padding: 0 }}>
          <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: 8, background: c, display: 'block', outline: tool === 'pen' && color === c ? '2px solid var(--accent-ink)' : 'none' }} />
        </button>
      ))}
      <button type="button" className={s.chip} aria-pressed={tool === 'hl'} onClick={() => setTool('hl')} style={btn} data-testid="ink-hl">🖍 형광펜</button>
      <button type="button" className={s.chip} aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')} style={btn} data-testid="ink-eraser">지우개</button>
      <button type="button" className={s.chip} onClick={onUndo} style={btn} aria-label="되돌리기" data-testid="ink-undo">↶</button>
      <button type="button" className={s.chip} onClick={() => { if (confirm('이 메모를 모두 지울까요?')) onClear(); }} style={btn} data-testid="ink-clear">모두 지우기</button>
      <button type="button" className={s.chip} aria-pressed={fingerDraw} onClick={() => setFingerDraw(!fingerDraw)} style={btn} title="펜슬이 없을 때 손가락으로 쓰기(켜 둔 동안은 화면이 스크롤되지 않아요)" data-testid="ink-finger">
        ✋ 손가락
      </button>
      {extra}
    </div>
  );
}
