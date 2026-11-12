import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import s from '../../styles/ui.module.css';
import st from '../../styles/structure.module.css';
import type { TabProps } from './LessonPage';
import { flatSentences, grammarOf, structureOf, vocabOf } from '../../lib/lessonUtils';
import type { Chunk, Role } from '../../lib/types';
import { GrammarCard } from '../../components/GrammarCard';
import { db } from '../../lib/db';
import { SpeakBtn } from '../../components/SentenceView';

export const ROLE_NAME: Record<Role, string> = { S: '주어', V: '동사', O: '목적어', C: '보어', M: '수식어', CONJ: '접속사' };
export const roleLabel = (c: Pick<Chunk, 'role' | 'sub'>) => (c.sub && c.role !== 'CONJ' ? `${c.role}′` : c.role);
export const isCore = (c: Chunk) => !c.sub && c.role !== 'M';

export function Legend() {
  return (
    <div className={st.legend} aria-label="역할 범례">
      {(Object.keys(ROLE_NAME) as Role[]).map((r) => (
        <span key={r} className={st['r_' + r]}><b className={st.role}>{r}</b><span style={{ color: 'var(--text)' }}>{ROLE_NAME[r]}</span></span>
      ))}
      <span><b className={st.role}>S′</b> 종속절 성분</span>
    </div>
  );
}

export function ChunkLine({ chunks, dimNonCore }: { chunks: Chunk[]; dimNonCore?: boolean }) {
  return (
    <div className={st.chunks} lang="en" data-testid="chunks">
      {chunks.map((c, i) => (
        <span key={i} className={`${st.chunk} ${st['r_' + c.role]} ${dimNonCore && !isCore(c) ? st.dim : ''}`} data-role={roleLabel(c)}>
          <span className={st.chunkText}>{c.text}</span>
          <b className={st.role} aria-label={`${ROLE_NAME[c.role]}${c.sub ? '(종속절)' : ''}`} data-testid="role-label">{roleLabel(c)}</b>
        </span>
      ))}
    </div>
  );
}

export function StructureTab({ lesson, lessonKey }: TabProps) {
  const sents = flatSentences(lesson);
  const [params, setParams] = useSearchParams();
  const firstStruct = lesson.structures[0]?.sentenceId ?? sents[0].id;
  const sid = params.get('s') && sents.some((x) => x.id === params.get('s')) ? params.get('s')! : firstStruct;
  const sen = sents.find((x) => x.id === sid)!;
  const structure = structureOf(lesson, sid);
  const grammar = grammarOf(lesson, sid);
  const vocab = vocabOf(lesson, sid);
  const [skeleton, setSkeleton] = useState(false);
  const [stepMode, setStepMode] = useState(false);
  const [opened, setOpened] = useState(0);
  const gstates = useLiveQuery(() => db.grammarState.where('lessonKey').equals(lessonKey).toArray(), [lessonKey]);
  const idx = sents.findIndex((x) => x.id === sid);

  const select = (id: string) => {
    setParams({ s: id }, { replace: true });
    setOpened(0);
  };
  const structIds = lesson.structures.map((x) => x.sentenceId);
  const nav = (dir: number) => {
    const list = structIds.length ? structIds : sents.map((x) => x.id);
    const cur = list.indexOf(sid);
    const next = list[(cur + dir + list.length) % list.length];
    select(next);
  };

  return (
    <div>
      <div className={st.picker} role="listbox" aria-label="문장 고르기">
        {sents.map((x, i) => (
          <button key={x.id} type="button" role="option" className={s.chip} aria-selected={x.id === sid} onClick={() => select(x.id)}>
            {i + 1}{structIds.includes(x.id) ? ' 🧩' : ''}
          </button>
        ))}
      </div>
      <p className={s.small + ' ' + s.muted} style={{ margin: '0 0 6px' }}>🧩 = 구조 분석 있음 · 문장 {idx + 1}/{sents.length}</p>

      {structure ? (
        <>
          <Legend />
          <section className={s.card} aria-label="구조 분석">
            <div className={s.between}><b>원문 조각</b><SpeakBtn text={sen.en} label="문장 듣기" /></div>
            <ChunkLine chunks={structure.chunks} dimNonCore={skeleton} />
          </section>

          <section className={s.card} style={{ marginTop: 10 }} aria-label="직독직해">
            <div className={s.between}>
              <b>직독직해</b>
              <label className={s.check} style={{ minHeight: 36 }}>
                <input type="checkbox" checked={stepMode} onChange={(e) => { setStepMode(e.target.checked); setOpened(0); }} />
                <span className={s.small}>한 조각씩 열기</span>
              </label>
            </div>
            <div className={st.direct}>
              {structure.chunks.map((c, i) => {
                const open = !stepMode || i < opened;
                return (
                  <button key={i} type="button" className={st.directItem} data-open={open} disabled={open && stepMode}
                    onClick={() => stepMode && setOpened(Math.max(opened, i + 1))} aria-label={open ? `${c.text}: ${c.ko}` : `${i + 1}번째 조각 뜻 열기`}>
                    <small style={{ color: open ? undefined : 'transparent' }}>{c.text}</small>
                    {open ? c.ko : '?'}
                  </button>
                );
              })}
            </div>
            {stepMode && opened < structure.chunks.length && (
              <button type="button" className={s.primary + ' ' + s.full} style={{ marginTop: 8 }} onClick={() => setOpened(opened + 1)}>다음 조각 뜻 열기</button>
            )}
            <p className={s.ko} style={{ marginBottom: 0 }}>{sen.ko}</p>
          </section>

          <section className={s.card} style={{ marginTop: 10 }} aria-label="뼈대">
            <div className={s.between}>
              <b>문장 뼈대</b>
              <button type="button" className={s.chip} aria-pressed={skeleton} onClick={() => setSkeleton(!skeleton)} data-testid="skeleton-toggle">
                {skeleton ? '✓ ' : ''}뼈대만 보기
              </button>
            </div>
            {skeleton && <p className={st.skeleton} lang="en" data-testid="skeleton">{structure.skeleton}</p>}
            <p style={{ marginBottom: 0 }}>{structure.explanationKo}</p>
          </section>
        </>
      ) : (
        <section className={s.card}>
          <p className={s.small + ' ' + s.muted} style={{ marginTop: 0 }}>이 문장은 구조 분석이 없어요.</p>
          <p className={s.reading} lang="en" style={{ margin: '0 0 6px' }}>{sen.en}</p>
          <p className={s.ko}>{sen.ko}</p>
          {vocab.length > 0 && (
            <ul className={s.small}>{vocab.map((v) => <li key={v.id}><b lang="en">{v.term}</b> {v.meaningKo}</li>)}</ul>
          )}
        </section>
      )}

      {grammar.length > 0 && (
        <>
          <h2 className={s.h2}>이 문장의 문법</h2>
          <ul className={s.list}>
            {grammar.map((g) => <GrammarCard key={g.id} lesson={lesson} g={g} lessonKey={lessonKey} state={gstates?.find((x) => x.grammarId === g.id)} />)}
          </ul>
        </>
      )}
      <div className={s.bottomBar}>
        <button type="button" className={s.btn + ' ' + s.big + ' ' + s.grow} onClick={() => nav(-1)}>‹ 이전 문장</button>
        <button type="button" className={s.btn + ' ' + s.big + ' ' + s.grow} onClick={() => nav(1)}>다음 문장 ›</button>
      </div>
    </div>
  );
}
