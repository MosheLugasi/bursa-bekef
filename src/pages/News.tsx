import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useActivePortfolio, useCurrentProfile } from '@/state/store';
import { loadNews, useMarket, type NewsItem } from '@/data/loader';
import { eventsUntil } from '@/content';
import { addDays, formatDateHe } from '@/engine/dates';
import { inst } from '@/engine/universe';
import { Change, RichText, Segmented } from '@/ui/components';
import { clsx } from '@/ui/format';

const CAT: Record<string, string> = { pandemic: '🦠 מגפה', rates: '🏦 ריבית', tech: '💡 טכנולוגיה', war: '⚔️ ביטחון', earnings: '📊 דוחות', politics: '🏛️ פוליטיקה', energy: '⛽ אנרגיה', company: '🏢 חברות', crisis: '🚨 משבר', market: '📈 שוק' };

export default function News() {
  const market = useMarket();
  const p = useActivePortfolio();
  const profile = useCurrentProfile()!;
  const date = p?.currentDate ?? market.asOf;
  const [news, setNews] = useState<NewsItem[]>([]);
  const [tab, setTab] = useState<'history' | 'live'>(p?.mode === 'live' ? 'live' : 'history');
  const [kid, setKid] = useState(profile.ageGroup !== 'adult');
  useEffect(() => {
    loadNews().then(setNews);
  }, []);
  const events = useMemo(() => eventsUntil(date), [date]);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">📰 חדשות ואקטואליה</h1>
        <Segmented value={kid ? 'kid' : 'adult'} onChange={(v) => setKid(v === 'kid')} options={[{ value: 'kid', label: '🧒' }, { value: 'adult', label: '🧑' }]} className="w-24" />
      </div>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'history', label: '📜 אירועים שהזיזו את השוק' },
          { value: 'live', label: '📡 כותרות אחרונות' }
        ]}
      />
      {tab === 'history' && (
        <>
          <div className="text-sm text-slate-500">אירועים אמיתיים עד {formatDateHe(date)} (במכונת הזמן לא רואים את העתיד 😉)</div>
          <div className="space-y-3">
            {events.map((e) => {
              const t = e.tickers.find((x) => market.available(x, e.date));
              const d0 = market.nextDate(addDays(e.date, -1));
              const move = t && d0 <= date ? market.change(t, market.snap(addDays(d0, -1)), d0) : NaN;
              return (
                <div key={e.id} className="card p-4">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{formatDateHe(e.date, { weekday: true })}</span>
                    <span className="chip text-xs py-0.5">{CAT[e.category] ?? e.category}</span>
                  </div>
                  <div className="font-bold text-lg mt-1">
                    {e.emoji} {e.title}
                  </div>
                  <div className="mt-1 text-slate-700">
                    <RichText text={kid ? e.kid : e.adult} />
                  </div>
                  <div className="flex gap-1.5 flex-wrap mt-2">
                    {e.tickers.map((x) =>
                      inst(x) ? (
                        <Link key={x} to={`/asset/${encodeURIComponent(x)}`} className="chip text-xs hover:bg-brand-50">
                          {inst(x)!.emoji} {inst(x)!.nameHe}
                        </Link>
                      ) : null
                    )}
                    {Number.isFinite(move) && (
                      <span className="text-xs text-slate-600 self-center">
                        תגובה באותו יום: <Change value={move} />
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-sm bg-amber-50 rounded-lg p-2">
                    💡 <RichText text={e.lesson} />
                  </div>
                </div>
              );
            })}
            {!events.length && <div className="text-center text-slate-500 py-8">אין אירועים לפני התאריך הזה.</div>}
          </div>
        </>
      )}
      {tab === 'live' && (
        <div className="space-y-2">
          {!news.length && <div className="text-center text-slate-500 py-8">אין כותרות כרגע.</div>}
          {news.slice(0, 80).map((n) => (
            <div key={n.id} className="card p-3">
              <div className="text-xs text-slate-500 flex gap-2 flex-wrap">
                <span>{n.time.slice(0, 10)}</span>
                {n.tickers.map((t) => (
                  <Link key={t} to={`/asset/${encodeURIComponent(t)}`} className="text-brand-700">
                    {inst(t)?.emoji} {inst(t)?.nameHe ?? t}
                  </Link>
                ))}
                {n.he && <span>{n.he.sentiment === 'positive' ? '😃 חיובי' : n.he.sentiment === 'negative' ? '😟 שלילי' : '😐 ניטרלי'}</span>}
              </div>
              {n.he && (
                <>
                  <div className="font-bold">{n.he.titleHe}</div>
                  <div className="text-sm text-slate-700">{kid ? n.he.kidHe : n.he.summaryHe}</div>
                </>
              )}
              <a href={n.url} target="_blank" rel="noreferrer" className={clsx('block text-sm mt-1', n.he ? 'text-slate-500' : 'font-semibold text-slate-800')} dir="ltr">
                {n.title} ↗
              </a>
            </div>
          ))}
          {news.length > 0 && !news.some((n) => n.he) && <div className="text-xs text-slate-500">💡 אפשר להפעיל תרגום אוטומטי לעברית (עם הסבר לילדים) – ראו בהוראות בקובץ README.</div>}
        </div>
      )}
    </div>
  );
}
