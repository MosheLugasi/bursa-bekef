import type { Currency } from '@/engine/market';

export const CUR_SYMBOL: Record<Currency, string> = { ILS: '₪', USD: '$' };

export function fmtNum(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('he-IL', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtMoney(n: number, cur: Currency = 'ILS', digits?: number): string {
  if (!Number.isFinite(n)) return '—';
  const d = digits ?? (Math.abs(n) >= 1000 ? 0 : 2);
  const s = Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: d, maximumFractionDigits: d });
  return `${n < 0 ? '-' : ''}${CUR_SYMBOL[cur]}${s}`;
}

export function fmtPrice(n: number, cur: Currency): string {
  if (!Number.isFinite(n)) return '—';
  const d = n < 1 ? 4 : 2;
  return `${CUR_SYMBOL[cur]}${n.toLocaleString('he-IL', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

export function fmtPct(x: number, digits = 1, sign = true): string {
  if (!Number.isFinite(x)) return '—';
  const v = x * 100;
  const s = Math.abs(v).toLocaleString('he-IL', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${sign ? (v > 0 ? '+' : v < 0 ? '-' : '') : v < 0 ? '-' : ''}${s}%`;
}

/** מספר גדול במילים: 391 מיליארד */
export function fmtBig(n: number | null | undefined, cur?: Currency): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  const sym = cur ? ` ${CUR_SYMBOL[cur]}` : '';
  const sign = n < 0 ? '-' : '';
  const f = (v: number) => v.toLocaleString('he-IL', { maximumFractionDigits: v >= 100 ? 0 : 1 });
  if (a >= 1e12) return `${sign}${f(a / 1e12)} טריליון${sym}`;
  if (a >= 1e9) return `${sign}${f(a / 1e9)} מיליארד${sym}`;
  if (a >= 1e6) return `${sign}${f(a / 1e6)} מיליון${sym}`;
  if (a >= 1e4) return `${sign}${f(a / 1e3)} אלף${sym}`;
  return `${sign}${a.toLocaleString('he-IL', { maximumFractionDigits: 2 })}${sym}`;
}

export function upDown(x: number): 'up' | 'down' | 'flat' {
  if (!Number.isFinite(x) || Math.abs(x) < 1e-9) return 'flat';
  return x > 0 ? 'up' : 'down';
}

export function clsx(...a: (string | false | null | undefined)[]): string {
  return a.filter(Boolean).join(' ');
}
