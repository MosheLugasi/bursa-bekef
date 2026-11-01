// עבודה עם תאריכים בפורמט ISO (YYYY-MM-DD). השוואה לקסיקוגרפית = השוואה כרונולוגית.
export type ISODate = string;

const DAY_MS = 86_400_000;

export function epochDayToISO(d: number): ISODate {
  return new Date(d * DAY_MS).toISOString().slice(0, 10);
}

export function isoToEpochDay(s: ISODate): number {
  return Math.round(Date.parse(s + 'T00:00:00Z') / DAY_MS);
}

export function addDays(s: ISODate, n: number): ISODate {
  return epochDayToISO(isoToEpochDay(s) + n);
}

export function addMonths(s: ISODate, n: number): ISODate {
  const [y, m, d] = s.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return isoToEpochDay(b) - isoToEpochDay(a);
}

export function yearsBetween(a: ISODate, b: ISODate): number {
  return daysBetween(a, b) / 365.25;
}

/** יום שישי השלישי בחודש – מועד הפקיעה המקובל של אופציות בארה״ב */
export function thirdFriday(year: number, month1: number): ISODate {
  const first = new Date(Date.UTC(year, month1 - 1, 1));
  const dow = first.getUTCDay(); // 0=Sun..5=Fri
  const firstFriday = 1 + ((5 - dow + 7) % 7);
  const day = firstFriday + 14;
  return `${year}-${String(month1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export function formatDateHe(s: ISODate, opts: { weekday?: boolean; short?: boolean } = {}): string {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  if (opts.short) return `${d}.${m}.${String(y).slice(2)}`;
  const base = `${d} ב${HE_MONTHS[m - 1]} ${y}`;
  if (opts.weekday) {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return `יום ${HE_DAYS[dow]}, ${base}`;
  }
  return base;
}

export function monthNameHe(s: ISODate): string {
  const [y, m] = s.split('-').map(Number);
  return `${HE_MONTHS[m - 1]} ${y}`;
}

export function todayISO(): ISODate {
  return new Date().toISOString().slice(0, 10);
}

/** חיפוש בינארי: האינדקס האחרון שבו arr[i] <= x, או -1 */
export function lastIndexLE(arr: ArrayLike<string | number>, x: string | number): number {
  let lo = 0;
  let hi = arr.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= x) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** האינדקס הראשון שבו arr[i] > x, או arr.length */
export function firstIndexGT(arr: ArrayLike<string | number>, x: string | number): number {
  return lastIndexLE(arr, x) + 1;
}
