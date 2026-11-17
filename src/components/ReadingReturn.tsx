import { useLocation, useNavigate } from 'react-router-dom';
import { ViewportLayer } from './ViewportLayer';
import s from '../styles/ui.module.css';
import { useReadingSpot, clearReadingSpot } from '../lib/backTarget';
import { useLessons } from '../lib/lessons';
import { lessonKeyOf } from '../lib/types';
import { tabsFor } from '../lib/checklist';

/** 홈·목록에서는 안 보임(거기엔 '계속'이 있음) */
const HIDE = /^\/(all|general|toeic)?$|^\/(general|toeic)\/list$/;

/** 읽거나 풀다가 문법·단어·설정 등으로 갔을 때: 보던 화면으로 바로 돌아가는 버튼 */
export function ReadingReturn() {
  const spot = useReadingSpot();
  const loc = useLocation();
  const nav = useNavigate();
  const { lessons, summaries } = useLessons();
  if (!spot || loc.pathname === spot.path || HIDE.test(loc.pathname)) return null;
  const key = lessonKeyOf(spot.track, spot.id);
  const title = lessons[key]?.title ?? summaries.find((x) => x.key === key)?.title ?? spot.id;
  const tabLabel = tabsFor(spot.track).find((t) => t.id === spot.tab)?.label ?? '';
  const go = () => {
    const y = spot.scrollY;
    nav(spot.path);
    // 레슨 화면이 위로 올린 뒤에 보던 위치로(내용이 늦게 그려질 수 있어 몇 번)
    for (const ms of [60, 250, 600]) setTimeout(() => window.scrollTo(0, y), ms);
  };
  return (
    <ViewportLayer zIndex={35}>
    <div data-pdf-skip="1" data-testid="reading-return"
      style={{ position: 'fixed', left: 12, bottom: 'calc(var(--nav-h) + var(--player-h) + 12px + env(safe-area-inset-bottom))', zIndex: 35, display: 'flex', alignItems: 'stretch', maxWidth: 'min(300px, calc(100vw - 210px))', boxShadow: 'var(--shadow)', borderRadius: 999 }}>
      <button type="button" className={s.primary} onClick={go} data-testid="reading-return-go" title={`${title} · ${tabLabel}`}
        style={{ borderRadius: '999px 0 0 999px', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15, padding: '4px 10px 4px 12px' }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>↩ 보던 화면으로</span>
        <span style={{ fontSize: 11, opacity: 0.85, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title} · {tabLabel}</span>
      </button>
      <button type="button" className={s.primary} onClick={clearReadingSpot} aria-label="보던 화면 버튼 닫기" data-testid="reading-return-close"
        style={{ borderRadius: '0 999px 999px 0', padding: '0 10px', borderLeft: '1px solid rgb(255 255 255 / 30%)', minWidth: 0 }}>✕</button>
    </div>
    </ViewportLayer>
  );
}
