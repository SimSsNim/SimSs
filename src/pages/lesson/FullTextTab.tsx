import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import s from '../../styles/ui.module.css';
import r from '../../styles/reading.module.css';
import type { TabProps } from './LessonPage';
import { useSettings, setSetting, type DisplayMode } from '../../lib/settings';
import { SentenceText, WordPopup, SentenceMenu, useLongPress, autoSpeakWord } from '../../components/SentenceView';
import { grammarOf, structureOf, vocabOf } from '../../lib/lessonUtils';
import type { GlossEntry, Sentence, Vocab } from '../../lib/types';
import { wordKey } from '../../lib/text';
import { db } from '../../lib/db';
import { usePlayer } from '../../store/player';
import { autoCheck } from '../../lib/progress';
import { blankedSentence } from '../../lib/validateLesson';

const MODES: { id: DisplayMode; label: string }[] = [
  { id: 'en', label: '영어' },
  { id: 'ko', label: '한글' },
  { id: 'both-sentence', label: '문장별 번역' },
  { id: 'both-paragraph', label: '단락별 번역' },
];

export function FullTextTab({ lesson, lessonKey, gate }: TabProps) {
  const hidden = gate?.hidden ?? new Set<string>();
  const numbered = lesson.chapter === 'part5';
  const st = useSettings();
  const player = usePlayer();
  const [popup, setPopup] = useState<{ word: string; vocab?: Vocab; gloss?: GlossEntry; sentence: string; grammarId?: string; sentenceId: string } | null>(null);
  const [menu, setMenu] = useState<Sentence | null>(null);
  const marks = useLiveQuery(() => db.sentenceMarks.where('lessonKey').equals(lessonKey).toArray(), [lessonKey]);
  const endRef = useRef<HTMLDivElement>(null);
  const showEn = st.displayMode !== 'ko';
  const playingHere = player.lessonKey === lessonKey;

  useEffect(() => {
    const el = endRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((ents) => {
      if (ents.some((e) => e.isIntersecting)) void autoCheck(lessonKey, 'read');
    });
    io.observe(el);
    return () => io.disconnect();
  }, [lessonKey]);

  // 번역은 '표시 모드'(영어/한글/문장별/단락별)로만 고른다
  const renderKo = (_id: string, text: string, cls: string) => <span className={cls} lang="ko">{text}</span>;

  return (
    <div>
      {/* 두 줄: ① 표시 모드 ② 켜고 끄기 */}
      <div className={`${s.seg} ${r.modeSeg}`} role="group" aria-label="표시 모드" data-testid="display-modes">
        {MODES.map((m) => (
          <button key={m.id} type="button" className={s.segBtn} aria-pressed={st.displayMode === m.id} onClick={() => setSetting('displayMode', m.id)}>{m.label}</button>
        ))}
      </div>
      <div className={r.toolbar} data-testid="reading-toggles">
        <Toggle on={st.hlVocab} set={(v) => setSetting('hlVocab', v)} label="단어" title="핵심 단어 강조" />
        <Toggle on={st.hlGrammar} set={(v) => setSetting('hlGrammar', v)} label="문법" title="문법 강조" />
        <Toggle on={st.showSlashes} set={(v) => setSetting('showSlashes', v)} label="끊어읽기 /" title="끊어 읽기 표시" />
        <details className={r.fontMenu}>
          <summary className={`${s.chip} ${r.tchip}`} style={{ listStyle: 'none' }} title="글자 크기·줄 간격·글꼴">Aa</summary>
          <div className={s.card} style={{ position: 'absolute', zIndex: 30, marginTop: 4, width: 260, right: 0 }}>
            <div className={s.row}>
              {[0, 1, 2, 3].map((n) => (
                <button key={n} type="button" className={s.chip} aria-pressed={st.fontSize === n} onClick={() => setSetting('fontSize', n as 0 | 1 | 2 | 3)}
                  aria-label={`글자 크기 ${n + 1}단계`} style={{ fontSize: 13 + n * 3 }}>가</button>
              ))}
            </div>
            <label className={s.label} style={{ marginTop: 8 }}>줄 간격 {st.lineHeight.toFixed(1)}
              <input className={s.range} type="range" min={1.4} max={2.4} step={0.1} value={st.lineHeight} onChange={(e) => setSetting('lineHeight', Number(e.target.value))} />
            </label>
            <div className={s.seg}>
              <button type="button" className={s.segBtn} aria-pressed={st.serif} onClick={() => setSetting('serif', true)} style={{ fontFamily: 'var(--serif)' }}>세리프</button>
              <button type="button" className={s.segBtn} aria-pressed={!st.serif} onClick={() => setSetting('serif', false)}>산세리프</button>
            </div>
          </div>
        </details>
      </div>
      <p className={s.small + ' ' + s.muted} style={{ marginTop: 0 }}>단어 누르기 → 뜻 · 문장 길게 누르기 → 메뉴</p>

      <article className={`${s.reading} ${st.serif ? '' : s.sansReading}`} lang="en" data-testid="full-text">
        {(() => {
          const Wrap = numbered ? 'ol' : 'div';
          return <Wrap style={numbered ? { paddingLeft: '1.6em', margin: 0 } : undefined}>
        {lesson.paragraphs.map((p) => {
          const Item = numbered ? 'li' : 'div';
          return (
          <Item key={p.id}>
            <p className={r.para} data-paragraph={p.id}>
              {p.sentences.map((sen, i) => {
                const mark = marks?.find((m) => m.sentenceId === sen.id);
                return (
                  <span key={sen.id}>
                    {i > 0 && showEn && st.displayMode !== 'both-sentence' ? ' ' : null}
                    {hidden.has(sen.id) ? (
                      <span className={r.sentence} data-hidden-sentence={sen.id} title="문제를 풀면 공개돼요">
                        {(() => { const q = lesson.questions.find((x) => x.blank?.sentenceId === sen.id)!; return showEn ? blankedSentence(sen.en, q.blank!.answerText) : '(문제를 풀면 공개)'; })()}
                      </span>
                    ) : showEn ? (
                      <SentenceSpan sentence={sen} current={playingHere && player.currentSentenceId === sen.id}
                        bookmarked={!!mark?.bookmark} hard={!!mark?.hard} onLong={() => setMenu(sen)}>
                        <SentenceText sentence={sen} vocab={st.hlVocab ? vocabOf(lesson, sen.id) : []}
                          grammar={st.hlGrammar ? grammarOf(lesson, sen.id) : []} structure={structureOf(lesson, sen.id)} slashes={st.showSlashes}
                          onWord={(w, v, gid) => { const vv = v ?? findVocab(lesson.vocab, sen.id, w); autoSpeakWord(vv?.term ?? w); setPopup({ word: w, vocab: vv, gloss: lesson.glossary[wordKey(w)], sentence: sen.en, grammarId: st.hlGrammar ? gid : undefined, sentenceId: sen.id }); }} />
                      </SentenceSpan>
                    ) : (
                      <>{i > 0 ? ' ' : null}{renderKo(sen.id, sen.ko, '')}</>
                    )}
                    {mark?.memo && showEn && <span className={r.memo}>📝 {mark.memo}</span>}
                    {st.displayMode === 'both-sentence' && !hidden.has(sen.id) && renderKo(sen.id, sen.ko, r.koLine)}
                  </span>
                );
              })}
            </p>
            {st.displayMode === 'both-paragraph' && !p.sentences.some((x) => hidden.has(x.id)) && <p className={r.koPara}>{renderKo(p.id, p.ko, '')}</p>}
          </Item>
          );
        })}
          </Wrap>;
        })()}
      </article>
      <div ref={endRef} aria-hidden="true" style={{ height: 1 }} />
      <Source lesson={lesson} />

      {popup && <WordPopup word={popup.word} vocab={popup.vocab} gloss={popup.gloss} sentence={popup.sentence} lessonKey={lessonKey} onClose={() => setPopup(null)}
        grammar={popup.grammarId ? lesson.grammar.find((g) => g.id === popup.grammarId) : undefined} grammarLink={`/${lesson.track}/lesson/${lesson.id}/structure?s=${popup.sentenceId}`} />}
      {menu && <SentenceMenu lesson={lesson} lessonKey={lessonKey} sentence={menu} mark={marks?.find((m) => m.sentenceId === menu.id)} onClose={() => setMenu(null)} />}
    </div>
  );
}

function findVocab(vocab: Vocab[], sid: string, word: string): Vocab | undefined {
  const w = word.toLowerCase();
  return vocab.find((v) => v.sentenceId === sid && v.matchText.toLowerCase().split(/\s+/).includes(w));
}

function SentenceSpan({ sentence, current, bookmarked, hard, onLong, children }: { sentence: Sentence; current: boolean; bookmarked: boolean; hard: boolean; onLong: () => void; children: React.ReactNode }) {
  const lp = useLongPress(onLong);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (current) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [current]);
  return (
    <span ref={ref} className={[r.sentence, current ? r.current : '', bookmarked ? r.bookmarked : '', hard ? r.hard : ''].join(' ')}
      data-sentence={sentence.id} tabIndex={0} aria-label={undefined} {...lp}>
      {children}
    </span>
  );
}

export function Toggle({ on, set, label, title }: { on: boolean; set: (v: boolean) => void; label: string; title?: string }) {
  return (
    <button type="button" className={`${s.chip} ${r.tchip}`} aria-pressed={on} onClick={() => set(!on)} title={title}>
      {on ? '✓' : ''}{label}
    </button>
  );
}

export function Source({ lesson }: { lesson: TabProps['lesson'] }) {
  const src = lesson.source;
  return (
    <footer className={s.small + ' ' + s.muted} style={{ marginTop: 24, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
      {lesson.track === 'toeic' ? (
        <p>AI 작성 연습 지문 · 토익 스타일 연습용으로 새로 쓴 글이며 실제 시험 지문이 아닙니다.</p>
      ) : (
        <p>
          출처: {[src.author, src.work, src.translator && `tr. ${src.translator}`, src.year].filter(Boolean).join(', ')} · {src.license === 'us-government-work' ? '미국 정부 저작물' : '퍼블릭 도메인'}
          {src.url && <> · <a href={src.url} target="_blank" rel="noreferrer">원문</a></>}
          {src.edition ? ` · ${src.edition}` : ''}
          {src.excerptNote ? ` · ${src.excerptNote}` : ''}
          {lesson.audio?.librivoxUrl && <> · 낭독: <a href={lesson.audio.librivoxUrl} target="_blank" rel="noreferrer">LibriVox</a></>}
        </p>
      )}
    </footer>
  );
}
