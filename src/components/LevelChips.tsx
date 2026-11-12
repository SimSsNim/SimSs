import s from '../styles/ui.module.css';
import { LEVELS, LEVEL_DESC, type Level, type Track } from '../lib/types';
import { useSettings, setSetting, getSettings, type Settings } from '../lib/settings';

export function setMyLevel(track: Track, level: Level) {
  setSetting('levelByTrack', { ...getSettings().levelByTrack, [track]: level });
  if (track === 'general') setSetting('generalView', 'level');
}
/** 켜 둔 레벨(하나도 없으면 전부) */
export const enabledLevelsOf = (st: Settings, track: Track): Level[] => {
  const on = (st.enabledLevels?.[track] ?? LEVELS).filter((l) => LEVELS.includes(l));
  return on.length ? LEVELS.filter((l) => on.includes(l)) : [...LEVELS];
};
/** 고른 레벨이 꺼져 있으면 켜진 첫 레벨 */
const effective = (st: Settings, track: Track): Level => {
  const lv = st.levelByTrack[track] ?? 1;
  const on = enabledLevelsOf(st, track);
  return on.includes(lv) ? lv : on[0];
};
export const myLevel = (track: Track): Level => effective(getSettings(), track);
export function useMyLevel(track: Track): Level {
  return effective(useSettings(), track);
}
/** 이야기 트랙에서 뉴스를 보는 중인지(뉴스가 꺼져 있으면 false) */
export const isNewsView = (st: Settings, track: Track) => track === 'general' && st.newsEnabled && st.generalView === 'news';
export function useNewsView(track: Track) {
  return isNewsView(useSettings(), track);
}

/** 내 레벨 칩 L1~L4 (트랙마다 따로 기억). 켜 둔 레벨만 보이고, 이야기 트랙은 뒤에 '뉴스' 칩 */
export function LevelChips({ track, value, onChange, label = '내 레벨', all = false }: { track: Track; value?: Level; onChange?: (l: Level) => void; label?: string; all?: boolean }) {
  const st = useSettings();
  const mine = useMyLevel(track);
  const news = !onChange && !all && isNewsView(st, track);
  const cur = value ?? mine;
  const levels = all ? LEVELS : enabledLevelsOf(st, track);
  const showNews = !onChange && !all && track === 'general' && st.newsEnabled;
  const chip = { minHeight: 32, flexDirection: 'column', gap: 0, lineHeight: 1.05, padding: '1px 9px', fontSize: 13 } as const;
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
      {levels.map((l) => (
        <button key={l} type="button" className={s.chip} aria-pressed={!news && cur === l} data-testid={`level-${l}`} title={LEVEL_DESC[track][l]}
          onClick={() => (onChange ? onChange(l) : setMyLevel(track, l))} style={chip}>
          <span>L{l}</span>
          <span style={{ fontSize: 9.5, fontWeight: 500, opacity: 0.85 }}>{LEVEL_DESC[track][l]}</span>
        </button>
      ))}
      {showNews && (
        <button type="button" className={s.chip} aria-pressed={news} data-testid="level-news" onClick={() => setSetting('generalView', 'news')} style={chip}>
          <span>뉴스</span>
          <span style={{ fontSize: 9.5, fontWeight: 500, opacity: 0.85 }}>VOA</span>
        </button>
      )}
    </div>
  );
}
