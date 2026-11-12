// PDF 저장: 화면(본문 + 손글씨 메모) / 손글씨 필사 노트. 필요할 때만 라이브러리를 불러온다.
import { drawStrokes, type InkStroke } from './ink';

const SCALE = 2;
const A4 = { w: 210, h: 297, m: 10 }; // mm

async function libs() {
  const [{ jsPDF }, h2i] = await Promise.all([import('jspdf'), import('html-to-image')]);
  return { jsPDF, h2i };
}

/** 머리글(제목·날짜) 그림 — PDF 기본 글꼴엔 한글이 없어서 그림으로 넣는다 */
function headerCanvas(widthPx: number, title: string, sub: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = widthPx;
  c.height = 70 * SCALE;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#111';
  ctx.font = `700 ${20 * SCALE}px Georgia, "Noto Serif KR", serif`;
  ctx.fillText(title, 0, 28 * SCALE, widthPx);
  ctx.fillStyle = '#666';
  ctx.font = `${13 * SCALE}px -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  ctx.fillText(sub, 0, 52 * SCALE, widthPx);
  return c;
}

/** 세로로 긴 캔버스들을 A4 페이지에 이어 붙인다(넘치면 다음 장) */
function toPdf(jsPDF: typeof import('jspdf').jsPDF, blocks: HTMLCanvasElement[]) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const contentW = A4.w - A4.m * 2;
  const contentH = A4.h - A4.m * 2;
  let y = A4.m;
  let first = true;
  for (const cv of blocks) {
    const mmPerPx = contentW / cv.width;
    let srcY = 0;
    while (srcY < cv.height) {
      const room = A4.m + contentH - y;
      if (room < 15 && !first) { doc.addPage(); y = A4.m; continue; }
      const sliceH = Math.min(cv.height - srcY, Math.floor(room / mmPerPx));
      const part = document.createElement('canvas');
      part.width = cv.width;
      part.height = sliceH;
      part.getContext('2d')!.drawImage(cv, 0, srcY, cv.width, sliceH, 0, 0, cv.width, sliceH);
      doc.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', A4.m, y, contentW, sliceH * mmPerPx);
      first = false;
      y += sliceH * mmPerPx;
      srcY += sliceH;
      if (srcY < cv.height) { doc.addPage(); y = A4.m; }
    }
    y += 4;
  }
  return doc.output('blob');
}

/** 만든 PDF: 공유 시트(아이패드 → '파일에 저장')가 되면 그걸로, 아니면 내려받기 */
export async function deliverPdf(blob: Blob, filename: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] }) && typeof nav.share === 'function') {
    try {
      await nav.share({ files: [file], title: filename });
      return 'shared';
    } catch { /* 취소하면 내려받기로 */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'downloaded';
}

/** 화면 PDF: el(본문 칸)을 그대로 그림으로 + 그 위에 손글씨 */
export async function screenPdf(el: HTMLElement, strokes: InkStroke[], title: string, sub: string): Promise<Blob> {
  const { jsPDF, h2i } = await libs();
  const opts = {
    pixelRatio: SCALE, backgroundColor: '#ffffff', cacheBust: true,
    filter: (n: Node) => !(n instanceof Element && (n.getAttribute('data-ink') === '1' || n.getAttribute('data-pdf-skip') === '1')),
  };
  await h2i.toCanvas(el, opts).catch(() => undefined); // Safari: 처음 한 번은 글꼴이 빠질 때가 있어 두 번 그린다
  const cv = await h2i.toCanvas(el, opts);
  drawStrokes(cv.getContext('2d')!, strokes, cv.width); // 좌표는 칸 너비 비율 → 그림 너비를 곱하면 됨
  return toPdf(jsPDF, [headerCanvas(cv.width, title, sub), cv]);
}

/** 손글씨 필사 PDF: 문장마다 원문 + 손으로 쓴 칸 */
export async function handwritingPdf(pages: { en: string; ko?: string; strokes: InkStroke[]; aspect: number; date?: string }[], title: string, sub: string): Promise<Blob> {
  const { jsPDF } = await libs();
  const W = 760 * SCALE;
  const blocks: HTMLCanvasElement[] = [headerCanvas(W, title, sub)];
  for (const [i, pg] of pages.entries()) {
    const textLines = wrap(`${i + 1}. ${pg.en}`, W, `${17 * SCALE}px Georgia, serif`);
    const padH = Math.round(W * pg.aspect);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = (textLines.length * 26 + 16) * SCALE + padH + 12 * SCALE;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#111';
    ctx.font = `${17 * SCALE}px Georgia, serif`;
    textLines.forEach((l, k) => ctx.fillText(l, 0, (k + 1) * 26 * SCALE));
    const top = (textLines.length * 26 + 16) * SCALE;
    ctx.save();
    ctx.translate(0, top);
    ruled(ctx, W, padH);
    drawStrokes(ctx, pg.strokes, W);
    ctx.restore();
    blocks.push(c);
  }
  return toPdf(jsPDF, blocks);
}

/** 손글씨 칸 줄무늬(화면과 같은 간격: 칸 너비의 1/12) */
export function ruled(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.save();
  ctx.strokeStyle = '#cfd6e0';
  ctx.lineWidth = Math.max(1, W / 800);
  ctx.strokeRect(0, 0, W, H);
  const gap = W / 12;
  for (let y = gap; y < H; y += gap) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();
}

function wrap(text: string, maxW: number, font: string): string[] {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = font;
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const t = line ? `${line} ${word}` : word;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t;
  }
  if (line) out.push(line);
  return out;
}
