import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import s from '../styles/ui.module.css';
import { exportBackup, importBackup, parseBackup } from '../lib/backup';
import { useSettings, setSetting, loadSettings } from '../lib/settings';
import { importLessonTexts, importSummaryText, useLessons, removeImported, loadLessons, type ImportResult } from '../lib/lessons';
import { db } from '../lib/db';
import { download } from './lesson/ListenTab';
import { toast } from '../components/Toast';
import { kstDate } from '../lib/date';
import { savedAudioList, deleteAudio, formatBytes } from '../lib/audioCache';
import { useEffect } from 'react';

export function BackupPanel() {
  const st = useSettings();
  const [mode, setMode] = useState<'merge' | 'overwrite'>('merge');
  const [msg, setMsg] = useState('');
  const [audio, setAudio] = useState<{ url: string; size: number }[]>([]);
  const refreshAudio = () => void savedAudioList().then(setAudio).catch(() => setAudio([]));
  useEffect(refreshAudio, []);
  const doExport = async () => {
    const b = await exportBackup();
    download(`pilsa-backup-${kstDate()}.json`, JSON.stringify(b));
    setSetting('lastBackupAt', Date.now());
    toast('백업 파일을 저장했어요');
  };
  const doImport = async (file: File) => {
    try {
      const b = parseBackup(await file.text());
      if (mode === 'overwrite' && !confirm('지금 기록을 모두 지우고 백업으로 바꿀까요?')) return;
      await importBackup(b, mode);
      await loadSettings();
      await loadLessons();
      setMsg(`복원했어요 (${b.exportedAt.slice(0, 10)} 백업, ${mode === 'merge' ? '합치기' : '덮어쓰기'})`);
    } catch (e) {
      setMsg(`복원 실패: ${(e as Error).message}`);
    }
  };
  return (
    <div className={s.stack}>
      <section className={s.card + ' ' + s.stack}>
        <b>백업 / 복원</b>
        <p className={s.small + ' ' + s.muted} style={{ margin: 0 }}>학습 기록은 이 기기 안에만 있어요. 가끔 파일로 내보내 두세요. 마지막 백업: {st.lastBackupAt ? new Date(st.lastBackupAt).toLocaleString('ko-KR') : '없음'}</p>
        <button type="button" className={s.primary} onClick={() => void doExport()}>⬇ 백업 파일 내보내기</button>
        <div className={s.seg} role="group" aria-label="가져오기 방식">
          <button type="button" className={s.segBtn} aria-pressed={mode === 'merge'} onClick={() => setMode('merge')}>합치기</button>
          <button type="button" className={s.segBtn} aria-pressed={mode === 'overwrite'} onClick={() => setMode('overwrite')}>덮어쓰기</button>
        </div>
        <label className={s.btn}>⬆ 백업 파일 가져오기
          <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && void doImport(e.target.files[0])} />
        </label>
        {msg && <p role="status">{msg}</p>}
      </section>
      <section className={s.card + ' ' + s.stack}>
        <b>저장한 음원</b>
        {audio.length === 0 ? <p className={s.small + ' ' + s.muted} style={{ margin: 0 }}>없음</p> : audio.map((a) => (
          <div key={a.url} className={s.row} style={{ flexWrap: 'nowrap' }}>
            <span className={s.grow + ' ' + s.small} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.url.split('/').pop()}</span>
            <span className={s.small}>{formatBytes(a.size)}</span>
            <button type="button" className={s.danger} onClick={async () => { await deleteAudio(a.url); refreshAudio(); }}>삭제</button>
          </div>
        ))}
        {audio.length > 0 && <p className={s.small} style={{ margin: 0 }}>합계 {formatBytes(audio.reduce((x, a) => x + a.size, 0))}</p>}
      </section>
    </div>
  );
}

export function ResetPanel() {
  return (
    <section className={s.card + ' ' + s.stack} style={{ marginTop: 10 }}>
      <b>데이터 초기화</b>
      <p className={s.small + ' ' + s.muted} style={{ margin: 0 }}>모든 학습 기록·설정·가져온 레슨·녹음이 지워져요. 먼저 백업하세요.</p>
      <button type="button" className={s.danger} onClick={async () => {
        if (!confirm('정말 모든 학습 기록을 지울까요?')) return;
        if (!confirm('되돌릴 수 없어요. 한 번 더 확인할게요. 지울까요?')) return;
        await Promise.all(db.tables.map((t) => t.clear()));
        location.reload();
      }}>모든 데이터 지우기</button>
    </section>
  );
}

/** 공부 기록 초기화: 항목을 골라서 지운다(설정·레슨·백업 시각은 그대로) */
const STUDY_ITEMS = [
  { id: 'progress', label: '학습 진행', hint: '오늘의 학습 순서 체크, 마지막으로 본 탭·문장', tables: ['lessonProgress'] },
  { id: 'words', label: '단어 학습 상태', hint: '알아요/몰라요/헷갈려요, 단어 ★, 단어 복습 일정', tables: ['wordState'] },
  { id: 'myWords', label: '내가 추가한 단어', hint: '직접 넣은 단어', tables: ['myWords'] },
  { id: 'quiz', label: '토익 문제 풀이 기록', hint: '점수·시도·걸린 시간, 레벨 추천 닫기', tables: ['quizAttempt', 'dismissedTips'] },
  { id: 'wrong', label: '오답노트', hint: '틀린 문제, 헷갈림, 문제 ★, 오답 복습 일정', tables: ['questionState'] },
  { id: 'sentences', label: '문장 북마크·메모', hint: '🔖 북마크, 어려움 표시, 메모', tables: ['sentenceMarks'] },
  { id: 'grammar', label: '문법 표시', hint: '이해함/다시 볼래요, 문법 ★', tables: ['grammarState'] },
  { id: 'practice', label: '연습 기록', hint: '타이핑·받아쓰기 등 점수', tables: ['practiceLog'] },
  { id: 'daily', label: '학습 시간·캘린더', hint: '하루 학습 시간, 연속 학습일', tables: ['dailyLog'] },
  { id: 'recordings', label: '녹음', hint: '섀도잉 녹음 파일', tables: ['recordings'] },
  { id: 'ink', label: '손글씨', hint: '화면 위 메모, 손글씨 필사', tables: ['inkNotes'] },
  { id: 'favFolders', label: '즐겨찾기 폴더', hint: '폴더와 폴더 나누기(즐겨찾기 표시는 남고 모두 기본 폴더로)', tables: ['favFolders', 'favAssign'] },
] as const;

export function StudyResetPanel() {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const counts = useLiveQuery(async () => {
    const out: Record<string, number> = {};
    for (const it of STUDY_ITEMS) {
      let n = 0;
      for (const tb of it.tables) n += await db.table(tb).count();
      out[it.id] = n;
    }
    return out;
  }, []);
  const toggle = (id: string) => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSel(next);
  };
  const allOn = sel.size === STUDY_ITEMS.length;
  const run = async () => {
    const picked = STUDY_ITEMS.filter((it) => sel.has(it.id));
    if (!picked.length) return;
    if (!confirm(`${picked.map((x) => x.label).join(', ')}\n\n이 항목들을 지울까요? 되돌릴 수 없어요. (먼저 백업을 권해요)`)) return;
    setBusy(true);
    try {
      const tables = [...new Set(picked.flatMap((x) => [...x.tables]))];
      await db.transaction('rw', tables.map((n) => db.table(n)), async () => {
        for (const n of tables) await db.table(n).clear();
      });
      setSel(new Set());
      toast(`${picked.length}개 항목을 초기화했어요`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className={s.card} data-testid="study-reset" style={{ padding: 0 }}>
      <summary style={{ padding: '12px 14px', cursor: 'pointer', fontWeight: 700, minHeight: 44 }}>🗑 공부 기록 초기화</summary>
      <div className={s.stack} style={{ padding: '0 14px 14px' }}>
        <p className={s.small + ' ' + s.muted} style={{ margin: 0 }}>지울 항목을 고르세요. 설정과 레슨은 그대로예요. 지우기 전에 <Link to="/records/backup">백업</Link>을 권해요.</p>
        <div className={s.row}>
          <button type="button" className={s.chip} onClick={() => setSel(new Set(STUDY_ITEMS.map((x) => x.id)))} aria-pressed={allOn} data-testid="reset-all">전체 선택</button>
          <button type="button" className={s.chip} onClick={() => setSel(new Set())} disabled={!sel.size} data-testid="reset-none">전체 해제</button>
          <span className={s.small + ' ' + s.muted}>{sel.size}개 선택</span>
        </div>
        <ul className={s.list} style={{ gap: 4 }}>
          {STUDY_ITEMS.map((it) => (
            <li key={it.id}>
              <label className={s.check} style={{ alignItems: 'flex-start' }}>
                <input type="checkbox" checked={sel.has(it.id)} onChange={() => toggle(it.id)} data-testid={`reset-${it.id}`} />
                <span>
                  <b>{it.label}</b> <span className={s.small + ' ' + s.muted}>{counts ? `${counts[it.id]}개` : ''}</span>
                  <br /><span className={s.small + ' ' + s.muted}>{it.hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <button type="button" className={s.danger} disabled={!sel.size || busy} onClick={() => void run()} data-testid="reset-run">
          {busy ? '지우는 중…' : `선택한 ${sel.size}개 초기화`}
        </button>
      </div>
    </details>
  );
}

export function ImportPanel() {
  const [text, setText] = useState('');
  const [results, setResults] = useState<ImportResult[]>([]);
  const { summaries } = useLessons();
  const imported = summaries.filter((x) => x.source === 'import');
  const run = async (files: { name: string; text: string }[]) => {
    const r = await importLessonTexts(files);
    setResults(r);
    const ok = r.filter((x) => x.ok).length;
    if (ok) toast(`${ok}개 레슨을 가져왔어요`);
  };
  return (
    <div className={s.stack}>
      <section className={s.card + ' ' + s.stack}>
        <b>레슨 가져오기</b>
        <p className={s.small + ' ' + s.muted} style={{ margin: 0 }}>자동 갱신이 안 될 때 쓰는 예비 경로예요. 트랙은 파일 안의 track 으로 정해지고, 같은 레슨이 저장소에 있으면 저장소 것을 써요.</p>
        <label className={s.btn}>📄 JSON 파일 고르기(여러 개 가능)
          <input type="file" accept="application/json,.json" multiple className="sr-only" data-testid="import-file"
            onChange={async (e) => {
              const files = [...(e.target.files ?? [])];
              void run(await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() }))));
              e.target.value = '';
            }} />
        </label>
        <textarea className={s.textarea} value={text} onChange={(e) => setText(e.target.value)} placeholder="또는 레슨 JSON을 여기에 붙여넣기" aria-label="레슨 JSON 붙여넣기" data-testid="import-text" />
        <button type="button" className={s.primary} disabled={!text.trim()} onClick={() => void run([{ name: '붙여넣기', text }])} data-testid="import-run">검증하고 가져오기</button>
        {results.length > 1 && <p role="status" data-testid="import-summary" style={{ fontWeight: 700, margin: 0 }}>{importSummaryText(results)}</p>}
        {results.map((r, i) => (
          <div key={i} className={s.card} role="status" data-testid="import-result">
            <div className={s.row}>
              {r.ok ? <span className={s.badgeOk}>통과</span> : <span className={s.badgeDanger}>오류</span>}
              <b>{r.name}</b> {r.key && <span className={s.muted}>{r.key}</span>}
            </div>
            {r.shadowed && <p className={s.small}>저장소에 같은 레슨이 있어 저장소 것을 계속 써요.</p>}
            {!r.ok && <ul className={s.small}>{r.errors.map((e, k) => <li key={k} style={{ whiteSpace: 'pre-wrap' }}>{e}</li>)}</ul>}
          </div>
        ))}
      </section>
      {imported.length > 0 && (
        <section className={s.card + ' ' + s.stack}>
          <b>가져온 레슨</b>
          {imported.map((x) => (
            <div key={x.key} className={s.row}>
              <span className={s.grow}>{x.key} · {x.title}</span>
              <button type="button" className={s.danger} onClick={() => void removeImported(x.key)}>삭제</button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
