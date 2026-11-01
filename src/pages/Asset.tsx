import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useActivePortfolio, useCurrentProfile, useGame } from '@/state/store';
import { ensureDetails, loadNews, useMarket, type NewsItem } from '@/data/loader';
import { inst, SECTORS } from '@/engine/universe';
import { addDays, addMonths, formatDateHe } from '@/engine/dates';
import { stockPosition } from '@/engine/trading';
import { COMPANIES, eventsUntil } from '@/content';
import { hasFeature } from '@/game/features';
import { markCompanyRead } from '@/game/actions';
import { PriceChart, RangeBar, type ChartMarker } from '@/ui/charts';
import { Change, Empty, HelpButton, RichText, Segmented, SectionTitle, Term, useCoachOnce } from '@/ui/components';
import { TradeSheet, ProtectionSheet } from '@/ui/TradeSheet';
import { Fundamentals } from '@/ui/Fundamentals';
import { OptionsPanel } from '@/ui/OptionsPanel';
import { NewsCard, sortNews } from '@/ui/NewsCard';
import { clsx, fmtMoney, fmtNum, fmtPrice } from '@/ui/format';

const RANGES = [
  { k: '1m', label: 'חודש', months: 1 },
  { k: '3m', label: '3 ח׳', months: 3 },
  { k: '6m', label: 'חצי שנה', months: 6 },
  { k: '1y', label: 'שנה', months: 12 },
  { k: '5y', label: '5 שנים', months: 60 },
  { k: 'all', label: 'הכל', months: 0 }
];

type Tab = 'about' | 'reports' | 'news' | 'options';

export default function Asset() {
  const { id: rawId } = useParams();
  const id = decodeURIComponent(rawId ?? '');
  const market = useMarket();
  const profile = useCurrentProfile()!;
  const p = useActivePortfolio();
  const updateProfile = useGame((s) => s.updateProfile);
  const i = inst(id);
  const date = p?.currentDate ?? market.asOf;
  const [range, setRange] = useState('1y');
  const [mode, setMode] = useState<'line' | 'candle'>('line');
  const [tab, setTab] = useState<Tab>('about');
  const [trade, setTrade] = useState<'buy' | 'sell' | null>(null);
  const [protect, setProtect] = useState(false);
  const [kidView, setKidView] = useState(profile.ageGroup !== 'adult');
  const [news, setNews] = useState<NewsItem[]>([]);
  useCoachOnce('asset');

  useEffect(() => {
    if (i) markCompanyRead(profile.id, i.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    if (mode === 'candle') ensureDetails(market, [id]);
  }, [mode, id, market]);
  useEffect(() => {
    loadNews().then((n) => setNews(n.filter((x) => x.tickers.includes(id))));
  }, [id]);

  const from = useMemo(() => {
    const r = RANGES.find((x) => x.k === range)!;
    return r.months ? addMonths(date, -r.months) : '1900-01-01';
  }, [range, date]);
  const line = useMemo(() => market.closeSeries(id, from, date), [market, id, from, date]);
  const bars = useMemo(() => (mode === 'candle' && market.hasDetail(id) ? market.barSeries(id, from, date) : undefined), [market, id, from, date, mode]);
  const year = useMemo(() => market.closeSeries(id, addDays(date, -365), date), [market, id, date]);
  const markers = useMemo<ChartMarker[]>(() => {
    const out: ChartMarker[] = [];
    if (p) for (const t of p.txs) if (t.instrumentId === id && (t.type === 'buy' || t.type === 'sell') && t.date <= date) out.push({ date: market.snap(t.date), kind: t.type });
    for (const e of eventsUntil(date, id)) out.push({ date: market.nextDate(addDays(e.date, -1)), kind: 'news', text: e.emoji });
    return out;
  }, [p, id, date, market]);

  if (!i) return <Empty emoji="🤷" title="לא מצאנו את הנכס הזה" />;
  const company = COMPANIES[id];
  const avail = market.available(id, date);
  const price = market.price(id, date);
  const pos = p ? stockPosition(p, id) : undefined;
  const watching = profile.watchlist.includes(id);
  const hi = year.length ? Math.max(...year.map((x) => x.value)) : NaN;
  const lo = year.length ? Math.min(...year.map((x) => x.value)) : NaN;
  const canCandles = hasFeature(profile, 'candles');
  const histEvents = eventsUntil(date, id);
  const posValue = pos ? pos.qty * price * market.fx(i.currency, p!.baseCurrency, date) : 0;
  const posPnl = pos ? posValue - pos.avgCostBase * pos.qty : 0;

  return (
    <div className="space-y-4 pb-16">
      <div className="flex items-start gap-3">
        <div className="text-5xl">{i.emoji}</div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight">{i.nameHe}</h1>
          <div className="text-sm text-slate-500 flex flex-wrap gap-x-2">
            <span dir="ltr">{i.nameEn}</span>·<span dir="ltr">{i.id.replace('.TA', '')}</span>·<span>{i.market === 'IL' ? '🇮🇱 ת״א' : '🇺🇸 וול סטריט'}</span>·
            <span>
              {SECTORS[i.sector]?.emoji} {SECTORS[i.sector]?.nameHe}
            </span>
          </div>
        </div>
        <button
          onClick={() => updateProfile(profile.id, (x) => ({ ...x, watchlist: watching ? x.watchlist.filter((w) => w !== id) : [...x.watchlist, id] }))}
          className={clsx('w-10 h-10 rounded-full text-xl border', watching ? 'bg-amber-100 border-amber-300' : 'bg-white border-slate-200')}
          title="מועדפים"
        >
          {watching ? '⭐' : '☆'}
        </button>
        <HelpButton coachKey="asset" />
      </div>

      {!avail ? (
        <div className="card p-6 text-center">
          <div className="text-4xl">⏳</div>
          <div className="font-bold mt-2">בתאריך {formatDateHe(date)} החברה עוד לא נסחרה בבורסה</div>
          <div className="text-sm text-slate-600 mt-1">היא התחילה להיסחר ב-{formatDateHe(market.firstDate(id) ?? '')}. המשיכו להתקדם בזמן!</div>
        </div>
      ) : (
        <div className="card p-4">
          <div className="flex items-end justify-between flex-wrap gap-2">
            <div>
              <div className="text-3xl font-extrabold num">{fmtPrice(price, i.currency)}</div>
              <div className="text-xs text-slate-500">{formatDateHe(market.lastDate(id)! < date ? market.lastDate(id)! : market.snap(date))}</div>
            </div>
            <div className="flex gap-1.5 flex-wrap text-xs">
              {[
                ['יום', market.dayChange(id, date)],
                ['שבוע', market.change(id, addDays(date, -7), date)],
                ['חודש', market.change(id, addMonths(date, -1), date)],
                ['שנה', market.change(id, addMonths(date, -12), date)]
              ].map(([l, v]) => (
                <span key={l as string} className="flex flex-col items-center">
                  <span className="text-slate-500">{l as string}</span>
                  <Change value={v as number} />
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
            <div className="flex gap-1 overflow-x-auto no-scrollbar">
              {RANGES.map((r) => (
                <button key={r.k} onClick={() => setRange(r.k)} className={clsx('rounded-lg px-2.5 py-1 text-sm font-semibold whitespace-nowrap', range === r.k ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100')}>
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button onClick={() => setMode('line')} className={clsx('rounded-lg px-2.5 py-1 text-sm', mode === 'line' ? 'bg-brand-600 text-white' : 'bg-slate-100')}>
                📈 קו
              </button>
              <button
                onClick={() => canCandles && setMode('candle')}
                className={clsx('rounded-lg px-2.5 py-1 text-sm', mode === 'candle' ? 'bg-brand-600 text-white' : 'bg-slate-100', !canCandles && 'opacity-50')}
                title={canCandles ? '' : 'נפתח אחרי השיעור "איך קוראים גרף"'}
              >
                {canCandles ? '🕯️' : '🔒'} <Term id="candlestick">נרות</Term>
              </button>
            </div>
          </div>
          <div className="mt-2">
            <PriceChart line={line} bars={bars} mode={mode} markers={markers} />
          </div>
          {Number.isFinite(hi) && (
            <div className="mt-3">
              <div className="text-xs text-slate-500 mb-1">
                <Term id="range-52w">טווח שנה אחרונה</Term>: איפה המחיר היום בין הנמוך לגבוה
              </div>
              <RangeBar low={lo} high={hi} value={price} labelLow={`נמוך ${fmtNum(lo)}`} labelHigh={`גבוה ${fmtNum(hi)}`} />
            </div>
          )}
          <div className="text-xs text-slate-500 mt-2">▲ כחול = קנייה שלכם · ▼ כתום = מכירה · ● סגול = חדשות</div>
        </div>
      )}

      {pos && p && (
        <div className="card p-4">
          <SectionTitle>💼 יש לכם בתיק</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <div>
              <div className="text-xs text-slate-500">כמות</div>
              <div className="font-bold num">{pos.qty} מניות</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">
                <Term id="avg-cost">מחיר קנייה ממוצע</Term>
              </div>
              <div className="font-bold num">{fmtPrice(pos.avgCost, i.currency)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">שווי היום</div>
              <div className="font-bold num">{fmtMoney(posValue, p.baseCurrency)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">
                <Term id="unrealized-pnl">רווח/הפסד</Term>
              </div>
              <div className={clsx('font-bold num', posPnl >= 0 ? 'text-up' : 'text-down')}>
                {posPnl >= 0 ? '+' : ''}
                {fmtMoney(posPnl, p.baseCurrency)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 text-sm flex-wrap">
            <span className="chip">🛡️ סטופ: {pos.stopLoss ? fmtPrice(pos.stopLoss, i.currency) : 'אין'}</span>
            <span className="chip">💰 טייק: {pos.takeProfit ? fmtPrice(pos.takeProfit, i.currency) : 'אין'}</span>
            {(hasFeature(profile, 'stopLoss') || hasFeature(profile, 'takeProfit')) && (
              <button className="btn-soft text-sm py-1" onClick={() => setProtect(true)}>
                עריכה
              </button>
            )}
          </div>
        </div>
      )}

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'about', label: '🏢 מה החברה עושה' },
          { value: 'reports', label: '📊 דוחות' },
          { value: 'news', label: '📰 חדשות' },
          ...(i.optionable ? [{ value: 'options' as Tab, label: '🎟️ אופציות' }] : [])
        ]}
      />

      <div className="card p-4">
        {tab === 'about' &&
          (company ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-lg font-bold">{company.tagline}</div>
                <Segmented
                  value={kidView ? 'kid' : 'adult'}
                  onChange={(v) => setKidView(v === 'kid')}
                  options={[
                    { value: 'kid', label: '🧒' },
                    { value: 'adult', label: '🧑' }
                  ]}
                  className="w-24 shrink-0"
                />
              </div>
              <p className="text-base leading-relaxed">
                <RichText text={kidView ? company.kid : company.adult} />
              </p>
              <Block title="💵 איך החברה מרוויחה כסף?" items={company.howMakesMoney} />
              {company.products.length > 0 && (
                <div>
                  <div className="font-bold mb-1">🛍️ מוצרים ומותגים</div>
                  <div className="flex flex-wrap gap-1.5">
                    {company.products.map((x) => (
                      <span key={x} className="chip">
                        {x}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <Block title="🤩 הידעתם?" items={company.funFacts} />
              <div className="grid sm:grid-cols-2 gap-3">
                <Block title="🚀 מה יכול לעזור לה לגדול" items={company.opportunities} className="bg-up-bg/60" />
                <Block title="⚠️ מה יכול להזיק לה" items={company.risks} className="bg-down-bg/60" />
              </div>
              {company.israelConnection && (
                <div className="rounded-xl bg-sky-50 p-3">
                  <div className="font-bold mb-1">🇮🇱 קשר לישראל</div>
                  <RichText text={company.israelConnection} />
                </div>
              )}
              {company.competitors.length > 0 && (
                <div>
                  <div className="font-bold mb-1">🥊 מתחרים</div>
                  <div className="flex flex-wrap gap-1.5">
                    {company.competitors.map((c) =>
                      inst(c) ? (
                        <Link key={c} to={`/asset/${encodeURIComponent(c)}`} className="chip hover:bg-brand-50">
                          {inst(c)!.emoji} {inst(c)!.nameHe}
                        </Link>
                      ) : (
                        <span key={c} className="chip">
                          {c}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}
              <div className="text-xs text-slate-500">
                {company.founded && <>נוסדה ב-{company.founded} · </>}
                {company.headquarters}
              </div>
            </div>
          ) : (
            <div className="text-slate-500">אין עדיין תיאור לחברה הזו.</div>
          ))}
        {tab === 'reports' &&
          (i.type === 'stock' ? (
            <Fundamentals id={id} date={date} />
          ) : (
            <div className="text-slate-600">
              זו <Term id="etf">קרן סל</Term> ולא חברה, ולכן אין לה דוחות כספיים משלה. הקרן מחזיקה הרבה נכסים יחד – קראו בלשונית "מה החברה עושה" מה יש בתוכה.
            </div>
          ))}
        {tab === 'news' && (
          <div className="space-y-3">
            {histEvents.map((e) => (
              <div key={e.id} className="rounded-xl border border-slate-100 p-3">
                <div className="text-xs text-slate-500">{formatDateHe(e.date)}</div>
                <div className="font-bold">
                  {e.emoji} {e.title}
                </div>
                <div className="text-sm mt-1">
                  <RichText text={kidView ? e.kid : e.adult} />
                </div>
                <div className="text-sm mt-2 bg-amber-50 rounded-lg p-2">
                  💡 <RichText text={e.lesson} />
                </div>
              </div>
            ))}
            {p?.mode !== 'history' && news.length > 0 && <div className="font-bold pt-2">📡 כותרות מהימים האחרונים</div>}
            {p?.mode !== 'history' && sortNews(news).slice(0, 12).map((n) => <NewsCard key={n.id} n={n} kid={kidView} />)}
            {histEvents.length === 0 && (p?.mode === 'history' || news.length === 0) && <div className="text-slate-500 text-center py-4">אין חדשות מיוחדות על החברה הזו עד התאריך הזה.</div>}
          </div>
        )}
        {tab === 'options' && p && <OptionsPanel p={p} underlying={id} />}
      </div>

      {p && avail && (
        <div className="fixed bottom-[60px] md:bottom-4 inset-x-0 z-30 px-3 safe-bottom pointer-events-none">
          <div className="max-w-md mx-auto grid grid-cols-2 gap-2 pointer-events-auto">
            <button className="btn-buy text-lg shadow-lg" onClick={() => setTrade('buy')}>
              🛒 קנייה
            </button>
            <button className="btn-sell text-lg shadow-lg" onClick={() => setTrade('sell')} disabled={!pos}>
              💸 מכירה
            </button>
          </div>
        </div>
      )}
      {trade && p && <TradeSheet p={p} instrumentId={id} side={trade} onClose={() => setTrade(null)} />}
      {protect && p && pos && <ProtectionSheet p={p} instrumentId={id} onClose={() => setProtect(false)} />}
    </div>
  );
}

function Block({ title, items, className }: { title: string; items: string[]; className?: string }) {
  if (!items?.length) return null;
  return (
    <div className={clsx('rounded-xl p-3', className ?? 'bg-slate-50')}>
      <div className="font-bold mb-1">{title}</div>
      <ul className="space-y-1 list-disc pr-5">
        {items.map((x) => (
          <li key={x}>
            <RichText text={x} />
          </li>
        ))}
      </ul>
    </div>
  );
}
