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

/** PDF 를 열었다 닫으며 앱이 처음부터 다시 열렸으면(아이패드 홈 화면 앱) 15분 안이면 보던 화면으로 */
function resumeAfterPdf() {
  try {
    const raw = localStorage.getItem('pilsa.resumeRoute');
    if (!raw) return;
    localStorage.removeItem('pilsa.resumeRoute');
    const r = JSON.parse(raw) as { hash: string; at: number };
    if (['', '#', '#/'].includes(location.hash) && r.hash && Date.now() - r.at < 15 * 60 * 1000) location.replace(r.hash);
  } catch { /* 무시 */ }
}

async function boot() {
  resumeAfterPdf();
  await loadSettings();
  const st = getSettings();
  if (st.backupReminderShownAt === null && st.lastBackupAt === null) setSetting('backupReminderShownAt', Date.now());
  applyStartPriority(st);
  initTTS();
  onSpeechSilent(() => toast('발음이 안 들리면 아이폰 옆 무음 스위치를 꺼 주세요. 아이폰은 무음일 때 웹 음성(TTS)을 내지 않아요.', { sticky: true }));
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
        toast('새 버전이 있어요', { sticky: true, action: { label: '업데이트', run: () => void update(true) } });
      },
      onRegisteredSW(_url, reg) {
        if (!reg) return;
        // 홈 화면 앱은 오래 켜 두어도 새 버전을 잘 안 찾아서: 앱으로 돌아올 때와 30분마다 확인
        const check = () => { if (navigator.onLine) void reg.update().catch(() => undefined); };
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
        setInterval(check, 30 * 60 * 1000);
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
