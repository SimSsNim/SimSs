import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import s from '../../../styles/ui.module.css';
import type { TabProps } from '../LessonPage';
import { flatSentences } from '../../../lib/lessonUtils';
import { InkSurface, type InkTool } from '../../../components/InkSurface';
import { InkToolbar, useInkNote } from '../../../components/InkTools';
import { INK_COLORS, hwKey, drawStrokes } from '../../../lib/ink';
import { db } from '../../../lib/db';
import { autoCheck } from '../../../lib/progress';
import { handwritingPdf, deliverPdf, ruled } from '../../../lib/pdf';
import { toast } from '../../../components/Toast';
import { formatKo } from '../../../lib/date';
import { useEffect, useRef } from 'react';

/** 손글씨 칸 가로:세로 = 1 : 0.42 (줄 간격 = 너비/12 → 5줄) */
export const PAD_ASPECT = 0.42;
const padBg = 'repeating-linear-gradient(to bottom, transparent 0, transparent calc(100% / 5.04 - 1px), #cfd6e0 calc(100% / 5.04 - 1px), #cfd6e0 calc(100% / 5.04))';

/** 손글씨 필사: 한 문장씩 원문을 보고 펜슬로 따라 쓰기. 문장마다 저장, 모아 보기·PDF */
export function HandwriteMode({ lesson, lessonKey }: TabProps) {
  const sents = flatSentences(lesson);
  const [i, setI] = useState(0);
  const [view, setView] = useState<'write' | 'all'>('write');
  const [tool, setTool] = useState<InkTool>('pen');
  const [color, setColor] = useState<string>(INK_COLORS[0]);
  const [finger, setFinger] = useState(false);
  const [busy, setBusy] = useState(false);
  const sen = sents[i];
  const note = useInkNote(hwKey(lessonKey, sen.id), { lessonKey, kind: 'hw', ref: sen.id });
  const rows = useLiveQuery(() => db.inkNotes.where('lessonKey').equals(lessonKey).filter((r) => r.kind === 'hw').toArray(), [lessonKey]);
  const written = new Set((rows ?? []).filter((r) => r.strokes.length).map((r) => r.ref));
  const allDone = sents.every((x) => written.has(x.id));

  useEffect(() => {
    if (allDone && rows) {
      void autoCheck(lessonKey, 'transcribe');
    }
  }, [allDone, rows, lessonKey]);

  const pdf = async () => {
    const pages = sents.map((x) => ({ x, r: rows?.find((r) => r.ref === x.id) })).filter((p) => p.r?.strokes.length)
      .map((p) => ({ en: p.x.en, strokes: p.r!.strokes, aspect: PAD_ASPECT }));
    if (!pages.length) return toast('아직 손으로 쓴 문장이 없어요');
    setBusy(true);
    try {
      const blob = await handwritingPdf(pages, `${lesson.title} — 손글씨 필사`, `${formatKo(lesson.date)} · 레벨 ${lesson.level} · ${pages.length}/${sents.length}문장`);
      await deliverPdf(blob, `${lesson.date}-${lesson.title.replace(/[^\w가-힣 -]/g, '').slice(0, 40)}-손글씨.pdf`);
    } catch (e) {
      toast(`PDF를 만들지 못했어요: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.stack} data-testid="handwrite">
      <div className={s.between}>
        <div className={s.seg} role="group" aria-label="보기">
          <button type="button" className={s.segBtn} aria-pressed={view === 'write'} onClick={() => setView('write')}>쓰기</button>
          <button type="button" className={s.segBtn} aria-pressed={view === 'all'} onClick={() => setView('all')} data-testid="hw-all">모아 보기 {written.size}/{sents.length}</button>
        </div>
        <button type="button" className={s.btn} onClick={() => void pdf()} disabled={busy} data-testid="hw-pdf">{busy ? '만드는 중…' : '📄 PDF'}</button>
      </div>
      {view === 'write' ? (
        <>
          <div className={s.chips} role="group" aria-label="문장 고르기">
            {sents.map((x, k) => (
              <button key={x.id} type="button" className={s.chip} aria-pressed={k === i} onClick={() => setI(k)} data-testid={`hw-s-${k + 1}`}
                style={{ minWidth: 36, justifyContent: 'center', padding: '0 8px' }}>{written.has(x.id) ? '✓' : ''}{k + 1}</button>
            ))}
          </div>
          <p lang="en" style={{ fontFamily: 'var(--serif)', fontSize: 'var(--read-size)', lineHeight: 1.5, margin: 0 }} data-testid="hw-sentence">{sen.en}</p>
          <div style={{ position: 'relative', width: '100%', aspectRatio: `1 / ${PAD_ASPECT}`, backgroundColor: '#fff', backgroundImage: padBg, border: '1px solid var(--line)', borderRadius: 10, touchAction: 'pan-y' }}
            data-testid="hw-pad">
            <InkSurface strokes={note.strokes} onChange={note.set} active tool={tool} color={color} fingerDraw={finger} testid="hw-surface" />
          </div>
          <InkToolbar tool={tool} setTool={setTool} color={color} setColor={setColor} fingerDraw={finger} setFingerDraw={setFinger} onUndo={note.undo} onClear={note.clear} />
          <div className={s.row}>
            <button type="button" className={s.btn} disabled={i === 0} onClick={() => setI(i - 1)}>‹ 이전 문장</button>
            <button type="button" className={s.primary} disabled={i === sents.length - 1} onClick={() => setI(i + 1)} data-testid="hw-next">다음 문장 ›</button>
          </div>
          <p className={s.small + ' ' + s.muted} style={{ margin: 0 }}>애플펜슬로 쓰면 저장돼요(손가락은 스크롤). 펜슬이 없으면 ✋ 손가락을 켜세요. 모든 문장을 쓰면 '필사'가 체크돼요.</p>
        </>
      ) : (
        <ul className={s.list}>
          {sents.map((x, k) => {
            const r = rows?.find((rr) => rr.ref === x.id);
            return (
              <li key={x.id} className={s.card} data-testid="hw-page">
                <p lang="en" style={{ fontFamily: 'var(--serif)', margin: '0 0 6px' }}>{k + 1}. {x.en}</p>
                {r?.strokes.length ? <PadPreview strokes={r.strokes} /> : <button type="button" className={s.ghost} onClick={() => { setI(k); setView('write'); }}>아직 안 썼어요 · 쓰러 가기 ›</button>}
                {r?.date && <div className={s.small + ' ' + s.muted}>{formatKo(r.date)}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** 저장된 손글씨를 그림으로(모아 보기) */
function PadPreview({ strokes }: { strokes: import('../../../lib/ink').InkStroke[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const W = c.clientWidth * 2;
    c.width = W;
    c.height = Math.round(W * PAD_ASPECT);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ruled(ctx, W, c.height);
    drawStrokes(ctx, strokes, W);
  }, [strokes]);
  return <canvas ref={ref} style={{ width: '100%', aspectRatio: `1 / ${PAD_ASPECT}`, borderRadius: 8, display: 'block' }} aria-label="손글씨" />;
}
