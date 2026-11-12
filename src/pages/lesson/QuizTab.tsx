import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import s from '../../styles/ui.module.css';
import qz from '../../styles/quiz.module.css';
import type { TabProps } from './LessonPage';
import { db, type QuizAttemptRow } from '../../lib/db';
import { attemptsOf, finishAttempt, isCorrect, markUnsure, unmarkUnsure, questionsOf, recommendedSec, saveAttempt, startAttempt } from '../../lib/quiz';
import { lessonKeyOf } from '../../lib/types';
import { blankedSentence } from '../../lib/validateLesson';
import { flatSentences } from '../../lib/lessonUtils';
import { useSettings, setSetting } from '../../lib/settings';
import { useKeys, useSwipe } from '../../hooks';
import { CHAPTER_LABEL, CHOICE_KEYS, QUESTION_TYPE_LABEL, type ChoiceKey, type Lesson, type Question } from '../../lib/types';
import { mmss } from './practice/Transcribe';
import { toast } from '../../components/Toast';

type Draft = Pick<QuizAttemptRow, 'answers' | 'checked' | 'durationSec' | 'mode'> & { id?: number; questionIds?: string[] };

export function QuizTab({ lesson, lessonKey }: TabProps) {
  const st = useSettings();
  const attempts = useLiveQuery(() => attemptsOf(lessonKey), [lessonKey]);
  const [view, setView] = useState<'auto' | 'solve' | 'result'>('auto');
  const [resultId, setResultId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [session, setSession] = useState(0); // 새로 풀기마다 +1 (풀이 화면을 새로 만든다)

  // 처음 화면 정하기: 진행 중이면 이어 풀기, 끝난 시도가 있으면 결과, 아니면 새로 풀기
  useEffect(() => {
    if (!attempts || view !== 'auto') return;
    const open = attempts.find((a) => a.inProgress === 1);
    const done = [...attempts].reverse().find((a) => a.inProgress === 0);
    if (open) {
      setDraft({ id: open.id, answers: open.answers, checked: open.checked, durationSec: open.durationSec, mode: open.mode, questionIds: open.questionIds });
      setView('solve');
    } else if (done) {
      setResultId(done.id!);
      setView('result');
    } else {
      setDraft({ answers: {}, checked: [], durationSec: 0, mode: st.quizMode });
      setView('solve');
    }
  }, [attempts, view, st.quizMode]);

  if (!attempts || view === 'auto') return <p className={s.empty}>불러오는 중…</p>;

  if (view === 'result') {
    const a = attempts.find((x) => x.id === resultId) ?? [...attempts].reverse().find((x) => x.inProgress === 0);
    if (!a) return null;
    return (
      <QuizResult lesson={lesson} attempt={a} attempts={attempts}
        onRetry={(ids) => {
          setSession((x) => x + 1);
          setDraft({ answers: {}, checked: [], durationSec: 0, mode: st.quizMode, questionIds: ids });
          setView('solve');
        }} />
    );
  }
  return (
    <Solver key={session} lesson={lesson} draft={draft!} setDraft={setDraft}
      onFinished={(id) => { setResultId(id); setView('result'); }} />
  );
}

// ---------------- 풀이 ----------------
function Solver({ lesson, draft, setDraft, onFinished }: {
  lesson: Lesson; draft: Draft; setDraft: (d: Draft) => void; onFinished: (id: number) => void;
}) {
  const chapter = lesson.chapter!;
  const qs = questionsOf(lesson, draft);
  const [i, setI] = useState(() => Math.max(0, qs.findIndex((q) => !(q.id in draft.answers))));
  const [started, setStarted] = useState(draft.mode === 'practice' || draft.id !== undefined);
  const [p7view, setP7view] = useState<'passage' | 'question'>('passage');
  const ref = useRef(draft);
  ref.current = draft;
  const exam = draft.mode === 'exam';
  const rec = recommendedSec(lesson) * (qs.length / Math.max(1, lesson.questions.length));
  const q = qs[Math.min(i, qs.length - 1)];
  const overWarned = useRef(false);

  const ensureRow = useCallback(async (): Promise<number> => {
    if (ref.current.id !== undefined) return ref.current.id;
    const row = await startAttempt(lesson, ref.current.mode, undefined, ref.current.questionIds);
    const next = { ...ref.current, id: row.id };
    ref.current = next;
    setDraft(next);
    return row.id!;
  }, [lesson, setDraft]);

  const persist = useCallback(async (d: Draft) => {
    if (d.id === undefined) return;
    await saveAttempt(d.id, { answers: d.answers, checked: d.checked, durationSec: d.durationSec, remainingSec: d.mode === 'exam' ? rec - d.durationSec : null });
  }, [rec]);

  // 걸린 시간: 화면이 보이는 동안만 1초씩
  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const d = { ...ref.current, durationSec: ref.current.durationSec + 1 };
      ref.current = d;
      setDraft(d);
      if (d.durationSec % 5 === 0) void persist(d);
      if (d.mode === 'exam' && d.durationSec === Math.round(rec) && !overWarned.current) {
        overWarned.current = true;
        toast('권장 시간이 지났어요. 계속 풀 수 있어요.');
      }
    }, 1000);
    return () => {
      clearInterval(t);
      void persist(ref.current);
    };
  }, [started, persist, rec, setDraft]);

  const select = async (key: ChoiceKey) => {
    if (!started) return;
    const cur = ref.current;
    if (!exam && cur.checked.includes(q.id)) return; // 연습 모드: 이미 확인한 문제
    const answers = { ...cur.answers, [q.id]: key };
    const checked = exam ? cur.checked : [...cur.checked, q.id];
    const next = { ...cur, answers, checked };
    ref.current = next;
    setDraft(next);
    await ensureRow();
    await persist(ref.current);
  };

  const finish = async () => {
    const unanswered = qs.filter((x) => !(x.id in ref.current.answers)).length;
    if (exam && unanswered && !confirm(`${unanswered}문제를 안 풀었어요. 채점할까요?`)) return;
    const id = await ensureRow();
    const row = await db.quizAttempt.get(id);
    const done = await finishAttempt(lesson, { ...row!, answers: ref.current.answers, checked: ref.current.checked }, ref.current.durationSec);
    onFinished(done.id!);
  };

  const go = (n: number) => {
    const k = Math.max(0, Math.min(qs.length - 1, n));
    setI(k);
    if (chapter === 'part7') setP7view('question');
  };
  useKeys({
    ArrowLeft: () => go(i - 1), ArrowRight: () => go(i + 1),
    '1': () => void select('A'), '2': () => void select('B'), '3': () => void select('C'), '4': () => void select('D'),
    a: () => void select('A'), b: () => void select('B'), c: () => void select('C'), d: () => void select('D'),
    A: () => void select('A'), B: () => void select('B'), C: () => void select('C'), D: () => void select('D'),
    Enter: () => (i < qs.length - 1 ? go(i + 1) : exam ? void finish() : undefined),
  }, [i, qs.length, started, exam, q?.id]);
  const swipe = useSwipe({ left: () => go(i + 1), right: () => go(i - 1) });

  const allChecked = qs.every((x) => draft.checked.includes(x.id));
  const answered = qs.filter((x) => x.id in draft.answers).length;
  const remaining = rec - draft.durationSec;
  const revealedQ = (x: Question) => !exam && draft.checked.includes(x.id);

  const changeMode = (m: 'practice' | 'exam') => {
    setSetting('quizMode', m);
    setDraft({ ...draft, mode: m });
    setStarted(m === 'practice');
  };

  if (!qs.length) return <p className={s.empty}>문제가 없어요.</p>;

  return (
    <div data-testid="quiz">
      <div className={s.between} style={{ marginBottom: 6 }}>
        {draft.id === undefined && answered === 0 ? (
          <div className={s.seg} role="group" aria-label="풀이 모드">
            <button type="button" className={s.segBtn} aria-pressed={!exam} onClick={() => changeMode('practice')} data-testid="mode-practice">연습</button>
            <button type="button" className={s.segBtn} aria-pressed={exam} onClick={() => changeMode('exam')} data-testid="mode-exam">실전</button>
          </div>
        ) : <span className={s.badgeAccent}>{exam ? '실전 모드' : '연습 모드'}{draft.questionIds ? ' · 틀린 문제만' : ''}</span>}
        <span className={`${qz.timer} ${exam && remaining < 0 ? qz.over : ''}`} data-testid="quiz-timer" aria-label="시간">
          {exam ? (remaining >= 0 ? `남은 ${mmss(Math.round(remaining))}` : `+${mmss(Math.round(-remaining))} 초과`) : mmss(draft.durationSec)}
        </span>
      </div>

      {!started ? (
        <div className={s.card} style={{ textAlign: 'center' }} data-testid="exam-start">
          <p style={{ fontWeight: 700 }}>{CHAPTER_LABEL[chapter]} · {qs.length}문제 · 권장 {mmss(Math.round(rec))}</p>
          <p className={s.small + ' ' + s.muted}>끝까지 푼 뒤 한꺼번에 채점해요. 시간이 지나도 계속 풀 수 있어요. 풀이가 끝날 때까지 다른 탭의 완성 문장·번역은 가려져요.</p>
          <button type="button" className={s.primary + ' ' + s.big} onClick={async () => { await ensureRow(); setStarted(true); }} data-testid="exam-begin">시작</button>
        </div>
      ) : (
        <>
          <nav className={qz.dots} aria-label="문제 목록" data-testid="quiz-dots">
            {qs.map((x, k) => {
              const a = draft.answers[x.id];
              const rev = revealedQ(x);
              const cls = rev ? (isCorrect(x, a) ? qz.dotOk : qz.dotBad) : a ? qz.dotAnswered : '';
              const mark = rev ? (isCorrect(x, a) ? '○' : '✕') : a ? '•' : '';
              return (
                <button key={x.id} type="button" className={`${qz.dot} ${cls}`} aria-current={k === i ? 'step' : undefined} onClick={() => go(k)}>
                  {x.number}<span className="sr-only">번{rev ? (isCorrect(x, a) ? ' 맞음' : ' 틀림') : a ? ' 답함' : ''}</span>{mark && <span aria-hidden="true">{mark}</span>}
                </button>
              );
            })}
          </nav>

          {chapter === 'part5' && (
            <div className={`${s.card} ${qz.qcard}`} {...swipe} data-testid="p5-card">
              <div className={s.small + ' ' + s.muted}>{q.number} / {qs.length}</div>
              <p className={qz.qsentence} lang="en" data-testid="q-sentence">
                {blankedSentence(sentenceOf(lesson, q.blank!.sentenceId), q.blank!.answerText)}
              </p>
              <Choices q={q} selected={draft.answers[q.id]} reveal={revealedQ(q)} onSelect={select} />
            </div>
          )}

          {chapter === 'part6' && (
            <>
              <div className={s.card} data-testid="p6-passage" style={{ maxHeight: '46vh', overflow: 'auto' }}>
                <Part6Passage lesson={lesson} qs={qs} answers={draft.answers} current={q.id} reveal={revealedQ} onPick={(k) => go(k)} />
              </div>
              <div className={`${s.card} ${qz.qcard}`} style={{ marginTop: 10 }}>
                <div className={s.small + ' ' + s.muted}>빈칸 [{q.number}] · {QUESTION_TYPE_LABEL[q.type]}</div>
                <Choices q={q} selected={draft.answers[q.id]} reveal={revealedQ(q)} onSelect={select} />
              </div>
            </>
          )}

          {chapter === 'part7' && (
            <div className={qz.split}>
              <div className={`${s.seg} ${qz.p7tabs}`} role="tablist" aria-label="지문과 문제" style={{ marginBottom: 8 }}>
                <button type="button" role="tab" className={s.segBtn} aria-selected={p7view === 'passage'} onClick={() => setP7view('passage')} data-testid="p7-tab-passage">지문</button>
                <button type="button" role="tab" className={s.segBtn} aria-selected={p7view === 'question'} onClick={() => setP7view('question')} data-testid="p7-tab-question">문제</button>
              </div>
              <div className={qz.splitPassage} data-p7view={p7view} style={{ display: undefined }}>
                <div className={`${s.card} p7passage`} data-testid="p7-passage" data-hidden-mobile={p7view !== 'passage'}>
                  <Passage lesson={lesson} highlight={new Set(revealedQ(q) ? q.evidenceSentenceIds ?? [] : [])} />
                </div>
              </div>
              <div className={qz.splitQuestions} data-hidden-mobile={p7view !== 'question'}>
                <div className={qz.passageBar}>
                  <span className={s.small}>{lesson.title}</span>
                  <button type="button" className={s.chip} onClick={() => setP7view('passage')}>지문 다시 보기</button>
                </div>
                <div className={`${s.card} ${qz.qcard}`} {...swipe}>
                  <div className={s.small + ' ' + s.muted}>{q.number} / {qs.length} · {QUESTION_TYPE_LABEL[q.type]}</div>
                  <p className={qz.prompt} lang="en" data-testid="q-prompt">{q.prompt}</p>
                  <Choices q={q} selected={draft.answers[q.id]} reveal={revealedQ(q)} onSelect={select} />
                </div>
              </div>
            </div>
          )}

          {revealedQ(q) && <Feedback lesson={lesson} q={q} answer={draft.answers[q.id]} />}

          <div className={s.bottomBar}>
            <button type="button" className={s.btn + ' ' + s.big} onClick={() => go(i - 1)} disabled={i === 0} aria-label="이전 문제">‹</button>
            {exam || allChecked ? (
              <button type="button" className={s.primary + ' ' + s.big + ' ' + s.grow} onClick={() => void finish()} data-testid="quiz-finish">
                {exam ? `채점하기 (${answered}/${qs.length})` : '결과 보기'}
              </button>
            ) : (
              <button type="button" className={s.btn + ' ' + s.big + ' ' + s.grow} onClick={() => go(i + 1)} disabled={i >= qs.length - 1} data-testid="quiz-next">다음 문제 ›</button>
            )}
            {(exam || allChecked) && <button type="button" className={s.btn + ' ' + s.big} onClick={() => go(i + 1)} disabled={i >= qs.length - 1} aria-label="다음 문제">›</button>}
          </div>
        </>
      )}
      <style>{`@media (max-width: 899px){ [data-hidden-mobile="true"]{ display:none } }`}</style>
    </div>
  );
}

export const sentenceOf = (lesson: Lesson, id: string) => flatSentences(lesson).find((x) => x.id === id)?.en ?? '';

export function Choices({ q, selected, reveal, onSelect, order }: {
  q: Question; selected?: ChoiceKey; reveal: boolean; onSelect: (k: ChoiceKey) => void;
  /** 보기 표시 순서(오답노트에서 섞을 때). 표시 글자는 A~D 를 다시 붙인다 */ order?: Question['choices'];
}) {
  const list = order ?? q.choices;
  return (
    <div className={qz.choices} role="group" aria-label="보기">
      {list.map((c, idx) => {
        const label = CHOICE_KEYS[idx];
        const cls = reveal ? (c.key === q.answer ? qz.choiceOk : c.key === selected ? qz.choiceBad : '') : '';
        return (
          <button key={c.key} type="button" className={`${qz.choice} ${cls}`} aria-pressed={selected === c.key} onClick={() => onSelect(order ? (c.key) : label)}
            data-testid={`choice-${label}`} data-key={c.key} lang="en">
            <b aria-hidden="true">{label}</b>
            <span>{c.text}</span>
            {reveal && c.key === q.answer && <span className="sr-only">정답</span>}
            {reveal && c.key === selected && c.key !== q.answer && <span className="sr-only">내 답, 오답</span>}
          </button>
        );
      })}
    </div>
  );
}

function Part6Passage({ lesson, qs, answers, current, reveal, onPick }: {
  lesson: Lesson; qs: Question[]; answers: Record<string, ChoiceKey>; current: string; reveal: (q: Question) => boolean; onPick: (index: number) => void;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    refs.current[current]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current]);
  const bySentence = new Map(lesson.questions.filter((q) => q.blank).map((q) => [q.blank!.sentenceId, q]));
  return (
    <div className={qz.passage} lang="en">
      {lesson.paragraphs.map((p) => (
        <p key={p.id}>
          {p.sentences.map((sen, k) => {
            const q = bySentence.get(sen.id);
            const inSet = q && qs.some((x) => x.id === q.id);
            let content: React.ReactNode = sen.en;
            if (q && inSet) {
              const a = answers[q.id];
              const filled = a ? q.choices.find((c) => c.key === a)?.text : null;
              const rev = reveal(q);
              const state = rev ? (isCorrect(q, a) ? 'ok' : 'bad') : 'neutral';
              const slot = (
                <button type="button" ref={(el) => { refs.current[q.id] = el; }} className={qz.slot} data-active={q.id === current} data-state={state}
                  data-testid={`slot-${q.number}`} onClick={() => onPick(qs.findIndex((x) => x.id === q.id))} aria-label={`빈칸 ${q.number}${filled ? `: ${filled}` : ''}`}>
                  [{q.number}] {filled ?? '-------'}
                </button>
              );
              const idx = sen.en.indexOf(q.blank!.answerText);
              content = q.blank!.answerText === sen.en ? slot : <>{sen.en.slice(0, idx)}{slot}{sen.en.slice(idx + q.blank!.answerText.length)}</>;
            }
            return <span key={sen.id}>{k > 0 ? ' ' : ''}{content}</span>;
          })}
        </p>
      ))}
    </div>
  );
}

export function Passage({ lesson, highlight }: { lesson: Lesson; highlight: Set<string> }) {
  return (
    <div className={qz.passage} lang="en">
      {lesson.paragraphs.map((p) => (
        <p key={p.id}>
          {p.sentences.map((sen, k) => (
            <span key={sen.id}>{k > 0 ? ' ' : ''}<span id={`ev-${sen.id}`} data-sid={sen.id} className={highlight.has(sen.id) ? qz.evidence : undefined}
              data-evidence={highlight.has(sen.id) || undefined}>{sen.en}</span></span>
          ))}
        </p>
      ))}
    </div>
  );
}

function Feedback({ lesson, q, answer }: { lesson: Lesson; q: Question; answer?: ChoiceKey }) {
  const ok = isCorrect(q, answer);
  return (
    <div className={qz.feedback} role="status" data-testid="feedback">
      <b style={{ color: ok ? 'var(--ok)' : 'var(--danger)' }}>{ok ? '○ 정답!' : `✕ 오답 — 정답 ${q.answer}`}</b>
      <p style={{ margin: '6px 0' }}>{q.explanationKo}</p>
      <ChoiceNotes q={q} />
      {ok && <UnsureToggle lesson={lesson} q={q} />}
    </div>
  );
}

function ChoiceNotes({ q }: { q: Question }) {
  const notes = q.choiceNotesKo ? CHOICE_KEYS.filter((k) => q.choiceNotesKo![k]) : [];
  if (!notes.length) return null;
  return (
    <ul className={s.small} style={{ margin: '4px 0 8px', paddingLeft: 18 }}>
      {notes.map((k) => <li key={k}><b>{k}</b> {q.choiceNotesKo![k]}</li>)}
    </ul>
  );
}

// ---------------- 결과 ----------------
function QuizResult({ lesson, attempt, attempts, onRetry }: { lesson: Lesson; attempt: QuizAttemptRow; attempts: QuizAttemptRow[]; onRetry: (ids?: string[]) => void }) {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const qs = questionsOf(lesson, attempt);
  const wrong = qs.filter((q) => !isCorrect(q, attempt.answers[q.id]));
  const [evidence, setEvidence] = useState<Set<string>>(new Set());
  const bySkill = useMemo(() => {
    const m = new Map<string, { ok: number; n: number }>();
    for (const q of qs) {
      const k = q.skill || QUESTION_TYPE_LABEL[q.type];
      const v = m.get(k) ?? { ok: 0, n: 0 };
      v.n++;
      if (isCorrect(q, attempt.answers[q.id])) v.ok++;
      m.set(k, v);
    }
    return [...m.entries()];
  }, [qs, attempt]);
  const set = params.get('set')?.split(',') ?? [];
  const nextId = set[set.indexOf(lesson.id) + 1];
  const first = attempts.find((a) => a.inProgress === 0);
  const showEvidence = (q: Question) => {
    setEvidence(new Set(q.evidenceSentenceIds ?? []));
    setTimeout(() => document.getElementById(`ev-${q.evidenceSentenceIds?.[0]}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
  };

  return (
    <div data-testid="quiz-result">
      <div className={s.card} style={{ textAlign: 'center' }}>
        <div className={s.small + ' ' + s.muted}>{CHAPTER_LABEL[lesson.chapter!]} · 시도 {attempt.attemptNo}{attempt.questionIds ? ' (틀린 문제만)' : ''} · {attempt.mode === 'exam' ? '실전' : '연습'}</div>
        <div className={qz.resultScore} data-testid="quiz-score">{attempt.score}/{attempt.total}</div>
        <div className={s.small}>
          걸린 시간 {mmss(attempt.durationSec)} · 권장 {mmss(Math.round(recommendedSec(lesson) * (attempt.total / lesson.questions.length)))}
          {first && first.id !== attempt.id ? ` · 첫 시도 ${first.score}/${first.total}` : ''}
        </div>
        <div className={qz.dots} style={{ justifyContent: 'center', marginTop: 8 }} aria-label="문항별 결과">
          {qs.map((q) => {
            const ok = isCorrect(q, attempt.answers[q.id]);
            return <a key={q.id} href={`#res-${q.id}`} className={`${qz.dot} ${ok ? qz.dotOk : qz.dotBad}`} aria-label={`${q.number}번 ${ok ? '맞음' : '틀림'}`}>{q.number}{ok ? '○' : '✕'}</a>;
          })}
        </div>
        <table className={s.table} style={{ marginTop: 8 }}>
          <thead><tr><th>유형</th><th>맞은 수</th></tr></thead>
          <tbody>{bySkill.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.ok}/{v.n}</td></tr>)}</tbody>
        </table>
      </div>

      <div className={s.row} style={{ margin: '10px 0' }}>
        {wrong.length > 0 && <button type="button" className={s.primary} onClick={() => onRetry(wrong.map((q) => q.id))} data-testid="retry-wrong">틀린 문제만 다시 풀기 ({wrong.length})</button>}
        <button type="button" className={s.btn} onClick={() => onRetry(undefined)} data-testid="retry-all">처음부터 다시 풀기</button>
        <Link className={s.btn} to={`/${lesson.track}/lesson/${lesson.id}/vocab`}>단어 탭으로</Link>
        {nextId && <button type="button" className={s.primary} onClick={() => nav(`/toeic/lesson/${nextId}/quiz?set=${set.join(',')}`)} data-testid="set-next">다음 Part ›</button>}
      </div>

      {lesson.chapter === 'part7' && (
        <details className={s.card} open={evidence.size > 0} style={{ marginBottom: 10 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, minHeight: 36 }}>지문</summary>
          <div data-testid="result-passage"><Passage lesson={lesson} highlight={evidence} /></div>
        </details>
      )}

      <ol className={s.list}>
        {qs.map((q) => <ResultItem key={q.id} lesson={lesson} q={q} answer={attempt.answers[q.id]} onEvidence={showEvidence} />)}
      </ol>
    </div>
  );
}

function ResultItem({ lesson, q, answer, onEvidence }: { lesson: Lesson; q: Question; answer?: ChoiceKey; onEvidence: (q: Question) => void }) {
  const ok = isCorrect(q, answer);
  const sids = q.blank ? [q.blank.sentenceId] : q.evidenceSentenceIds ?? [];
  const sents = flatSentences(lesson).filter((x) => sids.includes(x.id));
  const vocab = lesson.vocab.filter((v) => sents.some((x) => x.en.includes(v.matchText)));
  const grammar = lesson.grammar.filter((g) => sids.includes(g.sentenceId));
  const text = (k?: ChoiceKey) => q.choices.find((c) => c.key === k)?.text ?? '(안 풂)';
  return (
    <li id={`res-${q.id}`} className={s.card} data-testid="result-item">
      <div className={s.between}>
        <b>{q.number}. <span style={{ color: ok ? 'var(--ok)' : 'var(--danger)' }}>{ok ? '○ 맞음' : '✕ 틀림'}</span></b>
        <span className={s.badge}>{q.skill || QUESTION_TYPE_LABEL[q.type]}</span>
      </div>
      {q.prompt && <p className={qz.prompt} lang="en">{q.prompt}</p>}
      <p className={s.small} style={{ margin: '4px 0' }}>정답 <b lang="en">{q.answer}. {text(q.answer)}</b> · 내 답 <span lang="en">{answer ? `${answer}. ${text(answer)}` : '(안 풂)'}</span></p>
      <p style={{ margin: '6px 0' }}>{q.explanationKo}</p>
      <ChoiceNotes q={q} />
      {sents.map((x) => (
        <div key={x.id} style={{ margin: '6px 0' }}>
          <div className={qz.qsentence} lang="en" style={{ fontSize: 'var(--read-size)' }}>{x.en}</div>
          <div className={s.ko}>{x.ko}</div>
        </div>
      ))}
      <div className={s.row}>
        {q.evidenceSentenceIds?.length ? <button type="button" className={s.chip} onClick={() => onEvidence(q)} data-testid={`evidence-${q.id}`}>근거 보기</button> : null}
        {q.blank && <Link className={s.chip} to={`/${lesson.track}/lesson/${lesson.id}/practice?mode=typing&s=${q.blank.sentenceId}`}>✍️ 이 문장 필사하기</Link>}
        {vocab.map((v) => <Link key={v.id} className={s.chip} to={`/${lesson.track}/lesson/${lesson.id}/vocab`} lang="en">📘 {v.term}</Link>)}
        {grammar.map((g) => <Link key={g.id} className={s.chip} to={`/${lesson.track}/lesson/${lesson.id}/structure?s=${g.sentenceId}`}>✏️ {g.title}</Link>)}
        {ok && <UnsureToggle lesson={lesson} q={q} />}
      </div>
    </li>
  );
}

/** 맞힌 문제의 "헷갈렸어요" 켜기/끄기(다시 누르면 오답노트에서 빠짐) */
export function UnsureToggle({ lesson, q }: { lesson: Lesson; q: Question }) {
  const key = `${lessonKeyOf(lesson.track, lesson.id)}:${q.id}`;
  const row = useLiveQuery(() => db.questionState.get(key), [key]);
  const on = !!row?.unsure;
  return (
    <button type="button" className={s.chip} aria-pressed={on} data-testid={`unsure-${q.id}`}
      onClick={async () => {
        if (on) {
          await unmarkUnsure(lesson, q);
          toast('헷갈림 표시를 지웠어요');
        } else {
          await markUnsure(lesson, q);
          toast('오답노트에 넣었어요. 오늘 복습에 나와요');
        }
      }}>
      {on ? '✓ 헷갈림 (누르면 취소)' : '🤔 헷갈렸어요'}
    </button>
  );
}
