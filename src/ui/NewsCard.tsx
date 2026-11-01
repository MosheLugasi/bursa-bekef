import { Link } from 'react-router-dom';
import type { NewsItem } from '@/data/loader';
import { inst } from '@/engine/universe';
import { formatDateHe } from '@/engine/dates';
import { clsx } from './format';

const SENT: Record<string, string> = { positive: '😃 נשמע חיובי', negative: '😟 נשמע שלילי', neutral: '😐 ניטרלי' };

/** כותרת לתצוגה: תרגום עברי אם יש, אחרת הכותרת המקורית */
export function newsTitle(n: NewsItem): string {
  return n.he?.titleHe ?? n.title;
}

/** מסדר: קודם ידיעות בעברית (או מתורגמות), ואז לפי זמן */
export function sortNews(list: NewsItem[]): NewsItem[] {
  const heb = (n: NewsItem) => (n.lang === 'he' || n.he ? 1 : 0);
  return [...list].sort((a, b) => heb(b) - heb(a) || (a.time < b.time ? 1 : -1));
}

export function NewsCard({ n, kid, showTickers }: { n: NewsItem; kid: boolean; showTickers?: boolean }) {
  const hebrew = n.lang === 'he' || !!n.he;
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3">
      <div className="text-xs text-slate-500 flex gap-2 flex-wrap items-center">
        <span>{n.time ? formatDateHe(n.time.slice(0, 10), { short: true }) : ''}</span>
        {n.publisher && <span>· {n.publisher}</span>}
        {showTickers &&
          n.tickers.map((t) => (
            <Link key={t} to={`/asset/${encodeURIComponent(t)}`} className="text-brand-700">
              {inst(t)?.emoji} {inst(t)?.nameHe ?? t}
            </Link>
          ))}
        {n.he && <span>{SENT[n.he.sentiment]}</span>}
        {!hebrew && <span className="chip text-[10px] py-0">🇺🇸 באנגלית</span>}
      </div>
      <a href={n.url} target="_blank" rel="noreferrer" dir="auto" className={clsx('block font-bold mt-0.5 hover:underline', !hebrew && 'text-slate-700')}>
        {newsTitle(n)} <span className="text-slate-400 font-normal">↗</span>
      </a>
      {n.he && <div className="text-sm text-slate-700 mt-1">{kid ? n.he.kidHe : n.he.summaryHe}</div>}
    </div>
  );
}
