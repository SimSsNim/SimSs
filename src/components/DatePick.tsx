import s from '../styles/ui.module.css';
import { addDays, formatKo, kstDate } from '../lib/date';

/**
 * 날짜 고르기: ‹ [날짜] › (+ 전체 / 오늘)
 * value '' = 전체 날짜. dates가 있으면 ‹ ›는 그 목록(레슨이 있는 날) 안에서 움직이고, 없으면 하루씩.
 */
export function DatePick({ value, onChange, dates, allowAll = true, todayBtn = false, label = '날짜' }: {
  value: string; onChange: (d: string) => void; dates?: string[]; allowAll?: boolean; todayBtn?: boolean; label?: string;
}) {
  const today = kstDate();
  const list = dates ? [...new Set(dates)].sort() : null;
  const step = (dir: -1 | 1) => {
    if (!list) return onChange(addDays(value || today, dir));
    if (!list.length) return;
    if (!value) return onChange(dir < 0 ? list[list.length - 1] : list[0]);
    const next = dir < 0 ? [...list].reverse().find((d) => d < value) : list.find((d) => d > value);
    if (next) onChange(next);
  };
  const canPrev = !list || (list.length > 0 && (!value || list[0] < value));
  const canNext = !list || (list.length > 0 && (!value || list[list.length - 1] > value));
  return (
    <div className={s.row} role="group" aria-label={label} data-testid="date-pick" style={{ flexWrap: 'nowrap', gap: 6, margin: '6px 0' }}>
      <button type="button" className={s.iconBtn} onClick={() => step(-1)} disabled={!canPrev} aria-label="이전 날짜" data-testid="date-prev" style={{ flex: 'none' }}>‹</button>
      <label className={s.chip} style={{ position: 'relative', flex: '1 1 auto', justifyContent: 'center', minWidth: 0, fontWeight: 700 }}>
        <span aria-hidden="true" style={{ whiteSpace: 'nowrap' }}>📅 {value ? `${formatKo(value)}${value === today ? ' · 오늘' : ''}` : '전체 날짜'}</span>
        <input type="date" value={value} aria-label={label} data-testid="date-input"
          onChange={(e) => { if (e.target.value || allowAll) onChange(e.target.value); }}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
      </label>
      <button type="button" className={s.iconBtn} onClick={() => step(1)} disabled={!canNext} aria-label="다음 날짜" data-testid="date-next" style={{ flex: 'none' }}>›</button>
      {allowAll && value && <button type="button" className={s.chip} onClick={() => onChange('')} data-testid="date-all" style={{ flex: 'none' }}>전체</button>}
      {todayBtn && value !== today && <button type="button" className={s.chip} onClick={() => onChange(today)} data-testid="date-today" style={{ flex: 'none' }}>오늘</button>}
    </div>
  );
}
