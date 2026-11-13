import { useSyncExternalStore } from 'react';
import s from '../styles/ui.module.css';
import { subscribePdf, getReadyPdf, clearPdf, deliverPdf } from '../lib/pdf';
import { toast } from './Toast';

/** PDF 를 다 만들면 뜨는 칸: 버튼을 눌러야 공유 시트가 열린다(아이패드 제한) */
export function PdfReady() {
  const r = useSyncExternalStore(subscribePdf, getReadyPdf, getReadyPdf);
  if (!r) return null;
  const kb = Math.round(r.blob.size / 1024);
  return (
    <div role="dialog" aria-label="PDF 준비됨" data-testid="pdf-ready" className={s.card}
      style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(var(--nav-h) + var(--player-h) + 12px + env(safe-area-inset-bottom))', zIndex: 70, maxWidth: 520, margin: '0 auto', boxShadow: '0 10px 40px rgb(0 0 0 / 25%)' }}>
      <b>📄 PDF가 준비됐어요</b>
      <div className={s.small + ' ' + s.muted} style={{ margin: '2px 0 8px', wordBreak: 'break-all' }}>{r.filename} · {kb >= 1024 ? `${(kb / 1024).toFixed(1)}MB` : `${kb}KB`}</div>
      <div className={s.row}>
        <button type="button" className={s.primary} data-testid="pdf-save" autoFocus onClick={async () => {
          const how = await deliverPdf(r.blob, r.filename);
          if (how !== 'cancelled') clearPdf();
          if (how === 'downloaded') toast('PDF를 내려받았어요');
        }}>📤 공유 · 파일에 저장</button>
        <button type="button" className={s.btn} onClick={clearPdf}>닫기</button>
      </div>
    </div>
  );
}
