import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import s from '../../styles/ui.module.css';
import r from '../../styles/reading.module.css';
import type { TabProps } from './LessonPage';
import { flatSentences } from '../../lib/lessonUtils';
import {
  usePlayer, toggle, skip, seek, setRate, setLoop, setAB, loadLesson, playTTS, stopTTS, setTTSIndex, play, pause, getPlayer,
} from '../../store/player';
import { fmt } from '../../components/MiniPlayer';
import { db } from '../../lib/db';
import { useSettings, setSetting, type Accent } from '../../lib/settings';
import { ACCENTS, useVoices } from '../../lib/tts';
import { saveAudio, deleteAudio, cachedAudioBlob, formatBytes } from '../../lib/audioCache';
import { toast } from '../../components/Toast';
import type { Lesson } from '../../lib/types';

export function ListenTab({ lesson, lessonKey }: TabProps) {
  return lesson.audio ? <AudioListen lesson={lesson} lessonKey={lessonKey} /> : <TTSListen lesson={lesson} lessonKey={lessonKey} />;
}

function SentenceFollow({ lesson, currentId, onPick }: { lesson: Lesson; currentId: string | null; onPick: (id: string, index: number) => void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    if (currentId) refs.current[currentId]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentId]);
  const sents = flatSentences(lesson);
  return (
    <ol className={s.list} data-testid="follow-list">
      {sents.map((x, i) => (
        <li key={x.id}>
          <button type="button" ref={(el) => { refs.current[x.id] = el; }} onClick={() => onPick(x.id, i)}
            className={`${s.card} ${currentId === x.id ? r.current : ''}`} data-current={currentId === x.id} data-sentence-id={x.id}
            style={{ width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--serif)', fontSize: 'calc(var(--read-size) - 2px)', lineHeight: 1.6 }}
            aria-current={currentId === x.id ? 'true' : undefined} lang="en">
            {x.en}
          </button>
        </li>
      ))}
    </ol>
  );
}

function RateControl() {
  const p = usePlayer();
  return (
    <label className={s.label}>속도 {p.rate.toFixed(2)}×
      <input className={s.range} type="range" min={0.5} max={1.5} step={0.05} value={p.rate} onChange={(e) => setRate(Number(e.target.value))} aria-label="재생 속도" />
    </label>
  );
}

function AudioListen({ lesson, lessonKey }: TabProps) {
  const p = usePlayer();
  const audio = lesson.audio!;
  const marks = useLiveQuery(() => db.audioMarks.get(lessonKey), [lessonKey]);
  const [marking, setMarking] = useState<null | { starts: Record<string, number>; next: number }>(null);
  const [tuning, setTuning] = useState<Record<string, number> | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'unsupported'>('idle');
  const [progress, setProgress] = useState(0);
  const sents = flatSentences(lesson);
  const active = p.lessonKey === lessonKey;

  useEffect(() => {
    void cachedAudioBlob(audio.mp3).then((b) => setSaved(b ? b.size : null)).catch(() => setSaved(null));
  }, [audio.mp3]);

  const quality = p.srcKind === 'low' ? 'low' : 'high';
  const startMarking = () => {
    setMarking({ starts: {}, next: 0 });
    seek(marks?.introSkipSec ?? 0);
    play();
  };
  const markNext = () => {
    if (!marking) return;
    const t = Math.round(getPlayer().currentTime * 10) / 10;
    const id = sents[marking.next].id;
    const starts = { ...marking.starts, [id]: t };
    if (marking.next + 1 >= sents.length) {
      pause();
      setMarking(null);
      setTuning(starts);
    } else setMarking({ starts, next: marking.next + 1 });
  };
  const saveMarks = async (starts: Record<string, number>) => {
    await db.audioMarks.put({ key: lessonKey, introSkipSec: marks?.introSkipSec ?? null, sentenceStarts: starts });
    setTuning(null);
    toast('문장 구간을 저장했어요');
  };
  const exportMarks = () => {
    const data = { lesson: lessonKey, mp3: audio.mp3, introSkipSec: marks?.introSkipSec ?? null, sentenceStarts: marks?.sentenceStarts ?? {} };
    download(`audio-marks-${lessonKey.replace('/', '-')}.json`, JSON.stringify(data, null, 2));
  };
  const doSave = async () => {
    setSaveState('saving');
    try {
      const size = await saveAudio(audio.mp3, (l, t) => setProgress(t ? l / t : 0));
      setSaved(size);
      setSaveState('idle');
      toast('음원을 기기에 저장했어요');
      void loadLesson(lesson, { quality: 'high' });
    } catch (e) {
      setSaveState('unsupported');
      toast(`저장할 수 없어요: ${(e as Error).message}`);
    }
  };

  return (
    <div className={s.stack}>
      <section className={s.card}>
        <div className={s.small + ' ' + s.muted}>
          낭독: {audio.reader ?? 'LibriVox'} {audio.durationSec ? `· ${fmt(audio.durationSec)}` : p.duration ? `· ${fmt(p.duration)}` : ''}
          {audio.librivoxUrl && <> · <a href={audio.librivoxUrl} target="_blank" rel="noreferrer">LibriVox 페이지</a></>}
        </div>
        {audio.mp3Low && (
          <div className={s.seg} style={{ marginTop: 8 }} role="group" aria-label="음질">
            <button type="button" className={s.segBtn} aria-pressed={quality === 'high'} onClick={() => void loadLesson(lesson, { quality: 'high' })}>고음질</button>
            <button type="button" className={s.segBtn} aria-pressed={quality === 'low'} onClick={() => void loadLesson(lesson, { quality: 'low' })}>저용량</button>
          </div>
        )}
        {p.error && active && <p role="alert" style={{ color: 'var(--danger)' }}>{p.error}</p>}
        <input className={s.range} type="range" min={0} max={p.duration || 1} step={0.1} value={active ? p.currentTime : 0}
          onChange={(e) => seek(Number(e.target.value))} aria-label="재생 위치" style={{ marginTop: 10 }} />
        <div className={s.between + ' ' + s.small}><span>{fmt(p.currentTime)}</span><span>{fmt(p.duration)}</span></div>
        <div className={s.row} style={{ justifyContent: 'center' }}>
          <button type="button" className={s.btn} onClick={() => skip(-10)} aria-label="10초 뒤로">-10</button>
          <button type="button" className={s.btn} onClick={() => skip(-5)} aria-label="5초 뒤로">-5</button>
          <button type="button" className={s.primary + ' ' + s.big} onClick={toggle} aria-label={p.playing ? '일시정지' : '재생'} data-testid="listen-toggle">{p.playing ? '⏸' : '▶'}</button>
          <button type="button" className={s.btn} onClick={() => skip(5)} aria-label="5초 앞으로">+5</button>
          <button type="button" className={s.btn} onClick={() => skip(10)} aria-label="10초 앞으로">+10</button>
        </div>
        <RateControl />
        <div className={s.row}>
          <button type="button" className={s.chip} aria-pressed={p.loop} onClick={() => setLoop(!p.loop)}>🔁 반복</button>
          <button type="button" className={s.chip} aria-pressed={p.a !== null} onClick={() => setAB(p.currentTime, null)}>A {p.a !== null ? fmt(p.a) : ''}</button>
          <button type="button" className={s.chip} aria-pressed={p.b !== null} disabled={p.a === null} onClick={() => p.a !== null && p.currentTime > p.a && setAB(p.a, p.currentTime)}>B {p.b !== null ? fmt(p.b) : ''}</button>
          {(p.a !== null || p.b !== null) && <button type="button" className={s.chip} onClick={() => setAB(null, null)}>A-B 해제</button>}
        </div>
        <div className={s.row} style={{ marginTop: 6 }}>
          <button type="button" className={s.btn} onClick={async () => {
            await db.audioMarks.put({ key: lessonKey, sentenceStarts: marks?.sentenceStarts ?? {}, introSkipSec: Math.round(getPlayer().currentTime * 10) / 10 });
            toast(`본문 시작 위치를 ${fmt(getPlayer().currentTime)}로 저장했어요`);
          }}>⏭ 지금을 본문 시작으로</button>
          {marks?.introSkipSec ? <span className={s.small + ' ' + s.muted}>본문 시작 {fmt(marks.introSkipSec)} (안내 멘트 건너뜀)</span> : null}
        </div>
      </section>

      <section className={s.card}>
        <b>문장 구간 맞추기</b>
        {marking ? (
          <div className={s.stack} style={{ marginTop: 8 }}>
            <p style={{ margin: 0 }}>문장이 시작될 때 누르세요 ({marking.next + 1}/{sents.length})</p>
            <p className={s.reading} lang="en" style={{ margin: 0 }}>{sents[marking.next].en}</p>
            <button type="button" className={s.primary + ' ' + s.big} onClick={markNext}>다음 문장 시작 ⏎</button>
            <button type="button" className={s.ghost} onClick={() => { setMarking(null); pause(); }}>그만하기</button>
          </div>
        ) : tuning ? (
          <div className={s.stack} style={{ marginTop: 8 }}>
            <p className={s.small} style={{ margin: 0 }}>±0.1초로 미세 조정하고, ▶로 확인하세요.</p>
            {sents.map((x, i) => (
              <div key={x.id} className={s.row} style={{ flexWrap: 'nowrap' }}>
                <span className={s.grow + ' ' + s.small} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i + 1}. {x.en}</span>
                <button type="button" className={s.iconBtn} aria-label={`${i + 1}번 0.1초 앞당기기`} onClick={() => setTuning({ ...tuning, [x.id]: Math.max(0, Math.round(((tuning[x.id] ?? 0) - 0.1) * 10) / 10) })}>−</button>
                <span style={{ minWidth: 48, textAlign: 'center' }}>{(tuning[x.id] ?? 0).toFixed(1)}</span>
                <button type="button" className={s.iconBtn} aria-label={`${i + 1}번 0.1초 늦추기`} onClick={() => setTuning({ ...tuning, [x.id]: Math.round(((tuning[x.id] ?? 0) + 0.1) * 10) / 10 })}>＋</button>
                <button type="button" className={s.iconBtn} aria-label={`${i + 1}번 들어 보기`} onClick={() => { seek(tuning[x.id] ?? 0); play(); }}>▶</button>
              </div>
            ))}
            <button type="button" className={s.primary} onClick={() => void saveMarks(tuning)}>저장</button>
          </div>
        ) : (
          <div className={s.row} style={{ marginTop: 8 }}>
            <button type="button" className={s.btn} onClick={startMarking}>구간 맞추기 시작</button>
            {marks && Object.keys(marks.sentenceStarts).length > 0 && (
              <>
                <button type="button" className={s.btn} onClick={() => setTuning(marks.sentenceStarts)}>미세 조정</button>
                <button type="button" className={s.btn} onClick={exportMarks}>내보내기(JSON)</button>
              </>
            )}
            <span className={s.small + ' ' + s.muted}>{p.segments.length ? `${p.segments.length}개 문장 구간 있음` : '아직 구간 정보가 없어요'}</span>
          </div>
        )}
      </section>

      <section className={s.card}>
        <b>오프라인 저장</b>
        <div className={s.row} style={{ marginTop: 8 }}>
          {saved ? (
            <>
              <span className={s.badgeOk}>저장됨 {formatBytes(saved)}</span>
              <button type="button" className={s.danger} onClick={async () => { await deleteAudio(audio.mp3); setSaved(null); toast('저장한 음원을 지웠어요'); }}>삭제</button>
            </>
          ) : saveState === 'unsupported' ? (
            <span className={s.small + ' ' + s.muted}>이 음원은 온라인에서만 재생할 수 있어요.</span>
          ) : (
            <button type="button" className={s.btn} disabled={saveState === 'saving'} onClick={() => void doSave()}>
              {saveState === 'saving' ? `저장 중… ${Math.round(progress * 100)}%` : '⬇ 이 음원 저장'}
            </button>
          )}
        </div>
        <p className={s.small + ' ' + s.muted} style={{ marginBottom: 0 }}>iPhone에서는 화면이 꺼지면 재생이 멈출 수 있어요.</p>
      </section>

      <h2 className={s.h2}>문장 따라가기</h2>
      {!p.segments.length && <p className={s.small + ' ' + s.muted}>구간 정보가 생기면 지금 읽는 문장이 강조돼요.</p>}
      <SentenceFollow lesson={lesson} currentId={active ? p.currentSentenceId : null} onPick={(id) => {
        const seg = p.segments.find((x) => x.id === id);
        if (seg) { seek(seg.start); play(); }
      }} />
    </div>
  );
}

function TTSListen({ lesson, lessonKey }: TabProps) {
  const p = usePlayer();
  const st = useSettings();
  const voices = useVoices();
  const [scope, setScope] = useState<'all' | 'paragraph' | 'sentence'>('all');
  const [repeat, setRepeat] = useState(false);
  const sents = flatSentences(lesson);
  const active = p.lessonKey === lessonKey;
  useEffect(() => () => stopTTS(), []);

  if (!voices.supported) {
    return <div className={s.card}><p>이 기기에서 영어 음성(TTS)을 찾지 못했어요. 기기 설정에서 영어 음성을 설치하면 들을 수 있어요.</p></div>;
  }

  const range = (i: number): [number, number] => {
    if (scope === 'sentence') return [i, i];
    if (scope === 'paragraph') {
      let start = 0;
      for (const para of lesson.paragraphs) {
        const end = start + para.sentences.length - 1;
        if (i >= start && i <= end) return [start, end];
        start = end + 1;
      }
    }
    return [i, sents.length - 1];
  };
  const startAt = (i: number) => {
    const [from, to] = range(i);
    void playTTS(i < from ? from : i, { to, repeat });
  };

  return (
    <div className={s.stack}>
      <section className={s.card} data-testid="tts-mode">
        <div className={s.row}><span className={s.badgeAccent}>TTS 모드</span><span className={s.small + ' ' + s.muted}>원음이 없는 지문은 기기 음성으로 읽어요.</span></div>
        <div className={s.seg} style={{ marginTop: 8 }} role="group" aria-label="읽기 단위">
          {([['all', '전체'], ['paragraph', '단락'], ['sentence', '문장']] as const).map(([id, label]) => (
            <button key={id} type="button" className={s.segBtn} aria-pressed={scope === id} onClick={() => setScope(id)}>{label}</button>
          ))}
        </div>
        <div className={s.row} style={{ justifyContent: 'center', marginTop: 8 }}>
          <button type="button" className={s.btn} onClick={() => skip(-1)} aria-label="이전 문장">‹ 이전</button>
          <button type="button" className={s.primary + ' ' + s.big} data-testid="tts-toggle" aria-label={p.playing ? '정지' : '읽기'}
            onClick={() => (p.playing ? stopTTS() : startAt(active ? p.ttsIndex : 0))}>{p.playing ? '⏹' : '▶'}</button>
          <button type="button" className={s.btn} onClick={() => skip(1)} aria-label="다음 문장">다음 ›</button>
        </div>
        <RateControl />
        <label className={s.check}><input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />반복</label>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className={s.small} style={{ fontWeight: 700 }}>억양</legend>
          <div className={s.row}>
            {ACCENTS.map((a) => {
              const has = !!voices.byAccent[a.id]?.length;
              return (
                <button key={a.id} type="button" className={s.chip} aria-pressed={st.ttsAccent === a.id} disabled={!has} data-testid={`accent-${a.id}`}
                  title={has ? undefined : '이 기기에 없는 억양'} onClick={() => setSetting('ttsAccent', a.id as Accent)}>
                  {a.label}{has ? '' : ' (없음)'}
                </button>
              );
            })}
          </div>
          <label className={s.check}><input type="checkbox" checked={st.ttsRotateAccent} onChange={(e) => setSetting('ttsRotateAccent', e.target.checked)} />문장마다 억양 바꾸기</label>
        </fieldset>
        {active && p.playing && p.ttsAccent && <p className={s.small + ' ' + s.muted} aria-live="polite">지금 억양: {ACCENTS.find((a) => a.id === p.ttsAccent)?.label}</p>}
      </section>
      <h2 className={s.h2}>문장 따라가기</h2>
      <SentenceFollow lesson={lesson} currentId={active ? p.currentSentenceId : null} onPick={(_id, i) => { setTTSIndex(i); startAt(i); }} />
    </div>
  );
}

export function download(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
