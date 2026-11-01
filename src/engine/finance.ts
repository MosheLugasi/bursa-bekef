// מתמטיקה פיננסית: תמחור אופציות (בלק-שולס) ותמחור אג״ח מעקום תשואות אמיתי.
import { addMonths, thirdFriday, yearsBetween, type ISODate } from './dates';
import type { Currency, MarketData } from './market';

// ---------------- אופציות ----------------
export type OptionRight = 'call' | 'put';

/** פונקציית ההתפלגות המצטברת של התפלגות נורמלית סטנדרטית */
export function normCdf(x: number): number {
  // קירוב Abramowitz-Stegun 7.1.26 (דיוק ~1e-7)
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}

/** מחיר אופציה אירופאית לפי בלק-שולס. T בשנים, r ו-sigma כשברים עשרוניים */
export function blackScholes(right: OptionRight, S: number, K: number, T: number, r: number, sigma: number): number {
  if (T <= 0 || sigma <= 0) return Math.max(0, right === 'call' ? S - K : K - S);
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  if (right === 'call') return S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
  return K * Math.exp(-r * T) * normCdf(-d2) - S * normCdf(-d1);
}

export function intrinsic(right: OptionRight, S: number, K: number): number {
  return Math.max(0, right === 'call' ? S - K : K - S);
}

/** התנודתיות שבה המשחק משתמש: היסטורית × 1.1 (פרמיית סיכון), בגבולות סבירים */
export function gameVol(market: MarketData, underlying: string, date: ISODate): number {
  const hv = market.histVol(underlying, date, 60);
  if (!Number.isFinite(hv)) return 0.3;
  return Math.min(2, Math.max(0.12, hv * 1.1));
}

export function riskFreeRate(market: MarketData, date: ISODate): number {
  const r = market.rate('US3M', date);
  return Number.isFinite(r) ? r / 100 : 0.03;
}

export function optionPrice(
  market: MarketData,
  underlying: string,
  right: OptionRight,
  strike: number,
  expiry: ISODate,
  date: ISODate
): number {
  const S = market.price(underlying, date);
  if (!(S > 0)) return 0;
  const T = Math.max(0, yearsBetween(date, expiry));
  if (T <= 0) return intrinsic(right, S, strike);
  return blackScholes(right, S, strike, T, riskFreeRate(market, date), gameVol(market, underlying, date));
}

/** מועדי פקיעה זמינים: יום שישי השלישי ב-1,2,3 ו-6 החודשים הקרובים (לפחות שבוע קדימה) */
export function availableExpiries(date: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const [y, m] = date.split('-').map(Number);
  for (const add of [0, 1, 2, 3, 6]) {
    const target = addMonths(`${y}-${String(m).padStart(2, '0')}-01`, add);
    const [ty, tm] = target.split('-').map(Number);
    const tf = thirdFriday(ty, tm);
    if (yearsBetween(date, tf) * 365.25 >= 7) out.push(tf);
  }
  return out.slice(0, 4);
}

export function strikeStep(S: number): number {
  if (S < 10) return 0.5;
  if (S < 25) return 1;
  if (S < 50) return 2.5;
  if (S < 200) return 5;
  if (S < 500) return 10;
  if (S < 1000) return 25;
  return 50;
}

export function strikeGrid(S: number, n = 4): number[] {
  const step = strikeStep(S);
  const center = Math.round(S / step) * step;
  const out: number[] = [];
  for (let k = -n; k <= n; k++) {
    const K = +(center + k * step).toFixed(2);
    if (K > 0) out.push(K);
  }
  return out;
}

export function breakeven(right: OptionRight, strike: number, premium: number): number {
  return right === 'call' ? strike + premium : strike - premium;
}

// ---------------- אג״ח ----------------
export interface BondProduct {
  id: string;
  nameHe: string;
  issuerHe: string;
  emoji: string;
  curve: 'US' | 'IL';
  currency: Currency;
  termYears: number;
  /** מרווח מעל אג״ח ממשלתי באחוזים (הערכה קבועה לצורכי לימוד) */
  spread: number;
  /** דירוג להמחשה */
  rating: string;
  risk: 1 | 2 | 3 | 4; // 1=נמוך מאוד ... 4=גבוה
  freq: 1 | 2; // תשלומי קופון בשנה
  kind: 'government' | 'corporate';
  relatedStock?: string;
  descHe: string;
}

export const BOND_FACE = 1000; // ערך נקוב של אג״ח אחת

export const BOND_PRODUCTS: BondProduct[] = [
  { id: 'UST-1', nameHe: 'אג״ח ממשלת ארה״ב – שנה', issuerHe: 'ממשלת ארה״ב', emoji: '🇺🇸', curve: 'US', currency: 'USD', termYears: 1, spread: 0, rating: 'AA+', risk: 1, freq: 2, kind: 'government', descHe: 'הלוואה קצרה לממשלת ארה״ב. נחשבת לאחת ההשקעות הבטוחות בעולם.' },
  { id: 'UST-5', nameHe: 'אג״ח ממשלת ארה״ב – 5 שנים', issuerHe: 'ממשלת ארה״ב', emoji: '🇺🇸', curve: 'US', currency: 'USD', termYears: 5, spread: 0, rating: 'AA+', risk: 1, freq: 2, kind: 'government', descHe: 'הלוואה לממשלת ארה״ב ל-5 שנים. בטוחה מאוד, אבל המחיר זז כשהריבית משתנה.' },
  { id: 'UST-10', nameHe: 'אג״ח ממשלת ארה״ב – 10 שנים', issuerHe: 'ממשלת ארה״ב', emoji: '🇺🇸', curve: 'US', currency: 'USD', termYears: 10, spread: 0, rating: 'AA+', risk: 1, freq: 2, kind: 'government', descHe: 'האג״ח המפורסמת ביותר בעולם. רגישה לשינויי ריבית יותר מאג״ח קצרה.' },
  { id: 'UST-30', nameHe: 'אג״ח ממשלת ארה״ב – 30 שנה', issuerHe: 'ממשלת ארה״ב', emoji: '🇺🇸', curve: 'US', currency: 'USD', termYears: 30, spread: 0, rating: 'AA+', risk: 2, freq: 2, kind: 'government', descHe: 'הלוואה ארוכה מאוד. המחיר שלה יכול לזוז הרבה כשהריבית משתנה – גם אם הממשלה בטוחה.' },
  { id: 'AAPL-B5', nameHe: 'אג״ח אפל – 5 שנים', issuerHe: 'אפל', emoji: '🍎', curve: 'US', currency: 'USD', termYears: 5, spread: 0.6, rating: 'AA+', risk: 1, freq: 2, kind: 'corporate', relatedStock: 'AAPL', descHe: 'הלוואה לחברת אפל. חברה ענקית עם הרבה מזומנים, ולכן נחשבת בטוחה מאוד – אבל משלמת קצת יותר מהממשלה.' },
  { id: 'KO-B10', nameHe: 'אג״ח קוקה-קולה – 10 שנים', issuerHe: 'קוקה-קולה', emoji: '🥤', curve: 'US', currency: 'USD', termYears: 10, spread: 0.9, rating: 'A+', risk: 2, freq: 2, kind: 'corporate', relatedStock: 'KO', descHe: 'הלוואה לקוקה-קולה ל-10 שנים. חברה יציבה עם הכנסות קבועות.' },
  { id: 'BA-B5', nameHe: 'אג״ח בואינג – 5 שנים', issuerHe: 'בואינג', emoji: '✈️', curve: 'US', currency: 'USD', termYears: 5, spread: 2.0, rating: 'BBB-', risk: 3, freq: 2, kind: 'corporate', relatedStock: 'BA', descHe: 'הלוואה לבואינג. לחברה יש הרבה חובות ובעיות, ולכן היא משלמת ריבית גבוהה יותר – יותר סיכון, יותר תשואה.' },
  { id: 'ILGOV-2', nameHe: 'אג״ח ממשלת ישראל – שנתיים', issuerHe: 'ממשלת ישראל', emoji: '🇮🇱', curve: 'IL', currency: 'ILS', termYears: 2, spread: 0, rating: 'A', risk: 1, freq: 1, kind: 'government', descHe: 'הלוואה קצרה למדינת ישראל, בשקלים. ממשלת ישראל תמיד החזירה את חובותיה.' },
  { id: 'ILGOV-10', nameHe: 'אג״ח ממשלת ישראל – 10 שנים', issuerHe: 'ממשלת ישראל', emoji: '🇮🇱', curve: 'IL', currency: 'ILS', termYears: 10, spread: 0, rating: 'A', risk: 2, freq: 1, kind: 'government', descHe: 'הלוואה ארוכה למדינת ישראל. רגישה לשינויי הריבית של בנק ישראל ולמצב הכלכלה.' },
  { id: 'AZRG-B5', nameHe: 'אג״ח עזריאלי – 5 שנים', issuerHe: 'קבוצת עזריאלי', emoji: '🏙️', curve: 'IL', currency: 'ILS', termYears: 5, spread: 1.2, rating: 'AA (ישראלי)', risk: 2, freq: 1, kind: 'corporate', relatedStock: 'AZRG.TA', descHe: 'הלוואה לחברת הנדל״ן עזריאלי (המגדלים והקניונים). חברה חזקה, משלמת מעט יותר מהמדינה.' },
  { id: 'ELAL-B3', nameHe: 'אג״ח אל על – 3 שנים', issuerHe: 'אל על', emoji: '🛫', curve: 'IL', currency: 'ILS', termYears: 3, spread: 3.5, rating: 'BBB (ישראלי, להמחשה)', risk: 4, freq: 1, kind: 'corporate', relatedStock: 'ELAL.TA', descHe: 'הלוואה לחברת תעופה. חברות תעופה רגישות למלחמות, מגפות ומחיר הדלק – ולכן משלמות ריבית גבוהה.' }
];

export function bondProduct(id: string): BondProduct | undefined {
  return BOND_PRODUCTS.find((b) => b.id === id);
}

/** תשואה (באחוזים) לתקופה T שנים מעקום התשואות האמיתי בתאריך */
export function curveYield(market: MarketData, curve: 'US' | 'IL', T: number, date: ISODate): number {
  const pts: [number, number][] =
    curve === 'US'
      ? [
          [0.25, market.rate('US3M', date)],
          [5, market.rate('US5Y', date)],
          [10, market.rate('US10Y', date)],
          [30, market.rate('US30Y', date)]
        ]
      : [
          [0.25, market.rate('IL3M', date)],
          [10, market.rate('IL10Y', date)]
        ];
  const valid = pts.filter(([, y]) => Number.isFinite(y));
  if (!valid.length) return NaN;
  if (T <= valid[0][0]) return valid[0][1];
  for (let i = 1; i < valid.length; i++) {
    const [t0, y0] = valid[i - 1];
    const [t1, y1] = valid[i];
    if (T <= t1) return y0 + ((y1 - y0) * (T - t0)) / (t1 - t0);
  }
  return valid[valid.length - 1][1];
}

export function bondsAvailable(market: MarketData, curve: 'US' | 'IL', date: ISODate): boolean {
  return Number.isFinite(curveYield(market, curve, 1, date));
}

/** מועדי קופון עתידיים (אחרי date) עד הפדיון */
export function couponDates(issue: ISODate, maturity: ISODate, freq: 1 | 2): ISODate[] {
  const out: ISODate[] = [];
  const step = 12 / freq;
  for (let k = 1; k < 400; k++) {
    const d = addMonths(issue, k * step);
    if (d > maturity) break;
    out.push(d);
  }
  if (!out.length || out[out.length - 1] !== maturity) out.push(maturity);
  return out;
}

/** מחיר אג״ח ל-100 ש״ח/דולר ערך נקוב, לפי תשואה y (באחוזים), ריבית שנתית מורכבת */
export function bondPricePer100(couponRate: number, freq: 1 | 2, issue: ISODate, maturity: ISODate, date: ISODate, yieldPct: number): number {
  const y = yieldPct / 100;
  let pv = 0;
  for (const cd of couponDates(issue, maturity, freq)) {
    if (cd <= date) continue;
    const t = yearsBetween(date, cd);
    pv += (couponRate / freq) / Math.pow(1 + y, t);
  }
  const tm = yearsBetween(date, maturity);
  if (tm > 0) pv += 100 / Math.pow(1 + y, tm);
  return pv;
}

export interface BondQuote {
  product: BondProduct;
  yieldPct: number; // תשואה לפדיון
  couponRate: number; // ריבית שנתית שתקבלו (באחוזים)
  pricePer100: number;
  maturity: ISODate;
}

/** הצעת אג״ח חדשה: הקופון נקבע לפי התשואה של היום (מעוגל ל-1/8 אחוז) */
export function quoteNewBond(market: MarketData, product: BondProduct, date: ISODate): BondQuote | undefined {
  const base = curveYield(market, product.curve, product.termYears, date);
  if (!Number.isFinite(base)) return undefined;
  const ytm = Math.max(0.05, base + product.spread);
  const couponRate = Math.max(0.125, Math.round(ytm * 8) / 8);
  const maturity = addMonths(date, product.termYears * 12);
  const pricePer100 = bondPricePer100(couponRate, product.freq, date, maturity, date, ytm);
  return { product, yieldPct: ytm, couponRate, pricePer100, maturity };
}

/** שווי אג״ח קיימת היום: לפי התשואה הנוכחית לתקופה שנותרה + המרווח */
export function bondMarkPer100(
  market: MarketData,
  b: { curve: 'US' | 'IL'; spread: number; couponRate: number; freq: 1 | 2; issueDate: ISODate; maturity: ISODate },
  date: ISODate
): number {
  const T = yearsBetween(date, b.maturity);
  if (T <= 0) return 100;
  const base = curveYield(market, b.curve, T, date);
  if (!Number.isFinite(base)) return 100;
  return bondPricePer100(b.couponRate, b.freq, b.issueDate, b.maturity, date, Math.max(0.05, base + b.spread));
}

/** מח״מ (דיורציה מקולי) בשנים – להסבר רגישות לריבית */
export function macaulayDuration(couponRate: number, freq: 1 | 2, issue: ISODate, maturity: ISODate, date: ISODate, yieldPct: number): number {
  const y = yieldPct / 100;
  let pv = 0;
  let wsum = 0;
  for (const cd of couponDates(issue, maturity, freq)) {
    if (cd <= date) continue;
    const t = yearsBetween(date, cd);
    let cf = couponRate / freq;
    if (cd === maturity) cf += 100;
    const v = cf / Math.pow(1 + y, t);
    pv += v;
    wsum += t * v;
  }
  return pv > 0 ? wsum / pv : 0;
}
