import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import s from '../../styles/ui.module.css';
import type { TabProps } from './LessonPage';
import { db } from '../../lib/db';
import { GrammarCard } from '../../components/GrammarCard';
import { autoCheck, logPractice } from '../../lib/progress';
import { answerEq } from '../../lib/text';
import type { Lesson } from '../../lib/types';

export function GrammarTab({ lesson, lessonKey }: TabProps) {
  const states = useLiveQuery(() => db.grammarState.where('lessonKey').equals(lessonKey).toArray(), [lessonKey]);
  const check = async () => {
    const rows = await db.grammarState.where('lessonKey').equals(lessonKey).toArray();
    if (lesson.grammar.every((g) => rows.some((r) => r.grammarId === g.id && (r.understood || r.review)))) void autoCheck(lessonKey, 'grammar');
  };
  if (!lesson.grammar.length) return <p className={s.empty}>이 레슨에는 문법 포인트가 없어요.</p>;
  return (
    <div>
      <ul className={s.list}>
        {lesson.grammar.map((g) => (
          <GrammarCard key={g.id} lesson={lesson} g={g} lessonKey={lessonKey} state={states?.find((x) => x.grammarId === g.id)} onChange={() => void check()} />
        ))}
      </ul>
      <h2 className={s.h2}>미니 퀴즈</h2>
      <GrammarQuiz lesson={lesson} lessonKey={lessonKey} />
    </div>
  );
}

export function GrammarQuiz({ lesson, lessonKey }: { lesson: Lesson; lessonKey: string }) {
  const sents = new Map(lesson.paragraphs.flatMap((p) => p.sentences).map((x) => [x.id, x]));
  const qs = lesson.grammar.flatMap((g) => g.highlight.slice(0, 1).map((h) => ({ g, h, sent: sents.get(g.sentenceId)! }))).filter((q) => q.sent);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const score = qs.filter((q) => answerEq(answers[q.g.id] ?? '', q.h)).length;
  return (
    <form className={s.stack} onSubmit={(e) => {
      e.preventDefault();
      setChecked(true);
      void logPractice({ lessonKey, track: lesson.track, kind: 'grammarQuiz', score: Math.round((score / qs.length) * 100), durationSec: 0 });
    }}>
      {qs.map((q, i) => {
        const idx = q.sent.en.indexOf(q.h);
        const ok = answerEq(answers[q.g.id] ?? '', q.h);
        return (
          <div key={q.g.id} className={s.card}>
            <div className={s.small + ' ' + s.muted}>{i + 1}. {q.g.title}</div>
            <p className={s.reading} lang="en" style={{ margin: '6px 0', fontSize: 'calc(var(--read-size) - 2px)' }}>
              {q.sent.en.slice(0, idx)}<span style={{ borderBottom: '2px solid var(--text)', display: 'inline-block', minWidth: '4em', verticalAlign: 'bottom' }} aria-label="빈칸">&nbsp;</span>{q.sent.en.slice(idx + q.h.length)}
            </p>
            <input className={s.input} value={answers[q.g.id] ?? ''} aria-label={`${i + 1}번 빈칸`} autoCapitalize="off" autoCorrect="off" spellCheck={false}
              onChange={(e) => { setAnswers({ ...answers, [q.g.id]: e.target.value }); setChecked(false); }} />
            {checked && <p role="status" style={{ color: ok ? 'var(--ok)' : 'var(--danger)', margin: '6px 0 0' }}>{ok ? '✓ 정답' : `✗ 정답: ${q.h}`}</p>}
          </div>
        );
      })}
      <button type="submit" className={s.primary}>채점하기</button>
      {checked && <p role="status"><b>{score} / {qs.length}</b> 맞았어요</p>}
    </form>
  );
}
