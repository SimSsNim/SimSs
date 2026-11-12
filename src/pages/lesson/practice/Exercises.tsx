import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import s from '../../../styles/ui.module.css';
import p from '../../../styles/practice.module.css';
import type { TabProps } from '../LessonPage';
import { flatSentences } from '../../../lib/lessonUtils';
import { autoCheck, logPractice } from '../../../lib/progress';
import { useSettings } from '../../../lib/settings';
import { answerEq, diffChars, scoreTyping, shuffle } from '../../../lib/text';
import { playSentence, usePlayer, hasSentenceAudio } from '../../../store/player';
import { useVoices } from '../../../lib/tts';
import { ChunkLine } from '../StructureTab';
import { db } from '../../../lib/db';
import { toast } from '../../../components/Toast';

const done = (lessonKey: string) => autoCheck(lessonKey, 'review');

function Stepper({ i, n, set }: { i: number; n: number; set: (i: number) => void }) {
  return (
    <div className={s.row}>
      <button type="button" className={s.btn} disabled={i === 0} onClick={() => set(i - 1)} aria-label="이전">‹</button>
      <span className={s.badgeAccent}>{i + 1} / {n}</span>
      <button type="button" className={s.btn} disabled={i >= n - 1} onClick={() => set(i + 1)} aria-label="다음">›</button>
    </div>
  );
}

export function DictationMode({ lesson, lessonKey }: TabProps) {
  const sents = flatSentences(lesson);
  const opts = useSettings();
  const voices = useVoices();
  usePlayer();
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [plays, setPlays] = useState(0);
  const [checked, setChecked] = useState(false);
  const [t0, setT0] = useState(Date.now());
  const sen = sents[i];
  const co = { ignoreCase: opts.typingIgnoreCase, ignorePunctuation: opts.typingIgnorePunct };
  const res = scoreTyping(sen.en, typed, co);
  const canPlay = voices.supported || hasSentenceAudio(sen.id);
  const go = (n: number) => { setI(n); setTyped(''); setPlays(0); setChecked(false); setT0(Date.now()); };
  const check = async () => {
    setChecked(true);
    await logPractice({ lessonKey, track: lesson.track, kind: 'dictation', score: res.accuracy, durationSec: Math.round((Date.now() - t0) / 1000), detail: { sentenceId: sen.id, plays } });
    await done(lessonKey);
  };
  if (!canPlay) return <p className={s.empty}>들을 수 있는 소리가 없어요(원음 구간·TTS 모두 없음).</p>;
  return (
    <div className={s.stack}>
      <div className={s.between}><Stepper i={i} n={sents.length} set={go} /><span className={s.small + ' ' + s.muted}>들은 횟수 {plays}</span></div>
      <div className={s.row}>
        <button type="button" className={s.primary + ' ' + s.big + ' ' + s.grow} onClick={() => { setPlays(plays + 1); void playSentence(sen); }}>🔊 듣기{hasSentenceAudio(sen.id) ? '(원음)' : '(TTS)'}</button>
        <button type="button" className={s.btn + ' ' + s.big} onClick={() => { setPlays(plays + 1); void playSentence(sen, { rate: 0.75 }); }}>🐢 0.75×</button>
      </div>
      <textarea className={s.textarea} value={typed} onChange={(e) => { setTyped(e.target.value); setChecked(false); }} lang="en" aria-label="들은 문장 입력"
        autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="들은 문장을 입력하세요" />
      <button type="button" className={s.primary} onClick={() => void check()} disabled={!typed.trim()}>채점</button>
      {checked && (
        <div className={s.card} role="status">
          <b style={{ fontSize: 20 }}>{res.accuracy}%</b>
          <div className={p.diff} lang="en" style={{ marginTop: 6 }}>
            {diffChars(sen.en, typed, co).map((d, k) => <span key={k} className={p[d.state]}>{d.ch}</span>)}
          </div>
          <p className={s.small}>정답: <span lang="en">{sen.en}</span></p>
          <p className={s.ko}>{sen.ko}</p>
          {i < sents.length - 1 && <button type="button" className={s.btn} onClick={() => go(i + 1)}>다음 문장 ›</button>}
        </div>
      )}
    </div>
  );
}

interface BlankItem { id: string; sentenceId: string; answer: string; hint: string; kind: '단어' | '문법' }

export function BlankMode({ lesson, lessonKey }: TabProps) {
  const sents = new Map(flatSentences(lesson).map((x) => [x.id, x]));
  const items: BlankItem[] = useMemo(() => [
    ...lesson.vocab.map((v) => ({ id: `v:${v.id}`, sentenceId: v.sentenceId, answer: v.matchText, hint: v.meaningKo, kind: '단어' as const })),
    ...lesson.grammar.map((g) => ({ id: `g:${g.id}`, sentenceId: g.sentenceId, answer: g.highlight[0], hint: g.title, kind: '문법' as const })),
  ], [lesson]);
  const [type, setType] = useState<'choice' | 'input'>('choice');
  const [i, setI] = useState(0);
  const [val, setVal] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const it = items[i];
  const sen = sents.get(it.sentenceId)!;
  const idx = sen.en.indexOf(it.answer);
  const options = useMemo(() => {
    const others = shuffle([...new Set(items.filter((x) => x.answer !== it.answer).map((x) => x.answer))]).slice(0, 3);
    return shuffle([it.answer, ...others]);
  }, [items, it]);
  const answered = type === 'choice' ? picked !== null : picked !== null;
  const correct = answered && answerEq(type === 'choice' ? picked! : val, it.answer);
  const submit = (v: string) => {
    setPicked(v);
    const ok = answerEq(v, it.answer);
    const next = { right: score.right + (ok ? 1 : 0), total: score.total + 1 };
    setScore(next);
    if (i === items.length - 1) {
      void logPractice({ lessonKey, track: lesson.track, kind: 'blank', score: Math.round((next.right / next.total) * 100), durationSec: 0 });
      void done(lessonKey);
    }
  };
  const go = (n: number) => { setI(n); setVal(''); setPicked(null); };
  return (
    <div className={s.stack}>
      <div className={s.between}>
        <div className={s.seg}>
          <button type="button" className={s.segBtn} aria-pressed={type === 'choice'} onClick={() => { setType('choice'); go(i); }}>보기 선택</button>
          <button type="button" className={s.segBtn} aria-pressed={type === 'input'} onClick={() => { setType('input'); go(i); }}>직접 입력</button>
        </div>
        <span className={s.small}>맞힘 {score.right}/{score.total}</span>
      </div>
      <Stepper i={i} n={items.length} set={go} />
      <div className={s.card}>
        <span className={s.badge}>{it.kind}</span> <span className={s.small + ' ' + s.muted}>힌트: {it.hint}</span>
        <p className={s.reading} lang="en" style={{ margin: '8px 0' }}>
          {sen.en.slice(0, idx)}<span className={p.blank} aria-label="빈칸">{answered ? it.answer : ' '}</span>{sen.en.slice(idx + it.answer.length)}
        </p>
        {type === 'choice' ? (
          <div className={s.stack}>
            {options.map((o) => (
              <button key={o} type="button" className={s.btn} disabled={answered} onClick={() => submit(o)} lang="en"
                style={answered && o === it.answer ? { borderColor: 'var(--ok)', color: 'var(--ok)' } : answered && o === picked ? { borderColor: 'var(--danger)', color: 'var(--danger)' } : undefined}>
                {answered && o === it.answer ? '✓ ' : answered && o === picked ? '✗ ' : ''}{o}
              </button>
            ))}
          </div>
        ) : (
          <form className={s.row} onSubmit={(e) => { e.preventDefault(); if (!answered) submit(val); }}>
            <input className={s.input + ' ' + s.grow} value={val} onChange={(e) => setVal(e.target.value)} disabled={answered} lang="en" aria-label="빈칸 답" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
            <button type="submit" className={s.primary} disabled={answered}>확인</button>
          </form>
        )}
        {answered && <p role="status" style={{ color: correct ? 'var(--ok)' : 'var(--danger)' }}>{correct ? '정답!' : `정답: ${it.answer}`}</p>}
        {answered && i < items.length - 1 && <button type="button" className={s.btn} onClick={() => go(i + 1)}>다음 ›</button>}
      </div>
    </div>
  );
}

export function ArrangeMode({ lesson, lessonKey }: TabProps) {
  const structures = lesson.structures;
  const [i, setI] = useState(0);
  const [seed, setSeed] = useState(0);
  const struct = structures[i];
  const pool = useMemo(() => {
    if (!struct) return [];
    const idxs = struct.chunks.map((_, k) => k);
    let sh = shuffle(idxs);
    for (let t = 0; t < 5 && sh.every((v, k) => v === k) && idxs.length > 1; t++) sh = shuffle(idxs);
    return sh;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [struct, seed]);
  const [answer, setAnswer] = useState<number[]>([]);
  const [result, setResult] = useState<null | boolean>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  useEffect(() => { setAnswer([]); setResult(null); }, [i, seed]);
  if (!struct) return <p className={s.empty}>이 레슨에는 구조 분석 문장이 없어요.</p>;
  const n = struct.chunks.length;
  const check = () => {
    const text = answer.map((k) => struct.chunks[k].text).join(' ');
    const sent = flatSentences(lesson).find((x) => x.id === struct.sentenceId)!;
    const ok = text === sent.en;
    setResult(ok);
    void logPractice({ lessonKey, track: lesson.track, kind: 'arrange', score: ok ? 100 : 0, durationSec: 0, detail: { sentenceId: struct.sentenceId } });
    if (ok) void done(lessonKey);
  };
  const add = (k: number) => !answer.includes(k) && setAnswer([...answer, k]);
  return (
    <div className={s.stack}>
      <Stepper i={i} n={structures.length} set={setI} />
      <p className={s.ko} style={{ margin: 0 }}>{flatSentences(lesson).find((x) => x.id === struct.sentenceId)?.ko}</p>
      <div className={p.answer} aria-label="내 답" data-testid="arrange-answer"
        onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragFrom !== null) add(dragFrom); setDragFrom(null); }}>
        {answer.length === 0 && <span className={s.muted + ' ' + s.small}>아래 조각을 순서대로 누르거나 끌어 놓으세요</span>}
        {answer.map((k, pos) => (
          <button key={k} type="button" className={p.tile} lang="en" onClick={() => { setAnswer(answer.filter((_, j) => j !== pos)); setResult(null); }} aria-label={`${struct.chunks[k].text} 빼기`}>
            {struct.chunks[k].text}
          </button>
        ))}
      </div>
      <div className={p.pool} aria-label="조각">
        {pool.map((k) => (
          <button key={k} type="button" className={p.tile} lang="en" draggable aria-disabled={answer.includes(k)} disabled={answer.includes(k)}
            onDragStart={() => setDragFrom(k)} onClick={() => { add(k); setResult(null); }} data-testid="arrange-tile">
            {struct.chunks[k].text}
          </button>
        ))}
      </div>
      <div className={s.row}>
        <button type="button" className={s.btn} onClick={() => setSeed(seed + 1)}>↺ 섞기</button>
        <button type="button" className={s.primary + ' ' + s.grow} disabled={answer.length !== n} onClick={check}>확인</button>
      </div>
      {result !== null && (
        <div className={s.card} role="status">
          {result ? (
            <>
              <b style={{ color: 'var(--ok)' }}>정답! 역할을 확인해 보세요</b>
              <div style={{ marginTop: 8 }}><ChunkLine chunks={struct.chunks} /></div>
            </>
          ) : (
            <b style={{ color: 'var(--danger)' }}>순서가 달라요. 조각을 눌러 빼고 다시 해 보세요.</b>
          )}
        </div>
      )}
    </div>
  );
}

export function TranslateMode({ lesson, lessonKey }: TabProps) {
  const sents = flatSentences(lesson);
  const [i, setI] = useState(0);
  const [text, setText] = useState('');
  const [shown, setShown] = useState(false);
  const sen = sents[i];
  const go = (n: number) => { setI(n); setText(''); setShown(false); };
  const rate = async (similar: boolean) => {
    await logPractice({ lessonKey, track: lesson.track, kind: 'translate', score: similar ? 100 : 0, durationSec: 0, detail: { sentenceId: sen.id, similar } });
    await done(lessonKey);
    toast(similar ? '좋아요! 👍' : '다음엔 더 비슷하게!');
    if (i < sents.length - 1) go(i + 1);
  };
  return (
    <div className={s.stack}>
      <Stepper i={i} n={sents.length} set={go} />
      <div className={s.card}>
        <p style={{ fontSize: 18, margin: 0 }}>{sen.ko}</p>
      </div>
      <textarea className={s.textarea} value={text} onChange={(e) => setText(e.target.value)} lang="en" placeholder="영어로 말하거나 써 보세요" aria-label="영어로 쓰기" />
      {!shown ? (
        <button type="button" className={s.primary} onClick={() => setShown(true)}>원문과 비교</button>
      ) : (
        <div className={s.card}>
          <p className={s.reading} lang="en" style={{ margin: '0 0 10px' }}>{sen.en}</p>
          <div className={s.row}>
            <button type="button" className={s.btn + ' ' + s.grow} onClick={() => void rate(true)}>😊 비슷했어요</button>
            <button type="button" className={s.btn + ' ' + s.grow} onClick={() => void rate(false)}>🤔 달랐어요</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ShadowMode({ lesson, lessonKey }: TabProps) {
  const sents = flatSentences(lesson);
  const [i, setI] = useState(0);
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const sen = sents[i];
  const recs = useLiveQuery(() => db.recordings.where('lessonKey').equals(lessonKey).reverse().sortBy('at'), [lessonKey]);
  const [urls, setUrls] = useState<Record<number, string>>({});
  useEffect(() => {
    const m: Record<number, string> = {};
    for (const r of recs ?? []) if (r.id !== undefined) m[r.id] = URL.createObjectURL(r.blob);
    setUrls(m);
    return () => Object.values(m).forEach((u) => URL.revokeObjectURL(u));
  }, [recs]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' });
        await db.recordings.add({ lessonKey, sentenceId: sen.id, blob, mime: blob.type, at: Date.now() });
        // 레슨당 최근 3개만 보관
        const all = await db.recordings.where('lessonKey').equals(lessonKey).sortBy('at');
        const extra = all.slice(0, Math.max(0, all.length - 3)).map((r) => r.id!);
        if (extra.length) await db.recordings.bulkDelete(extra);
        void logPractice({ lessonKey, track: lesson.track, kind: 'shadow', score: null, durationSec: 0, detail: { sentenceId: sen.id } });
        void done(lessonKey);
      };
      mr.start();
      setRec(mr);
    } catch {
      toast('마이크를 쓸 수 없어요(권한 확인)');
    }
  };
  const stop = () => {
    rec?.stop();
    setRec(null);
  };
  const playMine = (id: number) => new Audio(urls[id]).play();
  const alternate = async (id: number) => {
    await playSentence(sen);
    await new Promise<void>((res) => {
      const a = new Audio(urls[id]);
      a.onended = () => res();
      a.onerror = () => res();
      void a.play();
    });
  };
  return (
    <div className={s.stack}>
      <Stepper i={i} n={sents.length} set={setI} />
      <div className={s.card}><p className={s.reading} lang="en" style={{ margin: 0 }}>{sen.en}</p></div>
      <div className={s.row}>
        <button type="button" className={s.btn + ' ' + s.big} onClick={() => void playSentence(sen)}>🔊 원음</button>
        {rec ? (
          <button type="button" className={s.danger + ' ' + s.big + ' ' + s.grow} onClick={stop}>■ 녹음 끝</button>
        ) : (
          <button type="button" className={s.primary + ' ' + s.big + ' ' + s.grow} onClick={() => void start()}>🎙 내 목소리 녹음</button>
        )}
      </div>
      <p className={s.small + ' ' + s.muted}>녹음은 이 기기에만 저장되고, 레슨당 최근 3개만 남아요.</p>
      <div className={p.recList}>
        {(recs ?? []).map((r) => (
          <div key={r.id} className={s.card + ' ' + s.row}>
            <span className={s.grow + ' ' + s.small}>{sents.findIndex((x) => x.id === r.sentenceId) + 1}번 문장 · {new Date(r.at).toLocaleTimeString('ko-KR')}</span>
            <button type="button" className={s.btn} onClick={() => void playMine(r.id!)}>▶ 내 녹음</button>
            {r.sentenceId === sen.id && <button type="button" className={s.btn} onClick={() => void alternate(r.id!)}>⇄ 번갈아</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
