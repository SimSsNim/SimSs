import { NavLink } from 'react-router-dom';
import sh from '../styles/shell.module.css';
import { Icon } from './Icon';
import { useSettings } from '../lib/settings';

export function BottomNav() {
  const { track } = useSettings();
  const items = [
    { to: `/${track}`, label: '오늘', icon: 'today', end: true },
    { to: `/${track}/list`, label: '지문 목록', icon: 'list' },
    { to: '/words', label: '단어장', icon: 'words' },
    { to: '/grammar', label: '문법 모음', icon: 'grammar' },
    { to: '/records', label: '기록/설정', icon: 'records' },
  ];
  return (
    <nav className={sh.nav} aria-label="주 메뉴">
      <div className={sh.navInner}>
        {items.map((i) => (
          <NavLink key={i.label} to={i.to} end={i.end} className={sh.navItem}>
            <Icon name={i.icon} />
            <span>{i.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
