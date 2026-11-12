import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import s from '../../styles/ui.module.css';
import type { TabProps } from './LessonPage';
import { db } from '../../lib/db';
import { vocabToItem, checkLessonVocabDone } from '../../lib/words';
import { wordKey } from '../../lib/text';
import { FilterChips, WordRow, matchFilter, type WordFilter } from '../../components/WordList';
import { Flashcards } from '../../components/Flashcards';
import { autoCheck } from '../../lib/progress';
import { isDue } from '../../lib/leitner';
import { kstDate } from '../../lib/date';

export function VocabTab({ lesson, lessonKey }: TabProps) {
  const [view, setView] = useState<'list' | 'flash' | 'review'>('list');
  const [filter, setFilter] = useState<WordFilter>('all');
  const items = useMemo(() => lesson.vocab.map((v) => vocabToItem(lesson, v)), [lesson]);
  const keys = items.map((x) => x.key);
  const rows = useLiveQuery(() => db.wordState.bulkGet(keys), [keys.join('|')]);
  const states = new Map((rows ?? []).filter(Boolean).map((r) => [r!.key, r!]));
  const shown = items.filter((it) => matchFilter(filter, states.get(it.key)));
  const today = kstDate();
  const due = items.filter((it) => { const r = states.get(wordKey(it.term)); return r && isDue(r, today); });

  return (
    <div>
      <div className={s.between}>
        <div className={s.seg} role="tablist" aria-label="보기">
          <button type="button" role="tab" className={s.segBtn} aria-selected={view === 'list'} onClick={() => setView('list')} data-testid="vocab-list">목록</button>
          <button type="button" role="tab" className={s.segBtn} aria-selected={view === 'flash'} onClick={() => setView('flash')} data-testid="vocab-flash">플래시카드</button>
          <button type="button" role="tab" className={s.segBtn} aria-selected={view === 'review'} onClick={() => setView('review')}>복습 {due.length}</button>
        </div>
        <Link to="/words" className={s.ghost + ' ' + s.small}>전체 단어장 ›</Link>
      </div>
      {view !== 'review' && <FilterChips items={items} states={states} value={filter} onChange={setFilter} />}
      {view === 'list' && (
        <ul className={s.list}>
          {shown.map((it) => <WordRow key={it.key} item={it} state={states.get(it.key)} lessonKey={lessonKey} onAnswered={() => void checkLessonVocabDone(lesson)} />)}
          {shown.length === 0 && <li className={s.empty}>이 상태의 단어가 없어요.</li>}
        </ul>
      )}
      {view === 'flash' && <Flashcards items={shown} deckKey={filter} onFinish={() => void checkLessonVocabDone(lesson)} />}
      {view === 'review' && (
        due.length ? <Flashcards items={due} deckKey="review" title="오늘 복습할 단어" onFinish={(n) => { if (n > 0) void autoCheck(lessonKey, 'review'); void checkLessonVocabDone(lesson); }} />
          : <p className={s.empty}>이 레슨에서 오늘 복습할 단어가 없어요. <Link to="/words?review=1">전체 복습 보기</Link></p>
      )}
    </div>
  );
}
