// פעולות מסחר על תיק: קנייה/מכירה, פקודות, אופציות, אג״ח ושווי תיק. כל הפונקציות טהורות ומחזירות תיק חדש.
import { addDays, daysBetween, type ISODate } from './dates';
import type { Currency, MarketData } from './market';
import { BOND_FACE, bondMarkPer100, bondProduct, optionPrice, quoteNewBond, type OptionRight } from './finance';
import { inst, instCurrency, instName } from './universe';
import type { BondPosition, LimitOrder, OptionPosition, Portfolio, Position, StockPosition, Transaction, TxReason } from './types';

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export interface TradeOutcome {
  portfolio: Portfolio;
  tx: Transaction;
}

export function calcFee(p: Portfolio, notional: number): number {
  if (p.settings.feeRate <= 0 && p.settings.minFee <= 0) return 0;
  return Math.max(p.settings.minFee, notional * p.settings.feeRate);
}

function touch(p: Portfolio, patch: Partial<Portfolio>): Portfolio {
  return { ...p, ...patch, updatedAt: new Date().toISOString() };
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** האם אפשר לסחור בנכס בתאריך (יש מחיר עדכני) */
export function tradable(market: MarketData, id: string, date: ISODate): Result<number> {
  if (!market.has(id)) return fail('אין נתונים לנכס הזה כרגע');
  const first = market.firstDate(id);
  if (!first || first > date) return fail('החברה עוד לא נסחרה בבורסה בתאריך הזה 🙂');
  const last = market.lastDate(id);
  if (!last || daysBetween(last, date) > 10) return fail('אין מסחר בנכס הזה כרגע');
  const price = market.price(id, date);
  if (!(price > 0)) return fail('אין מחיר לנכס');
  return { ok: true, value: price };
}

export interface BuyQuote {
  price: number;
  qty: number;
  notional: number; // במטבע הנכס
  fee: number;
  currency: Currency;
  fx: number;
  totalBase: number; // עלות במטבע התיק
  cashAfter: number;
}

export function quoteBuy(p: Portfolio, market: MarketData, instrumentId: string, qty: number, price?: number): Result<BuyQuote> {
  const date = p.currentDate;
  let px = price;
  if (px === undefined) {
    const t = tradable(market, instrumentId, date);
    if (!t.ok) return t;
    px = t.value;
  }
  const currency = instCurrency(instrumentId);
  const fx = market.fx(currency, p.baseCurrency, date);
  const notional = px * qty;
  const fee = calcFee(p, notional);
  const totalBase = (notional + fee) * fx;
  return { ok: true, value: { price: px, qty, notional, fee, currency, fx, totalBase, cashAfter: p.cash - totalBase } };
}

/** כמה מניות אפשר לקנות בסכום (במטבע התיק) */
export function maxQtyForAmount(p: Portfolio, market: MarketData, instrumentId: string, amountBase: number): number {
  const date = p.currentDate;
  const px = market.price(instrumentId, date);
  if (!(px > 0)) return 0;
  const fx = market.fx(instCurrency(instrumentId), p.baseCurrency, date);
  let q = Math.floor(amountBase / fx / (px * (1 + p.settings.feeRate)));
  while (q > 0) {
    const n = px * q;
    if ((n + calcFee(p, n)) * fx <= amountBase + 1e-9) break;
    q--;
  }
  return Math.max(0, q);
}

export function executeBuy(
  p: Portfolio,
  market: MarketData,
  instrumentId: string,
  qty: number,
  opts: { price?: number; reason?: TxReason } = {}
): Result<TradeOutcome> {
  if (!Number.isInteger(qty) || qty <= 0) return fail('צריך לבחור כמות שלמה וחיובית');
  const q = quoteBuy(p, market, instrumentId, qty, opts.price);
  if (!q.ok) return q;
  const { price, fee, fx, totalBase, currency } = q.value;
  if (totalBase > p.cash + 1e-6) return fail('אין מספיק מזומן בתיק לקנייה הזו');
  const date = p.currentDate;
  const positions = [...p.positions];
  const idx = positions.findIndex((x) => x.kind === 'stock' && x.instrumentId === instrumentId);
  const costCurPerShare = (price * qty + fee) / qty;
  const costBasePerShare = totalBase / qty;
  if (idx >= 0) {
    const old = positions[idx] as StockPosition;
    const nq = old.qty + qty;
    positions[idx] = {
      ...old,
      qty: nq,
      avgCost: (old.avgCost * old.qty + costCurPerShare * qty) / nq,
      avgCostBase: (old.avgCostBase * old.qty + costBasePerShare * qty) / nq
    };
  } else {
    positions.push({ kind: 'stock', id: uid('pos_'), instrumentId, qty, avgCost: costCurPerShare, avgCostBase: costBasePerShare, openedAt: date });
  }
  const tx: Transaction = { id: uid('tx_'), date, type: 'buy', instrumentId, qty, price, currency, fx, fee, cash: -totalBase, reason: opts.reason ?? 'market' };
  const portfolio = touch(p, {
    cash: p.cash - totalBase,
    positions,
    txs: [...p.txs, tx],
    counters: { ...p.counters, fees: p.counters.fees + fee * fx }
  });
  return { ok: true, value: { portfolio, tx } };
}

export function stockPosition(p: Portfolio, instrumentId: string): StockPosition | undefined {
  return p.positions.find((x) => x.kind === 'stock' && x.instrumentId === instrumentId) as StockPosition | undefined;
}

export function executeSell(
  p: Portfolio,
  market: MarketData,
  instrumentId: string,
  qty: number,
  opts: { price?: number; reason?: TxReason } = {}
): Result<TradeOutcome> {
  const pos = stockPosition(p, instrumentId);
  if (!pos) return fail('אין לכם מניות של החברה הזו בתיק');
  if (!Number.isInteger(qty) || qty <= 0) return fail('צריך לבחור כמות שלמה וחיובית');
  if (qty > pos.qty) return fail(`יש לכם רק ${pos.qty} מניות למכירה`);
  const date = p.currentDate;
  let price = opts.price;
  if (price === undefined) {
    const t = tradable(market, instrumentId, date);
    if (!t.ok) return t;
    price = t.value;
  }
  const currency = instCurrency(instrumentId);
  const fx = market.fx(currency, p.baseCurrency, date);
  const notional = price * qty;
  const fee = Math.min(calcFee(p, notional), notional);
  const proceedsBase = (notional - fee) * fx;
  const pnl = proceedsBase - pos.avgCostBase * qty;
  let positions: Position[];
  if (qty === pos.qty) positions = p.positions.filter((x) => x.id !== pos.id);
  else positions = p.positions.map((x) => (x.id === pos.id ? { ...pos, qty: pos.qty - qty } : x));
  // ביטול פקודות מכירה שכבר אין להן מניות
  const remaining = qty === pos.qty ? 0 : pos.qty - qty;
  const orders = p.orders.filter((o) => !(o.side === 'sell' && o.instrumentId === instrumentId && remaining === 0));
  const tx: Transaction = { id: uid('tx_'), date, type: 'sell', instrumentId, qty, price, currency, fx, fee, cash: proceedsBase, pnl, reason: opts.reason ?? 'market' };
  const portfolio = touch(p, {
    cash: p.cash + proceedsBase,
    positions,
    orders,
    txs: [...p.txs, tx],
    counters: { ...p.counters, fees: p.counters.fees + fee * fx }
  });
  return { ok: true, value: { portfolio, tx } };
}

// ---------------- פקודות לימיט / סטופ לוס / טייק פרופיט ----------------
export function placeLimitOrder(p: Portfolio, market: MarketData, o: Omit<LimitOrder, 'id' | 'createdAt'>): Result<Portfolio> {
  if (!Number.isInteger(o.qty) || o.qty <= 0) return fail('צריך לבחור כמות שלמה וחיובית');
  if (!(o.limitPrice > 0)) return fail('צריך לקבוע מחיר');
  const t = tradable(market, o.instrumentId, p.currentDate);
  if (!t.ok) return t;
  if (o.side === 'buy') {
    const q = quoteBuy(p, market, o.instrumentId, o.qty, o.limitPrice);
    if (!q.ok) return q;
    const reserved = pendingBuyReserve(p, market);
    if (q.value.totalBase + reserved > p.cash + 1e-6) return fail('אין מספיק מזומן לפקודה הזו (כולל פקודות קנייה אחרות שממתינות)');
  } else {
    const pos = stockPosition(p, o.instrumentId);
    const pendingSell = p.orders.filter((x) => x.side === 'sell' && x.instrumentId === o.instrumentId).reduce((a, x) => a + x.qty, 0);
    if (!pos || pos.qty - pendingSell < o.qty) return fail('אין מספיק מניות בתיק לפקודת המכירה הזו');
  }
  const order: LimitOrder = { ...o, id: uid('ord_'), createdAt: p.currentDate };
  return { ok: true, value: touch(p, { orders: [...p.orders, order] }) };
}

/** מזומן ששמור לפקודות קנייה ממתינות (במטבע התיק) */
export function pendingBuyReserve(p: Portfolio, market: MarketData): number {
  let sum = 0;
  for (const o of p.orders) {
    if (o.side !== 'buy') continue;
    const fx = market.fx(instCurrency(o.instrumentId), p.baseCurrency, p.currentDate);
    const n = o.qty * o.limitPrice;
    sum += (n + calcFee(p, n)) * fx;
  }
  return sum;
}

export function cancelOrder(p: Portfolio, orderId: string): Portfolio {
  return touch(p, { orders: p.orders.filter((o) => o.id !== orderId) });
}

export function setProtection(p: Portfolio, market: MarketData, instrumentId: string, stopLoss?: number, takeProfit?: number): Result<Portfolio> {
  const pos = stockPosition(p, instrumentId);
  if (!pos) return fail('אין מניות כאלה בתיק');
  const price = market.price(instrumentId, p.currentDate);
  if (stopLoss !== undefined && !(stopLoss > 0 && stopLoss < price)) return fail('סטופ לוס צריך להיות מתחת למחיר הנוכחי');
  if (takeProfit !== undefined && !(takeProfit > price)) return fail('טייק פרופיט צריך להיות מעל המחיר הנוכחי');
  const positions = p.positions.map((x) => (x.id === pos.id ? { ...pos, stopLoss, takeProfit } : x));
  return { ok: true, value: touch(p, { positions }) };
}

// ---------------- אופציות ----------------
export interface OptionQuote {
  premium: number; // למניה
  multiplier: number;
  contracts: number;
  fee: number;
  fx: number;
  totalBase: number;
  underlyingPrice: number;
}

export function quoteOption(
  p: Portfolio,
  market: MarketData,
  underlying: string,
  right: OptionRight,
  strike: number,
  expiry: ISODate,
  contracts: number
): Result<OptionQuote> {
  const i = inst(underlying);
  if (!i?.optionable) return fail('אין אופציות על הנכס הזה במשחק');
  const t = tradable(market, underlying, p.currentDate);
  if (!t.ok) return t;
  const premium = optionPrice(market, underlying, right, strike, expiry, p.currentDate);
  const fx = market.fx(i.currency, p.baseCurrency, p.currentDate);
  const fee = p.settings.optionFeePerContract * contracts;
  const totalBase = (premium * 100 * contracts + fee) * fx;
  return { ok: true, value: { premium, multiplier: 100, contracts, fee, fx, totalBase, underlyingPrice: t.value } };
}

export function buyOption(
  p: Portfolio,
  market: MarketData,
  args: { underlying: string; right: OptionRight; strike: number; expiry: ISODate; contracts: number }
): Result<TradeOutcome> {
  if (!Number.isInteger(args.contracts) || args.contracts <= 0) return fail('צריך לבחור מספר חוזים שלם');
  if (args.expiry <= p.currentDate) return fail('מועד הפקיעה כבר עבר');
  const q = quoteOption(p, market, args.underlying, args.right, args.strike, args.expiry, args.contracts);
  if (!q.ok) return q;
  const { premium, fee, fx, totalBase } = q.value;
  if (premium < 0.01) return fail('האופציה הזו כמעט חסרת ערך – בחרו מחיר מימוש אחר');
  if (totalBase > p.cash + 1e-6) return fail('אין מספיק מזומן בתיק');
  const date = p.currentDate;
  const positions = [...p.positions];
  const idx = positions.findIndex(
    (x) => x.kind === 'option' && x.underlying === args.underlying && x.right === args.right && x.strike === args.strike && x.expiry === args.expiry
  );
  const costPerContract = totalBase / args.contracts;
  if (idx >= 0) {
    const old = positions[idx] as OptionPosition;
    const n = old.contracts + args.contracts;
    positions[idx] = {
      ...old,
      contracts: n,
      avgPremium: (old.avgPremium * old.contracts + premium * args.contracts) / n,
      avgCostBase: (old.avgCostBase * old.contracts + costPerContract * args.contracts) / n
    };
  } else {
    positions.push({ kind: 'option', id: uid('opt_'), ...args, multiplier: 100, avgPremium: premium, avgCostBase: costPerContract, openedAt: date });
  }
  const tx: Transaction = {
    id: uid('tx_'),
    date,
    type: 'option_buy',
    instrumentId: args.underlying,
    qty: args.contracts,
    price: premium,
    currency: instCurrency(args.underlying),
    fx,
    fee,
    cash: -totalBase,
    reason: 'market',
    meta: { right: args.right, strike: args.strike, expiry: args.expiry }
  };
  const portfolio = touch(p, { cash: p.cash - totalBase, positions, txs: [...p.txs, tx], counters: { ...p.counters, fees: p.counters.fees + fee * fx } });
  return { ok: true, value: { portfolio, tx } };
}

export function sellOption(p: Portfolio, market: MarketData, positionId: string, contracts: number): Result<TradeOutcome> {
  const pos = p.positions.find((x) => x.id === positionId) as OptionPosition | undefined;
  if (!pos || pos.kind !== 'option') return fail('האופציה לא נמצאה');
  if (!Number.isInteger(contracts) || contracts <= 0 || contracts > pos.contracts) return fail('כמות חוזים לא תקינה');
  const date = p.currentDate;
  const premium = optionPrice(market, pos.underlying, pos.right, pos.strike, pos.expiry, date);
  const fx = market.fx(instCurrency(pos.underlying), p.baseCurrency, date);
  const gross = premium * pos.multiplier * contracts;
  const fee = Math.min(p.settings.optionFeePerContract * contracts, gross);
  const proceedsBase = (gross - fee) * fx;
  const pnl = proceedsBase - pos.avgCostBase * contracts;
  const positions =
    contracts === pos.contracts ? p.positions.filter((x) => x.id !== pos.id) : p.positions.map((x) => (x.id === pos.id ? { ...pos, contracts: pos.contracts - contracts } : x));
  const tx: Transaction = {
    id: uid('tx_'),
    date,
    type: 'option_sell',
    instrumentId: pos.underlying,
    qty: contracts,
    price: premium,
    currency: instCurrency(pos.underlying),
    fx,
    fee,
    cash: proceedsBase,
    pnl,
    reason: 'market',
    meta: { right: pos.right, strike: pos.strike, expiry: pos.expiry }
  };
  const portfolio = touch(p, { cash: p.cash + proceedsBase, positions, txs: [...p.txs, tx], counters: { ...p.counters, fees: p.counters.fees + fee * fx } });
  return { ok: true, value: { portfolio, tx } };
}

// ---------------- אג״ח ----------------
export function buyBond(p: Portfolio, market: MarketData, productId: string, units: number): Result<TradeOutcome> {
  const product = bondProduct(productId);
  if (!product) return fail('האג״ח לא נמצאה');
  if (!Number.isInteger(units) || units <= 0) return fail('צריך לבחור מספר יחידות שלם');
  const date = p.currentDate;
  const q = quoteNewBond(market, product, date);
  if (!q) return fail('אין נתוני ריבית לתאריך הזה');
  const fx = market.fx(product.currency, p.baseCurrency, date);
  const notional = (q.pricePer100 / 100) * BOND_FACE * units;
  const fee = calcFee(p, notional);
  const totalBase = (notional + fee) * fx;
  if (totalBase > p.cash + 1e-6) return fail('אין מספיק מזומן בתיק');
  const pos: BondPosition = {
    kind: 'bond',
    id: uid('bond_'),
    productId,
    currency: product.currency,
    curve: product.curve,
    spread: product.spread,
    couponRate: q.couponRate,
    freq: product.freq,
    issueDate: date,
    maturity: q.maturity,
    units,
    avgPrice: q.pricePer100,
    avgCostBase: totalBase / units,
    openedAt: date,
    lastCouponDate: date
  };
  const tx: Transaction = {
    id: uid('tx_'),
    date,
    type: 'bond_buy',
    instrumentId: productId,
    qty: units,
    price: q.pricePer100,
    currency: product.currency,
    fx,
    fee,
    cash: -totalBase,
    reason: 'market',
    meta: { coupon: q.couponRate, maturity: q.maturity }
  };
  const portfolio = touch(p, {
    cash: p.cash - totalBase,
    positions: [...p.positions, pos],
    txs: [...p.txs, tx],
    counters: { ...p.counters, fees: p.counters.fees + fee * fx }
  });
  return { ok: true, value: { portfolio, tx } };
}

export function sellBond(p: Portfolio, market: MarketData, positionId: string, units: number): Result<TradeOutcome> {
  const pos = p.positions.find((x) => x.id === positionId) as BondPosition | undefined;
  if (!pos || pos.kind !== 'bond') return fail('האג״ח לא נמצאה');
  if (!Number.isInteger(units) || units <= 0 || units > pos.units) return fail('כמות לא תקינה');
  const date = p.currentDate;
  const price = bondMarkPer100(market, pos, date);
  const fx = market.fx(pos.currency, p.baseCurrency, date);
  const notional = (price / 100) * BOND_FACE * units;
  const fee = Math.min(calcFee(p, notional), notional);
  const proceedsBase = (notional - fee) * fx;
  const pnl = proceedsBase - pos.avgCostBase * units;
  const positions = units === pos.units ? p.positions.filter((x) => x.id !== pos.id) : p.positions.map((x) => (x.id === pos.id ? { ...pos, units: pos.units - units } : x));
  const tx: Transaction = {
    id: uid('tx_'),
    date,
    type: 'bond_sell',
    instrumentId: pos.productId,
    qty: units,
    price,
    currency: pos.currency,
    fx,
    fee,
    cash: proceedsBase,
    pnl,
    reason: 'market'
  };
  const portfolio = touch(p, { cash: p.cash + proceedsBase, positions, txs: [...p.txs, tx], counters: { ...p.counters, fees: p.counters.fees + fee * fx } });
  return { ok: true, value: { portfolio, tx } };
}

// ---------------- שווי תיק ----------------
export interface HoldingView {
  position: Position;
  label: string;
  emoji: string;
  instrumentId: string; // לאג״ח – productId
  currency: Currency;
  /** מחיר נוכחי ליחידה במטבע הנכס (מניה / פרמיה למניה / מחיר ל-100 ע.נ.) */
  price: number;
  qty: number;
  valueBase: number;
  costBase: number;
  pnlBase: number;
  pnlPct: number;
  dayChangePct: number;
}

export interface Valuation {
  date: ISODate;
  cash: number;
  invested: number;
  total: number;
  holdings: HoldingView[];
}

export function holdingValue(p: Portfolio, market: MarketData, pos: Position, date: ISODate): { price: number; valueBase: number } {
  if (pos.kind === 'stock') {
    const price = market.price(pos.instrumentId, date);
    const fx = market.fx(instCurrency(pos.instrumentId), p.baseCurrency, date);
    return { price, valueBase: (Number.isFinite(price) ? price : pos.avgCost) * pos.qty * fx };
  }
  if (pos.kind === 'option') {
    const prem = optionPrice(market, pos.underlying, pos.right, pos.strike, pos.expiry, date);
    const fx = market.fx(instCurrency(pos.underlying), p.baseCurrency, date);
    return { price: prem, valueBase: prem * pos.multiplier * pos.contracts * fx };
  }
  const price = bondMarkPer100(market, pos, date);
  const fx = market.fx(pos.currency, p.baseCurrency, date);
  return { price, valueBase: (price / 100) * BOND_FACE * pos.units * fx };
}

export function totalValue(p: Portfolio, market: MarketData, date: ISODate = p.currentDate): number {
  let v = p.cash;
  for (const pos of p.positions) v += holdingValue(p, market, pos, date).valueBase;
  return v;
}

export function optionLabel(pos: { underlying: string; right: OptionRight; strike: number; expiry: ISODate }): string {
  const [, m, d] = pos.expiry.split('-');
  return `${pos.right === 'call' ? 'קול' : 'פוט'} ${instName(pos.underlying)} ${pos.strike} (${Number(d)}.${Number(m)})`;
}

export function valuate(p: Portfolio, market: MarketData, date: ISODate = p.currentDate): Valuation {
  const holdings: HoldingView[] = [];
  const prevDate = addDays(date, -1);
  for (const pos of p.positions) {
    const { price, valueBase } = holdingValue(p, market, pos, date);
    let label = '';
    let emoji = '';
    let instrumentId = '';
    let currency: Currency = p.baseCurrency;
    let qty = 0;
    let costBase = 0;
    let dayChangePct = NaN;
    if (pos.kind === 'stock') {
      const i = inst(pos.instrumentId);
      label = i?.nameHe ?? pos.instrumentId;
      emoji = i?.emoji ?? '📄';
      instrumentId = pos.instrumentId;
      currency = i?.currency ?? 'USD';
      qty = pos.qty;
      costBase = pos.avgCostBase * pos.qty;
      dayChangePct = market.dayChange(pos.instrumentId, date);
    } else if (pos.kind === 'option') {
      label = optionLabel(pos);
      emoji = pos.right === 'call' ? '🎟️⬆️' : '🎟️⬇️';
      instrumentId = pos.underlying;
      currency = instCurrency(pos.underlying);
      qty = pos.contracts;
      costBase = pos.avgCostBase * pos.contracts;
      const prev = holdingValue(p, market, pos, market.snap(prevDate)).valueBase;
      dayChangePct = prev > 0 ? valueBase / prev - 1 : NaN;
    } else {
      const prod = bondProduct(pos.productId);
      label = prod?.nameHe ?? pos.productId;
      emoji = prod?.emoji ?? '📜';
      instrumentId = pos.productId;
      currency = pos.currency;
      qty = pos.units;
      costBase = pos.avgCostBase * pos.units;
      const prev = holdingValue(p, market, pos, market.snap(prevDate)).valueBase;
      dayChangePct = prev > 0 ? valueBase / prev - 1 : NaN;
    }
    holdings.push({
      position: pos,
      label,
      emoji,
      instrumentId,
      currency,
      price,
      qty,
      valueBase,
      costBase,
      pnlBase: valueBase - costBase,
      pnlPct: costBase > 0 ? valueBase / costBase - 1 : 0,
      dayChangePct
    });
  }
  holdings.sort((a, b) => b.valueBase - a.valueBase);
  const invested = holdings.reduce((a, h) => a + h.valueBase, 0);
  return { date, cash: round2(p.cash), invested, total: p.cash + invested, holdings };
}
