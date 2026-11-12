import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { App } from './App';
import { loadSettings, getSettings, setSetting } from './lib/settings';
import { initTTS } from './lib/tts';
import { loadLessons } from './lib/lessons';
import { startTimeTracking } from './lib/progress';
import { toast } from './components/Toast';

async function boot() {
  await loadSettings();
  const st = getSettings();
  if (st.backupReminderShownAt === null && st.lastBackupAt === null) setSetting('backupReminderShownAt', Date.now());
  initTTS();
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
