import { useEffect, useMemo, useRef, useState } from 'react';
import s from '../../../styles/ui.module.css';
import p from '../../../styles/practice.module.css';
import type { TabProps } from '../LessonPage';
import { flatSentences } from '../../../lib/lessonUtils';
import { autoCheck, logPractice } from '../../../lib/progress';
import { useSettings, setSetting } from '../../../lib/settings';
import { diffChars, scoreTyping, type TypingResult } from '../../../lib/text';
import { countWords } from '../../../lib/validateLesson';
import { addMyWord } from '../../../lib/words';
import { toast } from '../../../components/Toast';

export function useTimer(running: boolean) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!running) return;
    const start = Date.now() - sec * 1000;
    const id = setInterval(() => setSec(Math.floor((Date.now() - start) / 1000)), 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  return [sec, setSec] as const;
}
export const mmss = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;

function useWakeLock(on: boolean) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let dead = false;
    const req = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        if (dead) void lock.release();
        else {
          setActive(true);
          lock.addEventListener('release', () => setActive(false));
        }
      } catch {
        setActive(false);
      }
    };
    void req();
    const vis = () => document.visibilityState === 'visible' && !dead && void req();
    document.addEventListener('visibilitychange', vis);
    return () => {
      dead = true;
      document.removeEventListener('visibilitychange', vis);
      void lock?.release();
      setActive(false);
    };
  }, [on]);
  return active;
}

export function PaperMode({ lesson, lessonKey }: TabProps) {
  const sents = flatSentences(lesson);
  const [view, setView] = useState<'one' | 'all'>('one');
  const [i, setI] = useState(0);
  const [running, setRunning] = useState(false);
  const [sec, setSec] = useTimer(running);
  const [done, setDone] = useState(false);
  const wake = useWakeLock(running);
  const finish = async () => {
    setRunning(false);
    setDone(true);
    await logPractice({ lessonKey, track: lesson.track, kind: 'paper', score: null, durationSec: sec });
    await autoCheck(lessonKey, 'transcribe');
    toast(`필사 완료! ${mmss(sec)} 걸렸어요`);
  };
  return (
    <div className={s.stack}>
      <div className={s.between}>
        <div className={s.seg}>
          <button type="button" className={s.segBtn} aria-pressed={view === 'one'} onClick={() => setView('one')}>한 문장씩</button>
          <button type="button" className={s.segBtn} aria-pressed={view === 'all'} onClick={() => setView('all')}>전체</button>
        </div>
        <span className={p.timer} aria-live="off" aria-label={`경과 시간 ${mmss(sec)}`}>{mmss(sec)}</span>
      </div>
      <p className={s.small + ' ' + s.muted} style={{ margin: 0 }}>{'wakeLock' in navigator ? (wake ? '☀️ 화면 꺼짐 방지 켜짐' : '타이머를 켜면 화면이 꺼지지 않아요') : '이 브라우저는 화면 꺼짐 방지를 지원하지 않아요'}</p>
      <div className={s.card}>
        {view === 'one' ? (
          <>
            <div className={s.small + ' ' + s.muted}>{i + 1} / {sents.length}</div>
            <p className={p.paper} lang="en">{sents[i].en}</p>
            <div className={s.row}>
              <button type="button" className={s.btn + ' ' + s.grow} disabled={i === 0} onClick={() => setI(i - 1)}>‹ 이전</button>
              <button type="button" className={s.btn + ' ' + s.grow} disabled={i === sents.length - 1} onClick={() => setI(i + 1)}>다음 ›</button>
            </div>
          </>
        ) : (
          lesson.paragraphs.map((para) => <p key={para.id} className={p.paper} lang="en">{para.en}</p>)
        )}
      </div>
      <div className={s.bottomBar}>
        <button type="button" className={s.btn + ' ' + s.big} onClick={() => setRunning(!running)}>{running ? '⏸ 타이머' : '▶ 타이머'}</button>
        <button type="button" className={s.btn + ' ' + s.big} onClick={() => { setRunning(false); setSec(0); setDone(false); }} aria-label="타이머 초기화">↺</button>
        <button type="button" className={s.primary + ' ' + s.big + ' ' + s.grow} onClick={() => void finish()} data-testid="paper-done">{done ? '✓ 완료됨' : '필사 완료'}</button>
      </div>
    </div>
  );
}

export function TypingMode({ lesson, lessonKey }: TabProps) {
  const st = useSettings();
  const [scope, setScope] = useState<number>(-1); // -1 = 전체
  const [hide, setHide] = useState(false);
  const [typed, setTyped] = useState('');
  const [startAt, setStartAt] = useState<number | null>(null);
  const [result, setResult] = useState<(TypingResult & { wpm: number; sec: number }) | null>(null);
  const target = useMemo(() => (scope < 0 ? lesson.paragraphs.map((x) => x.en).join('\n') : lesson.paragraphs[scope].en), [lesson, scope]);
  const opts = { ignoreCase: st.typingIgnoreCase, ignorePunctuation: st.typingIgnorePunct };
  const diff = diffChars(target, typed, opts);
  const wrongNow = diff.filter((d) => d.state === 'bad').length;
  const ref = useRef<HTMLTextAreaElement>(null);

  const finish = async () => {
    const sec = startAt ? Math.max(1, Math.round((Date.now() - startAt) / 1000)) : 1;
    const r = scoreTyping(target, typed, opts);
    const wpm = Math.round((countWords(typed) / sec) * 60);
    setResult({ ...r, wpm, sec });
    await logPractice({ lessonKey, track: lesson.track, kind: 'typing', score: r.accuracy, durationSec: sec, detail: { wpm, wrong: r.wrongWords, scope } });
    await autoCheck(lessonKey, 'transcribe');
  };
  const reset = () => {
    setTyped('');
    setStartAt(null);
    setResult(null);
    ref.current?.focus();
  };

  return (
    <div className={s.stack}>
      <div className={s.row}>
        <select className={s.select} style={{ width: 'auto' }} value={scope} onChange={(e) => { setScope(Number(e.target.value)); reset(); }} aria-label="범위">
          <option value={-1}>전체 지문</option>
          {lesson.paragraphs.map((x, i) => <option key={x.id} value={i}>{i + 1}번째 단락</option>)}
        </select>
        <button type="button" className={s.chip} aria-pressed={hide} onClick={() => setHide(!hide)}>원문 가리기</button>
      </div>
      <details className={s.small}>
        <summary style={{ minHeight: 36, cursor: 'pointer' }}>채점 엄격도</summary>
        <label className={s.check}><input type="checkbox" checked={st.typingIgnoreCase} onChange={(e) => setSetting('typingIgnoreCase', e.target.checked)} />대소문자 무시</label>
        <label className={s.check}><input type="checkbox" checked={st.typingIgnorePunct} onChange={(e) => setSetting('typingIgnorePunct', e.target.checked)} />구두점 무시</label>
        <p className={s.muted}>따옴표 모양(“ ” ‘ ’ 와 " ')은 항상 같게 처리해요.</p>
      </details>
      <div className={s.card}>
        <div className={`${p.diff} ${hide && !result ? p.hiddenText : ''}`} lang="en" data-testid="typing-target" aria-label="원문과 비교">
          {diff.map((d, i) => <span key={i} className={p[d.state]}>{d.ch}</span>)}
        </div>
      </div>
      <textarea ref={ref} className={`${s.textarea} ${p.typing}`} value={typed} lang="en" aria-label="여기에 입력" data-testid="typing-input"
        autoCapitalize="off" autoCorrect="off" spellCheck={false}
        onChange={(e) => { if (!startAt) setStartAt(Date.now()); setTyped(e.target.value); setResult(null); }} placeholder="원문을 보며 입력하세요" />
      <div className={s.between + ' ' + s.small}>
        <span>{typed.length} / {target.length}자 · 틀린 글자 {wrongNow}</span>
      </div>
      {result && (
        <div className={s.card} role="status" data-testid="typing-result">
          <div className={s.row}>
            <b style={{ fontSize: 24, color: result.accuracy === 100 ? 'var(--ok)' : 'var(--text)' }} data-testid="typing-accuracy">{result.accuracy}%</b>
            <span>분당 {result.wpm}단어 · {mmss(result.sec)}</span>
          </div>
          {result.wrongWords.length > 0 && (
            <div className={s.stack} style={{ marginTop: 8 }}>
              <b className={s.small}>틀린 단어</b>
              <div className={s.row}>
                {result.wrongWords.map((w) => (
                  <button key={w} type="button" className={s.chip} onClick={async () => { await addMyWord({ term: w, meaningKo: '', lessonKey }); toast(`'${w}' 를 내 단어에 추가했어요`); }}>
                    {w} ＋
                  </button>
                ))}
              </div>
              <span className={s.small + ' ' + s.muted}>눌러서 "내 단어"로 추가</span>
            </div>
          )}
        </div>
      )}
      <div className={s.bottomBar}>
        <button type="button" className={s.btn + ' ' + s.big} onClick={reset}>↺ 다시</button>
        <button type="button" className={s.primary + ' ' + s.big + ' ' + s.grow} onClick={() => void finish()} disabled={!typed} data-testid="typing-finish">채점하기</button>
      </div>
    </div>
  );
}
