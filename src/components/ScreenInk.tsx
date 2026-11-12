import { useEffect, useRef, useState, type ReactNode } from 'react';
import s from '../styles/ui.module.css';
import { InkSurface, type InkTool } from './InkSurface';
import { InkToolbar, useInkNote } from './InkTools';
import { INK_COLORS, screenKey } from '../lib/ink';
import { useSettings, setSetting } from '../lib/settings';
import { screenPdf, deliverPdf } from '../lib/pdf';
import { toast } from './Toast';
import { formatKo } from '../lib/date';
import type { Lesson } from '../lib/types';

/** 메모할 수 있는 탭(내용이 고정된 화면) */
export const INK_TABS = ['full', 'vocab', 'grammar'];
const VIEW_KEYS = ['displayMode', 'fontSize', 'lineHeight', 'serif', 'showSlashes', 'hlVocab', 'hlGrammar'] as const;

/** 레슨 본문 위 손글씨 메모 + PDF 저장. children = 탭 내용 */
export function ScreenInk({ lesson, lessonKey, tab, tabLabel, children }: { lesson: Lesson; lessonKey: string; tab: string; tabLabel: string; children: ReactNode }) {
  const st = useSettings();
  const enabled = INK_TABS.includes(tab);
  const [on, setOn] = useState(false);
  const [tool, setTool] = useState<InkTool>('pen');
  const [color, setColor] = useState<string>(INK_COLORS[0]);
  const [finger, setFinger] = useState(false);
  const [busy, setBusy] = useState(false);
  const view = Object.fromEntries(VIEW_KEYS.map((k) => [k, st[k]]));
  const note = useInkNote(screenKey(lessonKey, tab), { lessonKey, kind: 'screen', ref: tab, view });
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!enabled) setOn(false); }, [enabled]);

  const saved = note.row?.view;
  const differs = !!saved && note.strokes.length > 0 && VIEW_KEYS.some((k) => saved[k] !== undefined && saved[k] !== st[k]);

  const pdf = async () => {
    if (!box.current) return;
    setBusy(true);
    try {
      const blob = await screenPdf(box.current, note.strokes, lesson.title, `${tabLabel} · ${formatKo(lesson.date)} · 레벨 ${lesson.level}`);
      const how = await deliverPdf(blob, `${lesson.date}-${lesson.title.replace(/[^\w가-힣 -]/g, '').slice(0, 40)}-${tab}.pdf`);
      toast(how === 'shared' ? 'PDF를 만들었어요' : 'PDF를 내려받았어요');
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
      <div ref={box} style={{ position: 'relative' }} data-testid="ink-box">
        {children}
        <InkSurface strokes={note.strokes} onChange={note.set} active={on} tool={tool} color={color} fingerDraw={finger} />
      </div>
      <div data-pdf-skip="1" style={{ position: 'fixed', right: 12, bottom: 'calc(var(--nav-h) + var(--player-h) + 12px + env(safe-area-inset-bottom))', zIndex: 36, maxWidth: 'calc(100vw - 24px)' }}>
        {on ? (
          <div className={s.card} style={{ padding: '6px 8px', boxShadow: '0 6px 24px rgb(0 0 0 / 18%)', maxWidth: 'min(740px, calc(100vw - 24px))' }}>
            <InkToolbar tool={tool} setTool={setTool} color={color} setColor={setColor} fingerDraw={finger} setFingerDraw={setFinger}
              onUndo={note.undo} onClear={note.clear}
              extra={<>
                <button type="button" className={s.chip} onClick={() => void pdf()} disabled={busy} style={{ flex: 'none' }} data-testid="ink-pdf">{busy ? '만드는 중…' : '📄 PDF'}</button>
                <button type="button" className={s.chip} aria-pressed="true" onClick={() => setOn(false)} style={{ flex: 'none' }} data-testid="ink-done">완료</button>
              </>} />
          </div>
        ) : (
          <div className={s.row} style={{ gap: 6 }}>
            <button type="button" className={s.btn} onClick={() => void pdf()} disabled={busy} data-testid="screen-pdf" style={{ boxShadow: 'var(--shadow)' }}>{busy ? '…' : '📄 PDF'}</button>
            <button type="button" className={s.primary} onClick={() => setOn(true)} aria-label="손글씨 메모" data-testid="ink-toggle" style={{ boxShadow: 'var(--shadow)' }}>
              ✏️ 메모{note.strokes.length ? ` ${note.strokes.length}` : ''}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
