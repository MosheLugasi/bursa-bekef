import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadFund, useMarket, type FundFile, type FundRow } from '@/data/loader';
import { addDays, daysBetween, type ISODate } from '@/engine/dates';
import type { Currency, MarketData } from '@/engine/market';
import { inst, peers, SECTORS } from '@/engine/universe';
import { hasFeature } from '@/game/features';
import { useCurrentProfile } from '@/state/store';
import { GroupedBars } from './charts';
import { Locked, SectionTitle, Term, useCoachOnce } from './components';
import { clsx, fmtBig, fmtNum, fmtPct } from './format';

export interface Metrics {
  id: string;
  report?: FundRow;
  prev?: FundRow;
  finCur: string;
  priceCur: Currency;
  fxOk: boolean;
  marketCap: number; // במטבע המחיר
  revenue?: number | null;
  netIncome?: number | null;
  revenueGrowth?: number;
  netMargin?: number;
  grossMargin?: number;
  operatingMargin?: number;
  pe?: number;
  ps?: number;
  debtToEquity?: number;
  currentRatio?: number;
  roe?: number;
  divYield: number;
  cash?: number | null;
  debt?: number | null;
  fcf?: number | null;
}

const ratio = (a?: number | null, b?: number | null) => (a !== null && a !== undefined && b !== null && b !== undefined && b !== 0 ? a / b : undefined);

/** הדוחות שכבר פורסמו בתאריך המשחק (בערך חודשיים אחרי סוף השנה הפיננסית) */
export function reportsAsOf(f: FundFile, date: ISODate): FundRow[] {
  return f.annual.filter((r) => daysBetween(r.date, date) >= 60 && (r.revenue || r.netIncome || r.totalAssets));
}

export function computeMetrics(market: MarketData, id: string, f: FundFile | null, date: ISODate): Metrics {
  const i = inst(id)!;
  const priceCur = i.currency;
  const finCur = f?.currency ?? priceCur;
  const fxOk = finCur === 'USD' || finCur === 'ILS';
  const fx = fxOk ? market.fx(finCur as Currency, priceCur, date) : NaN;
  const price = market.price(id, date);
  const sharesNow = Number(f?.info?.sharesOutstanding) || NaN;
  const shares = sharesNow / market.splitFactor(id, date, market.asOf);
  const marketCap = price * shares;
  let divs = 0;
  for (const d of market.divsBetween(id, addDays(date, -365), date)) divs += d.amount / market.splitFactor(id, d.date, date);
  const divYield = price > 0 ? divs / price : 0;
  const reps = f ? reportsAsOf(f, date) : [];
  const report = reps[reps.length - 1];
  const prev = reps[reps.length - 2];
  if (!report) return { id, finCur, priceCur, fxOk, marketCap, divYield };
  const ni = report.netIncome;
  return {
    id,
    report,
    prev,
    finCur,
    priceCur,
    fxOk,
    marketCap,
    revenue: report.revenue,
    netIncome: ni,
    revenueGrowth: prev?.revenue && report.revenue ? report.revenue / prev.revenue - 1 : undefined,
    netMargin: ratio(ni, report.revenue),
    grossMargin: ratio(report.grossProfit, report.revenue),
    operatingMargin: ratio(report.operatingIncome, report.revenue),
    pe: fxOk && ni && ni > 0 && marketCap > 0 ? marketCap / (ni * fx) : undefined,
    ps: fxOk && report.revenue && marketCap > 0 ? marketCap / (report.revenue * fx) : undefined,
    debtToEquity: ratio(report.totalDebt, report.equity),
    currentRatio: ratio(report.currentAssets, report.currentLiabilities),
    roe: ratio(ni, report.equity),
    divYield,
    cash: report.cash,
    debt: report.totalDebt,
    fcf: report.freeCashFlow
  };
}

type Grade = 'good' | 'ok' | 'bad' | 'na';
function gradeOf(v: number | undefined, good: number, ok: number, higherBetter = true): Grade {
  if (v === undefined || !Number.isFinite(v)) return 'na';
  if (higherBetter) return v >= good ? 'good' : v >= ok ? 'ok' : 'bad';
  return v <= good ? 'good' : v <= ok ? 'ok' : 'bad';
}

const GRADE_STYLE: Record<Grade, { emoji: string; cls: string; label: string }> = {
  good: { emoji: '🟢', cls: 'bg-up-bg border-emerald-200', label: 'חזק' },
  ok: { emoji: '🟡', cls: 'bg-amber-50 border-amber-200', label: 'בינוני' },
  bad: { emoji: '🔴', cls: 'bg-down-bg border-rose-200', label: 'חלש' },
  na: { emoji: '⚪', cls: 'bg-slate-50 border-slate-200', label: 'אין נתון' }
};

function ReportCard({ m, isFinance }: { m: Metrics; isFinance: boolean }) {
  const items: { title: React.ReactNode; grade: Grade; text: string }[] = [
    {
      title: <Term id="revenue-growth">צמיחה</Term>,
      grade: gradeOf(m.revenueGrowth, 0.1, 0),
      text: m.revenueGrowth === undefined ? 'אין מספיק דוחות להשוואה' : m.revenueGrowth >= 0 ? `ההכנסות גדלו ב-${fmtPct(m.revenueGrowth, 0, false)} בשנה האחרונה` : `ההכנסות קטנו ב-${fmtPct(-m.revenueGrowth, 0, false)} בשנה האחרונה`
    },
    {
      title: <Term id="profit-margin">רווחיות</Term>,
      grade: gradeOf(m.netMargin, 0.15, 0),
      text: m.netMargin === undefined ? 'אין נתון' : m.netMargin >= 0 ? `מכל 100 שמגיעים מלקוחות נשארים ${fmtNum(m.netMargin * 100, 0)} רווח` : 'החברה הפסידה כסף בשנה האחרונה'
    },
    isFinance
      ? { title: <Term id="debt">חוב</Term>, grade: 'na', text: 'בבנקים ובחברות ביטוח, כסף של לקוחות הוא חלק מהעסק – לכן משווים אותם בעיקר לבנקים אחרים' }
      : {
          title: <Term id="debt-to-equity">חוב</Term>,
          grade: gradeOf(m.debtToEquity, 0.5, 1.5, false),
          text: m.debtToEquity === undefined ? 'אין נתון' : `על כל 1 של הון עצמי יש ${fmtNum(m.debtToEquity, 2)} חוב`
        },
    isFinance
      ? { title: <Term id="roe">תשואה על ההון</Term>, grade: gradeOf(m.roe, 0.12, 0.06), text: m.roe === undefined ? 'אין נתון' : `${fmtPct(m.roe, 0, false)} רווח על הכסף של בעלי המניות` }
      : {
          title: <Term id="current-ratio">נזילות</Term>,
          grade: gradeOf(m.currentRatio, 1.5, 1),
          text: m.currentRatio === undefined ? 'אין נתון' : m.currentRatio >= 1 ? 'יש מספיק כסף זמין לתשלומים הקרובים' : 'יש יותר תשלומים קרובים מכסף זמין – צריך לבדוק'
        },
    {
      title: <Term id="pe">תמחור</Term>,
      grade: m.pe === undefined ? (m.netIncome !== undefined && m.netIncome !== null && m.netIncome <= 0 ? 'bad' : 'na') : gradeOf(m.pe, 15, 30, false),
      text:
        m.pe !== undefined
          ? `משלמים ${fmtNum(m.pe, 1)} על כל 1 של רווח שנתי ${m.pe <= 15 ? '(זול יחסית)' : m.pe <= 30 ? '(ממוצע)' : '(יקר – המשקיעים מצפים לצמיחה גדולה)'}`
          : !m.fxOk
            ? 'הדוחות במטבע זר – אין חישוב מכפיל במשחק'
            : m.netIncome !== undefined && m.netIncome !== null && m.netIncome <= 0
              ? 'אין רווח, אז אין מכפיל רווח'
              : 'אין נתון'
    }
  ];
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {items.map((it, k) => {
        const g = GRADE_STYLE[it.grade];
        return (
          <div key={k} className={clsx('rounded-xl border p-3', g.cls)}>
            <div className="flex items-center justify-between">
              <span className="font-bold">{it.title}</span>
              <span className="text-sm font-semibold">
                {g.emoji} {g.label}
              </span>
            </div>
            <div className="text-sm text-slate-700 mt-1">{it.text}</div>
          </div>
        );
      })}
    </div>
  );
}

function median(vals: number[]): number | undefined {
  const v = vals.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return undefined;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function SectorCompare({ id, date, mine }: { id: string; date: ISODate; mine: Metrics }) {
  const market = useMarket();
  const [rows, setRows] = useState<Metrics[] | null>(null);
  const list = useMemo(() => peers(id).filter((x) => x.type === 'stock' && market.available(x.id, date)), [id, date, market]);
  useEffect(() => {
    let alive = true;
    Promise.all(list.map((x) => loadFund(x.id).then((f) => computeMetrics(market, x.id, f, date)))).then((r) => alive && setRows(r));
    return () => {
      alive = false;
    };
  }, [list, market, date]);
  if (!list.length) return <div className="text-sm text-slate-500">אין במשחק חברות נוספות מאותו תחום להשוואה.</div>;
  if (!rows) return <div className="text-sm text-slate-500">טוענים חברות דומות...</div>;
  const all = [mine, ...rows];
  const med = {
    revenueGrowth: median(all.map((m) => m.revenueGrowth ?? NaN)),
    netMargin: median(all.map((m) => m.netMargin ?? NaN)),
    pe: median(all.map((m) => m.pe ?? NaN)),
    debtToEquity: median(all.map((m) => m.debtToEquity ?? NaN)),
    divYield: median(all.map((m) => m.divYield))
  };
  const cell = (v: number | undefined, kind: 'pct' | 'x') => (v === undefined || !Number.isFinite(v) ? '—' : kind === 'pct' ? fmtPct(v, 0) : fmtNum(v, 1));
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm min-w-[520px]">
        <thead>
          <tr className="text-slate-500 text-xs">
            <th className="text-right p-1.5">חברה</th>
            <th className="p-1.5"><Term id="market-cap">שווי שוק</Term></th>
            <th className="p-1.5"><Term id="revenue-growth">צמיחה</Term></th>
            <th className="p-1.5"><Term id="profit-margin">שולי רווח</Term></th>
            <th className="p-1.5"><Term id="pe">מכפיל</Term></th>
            <th className="p-1.5"><Term id="debt-to-equity">חוב/הון</Term></th>
            <th className="p-1.5"><Term id="dividend-yield">דיבידנד</Term></th>
          </tr>
        </thead>
        <tbody>
          {all.map((m) => {
            const ii = inst(m.id)!;
            return (
              <tr key={m.id} className={clsx('border-t border-slate-100', m.id === id && 'bg-brand-50 font-semibold')}>
                <td className="p-1.5 text-right whitespace-nowrap">
                  <Link to={`/asset/${encodeURIComponent(m.id)}`} className="hover:underline">
                    {ii.emoji} {ii.nameHe}
                  </Link>
                </td>
                <td className="p-1.5 text-center"><span className="num">{fmtBig(m.marketCap, m.priceCur)}</span></td>
                <td className="p-1.5 text-center"><span className="num">{cell(m.revenueGrowth, 'pct')}</span></td>
                <td className="p-1.5 text-center"><span className="num">{cell(m.netMargin, 'pct')}</span></td>
                <td className="p-1.5 text-center"><span className="num">{cell(m.pe, 'x')}</span></td>
                <td className="p-1.5 text-center"><span className="num">{cell(m.debtToEquity, 'x')}</span></td>
                <td className="p-1.5 text-center"><span className="num">{fmtPct(m.divYield, 1, false)}</span></td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-slate-200 text-slate-600">
            <td className="p-1.5 text-right">📏 חציון הסקטור</td>
            <td className="p-1.5 text-center">—</td>
            <td className="p-1.5 text-center"><span className="num">{cell(med.revenueGrowth, 'pct')}</span></td>
            <td className="p-1.5 text-center"><span className="num">{cell(med.netMargin, 'pct')}</span></td>
            <td className="p-1.5 text-center"><span className="num">{cell(med.pe, 'x')}</span></td>
            <td className="p-1.5 text-center"><span className="num">{cell(med.debtToEquity, 'x')}</span></td>
            <td className="p-1.5 text-center"><span className="num">{med.divYield !== undefined ? fmtPct(med.divYield, 1, false) : '—'}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function Fundamentals({ id, date }: { id: string; date: ISODate }) {
  const market = useMarket();
  const profile = useCurrentProfile()!;
  const [f, setF] = useState<FundFile | null | undefined>(undefined);
  const unlocked = hasFeature(profile, 'fundamentals');
  useCoachOnce('fundamentals');
  useEffect(() => {
    setF(undefined);
    loadFund(id).then(setF);
  }, [id]);
  const m = useMemo(() => (f === undefined ? undefined : computeMetrics(market, id, f, date)), [market, id, f, date]);
  if (f === undefined || !m) return <div className="text-slate-500 py-6 text-center">טוענים דוחות...</div>;
  if (!f) return <div className="text-slate-500 py-6 text-center">אין לנו נתוני דוחות לחברה הזו כרגע.</div>;
  const i = inst(id)!;
  const isFinance = i.sector === 'finance';
  const reps = reportsAsOf(f, date).slice(-4);
  const fc = (m.fxOk ? m.finCur : undefined) as Currency | undefined;
  return (
    <div className="space-y-5">
      {!m.report ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          📅 בתאריך הזה עוד לא פורסם דוח שנתי שיש לנו במשחק (הנתונים שלנו מכסים את 4-5 השנים האחרונות). נסו להתקדם בזמן, או לבדוק בשוק החי.
        </div>
      ) : (
        <>
          <div>
            <SectionTitle help="fundamentals">🩺 תעודת בריאות</SectionTitle>
            <div className="text-xs text-slate-500 mb-2">לפי הדוח השנתי לשנה שהסתיימה ב-{m.report.date} {m.finCur !== 'USD' && m.finCur !== 'ILS' ? `(מטבע הדוחות: ${m.finCur})` : ''}</div>
            <ReportCard m={m} isFinance={isFinance} />
          </div>
          {!unlocked ? (
            <Locked feature="fundamentals" />
          ) : (
            <>
              <div>
                <SectionTitle>📊 הכנסות ורווח לאורך השנים</SectionTitle>
                <GroupedBars
                  groups={reps.map((r) => ({ label: r.date.slice(0, 4), values: [r.revenue ?? null, r.netIncome ?? null] }))}
                  seriesNames={['הכנסות', 'רווח נקי']}
                  format={(v) => fmtBig(v, fc)}
                />
              </div>
              <div>
                <SectionTitle>🔢 מספרים חשובים</SectionTitle>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  <KV k={<Term id="market-cap">שווי שוק</Term>} v={fmtBig(m.marketCap, m.priceCur)} />
                  <KV k={<Term id="revenue">הכנסות</Term>} v={fmtBig(m.revenue, fc)} />
                  <KV k={<Term id="net-income">רווח נקי</Term>} v={fmtBig(m.netIncome, fc)} />
                  <KV k={<Term id="gross-profit">שולי רווח גולמי</Term>} v={m.grossMargin !== undefined ? fmtPct(m.grossMargin, 0, false) : '—'} />
                  <KV k={<Term id="operating-income">שולי רווח תפעולי</Term>} v={m.operatingMargin !== undefined ? fmtPct(m.operatingMargin, 0, false) : '—'} />
                  <KV k={<Term id="pe">מכפיל רווח</Term>} v={m.pe !== undefined ? fmtNum(m.pe, 1) : '—'} />
                  <KV k={<Term id="ps">מכפיל מכירות</Term>} v={m.ps !== undefined ? fmtNum(m.ps, 1) : '—'} />
                  <KV k={<Term id="roe">תשואה על ההון</Term>} v={m.roe !== undefined ? fmtPct(m.roe, 0, false) : '—'} />
                  <KV k={<Term id="dividend-yield">תשואת דיבידנד</Term>} v={fmtPct(m.divYield, 1, false)} />
                  <KV k={<Term id="cash-flow">מזומנים</Term>} v={fmtBig(m.cash, fc)} />
                  <KV k={<Term id="debt">חוב</Term>} v={fmtBig(m.debt, fc)} />
                  <KV k={<Term id="fcf">תזרים חופשי</Term>} v={fmtBig(m.fcf, fc)} />
                </div>
              </div>
              {f.earnings.filter((e) => e.date <= date).length > 0 && (
                <div>
                  <SectionTitle>🎯 <Term id="earnings-surprise">הפתעות בדוחות</Term> (רבעונים אחרונים)</SectionTitle>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {f.earnings
                      .filter((e) => e.date <= date)
                      .slice(-4)
                      .map((e) => {
                        const s = e.surprisePct ?? (e.epsActual && e.epsEstimate ? e.epsActual / e.epsEstimate - 1 : null);
                        return (
                          <div key={e.date} className={clsx('rounded-xl p-2 text-center text-sm', s !== null && s >= 0 ? 'bg-up-bg' : 'bg-down-bg')}>
                            <div className="text-xs text-slate-500">{e.date}</div>
                            <div className="font-bold">{s === null ? '—' : s >= 0 ? '😃 הפתיעה לטובה' : '😟 אכזבה'}</div>
                            <div className="text-xs num">
                              צפי {fmtNum(e.epsEstimate ?? NaN)} · בפועל {fmtNum(e.epsActual ?? NaN)}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
              <div>
                <SectionTitle>⚖️ השוואה לחברות דומות · {SECTORS[i.sector]?.nameHe}</SectionTitle>
                <SectorCompare id={id} date={date} mine={m} />
              </div>
            </>
          )}
        </>
      )}
      {typeof f.info.longBusinessSummary === 'string' && profile.ageGroup !== 'kid' && daysBetween(date, market.asOf) <= 7 && (
        <details className="rounded-xl bg-slate-50 p-3 text-sm">
          <summary className="cursor-pointer font-semibold">🇺🇸 תיאור רשמי של החברה (באנגלית)</summary>
          <p className="mt-2 text-slate-700" dir="ltr">
            {String(f.info.longBusinessSummary)}
          </p>
        </details>
      )}
    </div>
  );
}

function KV({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2.5">
      <div className="text-xs text-slate-500">{k}</div>
      <div className="font-bold num">{v}</div>
    </div>
  );
}
