import { useLocation } from 'react-router-dom';
import sh from '../styles/shell.module.css';
import s from '../styles/ui.module.css';
import { Icon } from './Icon';
import { usePlayer, toggle, skip, setRate } from '../store/player';
import { useVoices } from '../lib/tts';
import { useEffect } from 'react';

const RATES = [0.75, 0.85, 1, 1.15, 1.25];

/** 레슨 화면 하단에 항상 떠 있는 플레이어 */
export function MiniPlayer() {
  const p = usePlayer();
  const loc = useLocation();
  const voices = useVoices();
  const inLesson = /\/lesson\//.test(loc.pathname);
  const visible = inLesson && p.lessonKey !== null && (p.mode === 'audio' || (p.mode === 'tts' && voices.supported));
  useEffect(() => {
    document.documentElement.style.setProperty('--player-h', visible ? '59px' : '0px');
  }, [visible]);
  if (!visible) return null;
  const pct = p.mode === 'audio' ? (p.duration ? (p.currentTime / p.duration) * 100 : 0) : p.sentences.length ? ((p.ttsIndex + (p.playing ? 0.5 : 0)) / p.sentences.length) * 100 : 0;
  const nextRate = () => {
    const i = RATES.findIndex((r) => Math.abs(r - p.rate) < 0.01);
    setRate(RATES[(i + 1) % RATES.length] ?? 1);
  };
  return (
    <div className={sh.player} role="region" aria-label="미니 플레이어" data-testid="mini-player">
      <div className={sh.playerBar}><span style={{ width: `${pct}%` }} /></div>
      <div className={sh.playerInner}>
        <button type="button" className={s.iconBtn} onClick={() => skip(-5)} aria-label={p.mode === 'tts' ? '이전 문장' : '5초 뒤로'}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>{p.mode === 'tts' ? '⏮' : '−5'}</span>
        </button>
        <button type="button" className={s.iconBtn} onClick={toggle} aria-label={p.playing ? '일시정지' : '재생'} data-testid="mini-toggle">
          <Icon name={p.playing ? 'pause' : 'play'} />
        </button>
        <div className={sh.playerTitle}>
          <b>{p.title}</b>
          <span className={s.muted}>
            {p.mode === 'tts' ? `TTS · ${p.ttsIndex + 1}/${p.sentences.length}` : `${fmt(p.currentTime)} / ${p.duration ? fmt(p.duration) : '--:--'}`}
            {p.error ? ' · 음원 오류' : ''}
          </span>
        </div>
        <button type="button" className={sh.rateBtn} onClick={nextRate} aria-label={`재생 속도 ${p.rate}배, 바꾸기`}>
          {p.rate}×
        </button>
      </div>
    </div>
  );
}

export function fmt(t: number) {
  if (!Number.isFinite(t)) return '--:--';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
