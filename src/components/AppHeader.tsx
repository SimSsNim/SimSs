import type { ReactNode } from 'react';
import s from '../styles/ui.module.css';
import sh from '../styles/shell.module.css';
import { TrackSwitch } from './TrackSwitch';
import type { Track } from '../lib/types';

export function AppHeader({ track, target = 'home', right, children, sticky = true }: { track?: Track; target?: 'home' | 'list' | 'stay'; right?: ReactNode; children?: ReactNode; sticky?: boolean }) {
  return (
    <header className={sticky ? s.header : s.headerStatic}>
      <div className={s.headerInner}>
        <div className={sh.top} style={{ width: '100%' }}>
          {track ? <TrackSwitch current={track} target={target} /> : <span className={sh.brand}>필사 노트</span>}
          {right}
        </div>
      </div>
      {children}
    </header>
  );
}
