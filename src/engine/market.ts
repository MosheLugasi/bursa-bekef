// גישה לנתוני שוק: מחירי סגירה (לא מתואמים לפיצולים – "גולמיים"), פיצולים, דיבידנדים, מט״ח ותשואות אג״ח.
// כל הפונקציות כאן טהורות ועובדות על נתונים שכבר נטענו.
import { epochDayToISO, lastIndexLE, type ISODate } from './dates';

export type Currency = 'USD' | 'ILS';

/** סדרה מקודדת: מספרים שלמים (×k), כל ערך הוא הפרש מהערך הקודם שאינו null */
export interface EncodedSeries {
  k: number;
  d: (number | null)[];
}

export function decodeSeries(x: (number | null)[] | EncodedSeries): (number | null)[] {
  if (Array.isArray(x)) return x;
  const out: (number | null)[] = new Array(x.d.length);
  let prev: number | null = null;
  for (let i = 0; i < x.d.length; i++) {
    const v = x.d[i];
    if (v === null || v === undefined) {
      out[i] = null;
      continue;
    }
    prev = prev === null ? v : prev + v;
    out[i] = prev / x.k;
  }
  return out;
}

export interface OverviewFile {
  v: 1 | 2;
  t: number[]; // ימי אפוק (ימים מאז 1970-01-01) – לוח שנה משותף לכל הנכסים
  s: Record<string, (number | null)[] | EncodedSeries>; // מחירי סגירה גולמיים לפי מזהה נכס/מאקרו (v2: מקודד)
  splits: Record<string, [number, number][]>; // [יום, יחס פיצול]
  divs: Record<string, [number, number][]>; // [יום אקס, סכום למניה]
}

export interface DetailFile {
  id: string;
  t: number[];
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
}

export interface Bar {
  date: ISODate;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface ManifestInstrument {
  id: string;
  first: ISODate;
  last: ISODate;
  hasFund: boolean;
  currency: Currency;
}

export interface Manifest {
  version: 1;
  asOf: ISODate; // תאריך המסחר האחרון בנתונים
  generatedAt: string;
  synthetic?: boolean; // נתוני פיתוח סינתטיים – לא אמיתיים!
  instruments: ManifestInstrument[];
  macro: string[];
  news?: boolean;
  newsHe?: boolean;
  failed?: string[];
}

export interface SplitEvent {
  date: ISODate;
  ratio: number;
}
export interface DivEvent {
  date: ISODate;
  amount: number;
}

interface Series {
  raw: Float64Array; // NaN = אין מסחר באותו יום
  ff: Float64Array; // ממולא קדימה
  firstIdx: number;
  lastIdx: number;
}

export class MarketData {
  readonly dates: ISODate[];
  readonly asOf: ISODate;
  readonly first: ISODate;
  private series = new Map<string, Series>();
  private splitMap = new Map<string, SplitEvent[]>();
  private divMap = new Map<string, DivEvent[]>();
  private details = new Map<string, { dates: ISODate[]; bars: Bar[] }>();

  constructor(
    overview: OverviewFile,
    readonly manifest: Manifest
  ) {
    this.dates = overview.t.map(epochDayToISO);
    this.first = this.dates[0];
    this.asOf = manifest.asOf || this.dates[this.dates.length - 1];
    const n = this.dates.length;
    for (const [id, enc] of Object.entries(overview.s)) {
      const arr = decodeSeries(enc);
      const raw = new Float64Array(n).fill(NaN);
      const ff = new Float64Array(n).fill(NaN);
      let last = NaN;
      let firstIdx = -1;
      let lastIdx = -1;
      for (let i = 0; i < n; i++) {
        const v = arr[i];
        if (v !== null && v !== undefined && Number.isFinite(v)) {
          raw[i] = v;
          last = v;
          if (firstIdx < 0) firstIdx = i;
          lastIdx = i;
        }
        ff[i] = last;
      }
      this.series.set(id, { raw, ff, firstIdx, lastIdx });
    }
    for (const [id, arr] of Object.entries(overview.splits || {})) {
      this.splitMap.set(
        id,
        arr.map(([d, r]) => ({ date: epochDayToISO(d), ratio: r })).sort((a, b) => (a.date < b.date ? -1 : 1))
      );
    }
    for (const [id, arr] of Object.entries(overview.divs || {})) {
      this.divMap.set(
        id,
        arr.map(([d, a]) => ({ date: epochDayToISO(d), amount: a })).sort((a, b) => (a.date < b.date ? -1 : 1))
      );
    }
  }

  has(id: string): boolean {
    return this.series.has(id);
  }

  ids(): string[] {
    return [...this.series.keys()];
  }

  /** אינדקס היום האחרון בלוח השנה שהוא <= date */
  idx(date: ISODate): number {
    return lastIndexLE(this.dates, date);
  }

  /** מחיר סגירה גולמי (לא מתואם) באותו יום או ביום המסחר האחרון שלפניו */
  price(id: string, date: ISODate): number {
    const s = this.series.get(id);
    if (!s) return NaN;
    const i = this.idx(date);
    if (i < 0) return NaN;
    return s.ff[i];
  }

  /** האם הנכס נסחר בדיוק ביום הזה */
  tradedOn(id: string, date: ISODate): boolean {
    const s = this.series.get(id);
    if (!s) return false;
    const i = this.idx(date);
    return i >= 0 && this.dates[i] === date && !Number.isNaN(s.raw[i]);
  }

  firstDate(id: string): ISODate | undefined {
    const s = this.series.get(id);
    if (!s || s.firstIdx < 0) return undefined;
    return this.dates[s.firstIdx];
  }

  lastDate(id: string): ISODate | undefined {
    const s = this.series.get(id);
    if (!s || s.lastIdx < 0) return undefined;
    return this.dates[s.lastIdx];
  }

  /** האם קיים מחיר לנכס בתאריך (כלומר הנכס כבר הונפק) */
  available(id: string, date: ISODate): boolean {
    const f = this.firstDate(id);
    return !!f && f <= date;
  }

  splits(id: string): SplitEvent[] {
    return this.splitMap.get(id) || [];
  }

  dividends(id: string): DivEvent[] {
    return this.divMap.get(id) || [];
  }

  /** פיצולים בטווח (from, to] */
  splitsBetween(id: string, fromExcl: ISODate, toIncl: ISODate): SplitEvent[] {
    return this.splits(id).filter((s) => s.date > fromExcl && s.date <= toIncl);
  }

  divsBetween(id: string, fromExcl: ISODate, toIncl: ISODate): DivEvent[] {
    return this.dividends(id).filter((s) => s.date > fromExcl && s.date <= toIncl);
  }

  /** מכפלת יחסי הפיצול שקרו אחרי date ועד asOf (כולל) */
  splitFactor(id: string, date: ISODate, asOf: ISODate): number {
    let f = 1;
    for (const s of this.splits(id)) if (s.date > date && s.date <= asOf) f *= s.ratio;
    return f;
  }

  /** מחיר מתואם לפיצולים כפי שהיה נראה בגרף בתאריך asOf */
  adjPrice(id: string, date: ISODate, asOf: ISODate): number {
    return this.price(id, date) / this.splitFactor(id, date, asOf);
  }

  /** שינוי באחוזים (כשבר עשרוני) בין שני תאריכים, מתואם לפיצולים */
  change(id: string, from: ISODate, to: ISODate): number {
    const a = this.adjPrice(id, from, to);
    const b = this.price(id, to);
    if (!(a > 0) || !(b > 0)) return NaN;
    return b / a - 1;
  }

  /** שינוי יומי: מול יום המסחר הקודם של הנכס */
  dayChange(id: string, date: ISODate): number {
    const s = this.series.get(id);
    if (!s) return NaN;
    let i = this.idx(date);
    // מוצאים את יום המסחר האחרון של הנכס עד date
    while (i >= 0 && Number.isNaN(s.raw[i])) i--;
    let j = i - 1;
    while (j >= 0 && Number.isNaN(s.raw[j])) j--;
    if (i < 0 || j < 0) return NaN;
    const cur = s.raw[i];
    const prev = s.raw[j] / this.splitFactor(id, this.dates[j], this.dates[i]);
    return cur / prev - 1;
  }

  /** סדרת מחירים מתואמת לפיצולים להצגה בגרף, עד asOf (לא כולל ימים בלי מסחר) */
  closeSeries(id: string, fromDate: ISODate, asOf: ISODate): { date: ISODate; value: number }[] {
    const s = this.series.get(id);
    if (!s) return [];
    const out: { date: ISODate; value: number }[] = [];
    const end = this.idx(asOf);
    const splits = this.splits(id).filter((x) => x.date <= asOf);
    for (let i = Math.max(0, s.firstIdx); i <= end; i++) {
      const d = this.dates[i];
      if (d < fromDate) continue;
      const v = s.raw[i];
      if (Number.isNaN(v)) continue;
      let f = 1;
      for (const sp of splits) if (sp.date > d) f *= sp.ratio;
      out.push({ date: d, value: v / f });
    }
    return out;
  }

  /** N מחירי סגירה אחרונים (מתואמים) – לגרף קטן */
  spark(id: string, asOf: ISODate, n = 30): number[] {
    const s = this.series.get(id);
    if (!s) return [];
    const out: number[] = [];
    let i = this.idx(asOf);
    while (i >= 0 && out.length < n) {
      const v = s.raw[i];
      if (!Number.isNaN(v)) out.push(v / this.splitFactor(id, this.dates[i], asOf));
      i--;
    }
    return out.reverse();
  }

  /** שער חליפין: כמה יחידות של to שוות יחידה אחת של from */
  fx(from: Currency, to: Currency, date: ISODate): number {
    if (from === to) return 1;
    const usdils = this.price('USDILS', date);
    const rate = Number.isFinite(usdils) && usdils > 0 ? usdils : 3.6;
    return from === 'USD' ? rate : 1 / rate;
  }

  /** תשואה/ריבית באחוזים (למשל 4.25) */
  rate(seriesId: string, date: ISODate): number {
    return this.price(seriesId, date);
  }

  /** תנודתיות היסטורית שנתית (סטיית תקן של תשואות לוג יומיות × שורש 252) */
  histVol(id: string, date: ISODate, window = 60): number {
    const s = this.series.get(id);
    if (!s) return NaN;
    let i = this.idx(date);
    const vals: { d: ISODate; v: number }[] = [];
    while (i >= 0 && vals.length < window + 1) {
      const v = s.raw[i];
      if (!Number.isNaN(v)) vals.push({ d: this.dates[i], v });
      i--;
    }
    if (vals.length < 10) return NaN;
    vals.reverse();
    const rets: number[] = [];
    for (let k = 1; k < vals.length; k++) {
      const prev = vals[k - 1].v / this.splitFactor(id, vals[k - 1].d, vals[k].d);
      rets.push(Math.log(vals[k].v / prev));
    }
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
    return Math.sqrt(variance) * Math.sqrt(252);
  }

  /** ימי הלוח בטווח (from, to] */
  datesBetween(fromExcl: ISODate, toIncl: ISODate): ISODate[] {
    const a = lastIndexLE(this.dates, fromExcl) + 1;
    const b = lastIndexLE(this.dates, toIncl);
    return a <= b ? this.dates.slice(a, b + 1) : [];
  }

  /** יום המסחר הבא אחרי date (או date עצמו אם אין) */
  nextDate(date: ISODate): ISODate {
    const i = lastIndexLE(this.dates, date) + 1;
    return i < this.dates.length ? this.dates[i] : this.asOf;
  }

  /** יום המסחר האחרון שהוא <= date */
  snap(date: ISODate): ISODate {
    const i = this.idx(date);
    return i >= 0 ? this.dates[i] : this.dates[0];
  }

  // ---------- נתונים מפורטים (OHLC) ----------
  setDetail(file: DetailFile) {
    const dates = file.t.map(epochDayToISO);
    const bars: Bar[] = dates.map((d, i) => ({ date: d, o: file.o[i], h: file.h[i], l: file.l[i], c: file.c[i], v: file.v?.[i] ?? 0 }));
    this.details.set(file.id, { dates, bars });
  }

  hasDetail(id: string): boolean {
    return this.details.has(id);
  }

  bar(id: string, date: ISODate): Bar | undefined {
    const d = this.details.get(id);
    if (d) {
      const i = lastIndexLE(d.dates, date);
      if (i >= 0 && d.dates[i] === date) return d.bars[i];
      return undefined;
    }
    // נפילה חכמה: אם אין נתונים מפורטים – משתמשים בסגירה בלבד
    if (!this.tradedOn(id, date)) return undefined;
    const c = this.price(id, date);
    return { date, o: c, h: c, l: c, c, v: 0 };
  }

  /** נרות מתואמים לפיצולים להצגה בגרף */
  barSeries(id: string, fromDate: ISODate, asOf: ISODate): Bar[] {
    const d = this.details.get(id);
    if (!d) return [];
    const splits = this.splits(id).filter((x) => x.date <= asOf);
    const out: Bar[] = [];
    for (const b of d.bars) {
      if (b.date < fromDate || b.date > asOf) continue;
      let f = 1;
      for (const sp of splits) if (sp.date > b.date) f *= sp.ratio;
      out.push(f === 1 ? b : { date: b.date, o: b.o / f, h: b.h / f, l: b.l / f, c: b.c / f, v: b.v * f });
    }
    return out;
  }
}
