import { useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import s from '../styles/ui.module.css';
import r from '../styles/reading.module.css';
import { segmentSentence } from '../lib/lessonUtils';
import type { GlossEntry, GrammarPoint, Lesson, Sentence, Structure, Vocab } from '../lib/types';
import { POS_KO } from '../lib/lessonAdapter';
import { getVoiceState, speak, useVoices } from '../lib/tts';
import { getSettings } from '../lib/settings';
import { addMyWord } from '../lib/words';
import { toggleSentenceMark, setMemo } from '../lib/marks';
import type { SentenceMarkRow } from '../lib/db';
import { getPlayer, playSentence } from '../store/player';
import { toast } from './Toast';

export function SentenceText(props: {
  sentence: Sentence;
  vocab?: Vocab[];
  grammar?: GrammarPoint[];
  structure?: Structure;
  slashes?: boolean;
  onWord?: (word: string, vocab?: Vocab) => void;
}) {
  const pieces = segmentSentence(props.sentence.en, props);
  return (
    <>
      {pieces.map((p, i) => {
        const cls = [p.vocabId ? s.hlVocab : '', p.grammarId ? s.hlGrammar : '', p.word && props.onWord ? r.word : '']
          .filter(Boolean).join(' ');
        // 끊어 읽기 '/' 는 하이라이트 밖, CSS 의사 요소로만 그린다(텍스트에는 안 들어감)
        const slash = p.slashBefore ? <span className={r.slash} aria-hidden="true" /> : null;
        if (!cls) return <span key={i}>{slash}{p.text}</span>;
        const v = p.vocabId ? props.vocab?.find((x) => x.id === p.vocabId) : undefined;
        return (
          <span key={i} style={{ display: 'contents' }}>{slash}<span className={cls} data-vocab={p.vocabId} data-grammar={p.grammarId}
            onClick={p.word && props.onWord ? (e) => { e.stopPropagation(); props.onWord!(p.word!, v); } : undefined}>
            {p.text}
          </span></span>
        );
      })}
    </>
  );
}

export function Sheet({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  return (
    <>
      <div className={s.backdrop} onClick={onClose} aria-hidden="true" />
      <div className={s.popover} role="dialog" aria-modal="true" aria-label={label}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        {children}
      </div>
    </>
  );
}

export function SpeakBtn({ text, label = '발음 듣기', rate }: { text: string; label?: string; rate?: number }) {
  const v = useVoices();
  if (!v.supported) return null;
  return (
    <button type="button" className={s.iconBtn} aria-label={label}
      onClick={(e) => { e.stopPropagation(); void speak(text, { rate: rate ?? getSettings().ttsRate, accent: getSettings().ttsAccent, voiceURI: getSettings().ttsVoiceURI }); }}>
      🔊
    </button>
  );
}

/** 단어 발음 읽기(설정의 억양·음성·속도). slow = 느리게 */
export function speakWord(text: string, slow = false) {
  const st = getSettings();
  void speak(text, { rate: slow ? Math.min(st.ttsRate, 1) * 0.6 : st.ttsRate, accent: st.ttsAccent, voiceURI: st.ttsVoiceURI });
}

/** 단어를 눌렀을 때 바로 한 번 읽기(설정에서 끌 수 있음). 듣기 재생 중이면 끊지 않으려고 읽지 않는다.
 *  iOS 는 탭 이벤트 안에서 시작한 음성만 허용하므로 클릭 핸들러에서 바로 부른다. */
export function autoSpeakWord(text: string) {
  if (getVoiceState().supported && getSettings().wordAutoSpeak && !getPlayer().playing) speakWord(text);
}

/** 네이버 영어사전 검색 주소(인터넷 연결 시 더 자세한 뜻·예문) */
export const dictUrl = (term: string) => `https://en.dict.naver.com/#/search?query=${encodeURIComponent(term)}`;

export function WordPopup({ word, vocab, gloss, sentence, lessonKey, onClose }: { word: string; vocab?: Vocab; gloss?: GlossEntry; sentence?: string; lessonKey: string; onClose: () => void }) {
  const [meaning, setMeaning] = useState(gloss?.ko ?? '');
  const [adding, setAdding] = useState(false);
  const voices = useVoices();
  const sayText = vocab?.term ?? word;
  const say = (text: string, slow = false) => speakWord(text, slow);
  return (
    <Sheet onClose={onClose} label={`단어 ${word}`}>
      <div className={s.between}>
        <div>
          <b style={{ fontSize: 20, fontFamily: 'var(--serif)' }}>{vocab?.term ?? word}</b>{' '}
          {vocab && <span className={s.muted}>{vocab.pos} {vocab.ipa && `[${vocab.ipa}]`}</span>}
          {!vocab && gloss && <span className={s.muted}>{POS_KO[gloss.pos] ?? gloss.pos}</span>}
        </div>
        <button type="button" className={s.iconBtn} onClick={onClose} aria-label="닫기" autoFocus>✕</button>
      </div>
      {voices.supported ? (
        <div className={s.row} style={{ marginTop: 4 }} data-testid="word-speak">
          <button type="button" className={s.btn} onClick={() => say(sayText)} aria-label={`${sayText} 발음 듣기`}>🔊 듣기</button>
          <button type="button" className={s.btn} onClick={() => say(sayText, true)} aria-label={`${sayText} 천천히 듣기`}>🐢 천천히</button>
          {!vocab && gloss && gloss.lemma.toLowerCase() !== word.toLowerCase() && !gloss.lemma.includes(' ') && (
            <button type="button" className={s.btn} onClick={() => say(gloss.lemma)} aria-label={`기본형 ${gloss.lemma} 발음 듣기`}>🔊 {gloss.lemma}</button>
          )}
        </div>
      ) : (
        <div className={s.small + ' ' + s.muted} style={{ marginTop: 4 }}>이 기기에서 영어 음성을 찾지 못해 발음을 들을 수 없어요.</div>
      )}
      {vocab ? (
        <div className={s.stack} style={{ marginTop: 6 }}>
          <div style={{ fontWeight: 700 }}>{vocab.meaningKo}</div>
          {vocab.synonyms?.length ? <div className={s.small}>유사 단어: {vocab.synonyms.join(', ')}</div> : null}
          {vocab.example && (
            <div className={s.small}>
              <div style={{ fontFamily: 'var(--serif)' }}>{vocab.example.en} <SpeakBtn text={vocab.example.en} label="예문 듣기" /></div>
              <div className={s.muted}>{vocab.example.ko}</div>
            </div>
          )}
        </div>
      ) : gloss && !adding ? (
        <div className={s.stack} style={{ marginTop: 6 }}>
          <div style={{ fontWeight: 700 }}>{gloss.ko}</div>
          {(gloss.form || gloss.lemma.toLowerCase() !== word.toLowerCase()) && (
            <div className={s.small + ' ' + s.muted}>
              기본형 <b style={{ fontFamily: 'var(--serif)' }}>{gloss.lemma}</b>{gloss.form ? ` · ${gloss.form}` : ''}
            </div>
          )}
          <div className={s.row}>
            <button type="button" className={s.btn} onClick={async () => {
              const term = gloss.pos === 'proper-noun' ? gloss.lemma : gloss.lemma.toLowerCase();
              await addMyWord({ term, meaningKo: gloss.ko, sentence, lessonKey });
              toast(`'${term}' 를 내 단어에 추가했어요`);
              onClose();
            }}>＋ 내 단어로 추가</button>
            <a className={s.ghost} href={dictUrl(gloss.lemma)} target="_blank" rel="noopener noreferrer">사전에서 더 보기 ↗</a>
          </div>
        </div>
      ) : adding ? (
        <form className={s.stack} style={{ marginTop: 8 }}
          onSubmit={async (e) => {
            e.preventDefault();
            await addMyWord({ term: word, meaningKo: meaning.trim(), sentence, lessonKey });
            toast(`'${word}' 를 내 단어에 추가했어요`);
            onClose();
          }}>
          <label className={s.label}>뜻(직접 입력)
            <input className={s.input} value={meaning} onChange={(e) => setMeaning(e.target.value)} autoFocus />
          </label>
          <button type="submit" className={s.primary}>추가</button>
        </form>
      ) : (
        <div className={s.row} style={{ marginTop: 8 }}>
          <span className={s.muted + ' ' + s.small}>이 레슨 파일에는 이 단어의 뜻 정보가 없어요.</span>
          <button type="button" className={s.btn} onClick={() => setAdding(true)}>＋ 내 단어로 추가</button>
          <a className={s.ghost} href={dictUrl(word)} target="_blank" rel="noopener noreferrer">사전에서 찾기 ↗</a>
        </div>
      )}
    </Sheet>
  );
}

export function SentenceMenu({ lesson, lessonKey, sentence, mark, onClose }: { lesson: Lesson; lessonKey: string; sentence: Sentence; mark?: SentenceMarkRow; onClose: () => void }) {
  const nav = useNavigate();
  const [memo, setMemoText] = useState(mark?.memo ?? '');
  const [editing, setEditing] = useState(false);
  return (
    <Sheet onClose={onClose} label="문장 메뉴">
      <p style={{ fontFamily: 'var(--serif)', marginTop: 0 }}>{sentence.en}</p>
      {editing ? (
        <form className={s.stack} onSubmit={async (e) => { e.preventDefault(); await setMemo(lessonKey, sentence.id, memo); onClose(); }}>
          <textarea className={s.textarea} value={memo} onChange={(e) => setMemoText(e.target.value)} aria-label="메모" autoFocus />
          <button type="submit" className={s.primary}>메모 저장</button>
        </form>
      ) : (
        <div className={s.stack}>
          <button type="button" className={s.btn} autoFocus onClick={() => { void toggleSentenceMark(lessonKey, sentence.id, 'bookmark'); onClose(); }}>
            🔖 {mark?.bookmark ? '북마크 해제' : '북마크'}
          </button>
          <button type="button" className={s.btn} onClick={() => setEditing(true)}>📝 메모{mark?.memo ? ' 수정' : ''}</button>
          <button type="button" className={s.btn} onClick={() => { void toggleSentenceMark(lessonKey, sentence.id, 'hard'); onClose(); }}>
            ⚠️ {mark?.hard ? '"어려운 문장" 해제' : '"어려운 문장" 표시'}
          </button>
          <button type="button" className={s.btn} onClick={() => { void playSentence(sentence); onClose(); }}>🔊 이 문장 듣기</button>
          <button type="button" className={s.btn} onClick={() => nav(`/${lesson.track}/lesson/${lesson.id}/structure?s=${sentence.id}`)}>🧩 문장+문법 탭에서 보기</button>
          <button type="button" className={s.ghost} onClick={onClose}>닫기</button>
        </div>
      )}
    </Sheet>
  );
}

/** 길게 누르기(500ms) + 오른쪽 클릭 + Enter 키 */
export function useLongPress(onLong: () => void) {
  const t = useRef<number | null>(null);
  const startPt = useRef<[number, number]>([0, 0]);
  const fired = useRef(false);
  const clear = () => {
    if (t.current) window.clearTimeout(t.current);
    t.current = null;
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      startPt.current = [e.clientX, e.clientY];
      fired.current = false;
      clear();
      t.current = window.setTimeout(() => { fired.current = true; onLong(); }, 500);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (Math.abs(e.clientX - startPt.current[0]) + Math.abs(e.clientY - startPt.current[1]) > 10) clear();
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); clear(); onLong(); },
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLong(); } },
    onClickCapture: (e: React.MouseEvent) => { if (fired.current) { e.stopPropagation(); e.preventDefault(); fired.current = false; } },
  };
}
