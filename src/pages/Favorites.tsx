import { useMemo, useState } from 'react';
import { setFavorite, moveFavorite, assignKey, sortFolders, DEFAULT_FOLDER, DEFAULT_FOLDER_NAME, type FavKind } from '../lib/favorites';
import { FolderManager } from '../components/FavFolders';
import type { WordItem } from '../lib/words';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import s from '../styles/ui.module.css';
import { DatePick } from '../components/DatePick';
import { GridTabs } from '../components/GridTabs';
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
  const assigns = useLiveQuery(() => db.favAssign.toArray(), []);
  const folders = useLiveQuery(() => db.favFolders.toArray(), []);
  const [folder, setFolder] = useState<string>('all');
  const [manage, setManage] = useState(false);
  const folderOf = useMemo(() => new Map((assigns ?? []).map((a) => [a.key, a.folderId])), [assigns]);
  const snapOf = useMemo(() => new Map((assigns ?? []).map((a) => [a.key, a.snap])), [assigns]);
  const fid = (k: FavKind, ref: string) => folderOf.get(assignKey(k, ref)) ?? DEFAULT_FOLDER;
  const folderName = (id: string) => (id === DEFAULT_FOLDER ? DEFAULT_FOLDER_NAME : folders?.find((f) => f.id === id)?.name ?? DEFAULT_FOLDER_NAME);
  const inFolder = (k: FavKind, ref: string) => kind === 'all' || folder === 'all' || fid(k, ref) === folder;

  const inTrack = (l: Lesson) => (trackF === 'all' || l.track === trackF) && (!day || l.date === day);

  const sentenceItems = useMemo(() => (marks ?? []).flatMap((m) => {
    const l = lessons[m.lessonKey];
    const sen = l?.paragraphs.flatMap((p) => p.sentences).find((x) => x.id === m.sentenceId);
    return l && sen && inTrack(l) ? [{ key: m.key, l, lk: m.lessonKey, sen, at: m.bookmarkedAt ?? 0 }] : [];
  }).sort((a, b) => b.at - a.at), [marks, lessons, trackF, day]);

  const wordItems = useMemo(() => {
    const starred = new Map((words ?? []).map((w) => [w.key, w]));
    const merged = new Map(mergeWords(Object.values(lessons), myWords ?? []).map((w) => [w.key, w]));
    const items: { item: WordItem; state: (typeof words & object)[number] }[] = [];
    for (const [key, state] of starred) {
      let item = merged.get(key);
      if (!item) {
        // 레슨 단어장에 없는 단어(본문에서 아무 단어나 ☆): 즐겨찾기할 때 저장한 뜻으로
        const sn = snapOf.get(assignKey('word', key));
        const l = sn?.lessonKey ? lessons[sn.lessonKey] : undefined;
        item = {
          key, term: sn?.term ?? state.term, pos: sn?.pos ?? '', ipa: sn?.ipa ?? undefined, meaningKo: sn?.meaningKo || '(뜻 없음)', synonyms: sn?.synonyms ?? [],
          sentence: sn?.sentence, matchText: sn?.term, mine: !l, createdAt: state.updatedAt,
          sources: l ? [{ lessonKey: sn!.lessonKey!, track: l.track, date: l.date, level: l.level, title: l.title, vocabId: '' }] : [],
        };
      }
      items.push({ item, state });
    }
    return items
      .filter(({ item: w }) => (trackF === 'all' || w.mine || w.sources.some((x) => x.track === trackF)) && (!day || w.sources.some((x) => x.date === day)))
      .sort((a, b) => b.state.updatedAt - a.state.updatedAt);
  }, [words, myWords, lessons, trackF, day, snapOf]);

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

  const fSent = sentenceItems.filter((x) => inFolder('sentence', x.key));
  const fWord = wordItems.filter((x) => inFolder('word', x.item.key));
  const fGram = grammarItems.filter((x) => inFolder('grammar', x.key));
  const fQues = questionItems.filter((x) => inFolder('question', x.key));
  const kindItems: Record<FavKind, { ref: string }[]> = {
    sentence: sentenceItems.map((x) => ({ ref: x.key })), word: wordItems.map((x) => ({ ref: x.item.key })),
    grammar: grammarItems.map((x) => ({ ref: x.key })), question: questionItems.map((x) => ({ ref: x.key })),
  };
  const counts: Record<Kind, number> = {
    sentence: sentenceItems.length, word: wordItems.length, grammar: grammarItems.length, question: questionItems.length,
    all: sentenceItems.length + wordItems.length + grammarItems.length + questionItems.length,
  };
  const pickKind = (k: Kind) => { setKind(k); setFolder('all'); setManage(false); };
  const tag = (k: FavKind, ref: string) => (
    <div className={s.row} style={{ gap: 6, margin: '0 0 4px' }}>
      <span className={s.badge} data-testid="fav-folder-tag">📁 {folderName(fid(k, ref))}</span>
      <button type="button" className={s.chip} style={{ minHeight: 26, fontSize: 12, padding: '0 8px' }} onClick={() => void moveFavorite(k, ref)} data-testid="fav-move">폴더 이동</button>
    </div>
  );
  const loading = status === 'loading' && counts.all === 0;
  const shownLen: Record<FavKind, number> = { sentence: fSent.length, word: fWord.length, grammar: fGram.length, question: fQues.length };
  const show = (k: FavKind) => (kind === 'all' || kind === k) && shownLen[k] > 0;
  const heading = (k: FavKind) => kind === 'all' && <h2 className={s.h2}>{KINDS.find((x) => x[0] === k)![1]} {counts[k]}</h2>;

  return (
    <>
      <AppHeader right={<TrackFilterSeg value={trackF} onChange={setTrackF} />} />
      <main className={s.page} data-testid="favorites">
        <h1 className={s.title}>즐겨찾기</h1>
        <DatePick value={day} onChange={setDay} dates={Object.values(lessons).map((l) => l.date)} />
        <GridTabs label="항목" value={kind} onChange={pickKind} testid="fav"
          options={KINDS.map(([k, label]) => [k, <>{label} <span data-testid={`fav-count-${k}`}>{counts[k]}</span></>] as [Kind, React.ReactNode])} />

        {kind !== 'all' && (() => {
          const k = kind as FavKind;
          const list = sortFolders((folders ?? []).filter((f) => f.kind === k));
          const n = (id: string) => kindItems[k].filter((x) => fid(k, x.ref) === id).length;
          return (
            <>
              <div className={s.chips} role="group" aria-label="폴더" data-testid="fav-folders">
                <button type="button" className={s.chip} aria-pressed={folder === 'all'} onClick={() => setFolder('all')}>모든 폴더 {counts[kind]}</button>
                {[{ id: DEFAULT_FOLDER, name: DEFAULT_FOLDER_NAME }, ...list].map((f) => (
                  <button key={f.id || 'default'} type="button" className={s.chip} aria-pressed={folder === f.id} onClick={() => setFolder(f.id)} data-testid={`fav-folder-${f.id || 'default'}`}>📁 {f.name} {n(f.id)}</button>
                ))}
                <button type="button" className={s.chip} aria-pressed={manage} onClick={() => setManage(!manage)} data-testid="fav-manage">⚙ 폴더 관리</button>
              </div>
              {manage && <FolderManager kind={k} onClose={() => setManage(false)} />}
            </>
          );
        })()}

        {counts[kind] > 0 && kind !== 'all' && shownLen[kind as FavKind] === 0 && <p className={s.empty} data-testid="fav-folder-empty">이 폴더는 비어 있어요. 항목의 '폴더 이동'으로 옮겨 넣을 수 있어요.</p>}
        {counts[kind] === 0 && (
          <p className={s.empty} data-testid="fav-empty">
            {loading ? '불러오는 중…' : '아직 즐겨찾기가 없어요. 문장은 🔖 북마크, 단어·문법·문제는 ☆를 누르면 여기에 모여요.'}
          </p>
        )}

        {show('sentence') && (
          <section aria-label="문장">
            {heading('sentence')}
            <ul className={s.list}>
              {fSent.map((x) => (
                <li key={x.key} className={s.card} data-testid="fav-sentence-item">
                  {tag('sentence', x.key)}
                  <div className={s.row} style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                    <div className={s.grow}>
                      <p className={s.reading} lang="en" style={{ margin: 0 }}>{x.sen.en}</p>
                      <p className={s.ko} style={{ margin: '4px 0 0' }}>{x.sen.ko}</p>
                    </div>
                    <SpeakBtn text={x.sen.en} label="문장 듣기" />
                  </div>
                  <div className={s.row} style={{ marginTop: 6 }}>
                    <button type="button" className={s.btn} onClick={() => void setFavorite('sentence', x.key, false, () => toggleSentenceMark(x.lk, x.sen.id, 'bookmark'))}>🔖 북마크 해제</button>
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
              {fWord.map((x) => <li key={x.item.key} style={{ listStyle: 'none' }}>{tag('word', x.item.key)}<ul className={s.list}><WordRow item={x.item} state={x.state} showSources /></ul></li>)}
            </ul>
          </section>
        )}

        {show('grammar') && (
          <section aria-label="문법">
            {heading('grammar')}
            <ExamplesToggleAll />
            <ul className={s.list}>
              {fGram.map((x) => <li key={x.key} style={{ listStyle: 'none' }}>{tag('grammar', x.key)}<ul className={s.list}><GrammarCard lesson={x.l} g={x.g} lessonKey={x.lk} state={x.st} showLesson /></ul></li>)}
            </ul>
          </section>
        )}

        {show('question') && (
          <section aria-label="문제">
            {heading('question')}
            <ul className={s.list}>
              {fQues.map((it) => <li key={it.key} style={{ listStyle: 'none' }}>{tag('question', it.key)}<ul className={s.list}><FavQuestion it={it} /></ul></li>)}
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
