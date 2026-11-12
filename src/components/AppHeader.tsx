import type { ReactNode } from 'react';
import s from '../styles/ui.module.css';
import sh from '../styles/shell.module.css';
import { TrackSwitch } from './TrackSwitch';
import { LevelChips, ChapterSeg } from './LevelChips';
import type { Track } from '../lib/types';

export function AppHeader({ track, target = 'home', right, children, sticky = true, levels = false }: {
  track?: Track; target?: 'home' | 'list' | 'stay'; right?: ReactNode; children?: ReactNode; sticky?: boolean;
  /** 트랙 아래에 레벨 칩(토익이면 Part 세그먼트도) */ levels?: boolean;
}) {
  return (
    <header className={sticky && !levels ? s.header : s.headerStatic}>
      <div className={s.headerInner}>
        <div className={sh.top} style={{ width: '100%' }}>
          {track ? <TrackSwitch current={track} target={target} /> : <span className={sh.brand}>필사 노트</span>}
          {right}
        </div>
      </div>
      {track && levels && (
        <div className={s.headerInner} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, marginTop: 6 }}>
          <LevelChips track={track} />
          {track === 'toeic' && <ChapterSeg />}
        </div>
      )}
      {children}
    </header>
  );
}
