import { useEffect, useSyncExternalStore } from 'react';
import s from '../styles/ui.module.css';
import { subscribePdf, getReadyPdf, clearPdf, deliverPdf } from '../lib/pdf';
import { toast } from './Toast';

/** 앱 안 PDF 보기: 만든 PDF 의 쪽들을 보여 주고, 위의 📤 공유로 '파일에 저장'·프린트 등. ✕ 는 보던 화면으로 그대로 */
export function PdfReady() {
  const r = useSyncExternalStore(subscribePdf, getReadyPdf, getReadyPdf);
  useEffect(() => {
    if (!r) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && clearPdf();
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [r]);
  if (!r) return null;
  const kb = Math.round(r.blob.size / 1024);
  return (
    <div role="dialog" aria-modal="true" aria-label="PDF 보기" data-testid="pdf-ready"
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: '#525659', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', paddingTop: 'calc(8px + env(safe-area-inset-top))', background: '#323639', color: '#fff' }}>
        <button type="button" className={s.iconSm} onClick={clearPdf} aria-label="PDF 닫기" data-testid="pdf-close" autoFocus
          style={{ background: 'transparent', color: '#fff', borderColor: 'rgb(255 255 255 / 30%)' }}>✕</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.filename}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{r.pages.length}쪽 · {kb >= 1024 ? `${(kb / 1024).toFixed(1)}MB` : `${kb}KB`}</div>
        </div>
        <button type="button" className={s.primary} data-testid="pdf-save" style={{ minHeight: 36 }} onClick={async () => {
          const how = await deliverPdf(r.blob, r.filename);
          if (how === 'downloaded') toast('PDF를 내려받았어요');
        }}>📤 공유</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch', padding: 12 }} data-testid="pdf-pages">
        {r.pages.map((src, i) => (
          <img key={i} src={src} alt={`${i + 1}쪽`} style={{ display: 'block', width: '100%', maxWidth: 760, margin: '0 auto 12px', boxShadow: '0 2px 10px rgb(0 0 0 / 35%)', background: '#fff' }} />
        ))}
      </div>
    </div>
  );
}
