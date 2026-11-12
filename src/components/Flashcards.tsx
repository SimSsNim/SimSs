import { useEffect, useMemo, useRef, useState } from 'react';
import s from '../styles/ui.module.css';
import w from '../styles/words.module.css';
import { answerWord, type WordItem } from '../lib/words';
import type { Answer } from '../lib/leitner';
import { useSettings, setSetting } from '../lib/settings';
import { useSwipe, useKeys } from '../hooks';
import { speak, cancelSpeech, useVoices } from '../lib/tts';
import { getSettings } from '../lib/settings';
import { shuffle } from '../lib/text';

export type FlashMode = 'term' | 'meaning' | 'both' | 'cloze';
const MODES: { id: FlashMode; label: string }[] = [
  { id: 'term', label: '영단어만' },
  { id: 'meaning', label: '뜻만' },
  { id: 'both', label: '같이 보기' },
  { id: 'cloze', label: '문장 빈칸' },
];

function clozeOf(it: WordItem) {
  const sent = it.sentence ?? it.example?.en;
  const match = it.sentence ? it.matchText : it.term;
  if (!sent || !match || !sent.includes(match)) return null;
  const i = sent.indexOf(match);
  return { before: sent.slice(0, i), after: sent.slice(i + match.length), answer: match };
}

const say = (text: string) => speak(text, { rate: getSettings().ttsRate, accent: getSettings().ttsAccent, voiceURI: getSettings().ttsVoiceURI });

export function Flashcards({ items, onFinish, title, deckKey = '' }: { items: WordItem[]; onFinish?: (answered: number) => void; title?: string; deckKey?: string }) {
  const st = useSettings();
  const voices = useVoices();
  const [mode, setMode] = useState<FlashMode>('term');
  const [order, setOrder] = useState<'seq' | 'random'>('seq');
  const [seed, setSeed] = useState(0);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [auto, setAuto] = useState(false);
  const [paused, setPaused] = useState(false);
  const [twoPhase, setTwoPhase] = useState(true);
  const [speakTerm, setSpeakTerm] = useState(false);
  const [speakEx, setSpeakEx] = useState(false);
  const [loop, setLoop] = useState(false);
  const [answered, setAnswered] = useState(0);
  const finishedRef = useRef(false);

  // 카드 목록은 시작할 때 고정(분류해서 필터에서 빠져도 덱이 바뀌지 않게). deckKey 가 바뀌면 새로 만든다.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const keySig = `${deckKey}#${items.length > 0 ? 1 : 0}`;
  const deck = useMemo(() => (order === 'random' ? shuffle(itemsRef.current) : itemsRef.current.slice()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keySig, order, seed]);
  const n = deck.length;
  const card = deck[Math.min(i, n - 1)];
  const done = i >= n;

  useEffect(() => {
    setI(0);
    setFlipped(false);
    finishedRef.current = false;
  }, [keySig, order, seed]);

  const next = () => {
    setFlipped(false);
    setI((x) => {
      if (x + 1 >= n && loop) return 0;
      return Math.min(n, x + 1);
    });
  };
  const prev = () => {
    setFlipped(false);
    setI((x) => Math.max(0, x - 1));
  };

  useEffect(() => {
    if (done && !finishedRef.current) {
      finishedRef.current = true;
      setAuto(false);
      onFinish?.(answered);
    }
  }, [done, answered, onFinish]);

  // 자동 넘김 타이머: 탭을 떠나면(언마운트) 정리된다
  useEffect(() => {
    if (!auto || paused || done) return;
    const front = st.flashFrontSec * 1000;
    const back = st.flashBackSec * 1000;
    let t: number;
    if (twoPhase && !flipped) t = window.setTimeout(() => setFlipped(true), front);
    else t = window.setTimeout(next, twoPhase ? back : front);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, paused, done, i, flipped, twoPhase, st.flashFrontSec, st.flashBackSec, n, loop]);

  // 앱이 백그라운드로 가면 자동 일시정지
  useEffect(() => {
    const h = () => {
      if (document.visibilityState === 'hidden') setPaused(true);
    };
    document.addEventListener('visibilitychange', h);
    return () => {
      document.removeEventListener('visibilitychange', h);
      cancelSpeech();
    };
  }, []);

  // TTS
  useEffect(() => {
    if (!card || done || !voices.supported) return;
    if (!flipped && speakTerm && (mode === 'term' || mode === 'both')) void say(card.term);
    if (flipped && speakEx) void say(card.example?.en ?? card.sentence ?? card.term);
  }, [card, flipped, done, speakTerm, speakEx, mode, voices.supported]);

  const classify = async (a: Answer) => {
    if (!card) return;
    await answerWord(card.term, a, card.sources[0]?.lessonKey);
    setAnswered((x) => x + 1);
    next();
  };

  const tapCard = () => {
    if (auto) setPaused((p) => !p);
    else setFlipped((f) => !f);
  };
  useKeys({
    ArrowRight: () => next(), ArrowLeft: () => prev(),
    Space: () => (auto ? setPaused((p) => !p) : setFlipped((f) => !f)),
    '1': () => void classify('known'), '2': () => void classify('confused'), '3': () => void classify('unknown'),
  }, [i, n, auto, card]);
  const swipe = useSwipe({ right: () => void classify('known'), left: () => void classify('unknown'), up: () => void classify('confused'), tap: tapCard });

  if (n === 0) return <p className={s.empty}>카드가 없어요. 범위나 필터를 바꿔 보세요.</p>;

  const cz = card ? clozeOf(card) : null;
  const front = () => {
    if (!card) return null;
    if (mode === 'meaning') return <div className={w.flashMeaning}>{card.meaningKo}</div>;
    if (mode === 'cloze') {
      return cz ? (
        <div className={w.flashSent} lang="en">{cz.before}<span className={w.blank} aria-label="빈칸">{flipped ? <b>{cz.answer}</b> : ' '}</span>{cz.after}</div>
      ) : <div className={w.flashMeaning}>{card.meaningKo}</div>;
    }
    return <div className={w.flashBig} lang="en">{card.term}</div>;
  };
  const back = () => {
    if (!card) return null;
    return (
      <div className={s.stack} style={{ alignItems: 'center' }}>
        {mode !== 'term' && mode !== 'both' && <div className={w.flashBig} lang="en">{card.term}</div>}
        {mode !== 'meaning' && <div className={w.flashMeaning}>{card.meaningKo}</div>}
        {card.synonyms.length > 0 && <div className={s.small}>유사 단어: {card.synonyms.join(', ')}</div>}
        {card.example && <div className={s.small} lang="en" style={{ fontFamily: 'var(--serif)' }}>{card.example.en}</div>}
      </div>
    );
  };

  return (
    <div data-testid="flashcards">
      {title && <h2 className={s.h2}>{title}</h2>}
      <div className={s.chips} role="group" aria-label="표시 모드">
        {MODES.map((m) => <button key={m.id} type="button" className={s.chip} aria-pressed={mode === m.id} onClick={() => { setMode(m.id); setFlipped(false); }}>{m.label}</button>)}
      </div>
      <div className={s.between} style={{ margin: '4px 0 8px' }}>
        <span className={s.badgeAccent} data-testid="flash-index" aria-live="polite">{done ? n : i + 1} / {n}</span>
        <div className={s.seg}>
          <button type="button" className={s.segBtn} aria-pressed={!auto} onClick={() => setAuto(false)} data-testid="flash-manual">수동</button>
          <button type="button" className={s.segBtn} aria-pressed={auto} onClick={() => { setAuto(true); setPaused(false); }} data-testid="flash-auto">자동</button>
        </div>
      </div>

      {done ? (
        <div className={`${s.card} ${w.flash}`} data-testid="flash-done">
          <div className={w.flashMeaning}>다 봤어요! ({answered}개 분류)</div>
          <button type="button" className={s.primary} onClick={() => { setSeed((x) => x + 1); setAnswered(0); }}>다시 보기</button>
        </div>
      ) : (
        <div className={`${s.card} ${w.flash}`} {...swipe} role="button" tabIndex={0} data-testid="flash-card"
          aria-label={auto ? (paused ? '일시정지됨. 탭하면 계속' : '탭하면 일시정지') : '탭하면 뒤집기'}>
          {front()}
          {(flipped || mode === 'both') && mode !== 'cloze' ? back() : null}
          {mode === 'cloze' && flipped ? <div className={w.flashMeaning}>{card.meaningKo}</div> : null}
          {!flipped && mode !== 'both' && <span className={s.small + ' ' + s.muted}>{auto ? '' : '탭해서 확인'}</span>}
          {auto && paused && <span className={s.badge} data-testid="flash-paused">⏸ 일시정지</span>}
        </div>
      )}

      {!done && (
        <>
          <div className={w.classify} style={{ marginTop: 10 }}>
            <button type="button" className={s.btn} onClick={() => void classify('unknown')} data-testid="flash-unknown">← 몰라요</button>
            <button type="button" className={s.btn} onClick={() => void classify('confused')} data-testid="flash-confused">↑ 헷갈려요</button>
            <button type="button" className={s.btn} onClick={() => void classify('known')} data-testid="flash-known">알아요 →</button>
          </div>
          <div className={s.row} style={{ marginTop: 8 }}>
            <button type="button" className={s.btn} onClick={prev} disabled={i === 0} aria-label="이전 카드">‹</button>
            {auto && <button type="button" className={s.btn + ' ' + s.grow} onClick={() => setPaused((p) => !p)} data-testid="flash-pause">{paused ? '▶ 계속' : '⏸ 일시정지'}</button>}
            {!auto && <button type="button" className={s.btn + ' ' + s.grow} onClick={() => setFlipped((f) => !f)}>뒤집기</button>}
            <button type="button" className={s.btn} onClick={next} aria-label="다음 카드" data-testid="flash-next">›</button>
          </div>
        </>
      )}

      <details className={s.card} style={{ marginTop: 12 }} open={auto}>
        <summary style={{ minHeight: 36, cursor: 'pointer', fontWeight: 600 }}>자동 재생 설정</summary>
        <div className={s.stack} style={{ marginTop: 8 }}>
          <label className={s.label}>{twoPhase ? '앞면' : '간격'} {st.flashFrontSec.toFixed(1)}초
            <input className={s.range} type="range" min={1} max={10} step={0.5} value={st.flashFrontSec} onChange={(e) => setSetting('flashFrontSec', Number(e.target.value))} data-testid="flash-front-sec" />
          </label>
          <label className={s.check}><input type="checkbox" checked={twoPhase} onChange={(e) => setTwoPhase(e.target.checked)} />앞면 → 뒷면 공개 → 다음 (2단계)</label>
          {twoPhase && (
            <label className={s.label}>뒷면 공개 {st.flashBackSec.toFixed(1)}초
              <input className={s.range} type="range" min={1} max={10} step={0.5} value={st.flashBackSec} onChange={(e) => setSetting('flashBackSec', Number(e.target.value))} />
            </label>
          )}
          {voices.supported && <label className={s.check}><input type="checkbox" checked={speakTerm} onChange={(e) => setSpeakTerm(e.target.checked)} />영단어 읽기(TTS)</label>}
          {voices.supported && <label className={s.check}><input type="checkbox" checked={speakEx} onChange={(e) => setSpeakEx(e.target.checked)} />뜻 공개 때 예문 읽기</label>}
          <label className={s.check}><input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />반복 재생</label>
          <div className={s.seg}>
            <button type="button" className={s.segBtn} aria-pressed={order === 'seq'} onClick={() => setOrder('seq')}>순서대로</button>
            <button type="button" className={s.segBtn} aria-pressed={order === 'random'} onClick={() => { setOrder('random'); setSeed((x) => x + 1); }}>랜덤</button>
          </div>
          <p className={s.small + ' ' + s.muted}>스와이프: 오른쪽 = 알아요, 왼쪽 = 몰라요, 위 = 헷갈려요 · 키보드: ←/→ 넘기기, Space 뒤집기/일시정지, 1·2·3 분류</p>
        </div>
      </details>
    </div>
  );
}
