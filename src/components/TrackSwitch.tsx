import { useNavigate } from 'react-router-dom';
import s from '../styles/ui.module.css';
import sh from '../styles/shell.module.css';
import { TRACKS, TRACK_LABEL, type Track } from '../lib/types';
import { useLessons } from '../lib/lessons';
import { setSetting, getSettings, useSettings } from '../lib/settings';

export function TrackSwitch({ current, target = 'home' }: { current: Track; target?: 'home' | 'list' | 'stay' }) {
  const nav = useNavigate();
  const { newKeys } = useLessons();
  const { startTrack } = useSettings();
  // 우선순위로 정한 트랙을 앞에
  const order = startTrack === 'last' ? TRACKS : [startTrack, ...TRACKS.filter((t) => t !== startTrack)];
  return (
    <div className={s.seg} role="group" aria-label="학습 트랙">
      {order.map((t) => {
        const hasNew = newKeys.some((k) => k.startsWith(`${t}/`));
        return (
          <button key={t} type="button" className={s.segBtn} aria-pressed={current === t} data-testid={`track-${t}`}
            onClick={() => {
              setSetting('track', t);
              if (t === current) return;
              const last = getSettings().lastLesson[t];
              if (target === 'list') nav(`/${t}/list`);
              else if (target === 'stay' && last) nav(`/${t}/lesson/${last.id}/${last.tab}`);
              else nav(`/${t}`);
            }}>
            {TRACK_LABEL[t]}
            {hasNew && <span className={sh.newDot} aria-label="새 지문" />}
          </button>
        );
      })}
    </div>
  );
}
