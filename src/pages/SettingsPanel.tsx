import s from '../styles/ui.module.css';
import { useSettings, setSetting, type Theme, type DisplayMode, type Accent } from '../lib/settings';
import { ACCENTS, useVoices, speak } from '../lib/tts';
import { LevelChips } from '../components/LevelChips';
import { TRACKS, TRACK_LABEL } from '../lib/types';

export function SettingsPanel() {
  const st = useSettings();
  const voices = useVoices();
  const accentVoices = voices.byAccent[st.ttsAccent] ?? [];
  return (
    <div className={s.stack}>
      <section className={s.card + ' ' + s.stack}>
        <b>내 레벨</b>
        {TRACKS.map((t) => (
          <div key={t}><div className={s.small} style={{ marginBottom: 4 }}>{TRACK_LABEL[t]}</div><LevelChips track={t} label={`${TRACK_LABEL[t]} 레벨`} /></div>
        ))}
        <label className={s.label}>토익 문제 기본 모드
          <select className={s.select} value={st.quizMode} onChange={(e) => setSetting('quizMode', e.target.value as 'practice' | 'exam')}>
            <option value="practice">연습 모드(한 문제씩 바로 채점)</option><option value="exam">실전 모드(타이머, 끝나고 한꺼번에 채점)</option>
          </select>
        </label>
      </section>
      <section className={s.card + ' ' + s.stack}>
        <b>화면</b>
        <div className={s.seg} role="group" aria-label="테마">
          {([['system', '시스템'], ['light', '라이트'], ['dark', '다크']] as [Theme, string][]).map(([v, l]) => (
            <button key={v} type="button" className={s.segBtn} aria-pressed={st.theme === v} onClick={() => setSetting('theme', v)} data-testid={`theme-${v}`}>{l}</button>
          ))}
        </div>
        <label className={s.label}>글자 크기 {st.fontSize + 1}단계
          <input className={s.range} type="range" min={0} max={3} step={1} value={st.fontSize} onChange={(e) => setSetting('fontSize', Number(e.target.value) as 0 | 1 | 2 | 3)} />
        </label>
        <label className={s.label}>줄 간격 {st.lineHeight.toFixed(1)}
          <input className={s.range} type="range" min={1.4} max={2.4} step={0.1} value={st.lineHeight} onChange={(e) => setSetting('lineHeight', Number(e.target.value))} />
        </label>
        <label className={s.check}><input type="checkbox" checked={st.serif} onChange={(e) => setSetting('serif', e.target.checked)} />영어 본문 세리프 글꼴</label>
        <label className={s.label}>기본 표시 모드
          <select className={s.select} value={st.displayMode} onChange={(e) => setSetting('displayMode', e.target.value as DisplayMode)}>
            <option value="en">영어만</option><option value="ko">한글만</option><option value="both-sentence">영어+한글(문장마다)</option><option value="both-paragraph">영어+한글(단락 뒤)</option>
          </select>
        </label>
      </section>

      <section className={s.card + ' ' + s.stack}>
        <b>음성(TTS)</b>
        {!voices.supported ? <p className={s.muted + ' ' + s.small}>이 기기에서 영어 음성을 찾지 못했어요. TTS 버튼은 숨겨져요.</p> : (
          <>
            <div className={s.row}>
              {ACCENTS.map((a) => (
                <button key={a.id} type="button" className={s.chip} aria-pressed={st.ttsAccent === a.id} disabled={!voices.byAccent[a.id]?.length}
                  onClick={() => { setSetting('ttsAccent', a.id as Accent); setSetting('ttsVoiceURI', ''); }}>{a.label}</button>
              ))}
            </div>
            <label className={s.label}>음성
              <select className={s.select} value={st.ttsVoiceURI} onChange={(e) => setSetting('ttsVoiceURI', e.target.value)}>
                <option value="">자동</option>
                {accentVoices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
              </select>
            </label>
            <label className={s.label}>속도 {st.ttsRate.toFixed(2)}×
              <input className={s.range} type="range" min={0.5} max={1.5} step={0.05} value={st.ttsRate} onChange={(e) => setSetting('ttsRate', Number(e.target.value))} />
            </label>
            <label className={s.check}><input type="checkbox" checked={st.ttsRotateAccent} onChange={(e) => setSetting('ttsRotateAccent', e.target.checked)} />문장마다 억양 바꾸기</label>
            <button type="button" className={s.btn} onClick={() => void speak('Thank you for your interest in the workshop.', { rate: st.ttsRate, accent: st.ttsAccent, voiceURI: st.ttsVoiceURI })}>🔊 들어 보기</button>
          </>
        )}
      </section>

      <section className={s.card + ' ' + s.stack}>
        <b>자동 넘김 기본값</b>
        <label className={s.label}>한 문장씩: 단어당 {st.autoPerWordSec.toFixed(1)}초
          <input className={s.range} type="range" min={0.4} max={1.5} step={0.1} value={st.autoPerWordSec} onChange={(e) => setSetting('autoPerWordSec', Number(e.target.value))} />
        </label>
        <label className={s.label}>플래시카드 앞면 {st.flashFrontSec.toFixed(1)}초
          <input className={s.range} type="range" min={1} max={10} step={0.5} value={st.flashFrontSec} onChange={(e) => setSetting('flashFrontSec', Number(e.target.value))} />
        </label>
        <label className={s.label}>플래시카드 뒷면 {st.flashBackSec.toFixed(1)}초
          <input className={s.range} type="range" min={1} max={10} step={0.5} value={st.flashBackSec} onChange={(e) => setSetting('flashBackSec', Number(e.target.value))} />
        </label>
      </section>

      <section className={s.card + ' ' + s.stack}>
        <b>음원·필사</b>
        <label className={s.label}>음원 품질
          <select className={s.select} value={st.audioQuality} onChange={(e) => setSetting('audioQuality', e.target.value as 'auto')}>
            <option value="auto">자동(모바일 데이터면 저용량)</option><option value="high">항상 고음질</option><option value="low">항상 저용량</option>
          </select>
        </label>
        <label className={s.check}><input type="checkbox" checked={st.typingIgnoreCase} onChange={(e) => setSetting('typingIgnoreCase', e.target.checked)} />타이핑: 대소문자 무시</label>
        <label className={s.check}><input type="checkbox" checked={st.typingIgnorePunct} onChange={(e) => setSetting('typingIgnorePunct', e.target.checked)} />타이핑: 구두점 무시</label>
      </section>

      <section className={s.card + ' ' + s.stack}>
        <b>하루 목표</b>
        <label className={s.label}>학습 시간 {st.dailyGoalMinutes}분
          <input className={s.range} type="range" min={5} max={60} step={5} value={st.dailyGoalMinutes} onChange={(e) => setSetting('dailyGoalMinutes', Number(e.target.value))} />
        </label>
        <label className={s.label}>레슨 수 {st.dailyGoalLessons}개
          <input className={s.range} type="range" min={1} max={4} step={1} value={st.dailyGoalLessons} onChange={(e) => setSetting('dailyGoalLessons', Number(e.target.value))} />
        </label>
      </section>
    </div>
  );
}
