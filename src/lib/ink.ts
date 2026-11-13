// 손글씨(애플펜슬) 공용: 획 저장·불러오기, SVG 경로, 캔버스에 그리기(PDF 용)
import { db, type InkNoteRow, type InkStroke } from './db';
import { kstDate } from './date';

export type { InkStroke };
export const INK_COLORS = ['#1f2937', '#d14343', '#2563eb', '#15803d'] as const;
export const HL_COLOR = '#facc15';
export const PEN_W = 0.0045; // 칸 너비 대비 굵기
export const HL_W = 0.022;

export const screenKey = (lessonKey: string, tab: string) => `${lessonKey}:${tab}`;
export const hwKey = (lessonKey: string, sentenceId: string) => `${lessonKey}:hw:${sentenceId}`;

export async function loadInk(key: string): Promise<InkNoteRow | undefined> {
  return db.inkNotes.get(key);
}

export async function saveInk(row: Omit<InkNoteRow, 'updatedAt' | 'date'>): Promise<void> {
  if (!row.strokes.length) {
    await db.inkNotes.delete(row.key);
    return;
  }
  await db.inkNotes.put({ ...row, updatedAt: Date.now(), date: kstDate() });
}

/** 점 목록(비율 좌표) → 부드러운 SVG 경로(중간점 2차 곡선) */
export function strokePath(p: number[], W: number): string {
  const n = p.length / 3;
  if (n === 0) return '';
  const x = (i: number) => p[i * 3] * W;
  const y = (i: number) => p[i * 3 + 1] * W;
  if (n === 1) return `M${x(0)},${y(0)} L${x(0) + 0.01},${y(0)}`;
  let d = `M${x(0).toFixed(1)},${y(0).toFixed(1)}`;
  for (let i = 1; i < n - 1; i++) {
    const mx = (x(i) + x(i + 1)) / 2;
    const my = (y(i) + y(i + 1)) / 2;
    d += ` Q${x(i).toFixed(1)},${y(i).toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
  }
  d += ` L${x(n - 1).toFixed(1)},${y(n - 1).toFixed(1)}`;
  return d;
}

/** 필압(0~1, 펜이 아니면 0.5)을 굵기에 반영 */
export function strokeWidth(s: InkStroke, W: number): number {
  if (s.t === 'hl') return s.w * W;
  const n = s.p.length / 3;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += s.p[i * 3 + 2] || 0.5;
  const avg = n ? sum / n : 0.5;
  return Math.max(1, s.w * W * (0.55 + avg * 0.9));
}

/** 캔버스에 획 그리기. W = 칸 너비(px), dy = 위로 밀 거리(px, 페이지 나눌 때) */
export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: InkStroke[], W: number, dy = 0) {
  for (const s of strokes) {
    const path = new Path2D(strokePath(s.p, W));
    ctx.save();
    ctx.translate(0, -dy);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = s.c;
    ctx.globalAlpha = s.t === 'hl' ? 0.35 : 1;
    ctx.lineWidth = strokeWidth(s, W);
    ctx.stroke(path);
    ctx.restore();
  }
}

/** 지우개: (x,y) 근처(비율 r)를 지나는 획의 번호 */
export function hitStrokes(strokes: InkStroke[], x: number, y: number, r: number): number[] {
  const out: number[] = [];
  strokes.forEach((s, idx) => {
    for (let i = 0; i < s.p.length; i += 3) {
      const dx = s.p[i] - x;
      const dy = s.p[i + 1] - y;
      if (dx * dx + dy * dy <= r * r) {
        out.push(idx);
        return;
      }
    }
  });
  return out;
}

/** 부분 지우개: (x,y) 반경 r 안의 점을 지우고, 끊긴 곳에서 획을 나눈다(점 간격이 넓으면 먼저 촘촘하게) */
export function eraseAtPoint(strokes: InkStroke[], x: number, y: number, r: number): InkStroke[] | null {
  let changed = false;
  const out: InkStroke[] = [];
  const r2 = r * r;
  for (const s of strokes) {
    // 빠르게 그어 점이 듬성한 획: 지우개 반경의 절반 간격으로 채움
    const pts: number[] = [];
    for (let i = 0; i < s.p.length; i += 3) {
      if (i > 0) {
        const [x0, y0, p0] = [s.p[i - 3], s.p[i - 2], s.p[i - 1]];
        const [x1, y1, p1] = [s.p[i], s.p[i + 1], s.p[i + 2]];
        const n = Math.floor(Math.hypot(x1 - x0, y1 - y0) / (r / 2));
        for (let k = 1; k < n; k++) pts.push(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, p0 + ((p1 - p0) * k) / n);
      }
      pts.push(s.p[i], s.p[i + 1], s.p[i + 2]);
    }
    let seg: number[] = [];
    let hit = false;
    for (let i = 0; i < pts.length; i += 3) {
      const dx = pts[i] - x;
      const dy = pts[i + 1] - y;
      if (dx * dx + dy * dy <= r2) {
        hit = true;
        if (seg.length >= 6) out.push({ ...s, p: seg });
        seg = [];
      } else seg.push(pts[i], pts[i + 1], pts[i + 2]);
    }
    if (!hit) { out.push(s); continue; }
    changed = true;
    if (seg.length >= 6) out.push({ ...s, p: seg });
  }
  return changed ? out : null;
}
