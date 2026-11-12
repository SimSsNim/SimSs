// 직접 만든 단순 SVG 아이콘
const paths: Record<string, string> = {
  today: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5',
  list: 'M5 6h14M5 12h14M5 18h9',
  words: 'M5 4h10l4 4v12H5zM9 11h6M9 15h6',
  grammar: 'M6 4h12v16H6zM9 8h6M9 12h6M9 16h3',
  records: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  play: 'M8 5v14l11-7z',
  pause: 'M7 5h4v14H7zM13 5h4v14h-4z',
  back5: 'M12 5a7 7 0 1 1-7 7M5 5v5h5',
  fwd5: 'M12 5a7 7 0 1 0 7 7M19 5v5h-5',
  speaker: 'M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  check: 'M5 12l5 5 9-10',
  close: 'M6 6l12 12M18 6L6 18',
  repeat: 'M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2M20 4v5h-5M4 20v-5h5',
  mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
};

export function Icon({ name, size = 22, filled = false, title }: { name: keyof typeof paths | string; size?: number; filled?: boolean; title?: string }) {
  const d = paths[name] ?? '';
  const isFill = filled || name === 'play' || name === 'pause';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}
      fill={isFill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={isFill && name !== 'star' && name !== 'bookmark' ? 0 : 2}
      strokeLinecap="round" strokeLinejoin="round" focusable="false">
      {title && <title>{title}</title>}
      <path d={d} />
    </svg>
  );
}
