import { Link, useLocation } from 'react-router-dom';
import sh from '../styles/shell.module.css';
import { Icon } from './Icon';
import { useSettings } from '../lib/settings';

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
  return (
    <nav className={sh.nav} aria-label="주 메뉴">
      <div className={sh.navInner}>
        {items.map((i) => {
          const on = i.match.test(pathname);
          return (
            <Link key={i.label} to={i.to} className={sh.navItem} aria-current={on ? 'page' : undefined} data-testid={on ? 'nav-active' : undefined}>
              <span className={sh.navPill}><Icon name={i.icon} filled={on && i.icon === 'star'} /></span>
              <span>{i.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
