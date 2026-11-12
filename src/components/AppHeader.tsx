import type { ReactNode } from 'react';
import s from '../styles/ui.module.css';
import sh from '../styles/shell.module.css';
import { TrackSwitch } from './TrackSwitch';
import { LevelChips } from './LevelChips';
import type { Track } from '../lib/types';

export function AppHeader({ track, target = 'home', right, children, sticky = true, levels = false }: {
  track?: Track; target?: 'home' | 'list' | 'stay'; right?: ReactNode; children?: ReactNode; sticky?: boolean;
  /** 트랙 아래에 레벨 칩 */ levels?: boolean;
}) {
  return (
    <header className={sticky && !levels ? s.header : s.headerStatic}>
      <div className={s.headerInner}>
        <div className={sh.top} style={{ width: '100%' }}>
          {track ? <TrackSwitch current={track} target={target} /> : <span className={sh.brand}>심쓰 영어</span>}
          {right}
        </div>
      </div>
      {track && levels && (
        <div className={s.headerInner} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, marginTop: 6 }}>
          <LevelChips track={track} />
        </div>
      )}
      {children}
    </header>
  );
}
