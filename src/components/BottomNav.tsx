import { Link, useLocation } from 'react-router-dom';
import sh from '../styles/shell.module.css';
import { Icon } from './Icon';
import { useSettings } from '../lib/settings';
import { useEffect } from 'react';
import { getSticky, setSticky } from '../lib/sticky';

export function BottomNav() {
  const { track, homeAll } = useSettings();
  const { pathname } = useLocation();
  const items = [
    // 레슨 화면도 '홈' 탭 안으로 본다
    { to: homeAll ? '/all' : `/${track}`, label: '홈', icon: 'today', match: /^\/(all$|(general|toeic)(\/?$|\/(list|lesson)(\/|$)))/ },
    { to: '/words', label: '단어', icon: 'abc', match: /^\/words/ },
    { to: '/grammar', label: '문법 모음', icon: 'grammar', match: /^\/grammar/ },
    { to: '/review', label: '복습', icon: 'review', match: /^\/(review|drill)/ },
    { to: '/favorites', label: '즐겨찾기', icon: 'star', match: /^\/favorites/ },
    { to: '/records', label: '기록/설정', icon: 'records', match: /^\/records/ },
  ];
  // 메뉴마다 마지막으로 보던 화면(하위 탭·날짜·레슨 포함)을 기억 → 다른 메뉴에 갔다 와도 그대로
  const here = items.find((i) => i.match.test(pathname));
  const full = pathname + useLocation().search;
  useEffect(() => { if (here) setSticky(`nav:${here.label}`, full); }, [here?.label, full]);
  return (
    <nav className={sh.nav} aria-label="주 메뉴">
      <div className={sh.navInner}>
        {items.map((i) => {
          const on = i.match.test(pathname);
          return (
            // 지금 메뉴를 한 번 더 누르면 처음 화면으로
            <Link key={i.label} to={on ? i.to : getSticky(`nav:${i.label}`, i.to)} onClick={() => on && setSticky(`nav:${i.label}`, i.to)} className={sh.navItem} aria-current={on ? 'page' : undefined} data-testid={on ? 'nav-active' : undefined}>
              <span className={sh.navPill}><Icon name={i.icon} filled={on && i.icon === 'star'} /></span>
              <span>{i.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
