import { lazy, Suspense, useEffect } from 'react';
import { useBackTracker } from './lib/backTarget';
import { PullToRefresh } from './components/PullToRefresh';
import { HashRouter, Navigate, Route, Routes, useParams, Outlet } from 'react-router-dom';
import { useSettings, setSetting, getSettings } from './lib/settings';
import { isTrack } from './lib/types';
import { BottomNav } from './components/BottomNav';
import { MiniPlayer } from './components/MiniPlayer';
import { Toasts } from './components/Toast';
import { LevelOnboarding } from './components/LevelOnboarding';
import { Home } from './pages/Home';
import { LessonList } from './pages/LessonList';

// 첫 화면(홈·목록) 밖은 나눠서 불러온다
const Review = lazy(() => import('./pages/Review').then((m) => ({ default: m.Review })));
const Drill = lazy(() => import('./pages/Review').then((m) => ({ default: m.Drill })));
const GrammarAll = lazy(() => import('./pages/GrammarAll').then((m) => ({ default: m.GrammarAll })));
const Favorites = lazy(() => import('./pages/Favorites').then((m) => ({ default: m.Favorites })));
const Records = lazy(() => import('./pages/Records').then((m) => ({ default: m.Records })));
const LessonPage = lazy(() => import('./pages/lesson/LessonPage').then((m) => ({ default: m.LessonPage })));
const LessonRedirect = lazy(() => import('./pages/lesson/LessonPage').then((m) => ({ default: m.LessonRedirect })));
import { kstDate } from './lib/date';
import { loadLessons, getLessonsState } from './lib/lessons';

function BackTracker() {
  useBackTracker();
  return null;
}

function TrackGuard() {
  const { track } = useParams();
  const settings = useSettings();
  useEffect(() => {
    if (isTrack(track) && settings.track !== track) setSetting('track', track);
  }, [track, settings.track]);
  if (!isTrack(track)) return <Navigate to={`/${getSettings().track}`} replace />;
  return <Outlet />;
}

function useThemeAndTrack() {
  const { theme, track, fontSize, lineHeight } = useSettings();
  useEffect(() => {
    const el = document.documentElement;
    if (theme === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', theme);
    el.setAttribute('data-track', track);
    el.style.setProperty('--read-size', `${[17, 19, 22, 26][fontSize]}px`);
    el.style.setProperty('--read-lh', String(lineHeight));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', getComputedStyle(el).getPropertyValue('--accent').trim() || '#2f6b4f');
  }, [theme, track, fontSize, lineHeight]);
}

function useDayWatcher() {
  useEffect(() => {
    let day = kstDate();
    const check = () => {
      const now = kstDate();
      if (now !== day) {
        day = now;
        void loadLessons();
      } else if (document.visibilityState === 'visible' && Date.now() - getLessonsState().loadedAt > 30 * 60 * 1000) {
        void loadLessons();
      }
    };
    const id = setInterval(check, 60000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('online', check);
    };
  }, []);
}

export function App() {
  useThemeAndTrack();
  useDayWatcher();
  const { track } = useSettings();
  return (
    <HashRouter>
      <BackTracker />
      <PullToRefresh />
      <Suspense fallback={<div style={{ minHeight: '100dvh' }} />}>
      <Routes>
        <Route path="/" element={<Navigate to={`/${track}`} replace />} />
        <Route path="/review" element={<Review />} />
        <Route path="/words" element={<Navigate to="/review?tab=words" replace />} />
        <Route path="/drill" element={<Drill />} />
        <Route path="/grammar" element={<GrammarAll />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/records" element={<Records />} />
        <Route path="/records/:section" element={<Records />} />
        <Route path="/:track" element={<TrackGuard />}>
          <Route index element={<Home />} />
          <Route path="list" element={<LessonList />} />
          <Route path="lesson/:id" element={<LessonRedirect />} />
          <Route path="lesson/:id/:tab" element={<LessonPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      <MiniPlayer />
      <BottomNav />
      <Toasts />
      <LevelOnboarding />
    </HashRouter>
  );
}
