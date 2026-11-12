import { useLocation } from 'react-router-dom';
import sh from '../styles/shell.module.css';
import s from '../styles/ui.module.css';
import { Icon } from './Icon';
import { usePlayer, toggle, skip, setRate, setRepeat, stepSentence, canRepeatOne } from '../store/player';
import { useVoices } from '../lib/tts';
import { useEffect, useState } from 'react';

const RATES = [0.75, 0.85, 1, 1.15, 1.25];

/** 레슨 화면 하단에 항상 떠 있는 플레이어 */
export function MiniPlayer() {
  const p = usePlayer();
  const loc = useLocation();
  const voices = useVoices();
  const [open, setOpen] = useState(false);
  const inLesson = /\/lesson\//.test(loc.pathname);
  const visible = inLesson && p.lessonKey !== null && (p.mode === 'audio' || (p.mode === 'tts' && voices.supported));
  useEffect(() => {
    document.documentElement.style.setProperty('--player-h', visible ? '59px' : '0px');
    if (!visible) setOpen(false);
  }, [visible]);
  if (!visible) return null;
  const pct = p.mode === 'audio' ? (p.duration ? (p.currentTime / p.duration) * 100 : 0) : p.sentences.length ? ((p.ttsIndex + (p.playing ? 0.5 : 0)) / p.sentences.length) * 100 : 0;
  const nextRate = () => {
    const i = RATES.findIndex((r) => Math.abs(r - p.rate) < 0.01);
    setRate(RATES[(i + 1) % RATES.length] ?? 1);
  };
  return (
    <>
    {open && <PlayerDrawer onClose={() => setOpen(false)} />}
    <div className={sh.player} role="region" aria-label="미니 플레이어" data-testid="mini-player">
      <div className={sh.playerBar}><span style={{ width: `${pct}%` }} /></div>
      <div className={sh.playerInner}>
        <button type="button" className={s.iconBtn} onClick={() => skip(-5)} title={p.mode === 'tts' ? '이전 문장' : '5초 뒤로'}>
          <span style={{ fontWeight: 800, fontSize: 14 }} aria-hidden="true">{p.mode === 'tts' ? '⏮' : '−5'}</span>
          <span className="sr-only">{p.mode === 'tts' ? '이전 문장' : '5초 뒤로'}</span>
        </button>
        <button type="button" className={s.iconBtn} onClick={toggle} aria-label={p.playing ? '일시정지' : '재생'} data-testid="mini-toggle">
          <Icon name={p.playing ? 'pause' : 'play'} />
        </button>
        <button type="button" className={sh.playerTitle} onClick={() => setOpen(!open)} aria-expanded={open} aria-label="재생 메뉴 열기" data-testid="player-open"
          style={{ border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer', color: 'inherit', padding: 0, display: 'block' }}>
          <b>{p.repeat === 'one' ? '🔂 ' : p.repeat === 'all' ? '🔁 ' : ''}{p.title} <span aria-hidden="true" style={{ fontSize: 11 }}>{open ? '▾' : '▴'}</span></b>
          <span className={s.muted}>
            {p.mode === 'tts' ? `TTS · ${p.ttsIndex + 1}/${p.sentences.length}` : `${fmt(p.currentTime)} / ${p.duration ? fmt(p.duration) : '--:--'}`}
            {p.error ? ' · 음원 오류' : ''}
          </span>
        </button>
        <button type="button" className={sh.rateBtn} onClick={nextRate} title="재생 속도 바꾸기">
          {p.rate}×<span className="sr-only"> 재생 속도 바꾸기</span>
        </button>
      </div>
    </div>
    </>
  );
}

/** 재생 메뉴: 플레이어 위로 살짝 올라오는 서랍 */
function PlayerDrawer({ onClose }: { onClose: () => void }) {
  const p = usePlayer();
  const one = canRepeatOne();
  const audio = p.mode === 'audio';
  const cur = p.sentences.find((x) => x.id === p.currentSentenceId);
  return (
    <>
      <div onClick={onClose} aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 37 }} />
      <div role="dialog" aria-label="재생 메뉴" data-testid="player-drawer" className={sh.drawer}>
        <button type="button" onClick={onClose} aria-label="재생 메뉴 닫기" className={sh.drawerHandle}><span /></button>
        {cur && <p lang="en" style={{ margin: '0 0 8px', fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.4, maxHeight: '2.8em', overflow: 'hidden' }}>{cur.en}</p>}
        <div className={s.row} style={{ flexWrap: 'nowrap', gap: 6, marginBottom: 8 }}>
          <span className={s.small} style={{ fontWeight: 700, flex: 'none', width: 34 }}>반복</span>
          <div className={s.seg} role="group" aria-label="반복" style={{ display: 'flex', flex: 1 }}>
            {([['off', '끔'], ['all', '🔁 전체'], ['one', '🔂 한 문장']] as const).map(([v, l]) => (
              <button key={v} type="button" className={s.segBtn} style={{ flex: 1 }} aria-pressed={p.repeat === v} disabled={v === 'one' && !one}
                onClick={() => setRepeat(v)} data-testid={`repeat-${v}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className={s.row} style={{ flexWrap: 'nowrap', gap: 6, marginBottom: 8 }}>
          <span className={s.small} style={{ fontWeight: 700, flex: 'none', width: 34 }}>이동</span>
          <div style={{ display: 'grid', gridTemplateColumns: audio ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)', gap: 6, flex: 1 }}>
            <button type="button" className={s.chip} style={{ justifyContent: 'center' }} onClick={() => stepSentence(-1)} data-testid="step-prev">⏮ 이전 문장</button>
            {audio && <button type="button" className={s.chip} style={{ justifyContent: 'center' }} onClick={() => skip(-5)}>−5초</button>}
            {audio && <button type="button" className={s.chip} style={{ justifyContent: 'center' }} onClick={() => skip(5)}>+5초</button>}
            <button type="button" className={s.chip} style={{ justifyContent: 'center' }} onClick={() => stepSentence(1)} data-testid="step-next">다음 문장 ⏭</button>
          </div>
        </div>
        <div className={s.row} style={{ flexWrap: 'nowrap', gap: 6 }}>
          <span className={s.small} style={{ fontWeight: 700, flex: 'none', width: 34 }}>속도</span>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${RATES.length}, 1fr)`, gap: 6, flex: 1 }}>
            {RATES.map((r) => (
              <button key={r} type="button" className={s.chip} style={{ justifyContent: 'center', padding: 0 }} aria-pressed={Math.abs(p.rate - r) < 0.01} onClick={() => setRate(r)}>{r}×</button>
            ))}
          </div>
        </div>
        {!one && <p className={s.small + ' ' + s.muted} style={{ margin: '6px 0 0' }}>이 음원은 문장 구간 정보가 없어 한 문장 반복·문장 이동 대신 5초씩 움직여요.</p>}
      </div>
    </>
  );
}

export function fmt(t: number) {
  if (!Number.isFinite(t)) return '--:--';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
