import { useState } from 'react';
import s from '../../styles/ui.module.css';
import type { TabProps } from './LessonPage';
import { PaperMode, TypingMode } from './practice/Transcribe';
import { DictationMode, BlankMode, ArrangeMode, TranslateMode, ShadowMode } from './practice/Exercises';

const MODES = [
  { id: 'paper', label: '종이 필사' },
  { id: 'typing', label: '타이핑 필사' },
  { id: 'dictation', label: '받아쓰기' },
  { id: 'blank', label: '빈칸 채우기' },
  { id: 'arrange', label: '문장 배열' },
  { id: 'translate', label: '해석 연습' },
  { id: 'shadow', label: '섀도잉' },
] as const;
type Mode = (typeof MODES)[number]['id'];

export function PracticeTab(props: TabProps) {
  const [mode, setMode] = useState<Mode>('paper');
  const shadowOk = typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia;
  return (
    <div>
      <div className={s.chips} role="tablist" aria-label="연습 종류">
        {MODES.filter((m) => m.id !== 'shadow' || shadowOk).map((m) => (
          <button key={m.id} type="button" role="tab" className={s.chip} aria-selected={mode === m.id} onClick={() => setMode(m.id)} data-testid={`practice-${m.id}`}>{m.label}</button>
        ))}
      </div>
      {mode === 'paper' && <PaperMode {...props} />}
      {mode === 'typing' && <TypingMode {...props} />}
      {mode === 'dictation' && <DictationMode {...props} />}
      {mode === 'blank' && <BlankMode {...props} />}
      {mode === 'arrange' && <ArrangeMode {...props} />}
      {mode === 'translate' && <TranslateMode {...props} />}
      {mode === 'shadow' && <ShadowMode {...props} />}
    </div>
  );
}
