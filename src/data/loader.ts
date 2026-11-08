// טעינת נתוני השוק (קבצי JSON סטטיים שנוצרים ב-GitHub Actions)
import { create } from 'zustand';
import { MarketData, type DetailFile, type Manifest, type OverviewFile } from '@/engine/market';
import { SITE_ROOT } from '@/ui/links';
import { hasPig } from '@/content/noPig';

const LOCAL = `${SITE_ROOT}data/`;
/**
 * הנתונים נוצרים כל יום ב-GitHub Actions ומתפרסמים יחד עם האתר ב-GitHub Pages.
 * כשהאתר רץ במקום אחר (למשל בתצוגה המקדימה של Base44) ואין בו תיקיית data –
 * טוענים את אותם קבצים מהאתר ב-GitHub Pages (שמאפשר גישה מכל דומיין).
 */
const REMOTES = [(import.meta.env.VITE_DATA_URL as string | undefined) || 'https://shori.co.il/data/', 'https://moshelugasi.github.io/bursa-bekef/data/'];
let BASE = LOCAL;

async function fetchJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url.split('/').pop()}: ${r.status}`);
  const text = await r.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    // שרתים שמחזירים את דף האפליקציה במקום קובץ חסר
    throw new Error(`${url.split('/').pop()}: not JSON`);
  }
}

async function getJSON<T>(path: string): Promise<T> {
  return fetchJSON<T>(BASE + path);
}

/** בוחרים מקור נתונים: קודם מקומי, ואם אין – האתר (shori.co.il, ואז הכתובת הישנה ב-GitHub Pages) */
async function getManifest(): Promise<Manifest> {
  let err: unknown;
  for (const base of [LOCAL, ...REMOTES]) {
    if (base !== LOCAL && new URL(base).href === new URL(LOCAL, location.href).href) continue;
    try {
      const m = await fetchJSON<Manifest>(base + 'manifest.json');
      BASE = base;
      return m;
    } catch (e) {
      err ??= e;
    }
  }
  throw err;
}

interface MarketState {
  market?: MarketData;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  version: number; // עולה בכל פעם שנטענים נתונים מפורטים (כדי לרנדר מחדש)
  load: () => Promise<MarketData | undefined>;
  bump: () => void;
}

let loading: Promise<MarketData | undefined> | null = null;

export const useMarketStore = create<MarketState>((set, get) => ({
  status: 'idle',
  version: 0,
  load: () => {
    if (get().market) return Promise.resolve(get().market);
    if (loading) return loading;
    set({ status: 'loading' });
    loading = (async () => {
      try {
        const manifest = await getManifest();
        const overview = await getJSON<OverviewFile>('closes.json');
        const market = new MarketData(overview, manifest);
        set({ market, status: 'ready' });
        return market;
      } catch (e) {
        set({ status: 'error', error: String(e) });
        loading = null;
        return undefined;
      }
    })();
    return loading;
  },
  bump: () => set((s) => ({ version: s.version + 1 }))
}));

export function useMarket(): MarketData {
  const m = useMarketStore((s) => s.market);
  useMarketStore((s) => s.version);
  if (!m) throw new Error('market not loaded');
  return m;
}

const detailPromises = new Map<string, Promise<void>>();

/** טעינת נרות (OHLC) לנכסים – נדרש לגרף נרות ולעיבוד פקודות */
export async function ensureDetails(market: MarketData, ids: string[]): Promise<void> {
  const todo = ids.filter((id) => market.has(id) && !market.hasDetail(id));
  await Promise.all(
    todo.map((id) => {
      let p = detailPromises.get(id);
      if (!p) {
        p = getJSON<DetailFile>(`prices/${encodeURIComponent(id)}.json`)
          .then((f) => market.setDetail(f))
          .catch(() => {
            detailPromises.delete(id);
          });
        detailPromises.set(id, p);
      }
      return p;
    })
  );
  if (todo.length) useMarketStore.getState().bump();
}

// ---------------- דוחות כספיים
export interface FundRow {
  date: string;
  revenue?: number | null;
  grossProfit?: number | null;
  operatingIncome?: number | null;
  netIncome?: number | null;
  eps?: number | null;
  shares?: number | null;
  totalAssets?: number | null;
  totalLiabilities?: number | null;
  equity?: number | null;
  cash?: number | null;
  totalDebt?: number | null;
  currentAssets?: number | null;
  currentLiabilities?: number | null;
  operatingCashFlow?: number | null;
  freeCashFlow?: number | null;
}

export interface FundFile {
  id: string;
  updated: string;
  currency: string;
  info: Record<string, string | number | undefined>;
  annual: FundRow[];
  quarterly: FundRow[];
  earnings: { date: string; epsEstimate: number | null; epsActual: number | null; surprisePct: number | null }[];
}

const fundCache = new Map<string, Promise<FundFile | null>>();
export function loadFund(id: string): Promise<FundFile | null> {
  let p = fundCache.get(id);
  if (!p) {
    p = getJSON<FundFile>(`fund/${encodeURIComponent(id)}.json`).catch(() => null);
    fundCache.set(id, p);
  }
  return p;
}

// ---------------- חדשות
export interface NewsItem {
  id: string;
  tickers: string[];
  title: string;
  summary: string;
  publisher: string;
  url: string;
  time: string;
  lang?: 'he' | 'en';
  he?: { titleHe: string; summaryHe: string; kidHe: string; sentiment: 'positive' | 'negative' | 'neutral' };
}

let newsPromise: Promise<NewsItem[]> | null = null;
export function loadNews(): Promise<NewsItem[]> {
  if (!newsPromise) newsPromise = getJSON<{ items: NewsItem[] }>('news.json').then((d) => (d.items || []).filter((n) => !hasPig(JSON.stringify(n)))).catch(() => []);
  return newsPromise;
}
