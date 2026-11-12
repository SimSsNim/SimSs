import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import s from '../styles/ui.module.css';
import { CHECKLIST } from '../lib/checklist';
import { db } from '../lib/db';
import { setChecklist } from '../lib/progress';

/** 이야기 레슨: 탭 줄 아래 '학습 순서' 가로 스크롤 줄. 이름을 누르면 그 탭으로, 네모를 누르면 체크 */
export function LessonSteps({ lessonKey, track, id, tab }: { lessonKey: string; track: string; id: string; tab?: string }) {
  const nav = useNavigate();
  const prog = useLiveQuery(() => db.lessonProgress.get(lessonKey), [lessonKey]);
  const list: Partial<Record<string, boolean>> = prog?.checklist ?? {};
  const done = CHECKLIST.filter((c) => list[c.key]).length;
  return (
    <div className={s.chips} role="group" aria-label={`학습 순서 ${done}/6`} data-testid="lesson-steps" style={{ maxWidth: 760, margin: '0 auto', paddingTop: 0, alignItems: 'center' }}>
      <span className={s.small + ' ' + s.muted} style={{ flex: 'none', fontWeight: 700 }}>순서 {done}/6</span>
      {CHECKLIST.map((c, i) => {
        const on = !!list[c.key];
        const here = c.tab === tab;
        return (
          <span key={c.key} className={s.chip} title={c.hint} style={{ flex: 'none', padding: 0, gap: 0, overflow: 'hidden', borderColor: here ? 'var(--accent)' : undefined, minHeight: 36 }}>
            <button type="button" role="checkbox" aria-checked={on} aria-label={`${c.label} 완료`} data-testid={`step-check-${c.key}`}
              onClick={() => void setChecklist(lessonKey, c.key, !on)}
              style={{ border: 0, background: on ? 'var(--accent)' : 'transparent', color: on ? 'var(--surface)' : 'var(--muted)', minWidth: 32, minHeight: 36, cursor: 'pointer', fontWeight: 800 }}>
              {on ? '✓' : '☐'}
            </button>
            <button type="button" data-testid={`step-${c.key}`} aria-current={here ? 'step' : undefined}
              onClick={() => nav(`/${track}/lesson/${id}/${c.tab}`, { replace: true })}
              style={{ border: 0, background: 'transparent', color: here ? 'var(--accent)' : 'inherit', fontWeight: here ? 800 : 600, padding: '0 10px 0 6px', minHeight: 36, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {'①②③④⑤⑥'[i]} {c.label}
            </button>
          </span>
        );
      })}
    </div>
  );
}
