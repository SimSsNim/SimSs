// 날짜는 모두 Asia/Seoul 기준 'YYYY-MM-DD' 문자열
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });

export function kstDate(d: Date = new Date()): string {
  return fmt.format(d);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(a) - toUtc(b)) / 86400000);
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function formatKo(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  const w = '일월화수목금토'[weekdayOf(date)];
  return `${m}월 ${d}일 (${w})`;
}
