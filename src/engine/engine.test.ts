import { describe, expect, it } from 'vitest';
import { MarketData, decodeSeries, type OverviewFile } from './market';
import { isoToEpochDay, addDays, thirdFriday } from './dates';
import { blackScholes, bondPricePer100, quoteNewBond, bondProduct, availableExpiries, strikeGrid, curveYield } from './finance';
import { executeBuy, executeSell, placeLimitOrder, setProtection, buyBond, buyOption, valuate, maxQtyForAmount, sellBond } from './trading';
import { advance, isRoundRatio } from './process';
import { DEFAULT_SETTINGS, type Portfolio } from './types';
import { computeStats } from './metrics';

// לוח שנה של 400 ימי חול מ-2020-01-01
function makeMarket(opts: { aapl?: (i: number) => number; splits?: Record<string, [string, number][]>; divs?: Record<string, [string, number][]>; detail?: boolean } = {}) {
  const start = isoToEpochDay('2020-01-01');
  const t: number[] = [];
  for (let d = start; t.length < 400; d++) {
    const dow = new Date(d * 86400000).getUTCDay();
    if (dow !== 0 && dow !== 6) t.push(d);
  }
  const n = t.length;
  const series = (f: (i: number) => number) => Array.from({ length: n }, (_, i) => +f(i).toFixed(4));
  const ov: OverviewFile = {
    v: 1,
    t,
    s: {
      AAPL: series(opts.aapl ?? ((i) => 100 + i * 0.1)),
      'LUMI.TA': series(() => 30),
      SPY: series((i) => 300 + i * 0.2),
      TA125: series(() => 200),
      USDILS: series(() => 3.5),
      US3M: series(() => 2),
      US5Y: series(() => 3),
      US10Y: series(() => 4),
      US30Y: series(() => 4.5),
      IL3M: series(() => 4),
      IL10Y: series(() => 4.5)
    },
    splits: Object.fromEntries(Object.entries(opts.splits ?? {}).map(([k, v]) => [k, v.map(([d, r]) => [isoToEpochDay(d), r] as [number, number])])),
    divs: Object.fromEntries(Object.entries(opts.divs ?? {}).map(([k, v]) => [k, v.map(([d, a]) => [isoToEpochDay(d), a] as [number, number])]))
  };
  const m = new MarketData(ov, { version: 1, asOf: '', generatedAt: '', instruments: [], macro: [] });
  return m;
}

function newPortfolio(date = '2020-01-01', base: 'ILS' | 'USD' = 'ILS', cash = 100_000): Portfolio {
  return {
    id: 'p1',
    name: 'test',
    ownerId: 'u1',
    emoji: '🐂',
    color: '#000',
    mode: 'history',
    baseCurrency: base,
    startCash: cash,
    cash,
    startDate: date,
    currentDate: date,
    positions: [],
    orders: [],
    txs: [],
    equity: [],
    settings: { ...DEFAULT_SETTINGS },
    createdAt: '',
    updatedAt: '',
    counters: { dividends: 0, coupons: 0, fees: 0, stopLossHits: 0, takeProfitHits: 0, limitFills: 0 }
  };
}

describe('encoding', () => {
  it('decodes delta-encoded series with gaps', () => {
    expect(decodeSeries({ k: 100, d: [12345, 5, null, -10, null] })).toEqual([123.45, 123.5, null, 123.4, null]);
    expect(decodeSeries([1, null, 2])).toEqual([1, null, 2]);
  });
});

describe('dates', () => {
  it('third friday', () => {
    expect(thirdFriday(2024, 6)).toBe('2024-06-21');
    expect(thirdFriday(2025, 1)).toBe('2025-01-17');
  });
});

describe('trading', () => {
  it('buys US stock from shekel portfolio with fx and fee', () => {
    const m = makeMarket();
    const p = newPortfolio();
    const r = executeBuy(p, m, 'AAPL', 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // מחיר 100$, 10 מניות = 1000$, עמלה 1$ (0.1%), שער 3.5
    expect(r.value.portfolio.cash).toBeCloseTo(100_000 - 1001 * 3.5, 6);
    const v = valuate(r.value.portfolio, m);
    expect(v.total).toBeCloseTo(100_000 - 3.5, 6);
  });

  it('rejects buy without cash and sells with pnl', () => {
    const m = makeMarket();
    const p = newPortfolio('2020-01-01', 'ILS', 1000);
    expect(executeBuy(p, m, 'AAPL', 10).ok).toBe(false);
    const p2 = newPortfolio();
    const b = executeBuy(p2, m, 'LUMI.TA', 100);
    if (!b.ok) throw new Error(b.error);
    const s = executeSell(b.value.portfolio, m, 'LUMI.TA', 100);
    if (!s.ok) throw new Error(s.error);
    // קנייה 3000 + עמלה 3, מכירה 3000 - 3 => הפסד 6
    expect(s.value.tx.pnl).toBeCloseTo(-6, 6);
    expect(s.value.portfolio.positions.length).toBe(0);
  });

  it('max qty for amount respects fee', () => {
    const m = makeMarket();
    const p = newPortfolio();
    const q = maxQtyForAmount(p, m, 'LUMI.TA', 3003);
    expect(q).toBe(100);
  });
});

describe('orders and protection', () => {
  it('limit buy fills when price drops, stop loss triggers', () => {
    // AAPL יורדת בהדרגה מ-100
    const m = makeMarket({ aapl: (i) => 100 - i * 0.5 });
    let p = newPortfolio();
    const o = placeLimitOrder(p, m, { side: 'buy', instrumentId: 'AAPL', qty: 5, limitPrice: 98 });
    if (!o.ok) throw new Error(o.error);
    p = o.value;
    const r = advance(p, m, '2020-01-10');
    expect(r.portfolio.orders.length).toBe(0);
    expect(r.portfolio.positions.length).toBe(1);
    expect(r.events.some((e) => e.kind === 'fill')).toBe(true);
    const sl = setProtection(r.portfolio, m, 'AAPL', 95);
    if (!sl.ok) throw new Error(sl.error);
    const r2 = advance(sl.value, m, '2020-02-28');
    expect(r2.portfolio.positions.length).toBe(0);
    expect(r2.portfolio.counters.stopLossHits).toBe(1);
    const sellTx = r2.portfolio.txs.find((t) => t.reason === 'stop_loss');
    expect(sellTx?.price).toBeCloseTo(95, 0);
  });

  it('take profit triggers on rise', () => {
    const m = makeMarket({ aapl: (i) => 100 + i });
    let p = newPortfolio();
    const b = executeBuy(p, m, 'AAPL', 10);
    if (!b.ok) throw new Error(b.error);
    const tp = setProtection(b.value.portfolio, m, 'AAPL', undefined, 110);
    if (!tp.ok) throw new Error(tp.error);
    p = advance(tp.value, m, '2020-03-01').portfolio;
    expect(p.counters.takeProfitHits).toBe(1);
    expect(p.positions.length).toBe(0);
    expect(p.cash).toBeGreaterThan(100_000);
  });
});

describe('corporate actions', () => {
  it('applies split to quantity without changing value', () => {
    // מחיר 100 עד הפיצול ב-2020-02-03, אחר כך 25 (פיצול 4:1)
    const splitIdx = 23;
    const m = makeMarket({ aapl: (i) => (i < splitIdx ? 100 : 25), splits: { AAPL: [['2020-02-03', 4]] } });
    const b = executeBuy(newPortfolio(), m, 'AAPL', 10);
    if (!b.ok) throw new Error(b.error);
    const before = valuate(b.value.portfolio, m).total;
    const r = advance(b.value.portfolio, m, '2020-02-10');
    const pos = r.portfolio.positions[0];
    expect(pos.kind === 'stock' && pos.qty).toBe(40);
    expect(valuate(r.portfolio, m).total).toBeCloseTo(before, 4);
    expect(r.events.some((e) => e.kind === 'split')).toBe(true);
  });

  it('tells real splits from spin-off adjustments', () => {
    expect(isRoundRatio(10)).toBe(true);
    expect(isRoundRatio(0.125)).toBe(true);
    expect(isRoundRatio(1.054)).toBe(false);
    expect(isRoundRatio(1.973)).toBe(false);
  });

  it('pays dividends', () => {
    const m = makeMarket({ aapl: () => 100, divs: { AAPL: [['2020-01-15', 0.5]] } });
    const b = executeBuy(newPortfolio(), m, 'AAPL', 10);
    if (!b.ok) throw new Error(b.error);
    const r = advance(b.value.portfolio, m, '2020-01-20');
    expect(r.portfolio.counters.dividends).toBeCloseTo(0.5 * 10 * 3.5, 6);
  });
});

describe('bonds', () => {
  it('par bond prices ~100 and falls when yields rise', () => {
    const p100 = bondPricePer100(4, 2, '2020-01-01', '2030-01-01', '2020-01-01', 4);
    expect(p100).toBeGreaterThan(99);
    expect(p100).toBeLessThan(101.5);
    const higher = bondPricePer100(4, 2, '2020-01-01', '2030-01-01', '2020-01-01', 5);
    expect(higher).toBeLessThan(p100);
  });

  it('curve interpolates', () => {
    const m = makeMarket();
    expect(curveYield(m, 'US', 7.5, '2020-03-01')).toBeCloseTo(3.5, 6);
  });

  it('pays coupons and principal at maturity', () => {
    const m = makeMarket();
    const prod = bondProduct('UST-1')!;
    const q = quoteNewBond(m, prod, '2020-01-01')!;
    expect(q.couponRate).toBe(2.125); // ריבית לשנה: אינטרפולציה בין 3 חודשים (2%) ל-5 שנים (3%)
    const b = buyBond(newPortfolio(), m, 'UST-1', 10);
    if (!b.ok) throw new Error(b.error);
    const r = advance(b.value.portfolio, m, '2021-06-01');
    expect(r.portfolio.positions.length).toBe(0);
    // 2 קופונים של 1.0625% × 10,000$ = 212.5$, וקרן 10,000$
    expect(r.portfolio.counters.coupons).toBeCloseTo(212.5 * 3.5, 4);
    expect(r.portfolio.txs.some((t) => t.type === 'bond_maturity')).toBe(true);
    const s = buyBond(newPortfolio(), m, 'UST-5', 2);
    if (!s.ok) throw new Error(s.error);
    expect(sellBond(s.value.portfolio, m, s.value.portfolio.positions[0].id, 2).ok).toBe(true);
  });
});

describe('options', () => {
  it('black scholes put-call parity', () => {
    const S = 100, K = 105, T = 0.5, r = 0.03, v = 0.3;
    const c = blackScholes('call', S, K, T, r, v);
    const p = blackScholes('put', S, K, T, r, v);
    expect(c - p).toBeCloseTo(S - K * Math.exp(-r * T), 4);
  });

  it('expiries and strikes', () => {
    const ex = availableExpiries('2024-06-03');
    expect(ex[0]).toBe('2024-06-21');
    expect(ex.length).toBe(4);
    expect(strikeGrid(187)).toContain(185);
  });

  it('call expires in the money and pays intrinsic', () => {
    const m = makeMarket({ aapl: (i) => 100 + i });
    const p = newPortfolio('2020-01-01', 'USD');
    const r = buyOption(p, m, { underlying: 'AAPL', right: 'call', strike: 105, expiry: '2020-02-21', contracts: 1 });
    if (!r.ok) throw new Error(r.error);
    const after = advance(r.value.portfolio, m, '2020-03-01');
    expect(after.portfolio.positions.length).toBe(0);
    const tx = after.portfolio.txs.find((t) => t.type === 'option_expire')!;
    // ב-2020-02-21 (יום מסחר 37) המחיר 137 → ערך פנימי 32 × 100
    expect(tx.cash).toBeCloseTo(3200, 4);
  });
});

describe('stats', () => {
  it('computes return and drawdown', () => {
    const m = makeMarket({ aapl: (i) => (i < 50 ? 100 + i : 150 - (i - 50)) });
    const b = executeBuy(newPortfolio(), m, 'AAPL', 100);
    if (!b.ok) throw new Error(b.error);
    const r = advance(b.value.portfolio, m, addDays('2020-01-01', 140));
    const s = computeStats(r.portfolio, m);
    expect(s.maxDrawdown).toBeLessThan(0);
    expect(Number.isFinite(s.returnPct)).toBe(true);
  });
});

import { COMPANIES } from '@/content';
import { atDate, profileAt } from '../content/dated';

describe('dated content', () => {
  it('hides text from the future in time machine and shows all in live mode', () => {
    const t = 'אנבידיה מייצרת שבבים. {{2024-06-18|היום היא החברה היקרה בעולם.}} היא נוסדה ב-1993.';
    expect(atDate(t, '2020-03-01')).toBe('אנבידיה מייצרת שבבים. היא נוסדה ב-1993.');
    expect(atDate(t, '2024-06-18')).toContain('החברה היקרה בעולם');
    expect(atDate(t)).toBe('אנבידיה מייצרת שבבים. היום היא החברה היקרה בעולם. היא נוסדה ב-1993.');
  });
  it('drops array items that become empty', () => {
    const p = profileAt(
      { id: 'X', tagline: 't', kid: 'k', adult: 'a', howMakesMoney: ['a'], products: ['ישן', '{{2023-12-31|חדש}}'], funFacts: [], risks: [], opportunities: [], competitors: [], israelConnection: '{{2022-01-31|נרכשה חברה ישראלית.}}' },
      '2021-01-01'
    );
    expect(p.products).toEqual(['ישן']);
    expect(p.israelConnection).toBeUndefined();
  });
  it('supports "before" markers (old headquarters, renamed competitors)', () => {
    const hq = '{{<2021-12-01|פאלו אלטו}}{{2021-12-01|אוסטין}}';
    expect(atDate(hq, '2020-01-01')).toBe('פאלו אלטו');
    expect(atDate(hq, '2022-01-01')).toBe('אוסטין');
    expect(atDate(hq)).toBe('אוסטין');
    const p = profileAt(
      { id: 'X', tagline: 't', kid: 'k', adult: 'a', howMakesMoney: [], products: [], funFacts: [], risks: [], opportunities: [], competitors: ['A', '{{2022-09-30|טמו}}'], headquarters: hq },
      '2020-01-01'
    );
    expect(p.competitors).toEqual(['A']);
    expect(p.headquarters).toBe('פאלו אלטו');
  });
  it('all company profile markers are well formed', () => {
    for (const c of Object.values(COMPANIES)) {
      for (const v of Object.values(c)) {
        for (const t of Array.isArray(v) ? v : [v]) {
          if (typeof t !== 'string' || !t.includes('{{')) continue;
          // אחרי הסרת כל הסימונים התקינים לא נשארים סוגריים מסולסלים כפולים
          expect(t.replace(/\{\{<?\d{4}-\d{2}-\d{2}\|[^{}]*\}\}/g, ''), `${c.id}: ${t}`).not.toMatch(/\{\{|\}\}/);
          expect(atDate(t, '2019-01-02'), `${c.id}`).not.toMatch(/\{|\}/);
        }
      }
    }
  });
});

import { JOURNEY, answerOrder } from '@/game/journey';
import { GLOSSARY } from '@/content/glossary';

describe('kids journey', () => {
  it('has valid quizzes, glossary links and shuffled answers', () => {
    const ids = new Set(GLOSSARY.map((g) => g.id));
    const firstPos: number[] = [];
    for (const st of JOURNEY) {
      expect(st.cards.length).toBeGreaterThan(0);
      for (const c of st.cards) for (const m of c.text.matchAll(/\[\[([^\]|]+)/g)) expect(ids.has(m[1]), `${st.id}: ${m[1]}`).toBe(true);
      for (const q of st.quiz) {
        expect(q.answer).toBeLessThan(q.options.length);
        const ord = answerOrder(q);
        expect([...ord].sort()).toEqual(q.options.map((_, i) => i));
        firstPos.push(ord.indexOf(q.answer));
      }
    }
    // התשובה הנכונה לא תמיד באותו מקום
    expect(new Set(firstPos).size).toBeGreaterThan(1);
    expect(JOURNEY.map((s) => s.id)).toContain('bonds');
    expect(JOURNEY.map((s) => s.id)).toContain('options');
  });
});

import { hasPig, withoutPigs } from '@/content/noPig';
import { COMPANIES as ALL_COMPANIES, LESSONS as ALL_LESSONS, EVENTS as ALL_EVENTS } from '@/content';
import { GLOSSARY as ALL_GLOSSARY } from '@/content/glossary';
import { JOURNEY as ALL_JOURNEY } from '@/game/journey';
import { LEVELS as ALL_LEVELS } from '@/game/xp';

describe('no pigs in the game', () => {
  it('detects pigs but not the verb "to return"', () => {
    expect(hasPig('קופת חזיר')).toBe(true);
    expect(hasPig('🐷')).toBe(true);
    expect(hasPig('Peppa Pig and friends')).toBe(true);
    expect(hasPig('הבנק מחזיר את הכסף, והלווה צריך להחזיר')).toBe(false);
    expect(hasPig('Hasbro owns NERF')).toBe(false);
  });
  it('strips pigs from external summaries', () => {
    const s = withoutPigs('Brands include NERF, and PEPPA PIG, as well as Star Wars. The company sells toys. Pork prices rose.');
    expect(s).toBe('Brands include NERF, as well as Star Wars. The company sells toys.');
  });
  it('our own content has no pigs', () => {
    const all = JSON.stringify([ALL_COMPANIES, ALL_LESSONS, ALL_EVENTS, ALL_GLOSSARY, ALL_JOURNEY, ALL_LEVELS]);
    expect(hasPig(all)).toBe(false);
  });
});
