import s from '../styles/ui.module.css';
import { LEVELS, LEVEL_DESC, CHAPTERS, CHAPTER_LABEL, CHAPTER_COUNT, type Chapter, type Level, type Track } from '../lib/types';
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

/** 토익 Part 세그먼트 */
export function ChapterSeg({ value, onChange }: { value?: Chapter; onChange?: (c: Chapter) => void }) {
  const st = useSettings();
  const cur = value ?? st.toeicChapter;
  return (
    <div className={s.seg} role="group" aria-label="토익 Part">
      {CHAPTERS.map((c) => (
        <button key={c} type="button" className={s.segBtn} aria-pressed={cur === c} data-testid={`chapter-${c}`}
          onClick={() => (onChange ? onChange(c) : setSetting('toeicChapter', c))} style={{ fontSize: 13, padding: '0 8px' }}>
          {CHAPTER_LABEL[c]} · {CHAPTER_COUNT[c]}문제
        </button>
      ))}
    </div>
  );
}
