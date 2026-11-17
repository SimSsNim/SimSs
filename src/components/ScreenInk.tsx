import { useEffect, useRef, useState, type ReactNode } from 'react';
import s from '../styles/ui.module.css';
import { InkSurface } from './InkSurface';
import { InkToolbar, useInkNote, usePen } from './InkTools';
import { screenKey } from '../lib/ink';
import { useSettings, setSetting } from '../lib/settings';
import { screenPdf, offerPdf } from '../lib/pdf';
import { toast } from './Toast';
import { formatKo } from '../lib/date';
import type { Lesson } from '../lib/types';

/** 메모할 수 있는 탭(내용이 고정된 화면) */
export const INK_TABS = ['full', 'vocab', 'grammar'];
/** 펜슬로 열린 메모: 이만큼 펜슬 움직임이 없으면 자동 완료 */
export const PEN_IDLE_MS = 6000;
const VIEW_KEYS = ['displayMode', 'fontSize', 'lineHeight', 'serif', 'showSlashes', 'hlVocab', 'hlGrammar'] as const;

/** 레슨 본문 위 손글씨 메모 + PDF 저장. children = 탭 내용 */
export function ScreenInk({ lesson, lessonKey, tab, tabLabel, children }: { lesson: Lesson; lessonKey: string; tab: string; tabLabel: string; children: ReactNode }) {
  const st = useSettings();
  const enabled = INK_TABS.includes(tab);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const pen = usePen();
  const { tool, setTool, color, setColor, size, setSize, eraseMode, setEraseMode, finger, setFinger } = pen;
  const dtOn = useSettings().penDoubleTap !== 'none';
  const view = Object.fromEntries(VIEW_KEYS.map((k) => [k, st[k]]));
  const note = useInkNote(screenKey(lessonKey, tab), { lessonKey, kind: 'screen', ref: tab, view });
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!enabled) setOn(false); }, [enabled]);
  // 펜슬로 바로 쓰기로 열린 메모는, 펜슬을 내려놓으면(잠시 닿지도 가까이 있지도 않으면) 저절로 완료
  const autoOpened = useRef(false);
  const idleTimer = useRef<number | undefined>(undefined);
  const penActive = () => {
    clearTimeout(idleTimer.current);
    if (!autoOpened.current) return;
    idleTimer.current = window.setTimeout(() => {
      if (autoOpened.current) { autoOpened.current = false; setOn(false); }
    }, PEN_IDLE_MS);
  };
  useEffect(() => () => clearTimeout(idleTimer.current), []);
  const openByButton = () => { autoOpened.current = false; clearTimeout(idleTimer.current); if (st.penLock) setSetting('penLock', false); setOn(true); };
  const close = () => { autoOpened.current = false; clearTimeout(idleTimer.current); setOn(false); };
  const toggleLock = () => { const next = !st.penLock; setSetting('penLock', next); if (next) close(); toast(next ? '🔒 펜 글씨 잠금: 펜슬은 누르기·스크롤만' : '🔓 펜 글씨 잠금 풀림', { ms: 1500 }); };

  const saved = note.row?.view;
  const differs = !!saved && note.strokes.length > 0 && VIEW_KEYS.some((k) => saved[k] !== undefined && saved[k] !== st[k]);

  const pdf = async () => {
    if (!box.current) return;
    setBusy(true);
    try {
      const made = await screenPdf(box.current, note.strokes, lesson.title, `${tabLabel} · ${formatKo(lesson.date)} · 레벨 ${lesson.level}`);
      offerPdf(made, `${lesson.date}-${lesson.title.replace(/[^\w가-힣 -]/g, '').slice(0, 40)}-${tab}.pdf`);
    } catch (e) {
      toast(`PDF를 만들지 못했어요: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  if (!enabled) return <>{children}</>;
  return (
    <>
      {differs && (
        <div className={s.card} role="note" style={{ marginBottom: 8, padding: 10 }} data-testid="ink-view-differs">
          <span className={s.small}>메모할 때와 보기 설정(글자 크기·표시 방식)이 달라 메모 위치가 어긋날 수 있어요. </span>
          <button type="button" className={s.chip} onClick={() => VIEW_KEYS.forEach((k) => saved![k] !== undefined && setSetting(k, saved![k] as never))}>메모할 때 설정으로 보기</button>
        </div>
      )}
      <div ref={box} style={{ position: 'relative', cursor: on ? (tool === 'eraser' ? 'cell' : 'crosshair') : undefined, touchAction: on && finger ? 'none' : undefined, userSelect: on ? 'none' : undefined }} data-testid="ink-box">
        {children}
        <InkSurface strokes={note.strokes} onChange={note.set} active={on} tool={tool} color={color} fingerDraw={finger} eraseMode={eraseMode} size={size} onPenDoubleTap={dtOn && (!st.penLock || st.penDoubleTap === 'lock') ? () => pen.doubleTap(note, toggleLock) : undefined}
          penAlways={st.penAuto && !st.penLock} locked={st.penLock} scribbleErase={st.scribbleErase} onPenActivity={penActive}
          onPenStart={() => { autoOpened.current = true; setOn(true); penActive(); }} />
      </div>
      <div data-pdf-skip="1" style={{ position: 'fixed', right: 12, bottom: 'calc(var(--nav-h) + var(--player-h) + 12px + env(safe-area-inset-bottom))', zIndex: 36, maxWidth: 'calc(100vw - 24px)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
          <button type="button" className={st.penLock ? s.primary : s.btn} aria-pressed={st.penLock} onClick={toggleLock} data-testid="pen-lock"
            title="켜면 펜슬로 글씨가 써지지 않고 누르기·스크롤만 돼요" style={{ boxShadow: 'var(--shadow)', minHeight: 34, fontSize: 13 }}>
            {st.penLock ? '🔒 펜 잠금' : '🔓 펜 잠금'}
          </button>
        </div>
        {on ? (
          <div className={s.card} style={{ padding: '6px 8px', boxShadow: '0 6px 24px rgb(0 0 0 / 18%)', maxWidth: 'min(740px, calc(100vw - 24px))' }}>
            <InkToolbar tool={tool} setTool={setTool} color={color} setColor={setColor} size={size} setSize={setSize} fingerDraw={finger} setFingerDraw={setFinger}
              onUndo={note.undo} onRedo={note.redo} canUndo={note.canUndo} canRedo={note.canRedo} eraseMode={eraseMode} setEraseMode={setEraseMode} onClear={note.clear}
              extra={<button type="button" className={s.chip} onClick={() => void pdf()} disabled={busy} style={{ flex: 'none' }} data-testid="ink-pdf">{busy ? '만드는 중…' : '📄 PDF'}</button>}
              done={<button type="button" className={s.chip} aria-pressed="true" onClick={close} style={{ flex: 'none', marginLeft: 'auto' }} data-testid="ink-done">완료</button>} />
          </div>
        ) : (
          <div className={s.row} style={{ gap: 6 }}>
            <button type="button" className={s.btn} onClick={() => void pdf()} disabled={busy} data-testid="screen-pdf" style={{ boxShadow: 'var(--shadow)' }}>{busy ? '…' : '📄 PDF'}</button>
            <button type="button" className={s.primary} onClick={openByButton} aria-label="손글씨 메모" data-testid="ink-toggle" style={{ boxShadow: 'var(--shadow)' }}>
              ✏️ 메모{note.strokes.length ? ` ${note.strokes.length}` : ''}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
