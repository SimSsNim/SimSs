import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import s from '../styles/ui.module.css';
import { DatePick } from '../components/DatePick';
import { AppHeader } from '../components/AppHeader';
import { TrackFilterSeg, type TrackFilter } from './Wordbook';
import { useLessons } from '../lib/lessons';
import { useSettings } from '../lib/settings';
import { db } from '../lib/db';
import { mergeWords } from '../lib/words';
import { WordRow } from '../components/WordList';
import { GrammarCard, ExamplesToggleAll } from '../components/GrammarCard';
import { SpeakBtn } from '../components/SentenceView';
import { toggleSentenceMark } from '../lib/marks';
import { QuestionContext, QuestionDrill, type DrillItem } from './Review';
import { QuestionStar } from './lesson/QuizTab';
import { skillOf } from '../lib/stats';
import { CHAPTER_LABEL, type Lesson } from '../lib/types';

type Kind = 'all' | 'sentence' | 'word' | 'grammar' | 'question';
const KINDS: [Kind, string][] = [['all', '전체'], ['sentence', '문장'], ['word', '단어'], ['grammar', '문법'], ['question', '문제']];

/** 하단 탭 '즐겨찾기': 북마크한 문장·★ 단어·★ 문법·★ 문제를 한곳에서 */
export function Favorites() {
  const settings = useSettings();
  const [trackF, setTrackF] = useState<TrackFilter>(settings.track);
  const [kind, setKind] = useState<Kind>('all');
  const [day, setDay] = useState('');
  const { lessons, status } = useLessons();
  const marks = useLiveQuery(() => db.sentenceMarks.filter((m) => m.bookmark).toArray(), []);
  const words = useLiveQuery(() => db.wordState.filter((w) => w.starred).toArray(), []);
  const myWords = useLiveQuery(() => db.myWords.toArray(), []);
  const grammars = useLiveQuery(() => db.grammarState.filter((g) => !!g.starred).toArray(), []);
  const questions = useLiveQuery(() => db.questionState.filter((q) => !!q.starred).toArray(), []);

  const inTrack = (l: Lesson) => (trackF === 'all' || l.track === trackF) && (!day || l.date === day);

  const sentenceItems = useMemo(() => (marks ?? []).flatMap((m) => {
    const l = lessons[m.lessonKey];
    const sen = l?.paragraphs.flatMap((p) => p.sentences).find((x) => x.id === m.sentenceId);
    return l && sen && inTrack(l) ? [{ key: m.key, l, lk: m.lessonKey, sen, at: m.bookmarkedAt ?? 0 }] : [];
  }).sort((a, b) => b.at - a.at), [marks, lessons, trackF, day]);

  const wordItems = useMemo(() => {
    const starred = new Map((words ?? []).map((w) => [w.key, w]));
    return mergeWords(Object.values(lessons), myWords ?? [])
      .filter((w) => starred.has(w.key))
      .filter((w) => (trackF === 'all' || w.mine || w.sources.some((x) => x.track === trackF)) && (!day || w.sources.some((x) => x.date === day)))
      .map((w) => ({ item: w, state: starred.get(w.key)! }))
      .sort((a, b) => b.state.updatedAt - a.state.updatedAt);
  }, [words, myWords, lessons, trackF, day]);

  const grammarItems = useMemo(() => (grammars ?? []).flatMap((st) => {
    const l = lessons[st.lessonKey];
    const g = l?.grammar.find((x) => x.id === st.grammarId);
    return l && g && inTrack(l) ? [{ key: st.key, l, lk: st.lessonKey, g, st }] : [];
  }).sort((a, b) => (b.st.starredAt ?? 0) - (a.st.starredAt ?? 0)), [grammars, lessons, trackF, day]);

  const questionItems: DrillItem[] = useMemo(() => (questions ?? []).flatMap((st) => {
    const l = lessons[st.lessonKey];
    const q = l?.questions.find((x) => x.id === st.qid);
    return l && q && inTrack(l) ? [{ key: st.key, lesson: l, q, state: st }] : [];
  }).sort((a, b) => (b.state!.starredAt ?? 0) - (a.state!.starredAt ?? 0)), [questions, lessons, trackF, day]);

  const counts: Record<Kind, number> = {
    sentence: sentenceItems.length, word: wordItems.length, grammar: grammarItems.length, question: questionItems.length,
    all: sentenceItems.length + wordItems.length + grammarItems.length + questionItems.length,
  };
  const loading = status === 'loading' && counts.all === 0;
  const show = (k: Kind) => (kind === 'all' || kind === k) && counts[k] > 0;
  const heading = (k: Kind) => kind === 'all' && <h2 className={s.h2}>{KINDS.find((x) => x[0] === k)![1]} {counts[k]}</h2>;

  return (
    <>
      <AppHeader right={<TrackFilterSeg value={trackF} onChange={setTrackF} />} />
      <main className={s.page} data-testid="favorites">
        <h1 className={s.title}>즐겨찾기</h1>
        <DatePick value={day} onChange={setDay} dates={Object.values(lessons).map((l) => l.date)} />
        <div className={s.chips} role="group" aria-label="항목">
          {KINDS.map(([k, label]) => (
            <button key={k} type="button" className={s.chip} aria-pressed={kind === k} onClick={() => setKind(k)} data-testid={`fav-${k}`}>
              {label} <span data-testid={`fav-count-${k}`}>{counts[k]}</span>
            </button>
          ))}
        </div>

        {counts[kind] === 0 && (
          <p className={s.empty} data-testid="fav-empty">
            {loading ? '불러오는 중…' : '아직 즐겨찾기가 없어요. 문장은 🔖 북마크, 단어·문법·문제는 ☆를 누르면 여기에 모여요.'}
          </p>
        )}

        {show('sentence') && (
          <section aria-label="문장">
            {heading('sentence')}
            <ul className={s.list}>
              {sentenceItems.map((x) => (
                <li key={x.key} className={s.card} data-testid="fav-sentence-item">
                  <div className={s.row} style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                    <div className={s.grow}>
                      <p className={s.reading} lang="en" style={{ margin: 0 }}>{x.sen.en}</p>
                      <p className={s.ko} style={{ margin: '4px 0 0' }}>{x.sen.ko}</p>
                    </div>
                    <SpeakBtn text={x.sen.en} label="문장 듣기" />
                  </div>
                  <div className={s.row} style={{ marginTop: 6 }}>
                    <button type="button" className={s.btn} onClick={() => void toggleSentenceMark(x.lk, x.sen.id, 'bookmark')}>🔖 북마크 해제</button>
                    <Link className={s.ghost} to={`/${x.l.track}/lesson/${x.l.id}/structure?s=${x.sen.id}`}>{x.l.date} {x.l.title} ›</Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {show('word') && (
          <section aria-label="단어">
            {heading('word')}
            <ul className={s.list}>
              {wordItems.map((x) => <WordRow key={x.item.key} item={x.item} state={x.state} showSources />)}
            </ul>
          </section>
        )}

        {show('grammar') && (
          <section aria-label="문법">
            {heading('grammar')}
            <ExamplesToggleAll />
            <ul className={s.list}>
              {grammarItems.map((x) => <GrammarCard key={x.key} lesson={x.l} g={x.g} lessonKey={x.lk} state={x.st} showLesson />)}
            </ul>
          </section>
        )}

        {show('question') && (
          <section aria-label="문제">
            {heading('question')}
            <ul className={s.list}>
              {questionItems.map((it) => <FavQuestion key={it.key} it={it} />)}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}

function FavQuestion({ it }: { it: DrillItem }) {
  const [retry, setRetry] = useState(false);
  return (
    <li className={s.card} data-testid="fav-question-item">
      <span className={s.small}>
        <span className={s.badgeAccent}>{CHAPTER_LABEL[it.lesson.chapter!]} {it.q.number}번</span> <span className={s.badge}>L{it.lesson.level}</span> <span className={s.badge}>{skillOf(it.q)}</span>
      </span>
      <QuestionContext lesson={it.lesson} q={it.q} />
      <div className={s.row}>
        <button type="button" className={s.btn} onClick={() => setRetry(!retry)}>{retry ? '접기' : '다시 풀기'}</button>
        <QuestionStar lesson={it.lesson} q={it.q} />
        <Link className={s.ghost} to={`/toeic/lesson/${it.lesson.id}/quiz`}>{it.lesson.date} {it.lesson.title} ›</Link>
      </div>
      {retry && <QuestionDrill items={[it]} mode="drill" compact />}
    </li>
  );
}
