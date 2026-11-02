// קידום הזמן בתיק: עיבוד יום אחר יום של פקודות, סטופ לוס/טייק פרופיט, דיבידנדים, פיצולים, קופונים, פדיונות ופקיעות.
import { formatDateHe, type ISODate } from './dates';
import type { MarketData } from './market';
import { BOND_FACE, bondProduct, couponDates, intrinsic } from './finance';
import { instCurrency, instName } from './universe';
import { executeBuy, executeSell, optionLabel, totalValue, uid } from './trading';
import type { BondPosition, GameEvent, OptionPosition, Portfolio, Position, StockPosition, Transaction } from './types';

const fmt = (n: number) => n.toLocaleString('he-IL', { maximumFractionDigits: 2 });

/** אילו נכסים צריכים נתוני נרות (גבוה/נמוך) כדי לעבד את התיק */
export function detailsNeeded(p: Portfolio): string[] {
  const s = new Set<string>();
  for (const o of p.orders) s.add(o.instrumentId);
  for (const pos of p.positions) if (pos.kind === 'stock' && (pos.stopLoss || pos.takeProfit)) s.add(pos.instrumentId);
  return [...s];
}

export interface AdvanceResult {
  portfolio: Portfolio;
  events: GameEvent[];
}

export function advance(p0: Portfolio, market: MarketData, target: ISODate): AdvanceResult {
  let p: Portfolio = { ...p0, positions: [...p0.positions], orders: [...p0.orders], txs: [...p0.txs], equity: [...p0.equity], counters: { ...p0.counters } };
  const events: GameEvent[] = [];
  const to = target > market.asOf ? market.asOf : target;
  if (to <= p.currentDate) return { portfolio: p0, events };
  const days = market.datesBetween(p.currentDate, to);
  let prev = p.currentDate;
  for (const d of days) {
    p = { ...p, currentDate: d };
    p = applySplits(p, market, prev, d, events);
    p = processOrders(p, market, d, events);
    p = processProtection(p, market, d, events);
    p = applyDividends(p, market, prev, d, events);
    p = processBonds(p, market, d, events);
    p = processOptions(p, market, d, events);
    p = { ...p, equity: pushEquity(p.equity, d, totalValue(p, market, d)) };
    prev = d;
  }
  p = { ...p, currentDate: to, updatedAt: new Date().toISOString() };
  if (p.endDate && to >= p.endDate) p = { ...p, finished: true };
  return { portfolio: p, events };
}

function pushEquity(eq: [ISODate, number][], d: ISODate, v: number): [ISODate, number][] {
  const val = Math.round(v * 100) / 100;
  if (eq.length && eq[eq.length - 1][0] === d) return [...eq.slice(0, -1), [d, val]];
  eq.push([d, val]);
  return eq;
}

/** רושם נקודת שווי ליום הנוכחי (אחרי פעולת מסחר) */
export function recordEquity(p: Portfolio, market: MarketData): Portfolio {
  return { ...p, equity: pushEquity([...p.equity], p.currentDate, totalValue(p, market, p.currentDate)) };
}

function applySplits(p: Portfolio, market: MarketData, prev: ISODate, d: ISODate, events: GameEvent[]): Portfolio {
  let changed = false;
  const txs: Transaction[] = [];
  const positions = p.positions.map((pos): Position => {
    const id = pos.kind === 'stock' ? pos.instrumentId : pos.kind === 'option' ? pos.underlying : '';
    if (!id) return pos;
    const splits = market.splitsBetween(id, prev, d);
    if (!splits.length) return pos;
    let r = 1;
    for (const s of splits) r *= s.ratio;
    changed = true;
    if (pos.kind === 'stock') {
      const newQty = Math.round(pos.qty * r);
      events.push({ date: d, kind: 'split', instrumentId: id, good: true, text: splitText(instName(id), r, pos.qty, newQty) });
      txs.push({ id: uid('tx_'), date: d, type: 'split', instrumentId: id, qty: newQty, cash: 0, note: `פיצול ${fmtRatio(r)}`, meta: { ratio: r } });
      return {
        ...pos,
        qty: newQty,
        avgCost: pos.avgCost / r,
        avgCostBase: (pos.avgCostBase * pos.qty) / newQty,
        stopLoss: pos.stopLoss ? pos.stopLoss / r : undefined,
        takeProfit: pos.takeProfit ? pos.takeProfit / r : undefined
      };
    }
    const op = pos as OptionPosition;
    return { ...op, strike: op.strike / r, multiplier: op.multiplier * r, avgPremium: op.avgPremium / r };
  });
  if (!changed) return p;
  const orders = p.orders.map((o) => {
    let r = 1;
    for (const s of market.splitsBetween(o.instrumentId, prev, d)) r *= s.ratio;
    return r === 1 ? o : { ...o, qty: Math.round(o.qty * r), limitPrice: o.limitPrice / r };
  });
  return { ...p, positions, orders, txs: [...p.txs, ...txs] };
}

/** יחס "עגול" (2, 3, 10, 1/8...) = פיצול רגיל; יחס לא עגול = התאמה בגלל ספין-אוף או הנפקת זכויות */
export function isRoundRatio(r: number): boolean {
  const x = r >= 1 ? r : 1 / r;
  return Math.abs(x - Math.round(x)) < 0.02;
}

function splitText(name: string, r: number, before: number, after: number): string {
  if (isRoundRatio(r))
    return `✂️ ${name} פיצלה את המניה ביחס ${fmtRatio(r)}! היו לכם ${before} מניות ועכשיו יש ${after}. השווי הכולל לא השתנה.`;
  return `🧩 ${name} הפרידה חלק מהעסק לחברה נפרדת (ספין-אוף) או ביצעה שינוי בהון. כדי לשמור על השווי שלכם, מספר המניות עודכן מ-${before} ל-${after}.`;
}

function fmtRatio(r: number): string {
  return r >= 1 ? `${fmt(r)} ל-1` : `1 ל-${fmt(1 / r)}`;
}

function processOrders(p: Portfolio, market: MarketData, d: ISODate, events: GameEvent[]): Portfolio {
  if (!p.orders.length) return p;
  let cur = p;
  for (const o of p.orders) {
    if (o.createdAt >= d) continue; // פקודה שנוצרה היום מתחילה לפעול ממחר
    if (o.expiresAt && d > o.expiresAt) {
      cur = { ...cur, orders: cur.orders.filter((x) => x.id !== o.id) };
      events.push({ date: d, kind: 'cancel', instrumentId: o.instrumentId, text: `⌛ פקודת ה${o.side === 'buy' ? 'קנייה' : 'מכירה'} על ${instName(o.instrumentId)} פגה בלי להתבצע.` });
      continue;
    }
    const bar = market.bar(o.instrumentId, d);
    if (!bar) continue;
    let fillPrice: number | undefined;
    if (o.side === 'buy' && bar.l <= o.limitPrice) fillPrice = Math.min(bar.o, o.limitPrice);
    if (o.side === 'sell' && bar.h >= o.limitPrice) fillPrice = Math.max(bar.o, o.limitPrice);
    if (fillPrice === undefined) continue;
    const without = { ...cur, orders: cur.orders.filter((x) => x.id !== o.id) };
    const res =
      o.side === 'buy'
        ? executeBuy(without, market, o.instrumentId, o.qty, { price: fillPrice, reason: 'limit' })
        : executeSell(without, market, o.instrumentId, Math.min(o.qty, stockQty(without, o.instrumentId)), { price: fillPrice, reason: 'limit' });
    if (res.ok) {
      cur = { ...res.value.portfolio, counters: { ...res.value.portfolio.counters, limitFills: res.value.portfolio.counters.limitFills + 1 } };
      events.push({
        date: d,
        kind: 'fill',
        instrumentId: o.instrumentId,
        good: true,
        text: `✅ פקודת לימיט בוצעה: ${o.side === 'buy' ? 'קניתם' : 'מכרתם'} ${o.qty} מניות ${instName(o.instrumentId)} במחיר ${fmt(fillPrice)}.`
      });
    } else {
      cur = without;
      events.push({ date: d, kind: 'cancel', instrumentId: o.instrumentId, text: `❌ פקודת לימיט על ${instName(o.instrumentId)} בוטלה: ${res.error}` });
    }
  }
  return cur;
}

function stockQty(p: Portfolio, id: string): number {
  const pos = p.positions.find((x) => x.kind === 'stock' && x.instrumentId === id) as StockPosition | undefined;
  return pos?.qty ?? 0;
}

function processProtection(p: Portfolio, market: MarketData, d: ISODate, events: GameEvent[]): Portfolio {
  let cur = p;
  for (const pos of p.positions) {
    if (pos.kind !== 'stock' || (!pos.stopLoss && !pos.takeProfit)) continue;
    if (pos.openedAt >= d && cur.txs.some((t) => t.date === d && t.instrumentId === pos.instrumentId && t.type === 'buy')) continue;
    const bar = market.bar(pos.instrumentId, d);
    if (!bar) continue;
    const sl = pos.stopLoss;
    const tp = pos.takeProfit;
    let hit: 'sl' | 'tp' | undefined;
    let price = 0;
    if (sl && bar.o <= sl) {
      hit = 'sl';
      price = bar.o; // פער פתיחה – נמכר במחיר הפתיחה
    } else if (tp && bar.o >= tp) {
      hit = 'tp';
      price = bar.o;
    } else if (sl && bar.l <= sl) {
      hit = 'sl';
      price = sl;
    } else if (tp && bar.h >= tp) {
      hit = 'tp';
      price = tp;
    }
    if (!hit) continue;
    const qty = stockQty(cur, pos.instrumentId);
    if (!qty) continue;
    const res = executeSell(cur, market, pos.instrumentId, qty, { price, reason: hit === 'sl' ? 'stop_loss' : 'take_profit' });
    if (!res.ok) continue;
    cur = res.value.portfolio;
    cur = {
      ...cur,
      orders: cur.orders.filter((o) => !(o.side === 'sell' && o.instrumentId === pos.instrumentId)),
      counters: {
        ...cur.counters,
        stopLossHits: cur.counters.stopLossHits + (hit === 'sl' ? 1 : 0),
        takeProfitHits: cur.counters.takeProfitHits + (hit === 'tp' ? 1 : 0)
      }
    };
    const pnl = res.value.tx.pnl ?? 0;
    events.push({
      date: d,
      kind: hit === 'sl' ? 'stop_loss' : 'take_profit',
      instrumentId: pos.instrumentId,
      amount: pnl,
      good: hit === 'tp',
      text:
        hit === 'sl'
          ? `🛡️ הסטופ לוס הופעל: ${qty} מניות ${instName(pos.instrumentId)} נמכרו ב-${fmt(price)} כדי להגן עליכם מהפסד גדול יותר.`
          : `🎯 טייק פרופיט! ${qty} מניות ${instName(pos.instrumentId)} נמכרו ב-${fmt(price)} והרווח נכנס לקופה.`
    });
  }
  return cur;
}

function applyDividends(p: Portfolio, market: MarketData, prev: ISODate, d: ISODate, events: GameEvent[]): Portfolio {
  let cur = p;
  for (const pos of p.positions) {
    if (pos.kind !== 'stock') continue;
    const divs = market.divsBetween(pos.instrumentId, prev, d);
    for (const dv of divs) {
      if (pos.openedAt >= dv.date) continue; // צריך להחזיק לפני יום האקס
      const fx = market.fx(instCurrency(pos.instrumentId), p.baseCurrency, d);
      const amountBase = dv.amount * pos.qty * fx;
      if (amountBase <= 0) continue;
      const tx: Transaction = {
        id: uid('tx_'),
        date: d,
        type: 'dividend',
        instrumentId: pos.instrumentId,
        qty: pos.qty,
        price: dv.amount,
        currency: instCurrency(pos.instrumentId),
        fx,
        cash: amountBase,
        reason: 'auto'
      };
      cur = { ...cur, cash: cur.cash + amountBase, txs: [...cur.txs, tx], counters: { ...cur.counters, dividends: cur.counters.dividends + amountBase } };
      events.push({
        date: d,
        kind: 'dividend',
        instrumentId: pos.instrumentId,
        amount: amountBase,
        good: true,
        text: `💰 ${instName(pos.instrumentId)} חילקה דיבידנד! קיבלתם ${fmt(amountBase)} ${p.baseCurrency === 'ILS' ? '₪' : '$'} על ${pos.qty} מניות.`
      });
    }
  }
  return cur;
}

function processBonds(p: Portfolio, market: MarketData, d: ISODate, events: GameEvent[]): Portfolio {
  let cur = p;
  for (const pos of p.positions) {
    if (pos.kind !== 'bond') continue;
    const b = pos as BondPosition;
    const fx = market.fx(b.currency, p.baseCurrency, d);
    const due = couponDates(b.issueDate, b.maturity, b.freq).filter((cd) => cd > b.lastCouponDate && cd <= d);
    let next: BondPosition = b;
    const name = bondProduct(b.productId)?.nameHe ?? b.productId;
    for (const cd of due) {
      const coupon = (b.couponRate / 100 / b.freq) * BOND_FACE * b.units;
      const amountBase = coupon * fx;
      const tx: Transaction = { id: uid('tx_'), date: d, type: 'coupon', instrumentId: b.productId, qty: b.units, price: coupon / b.units, currency: b.currency, fx, cash: amountBase, reason: 'auto' };
      cur = { ...cur, cash: cur.cash + amountBase, txs: [...cur.txs, tx], counters: { ...cur.counters, coupons: cur.counters.coupons + amountBase } };
      next = { ...next, lastCouponDate: cd };
      events.push({ date: d, kind: 'coupon', instrumentId: b.productId, amount: amountBase, good: true, text: `🧾 קיבלתם ריבית (קופון) מ${name}: ${fmt(amountBase)} ${p.baseCurrency === 'ILS' ? '₪' : '$'}.` });
    }
    if (b.maturity <= d) {
      const principal = BOND_FACE * b.units * fx;
      const pnl = principal + 0 - b.avgCostBase * b.units;
      const tx: Transaction = { id: uid('tx_'), date: d, type: 'bond_maturity', instrumentId: b.productId, qty: b.units, price: 100, currency: b.currency, fx, cash: principal, pnl, reason: 'maturity' };
      cur = { ...cur, cash: cur.cash + principal, positions: cur.positions.filter((x) => x.id !== b.id), txs: [...cur.txs, tx] };
      events.push({ date: d, kind: 'maturity', instrumentId: b.productId, amount: principal, good: true, text: `🏁 ${name} הגיעה לפדיון! קיבלתם בחזרה את הקרן: ${fmt(principal)} ${p.baseCurrency === 'ILS' ? '₪' : '$'}.` });
    } else if (next !== b) {
      cur = { ...cur, positions: cur.positions.map((x) => (x.id === b.id ? next : x)) };
    }
  }
  return cur;
}

function processOptions(p: Portfolio, market: MarketData, d: ISODate, events: GameEvent[]): Portfolio {
  let cur = p;
  for (const pos of p.positions) {
    if (pos.kind !== 'option' || pos.expiry > d) continue;
    const S = market.price(pos.underlying, pos.expiry);
    const value = intrinsic(pos.right, S, pos.strike);
    const fx = market.fx(instCurrency(pos.underlying), p.baseCurrency, d);
    const payout = value * pos.multiplier * pos.contracts * fx;
    const pnl = payout - pos.avgCostBase * pos.contracts;
    const tx: Transaction = {
      id: uid('tx_'),
      date: d,
      type: 'option_expire',
      instrumentId: pos.underlying,
      qty: pos.contracts,
      price: value,
      currency: instCurrency(pos.underlying),
      fx,
      cash: payout,
      pnl,
      reason: 'expiry',
      meta: { right: pos.right, strike: pos.strike, expiry: pos.expiry }
    };
    cur = { ...cur, cash: cur.cash + payout, positions: cur.positions.filter((x) => x.id !== pos.id), txs: [...cur.txs, tx] };
    events.push({
      date: d,
      kind: 'expiry',
      instrumentId: pos.underlying,
      amount: pnl,
      good: payout > 0,
      text:
        payout > 0
          ? `🎟️ האופציה ${optionLabel(pos)} פקעה "בתוך הכסף" ושולמו לכם ${fmt(payout)} ${p.baseCurrency === 'ILS' ? '₪' : '$'}.`
          : `🎟️ האופציה ${optionLabel(pos)} פקעה בלי ערך (המחיר לא הגיע למחיר המימוש עד ${formatDateHe(pos.expiry)}).`
    });
  }
  return cur;
}
