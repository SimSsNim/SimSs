import type { ReactNode } from 'react';
import s from '../styles/ui.module.css';

/** 한 줄을 꽉 채우는 네모 선택 버튼(L1~L4 칩과 같은 모양) */
export function GridTabs<T extends string>({ value, onChange, options, label, role = 'group', testid }: {
  value: T; onChange: (v: T) => void; options: [T, ReactNode][]; label: string; role?: 'group' | 'tablist';
  /** 버튼 data-testid 앞부분(예: 'fav' → fav-all) */ testid?: string;
}) {
  return (
    <div role={role} aria-label={label} style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`, gap: 5, margin: '2px 0 6px' }}>
      {options.map(([v, l]) => (
        <button key={v} type="button" className={s.chip} role={role === 'tablist' ? 'tab' : undefined}
          aria-selected={role === 'tablist' ? value === v : undefined} aria-pressed={role === 'group' ? value === v : undefined}
          onClick={() => onChange(v)} data-testid={testid ? `${testid}-${v}` : undefined}
          style={{ borderRadius: 8, justifyContent: 'center', padding: '0 2px', minWidth: 0, width: '100%', fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {l}
        </button>
      ))}
    </div>
  );
}
