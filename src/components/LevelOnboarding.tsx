import { useState } from 'react';
import s from '../styles/ui.module.css';
import { useSettings, setSetting } from '../lib/settings';
import { LevelChips } from './LevelChips';
import { TRACKS, TRACK_LABEL, type Level, type Track } from '../lib/types';

/** 처음 실행 때 한 번: 트랙마다 내 레벨 고르기(나중에 설정에서 바꿀 수 있음) */
export function LevelOnboarding() {
  const st = useSettings();
  const [pick, setPick] = useState<Record<Track, Level>>({ general: st.levelByTrack.general ?? 1, toeic: st.levelByTrack.toeic ?? 1 });
  if (st.levelByTrack.general !== null && st.levelByTrack.toeic !== null) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="onb-title" data-testid="level-onboarding"
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg)', overflowY: 'auto' }}>
      <div className={s.page} style={{ paddingBottom: 32 }}>
        <h1 id="onb-title" className={s.title}>내 레벨 고르기</h1>
        <p className={s.muted}>트랙마다 따로 골라요. 매일 레벨 1~4 지문이 모두 오고, 언제든 다른 레벨도 볼 수 있어요. 나중에 기록/설정에서 바꿀 수 있어요.</p>
        {TRACKS.map((t) => (
          <section key={t} className={s.card} style={{ marginBottom: 12 }} data-testid={`onb-${t}`}>
            <h2 className={s.h2} style={{ marginTop: 0 }}>{TRACK_LABEL[t]}</h2>
            <LevelChips track={t} value={pick[t]} onChange={(l) => setPick({ ...pick, [t]: l })} label={`${TRACK_LABEL[t]} 레벨`} />
          </section>
        ))}
        <button type="button" className={s.primary + ' ' + s.big + ' ' + s.full} data-testid="onb-start"
          onClick={() => setSetting('levelByTrack', { general: pick.general, toeic: pick.toeic })}>
          시작하기
        </button>
      </div>
    </div>
  );
}
