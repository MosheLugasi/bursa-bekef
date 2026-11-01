// סטטיסטיקות ביצועים לתיק
import type { ISODate } from './dates';
import type { MarketData } from './market';
import { inst, instCurrency, SECTORS } from './universe';
import { valuate } from './trading';
import type { Portfolio, Transaction } from './types';

export interface PortfolioStats {
  value: number;
  returnPct: number;
  pnl: number;
  maxDrawdown: number; // שבר שלילי
  volatility: number; // שנתית
  sharpe: number;
  trades: number;
  closedTrades: number;
  wins: number;
  winRate: number;
  bestTrade?: Transaction;
  worstTrade?: Transaction;
  realizedPnl: number;
  dividends: number;
  coupons: number;
  fees: number;
  daysActive: number;
  benchmarkReturn: { US: number; IL: number };
}

const SELL_TYPES = new Set(['sell', 'option_sell', 'option_expire', 'bond_sell', 'bond_maturity']);
const TRADE_TYPES = new Set(['buy', 'sell', 'option_buy', 'option_sell', 'bond_buy', 'bond_sell']);

export function portfolioReturn(p: Portfolio, value: number): number {
  return p.startCash > 0 ? value / p.startCash - 1 : 0;
}

/** תשואת מדד ייחוס בתקופת התיק, במטבע התיק */
export function benchmarkReturn(market: MarketData, id: string, p: Portfolio, from: ISODate = p.startDate, to: ISODate = p.currentDate): number {
  const a = market.adjPrice(id, from, to);
  const b = market.price(id, to);
  if (!(a > 0 && b > 0)) return NaN;
  const cur = instCurrency(id);
  const fxa = market.fx(cur, p.baseCurrency, from);
  const fxb = market.fx(cur, p.baseCurrency, to);
  // מוסיפים דיבידנדים שחולקו בתקופה (תשואה כוללת בקירוב)
  let divs = 0;
  for (const d of market.divsBetween(id, from, to)) divs += d.amount / market.splitFactor(id, d.date, to);
  return ((b + divs) * fxb) / (a * fxa) - 1;
}

export function computeStats(p: Portfolio, market: MarketData): PortfolioStats {
  const v = valuate(p, market);
  const eq = p.equity.length ? p.equity : [[p.startDate, p.startCash] as [ISODate, number]];
  // ירידה מקסימלית
  let peak = p.startCash;
  let mdd = 0;
  for (const [, val] of eq) {
    if (val > peak) peak = val;
    const dd = val / peak - 1;
    if (dd < mdd) mdd = dd;
  }
  // תנודתיות ושארפ מתוך תשואות יומיות
  const rets: number[] = [];
  let prevVal = p.startCash;
  for (const [, val] of eq) {
    if (prevVal > 0) rets.push(val / prevVal - 1);
    prevVal = val;
  }
  const mean = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const sd = rets.length > 1 ? Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1)) : 0;
  const volatility = sd * Math.sqrt(252);
  const sharpe = sd > 0 ? ((mean * 252 - 0.03) / volatility) : 0;

  const closes = p.txs.filter((t) => SELL_TYPES.has(t.type) && t.pnl !== undefined);
  const wins = closes.filter((t) => (t.pnl ?? 0) > 0).length;
  let best: Transaction | undefined;
  let worst: Transaction | undefined;
  for (const t of closes) {
    if (!best || (t.pnl ?? 0) > (best.pnl ?? 0)) best = t;
    if (!worst || (t.pnl ?? 0) < (worst.pnl ?? 0)) worst = t;
  }
  const realized = closes.reduce((a, t) => a + (t.pnl ?? 0), 0);
  return {
    value: v.total,
    returnPct: portfolioReturn(p, v.total),
    pnl: v.total - p.startCash,
    maxDrawdown: mdd,
    volatility,
    sharpe,
    trades: p.txs.filter((t) => TRADE_TYPES.has(t.type)).length,
    closedTrades: closes.length,
    wins,
    winRate: closes.length ? wins / closes.length : 0,
    bestTrade: best && (best.pnl ?? 0) > 0 ? best : undefined,
    worstTrade: worst && (worst.pnl ?? 0) < 0 ? worst : undefined,
    realizedPnl: realized,
    dividends: p.counters.dividends,
    coupons: p.counters.coupons,
    fees: p.counters.fees,
    daysActive: eq.length,
    benchmarkReturn: { US: benchmarkReturn(market, 'SPY', p), IL: benchmarkReturn(market, 'TA125', p) }
  };
}

export interface AllocationSlice {
  key: string;
  label: string;
  emoji: string;
  value: number;
  pct: number;
}

export function allocation(p: Portfolio, market: MarketData, by: 'sector' | 'type' | 'country'): AllocationSlice[] {
  const v = valuate(p, market);
  const map = new Map<string, AllocationSlice>();
  const add = (key: string, label: string, emoji: string, value: number) => {
    const s = map.get(key) || { key, label, emoji, value: 0, pct: 0 };
    s.value += value;
    map.set(key, s);
  };
  if (v.cash > 0) add('cash', 'מזומן', '💵', v.cash);
  for (const h of v.holdings) {
    const pos = h.position;
    if (by === 'type') {
      if (pos.kind === 'stock') {
        const t = inst(pos.instrumentId)?.type;
        if (t === 'stock') add('stock', 'מניות', '📈', h.valueBase);
        else add('fund', 'קרנות סל ומדדים', '🧺', h.valueBase);
      } else if (pos.kind === 'option') add('option', 'אופציות', '🎟️', h.valueBase);
      else add('bond', 'אג״ח', '📜', h.valueBase);
    } else if (by === 'country') {
      const market = pos.kind === 'bond' ? (pos.curve === 'IL' ? 'IL' : 'US') : inst(h.instrumentId)?.market;
      if (market === 'IL') add('IL', 'ישראל', '🇮🇱', h.valueBase);
      else add('US', 'ארה״ב', '🇺🇸', h.valueBase);
    } else {
      if (pos.kind === 'bond') add('bonds', 'אג״ח', '📜', h.valueBase);
      else if (pos.kind === 'option') add('options', 'אופציות', '🎟️', h.valueBase);
      else {
        const sec = inst(pos.instrumentId)?.sector ?? 'other';
        add(sec, SECTORS[sec]?.nameHe ?? sec, SECTORS[sec]?.emoji ?? '❓', h.valueBase);
      }
    }
  }
  const total = [...map.values()].reduce((a, s) => a + s.value, 0) || 1;
  return [...map.values()].map((s) => ({ ...s, pct: s.value / total })).sort((a, b) => b.value - a.value);
}

/** סדרת שווי של "מה היה קורה אם הייתי שם הכל במדד" – להשוואה בגרף */
export function benchmarkEquity(p: Portfolio, market: MarketData, id: string): [ISODate, number][] {
  const out: [ISODate, number][] = [];
  const cur = instCurrency(id);
  const a = market.price(id, p.startDate);
  const fxa = market.fx(cur, p.baseCurrency, p.startDate);
  if (!(a > 0)) return out;
  for (const [d] of p.equity) {
    const b = market.adjPrice(id, d, d) * 1;
    const factor = market.splitFactor(id, p.startDate, d);
    const fxb = market.fx(cur, p.baseCurrency, d);
    out.push([d, (p.startCash * (b * factor) * fxb) / (a * fxa)]);
  }
  return out;
}
