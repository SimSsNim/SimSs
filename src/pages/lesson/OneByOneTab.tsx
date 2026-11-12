import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import s from '../../styles/ui.module.css';
import r from '../../styles/reading.module.css';
import type { TabProps } from './LessonPage';
import { flatSentences, structureOf, grammarOf } from '../../lib/lessonUtils';
import { useSettings, setSetting } from '../../lib/settings';
import { useSwipe, useKeys } from '../../hooks';
import { db } from '../../lib/db';
import { getProgress, updateProgress, autoCheck } from '../../lib/progress';
import { toggleSentenceMark } from '../../lib/marks';
import { playSentence, hasSentenceAudio, usePlayer } from '../../store/player';
import { cancelSpeech, useVoices } from '../../lib/tts';
import { countWords } from '../../lib/validateLesson';

export function OneByOneTab({ lesson, lessonKey }: TabProps) {
  const sents = flatSentences(lesson);
  const n = sents.length;
  const st = useSettings();
  const voices = useVoices();
  usePlayer();
  const [idx, setIdx] = useState<number | null>(null);
  const [show, setShow] = useState(false);
  const [auto, setAuto] = useState(false);
  const [repeating, setRepeating] = useState(false);
  const repeatRef = useRef(false);
  const marks = useLiveQuery(() => db.sentenceMarks.where('lessonKey').equals(lessonKey).toArray(), [lessonKey]);

  useEffect(() => {
    void getProgress(lessonKey).then((p) => setIdx(Math.min(p.lastSentenceIndex ?? 0, n - 1)));
  }, [lessonKey, n]);

  const i = idx ?? 0;
  const go = (to: number) => {
    const next = Math.max(0, Math.min(n, to));
    setIdx(next);
    setShow(false);
    stopRepeat();
    if (next < n) void updateProgress(lessonKey, { lastSentenceIndex: next });
    if (next === n) {
      setAuto(false);
      void autoCheck(lessonKey, 'read');
    }
  };
  const stopRepeat = () => {
    repeatRef.current = false;
    setRepeating(false);
    cancelSpeech();
  };
  useEffect(() => () => { repeatRef.current = false; }, []);

  // 자동 넘김
  const sen = sents[i];
  useEffect(() => {
    if (!auto || idx === null || i >= n || !sen) return;
    let cancelled = false;
    let timer: number | undefined;
    if (st.autoAdvanceMode === 'audioEnd' && hasSentenceAudio(sen.id)) {
      void playSentence(sen).then(() => { if (!cancelled) timer = window.setTimeout(() => go(i + 1), 400); });
    } else {
      const sec = st.autoAdvanceMode === 'fixed' ? st.autoFixedSec : Math.max(1.5, countWords(sen.en) * st.autoPerWordSec);
      timer = window.setTimeout(() => go(i + 1), sec * 1000);
    }
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, i, idx, st.autoAdvanceMode, st.autoFixedSec, st.autoPerWordSec]);

  useKeys({ ArrowLeft: () => go(i - 1), ArrowRight: () => go(i + 1), Space: () => setShow((v) => !v) }, [i, n]);
  const swipe = useSwipe({ left: () => go(i + 1), right: () => go(i - 1), tap: () => setShow((v) => !v) });

  const repeatSlow = async () => {
    if (repeatRef.current) return stopRepeat();
    repeatRef.current = true;
    setRepeating(true);
    while (repeatRef.current) {
      await playSentence(sen, { rate: 0.75 });
      await new Promise((res) => setTimeout(res, 600));
    }
  };

  if (idx === null) return null;
  const canListen = voices.supported || (sen && hasSentenceAudio(sen.id));

  if (i >= n) {
    return (
      <div className={`${s.card} ${r.oneCard}`} data-testid="one-end" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>끝까지 읽었어요 🎉</div>
        <div className={s.stack}>
          <button type="button" className={s.primary} onClick={() => go(0)}>다시 처음부터</button>
          <Link className={s.btn} to={`/${lesson.track}/lesson/${lesson.id}/vocab`}>단어 탭으로</Link>
        </div>
      </div>
    );
  }
  const mark = marks?.find((m) => m.sentenceId === sen.id);
  const hasStruct = !!structureOf(lesson, sen.id) || grammarOf(lesson, sen.id).length > 0;
  const showKo = show || st.alwaysShowTranslation;
  return (
    <div>
      <div className={s.between} style={{ marginBottom: 8 }}>
        <span className={s.badgeAccent} data-testid="one-progress" aria-live="polite">{i + 1} / {n}</span>
        <label className={s.check} style={{ minHeight: 36 }}>
          <input type="checkbox" checked={st.alwaysShowTranslation} onChange={(e) => setSetting('alwaysShowTranslation', e.target.checked)} />
          <span className={s.small}>번역 항상 보기</span>
        </label>
      </div>
      <div className={s.progressBar} aria-hidden="true"><span style={{ width: `${((i + 1) / n) * 100}%` }} /></div>
      <div key={i} className={`${s.card} ${r.oneCard} ${r.slideIn}`} {...swipe} data-testid="one-card" style={{ marginTop: 10 }}>
        <div className={`${r.oneEn} ${st.serif ? '' : s.sansReading}`} lang="en" data-testid="one-en">{sen.en}</div>
        {showKo ? (
          <div className={s.ko} lang="ko">{sen.ko}</div>
        ) : (
          <button type="button" className={r.reveal} onClick={(e) => { e.stopPropagation(); setShow(true); }} onPointerUp={(e) => e.stopPropagation()}>번역 보기 (탭)</button>
        )}
      </div>
      <div className={s.row} style={{ marginTop: 10, justifyContent: 'center' }}>
        {canListen && <button type="button" className={s.btn} onClick={() => void playSentence(sen)}>🔊 듣기</button>}
        {canListen && <button type="button" className={s.btn} aria-pressed={repeating} onClick={() => void repeatSlow()}>{repeating ? '■ 반복 정지' : '🐢 0.75× 반복'}</button>}
        <button type="button" className={s.btn} aria-pressed={!!mark?.bookmark} onClick={() => void toggleSentenceMark(lessonKey, sen.id, 'bookmark')}>
          {mark?.bookmark ? '🔖 북마크됨' : '🔖 북마크'}
        </button>
        {hasStruct && <Link className={s.btn} to={`/${lesson.track}/lesson/${lesson.id}/structure?s=${sen.id}`}>🧩 구조·문법</Link>}
      </div>
      <details className={s.card} style={{ marginTop: 12 }}>
        <summary style={{ minHeight: 36, cursor: 'pointer', fontWeight: 600 }}>자동 넘김 {auto ? '(켜짐)' : ''}</summary>
        <div className={s.stack} style={{ marginTop: 8 }}>
          <div className={s.seg}>
            <button type="button" className={s.segBtn} aria-pressed={st.autoAdvanceMode === 'perWord'} onClick={() => setSetting('autoAdvanceMode', 'perWord')}>단어 수 비례</button>
            <button type="button" className={s.segBtn} aria-pressed={st.autoAdvanceMode === 'fixed'} onClick={() => setSetting('autoAdvanceMode', 'fixed')}>고정 초</button>
            {lesson.audio && <button type="button" className={s.segBtn} aria-pressed={st.autoAdvanceMode === 'audioEnd'} onClick={() => setSetting('autoAdvanceMode', 'audioEnd')}>재생 끝나면</button>}
          </div>
          {st.autoAdvanceMode === 'perWord' && (
            <label className={s.label}>단어당 {st.autoPerWordSec.toFixed(1)}초
              <input className={s.range} type="range" min={0.4} max={1.5} step={0.1} value={st.autoPerWordSec} onChange={(e) => setSetting('autoPerWordSec', Number(e.target.value))} />
            </label>
          )}
          {st.autoAdvanceMode === 'fixed' && (
            <label className={s.label}>{st.autoFixedSec}초마다
              <input className={s.range} type="range" min={1} max={20} step={1} value={st.autoFixedSec} onChange={(e) => setSetting('autoFixedSec', Number(e.target.value))} />
            </label>
          )}
          {st.autoAdvanceMode === 'audioEnd' && !hasSentenceAudio(sen.id) && <p className={s.small + ' ' + s.muted}>문장 구간 정보가 없어 단어 수 비례로 넘어가요. 듣기 탭의 "구간 맞추기"로 만들 수 있어요.</p>}
        </div>
      </details>
      <div className={s.bottomBar}>
        <button type="button" className={s.btn + ' ' + s.big} onClick={() => go(i - 1)} disabled={i === 0} aria-label="이전 문장">‹ 이전</button>
        <button type="button" className={s.btn + ' ' + s.big} aria-pressed={auto} onClick={() => setAuto(!auto)} aria-label={auto ? '자동 넘김 정지' : '자동 넘김 시작'}>{auto ? '⏸' : '▶ 자동'}</button>
        <button type="button" className={s.primary + ' ' + s.big + ' ' + s.grow} onClick={() => go(i + 1)} data-testid="one-next">다음 ›</button>
      </div>
    </div>
  );
}
