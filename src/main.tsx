import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { App } from './App';
import { loadSettings, getSettings, setSetting, type Settings } from './lib/settings';
import { initTTS, onSpeechSilent } from './lib/tts';
import { loadLessons } from './lib/lessons';
import { startTimeTracking } from './lib/progress';
import { toast } from './components/Toast';

/** 우선순위 설정: 앱을 처음 열 때(특정 화면 주소 없이 열 때)만 시작 트랙·레벨을 맞춘다. 새로고침은 그대로 둔다 */
function applyStartPriority(st: Settings) {
  if (!['', '#', '#/'].includes(location.hash)) return;
  if (st.startTrack === 'all') setSetting('homeAll', true);
  else if (st.startTrack !== 'last') {
    setSetting('track', st.startTrack);
    setSetting('homeAll', false);
  }
  const lv = { ...st.levelByTrack };
  let changed = false;
  for (const t of ['general', 'toeic'] as const) {
    const want = st.startLevel?.[t] ?? 'last';
    if (want === 'last' || lv[t] === null) continue; // 처음 실행(레벨 고르기 전)은 건드리지 않음
    if (want === 'news') {
      if (t === 'general' && st.newsEnabled) setSetting('generalView', 'news');
    } else {
      lv[t] = want;
      changed = true;
      if (t === 'general') setSetting('generalView', 'level');
    }
  }
  if (changed) setSetting('levelByTrack', lv);
}

async function boot() {
  await loadSettings();
  const st = getSettings();
  if (st.backupReminderShownAt === null && st.lastBackupAt === null) setSetting('backupReminderShownAt', Date.now());
  applyStartPriority(st);
  initTTS();
  onSpeechSilent(() => toast('발음이 안 들리면: 아이폰 옆 무음 스위치를 끄고, 소리 크기를 올려 주세요. 기록/설정 → 설정에서 다른 음성을 골라도 돼요.', { sticky: true }));
  void navigator.storage?.persist?.().catch(() => undefined);
  void loadLessons();
  startTimeTracking();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    const { registerSW } = await import('virtual:pwa-register');
    const update = registerSW({
      onNeedRefresh() {
        // 자동 강제 새로고침 금지: 필사 중 입력을 지키기 위해 사용자가 누를 때만
        toast('새 버전이 있어요', { sticky: true, action: { label: '새로고침', run: () => void update(true) } });
      },
    });
  }

  // iOS Safari: 홈 화면에 설치하지 않으면 데이터가 지워질 수 있음
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  if (isIOS && !standalone && !getSettings().installHintShown) {
    setSetting('installHintShown', true);
    toast('공유 버튼 → "홈 화면에 추가"로 설치하면 학습 기록이 지워지지 않아요. 백업도 가끔 해 주세요.', { sticky: true });
  }
}

void boot();
