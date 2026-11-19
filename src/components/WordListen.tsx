import { useEffect, useRef, useState } from 'react';
import s from '../styles/ui.module.css';
import type { WordItem } from '../lib/words';
import { useSettings, setSetting, getSettings, type Settings } from '../lib/settings';
import { speak, cancelSpeech, useVoices } from '../lib/tts';
import { stopAll } from '../store/player';
import { ViewportLayer } from './ViewportLayer';

type Part = keyof Settings['wordListenParts'];
const PARTS: { id: Part; label: string }[] = [
  { id: 'term', label: '단어' },
  { id: 'meaning', label: '뜻' },
  { id: 'example', label: '예문' },
  { id: 'exampleKo', label: '예문 뜻' },
];
const GAPS = [0.3, 0.8, 1.5, 3];

/** 이 단어에서 읽을 말들(설정에서 고른 것만) */
function linesOf(it: WordItem, parts: Settings['wordListenParts']): { text: string; ko: boolean }[] {
  const out: { text: string; ko: boolean }[] = [];
  if (parts.term) out.push({ text: it.term, ko: false });
  if (parts.meaning && it.meaningKo) out.push({ text: it.meaningKo, ko: true });
  const ex = it.example?.en ?? it.sentence;
  if (parts.example && ex) out.push({ text: ex, ko: false });
  if (parts.exampleKo && it.example?.ko) out.push({ text: it.example.ko, ko: true });
  return out;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 지금 읽는 단어 줄을 목록에서 표시하고 보이게 */
function markRow(key: string | null) {
  document.querySelectorAll('[data-word-playing="1"]').forEach((el) => el.removeAttribute('data-word-playing'));
  if (!key) return;
  const el = document.querySelector(`[data-word-key="${CSS.escape(key)}"]`);
  if (!el) return;
  el.setAttribute('data-word-playing', '1');
  const r = el.getBoundingClientRect();
  if (r.top < 80 || r.bottom > window.innerHeight - 200) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/**
 * 단어 전체 듣기: 지금 보이는 단어(필터 적용)를 차례로 읽는다.
 * 재생 중 막대를 누르면 읽을 것(단어·뜻·예문·예문 뜻)·반복·간격을 고를 수 있다.
 */
export function WordListen({ items }: { items: WordItem[] }) {
  const st = useSettings();
  const voices = useVoices();
  const [on, setOn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);
  const [part, setPart] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const token = useRef(0);
  const list = useRef(items);
  list.current = items;

  const stop = () => {
    token.current++;
    cancelSpeech();
    setPlaying(false);
    setOn(false);
    setOpen(false);
    markRow(null);
  };
  useEffect(() => () => { token.current++; cancelSpeech(); markRow(null); }, []);

  /** from 번째 단어부터 읽기. iOS: 첫 speak 는 탭 안에서 바로 불려야 해서 await 전에 시작 */
  const run = async (from: number) => {
    const my = ++token.current;
    stopAll(); // 레슨 듣기와 겹치지 않게
    setOn(true);
    setPlaying(true);
    let i = from;
    for (;;) {
      const its = list.current;
      if (i >= its.length) {
        if (getSettings().wordListenLoop && its.length) i = 0;
        else break;
      }
      const it = its[i];
      setIdx(i);
      markRow(it.key);
      const lines = linesOf(it, getSettings().wordListenParts);
      for (let k = 0; k < lines.length; k++) {
        if (my !== token.current) return;
        setPart(k);
        const st2 = getSettings();
        const ok = await speak(lines[k].text, lines[k].ko ? { rate: 1, lang: 'ko-KR' } : { rate: st2.ttsRate, accent: st2.ttsAccent, voiceURI: st2.ttsVoiceURI });
        if (my !== token.current) return;
        if (!ok) { setPlaying(false); return; }
        if (k < lines.length - 1) await wait(250);
      }
      if (my !== token.current) return;
      await wait(getSettings().wordListenGap * 1000);
      if (my !== token.current) return;
      i++;
    }
    if (my === token.current) { setPlaying(false); setOn(false); markRow(null); }
  };
  const pause = () => { token.current++; cancelSpeech(); setPlaying(false); };
  const go = (d: number) => {
    const n = list.current.length;
    const i = Math.max(0, Math.min(n - 1, idx + d));
    setIdx(i);
    if (playing) void run(i);
    else markRow(list.current[i]?.key ?? null);
  };

  if (!voices.supported || items.length === 0) return null;
  const cur = items[Math.min(idx, items.length - 1)];
  const parts = st.wordListenParts;
  const partsLabel = PARTS.filter((p) => parts[p.id]).map((p) => p.label).join('·') || '고른 것 없음';
  const lines = cur ? linesOf(cur, parts) : [];

  const options = (
    <div className={s.stack} style={{ gap: 8, marginTop: 8 }} data-testid="word-listen-options">
      <div className={s.small} style={{ fontWeight: 700 }}>읽을 것</div>
      <div className={s.chips} role="group" aria-label="읽을 것" style={{ padding: 0 }}>
        {PARTS.map((p) => (
          <button key={p.id} type="button" className={s.chip} aria-pressed={parts[p.id]} data-testid={`wl-part-${p.id}`}
            onClick={() => setSetting('wordListenParts', { ...parts, [p.id]: !parts[p.id] })}>{parts[p.id] ? '✓ ' : ''}{p.label}</button>
        ))}
      </div>
      <div className={s.row} style={{ gap: 6, alignItems: 'center' }}>
        <span className={s.small} style={{ fontWeight: 700 }}>단어 사이</span>
        {GAPS.map((g) => (
          <button key={g} type="button" className={s.chip} aria-pressed={Math.abs(st.wordListenGap - g) < 0.01} onClick={() => setSetting('wordListenGap', g)}>{g}초</button>
        ))}
      </div>
      <label className={s.check}><input type="checkbox" checked={st.wordListenLoop} onChange={(e) => setSetting('wordListenLoop', e.target.checked)} data-testid="wl-loop" />끝나면 처음부터 다시</label>
      <p className={s.small + ' ' + s.muted} style={{ margin: 0 }}>뜻·예문 뜻은 기기의 한국어 음성으로 읽어요. 속도는 설정의 듣기 속도를 따라요.</p>
    </div>
  );

  if (!on) {
    return (
      <div style={{ margin: '8px 0' }}>
        <div className={s.row} style={{ flexWrap: 'nowrap', gap: 6 }}>
          <button type="button" className={s.primary} onClick={() => void run(0)} data-testid="word-play-all" style={{ flex: 1, justifyContent: 'center' }}>
            🔊 전체 듣기 <span style={{ fontWeight: 400, opacity: 0.85 }}>· {items.length}개 · {partsLabel}</span>
          </button>
          <button type="button" className={s.btn} aria-expanded={open} onClick={() => setOpen(!open)} data-testid="word-listen-settings" aria-label="듣기 설정">⚙</button>
        </div>
        {open && <div className={s.card} style={{ marginTop: 6, padding: 10 }}>{options}</div>}
      </div>
    );
  }

  return (
    <ViewportLayer zIndex={38}>
      <div role="region" aria-label="단어 전체 듣기" data-testid="word-listen-bar" data-pdf-skip="1"
        style={{ position: 'fixed', left: 8, right: 8, bottom: 'calc(var(--nav-h) + var(--player-h) + 8px + env(safe-area-inset-bottom))', zIndex: 38, maxWidth: 640, margin: '0 auto' }}>
        <div className={s.card} style={{ padding: '8px 10px', boxShadow: '0 6px 24px rgb(0 0 0 / 22%)' }}>
          <div className={s.row} style={{ flexWrap: 'nowrap', gap: 6, alignItems: 'center' }}>
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="읽을 것 고르기" data-testid="word-listen-info"
              style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 0, background: 'transparent', color: 'inherit', padding: 0, cursor: 'pointer' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', minWidth: 0 }}>
                <span className={s.small + ' ' + s.muted} style={{ flex: 'none' }} data-testid="word-listen-index">{idx + 1}/{items.length}</span>
                <b lang="en" style={{ fontFamily: 'var(--serif)', fontSize: 17, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} data-testid="word-listen-term">{cur?.term}</b>
              </div>
              <div className={s.small} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--ok)' }}>
                {playing && lines[part] ? `🔊 ${lines[part].text}` : cur?.meaningKo}
              </div>
              <div className={s.small + ' ' + s.muted}>{partsLabel} {open ? '▾' : '▴ 눌러서 고르기'}</div>
            </button>
            <button type="button" className={s.iconBtn} onClick={() => go(-1)} aria-label="이전 단어" data-testid="wl-prev">⏮</button>
            <button type="button" className={s.iconBtn} onClick={() => (playing ? pause() : void run(idx))} aria-label={playing ? '일시정지' : '계속 듣기'} data-testid="wl-toggle">{playing ? '⏸' : '▶'}</button>
            <button type="button" className={s.iconBtn} onClick={() => go(1)} aria-label="다음 단어" data-testid="wl-next">⏭</button>
            <button type="button" className={s.iconBtn} onClick={stop} aria-label="듣기 끝내기" data-testid="wl-stop">■</button>
          </div>
          {open && options}
        </div>
      </div>
    </ViewportLayer>
  );
}
