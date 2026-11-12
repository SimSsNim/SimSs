import s from '../styles/ui.module.css';
import { LEVELS, LEVEL_DESC, type Level, type Track } from '../lib/types';
import { useSettings, setSetting, getSettings } from '../lib/settings';

export function setMyLevel(track: Track, level: Level) {
  setSetting('levelByTrack', { ...getSettings().levelByTrack, [track]: level });
}
export const myLevel = (track: Track): Level => getSettings().levelByTrack[track] ?? 1;
export function useMyLevel(track: Track): Level {
  return useSettings().levelByTrack[track] ?? 1;
}

/** 내 레벨 칩 L1~L4 (트랙마다 따로 기억) */
export function LevelChips({ track, value, onChange, label = '내 레벨' }: { track: Track; value?: Level; onChange?: (l: Level) => void; label?: string }) {
  const mine = useMyLevel(track);
  const cur = value ?? mine;
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {LEVELS.map((l) => (
        <button key={l} type="button" className={s.chip} aria-pressed={cur === l} data-testid={`level-${l}`} title={LEVEL_DESC[track][l]}
          onClick={() => (onChange ? onChange(l) : setMyLevel(track, l))} style={{ minHeight: 40, flexDirection: 'column', gap: 0, lineHeight: 1.1, padding: '2px 10px' }}>
          <span>L{l}</span>
          <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.85 }}>{LEVEL_DESC[track][l]}</span>
        </button>
      ))}
    </div>
  );
}
