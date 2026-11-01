import { useMemo, useState } from 'react';
import { useCurrentProfile, useGame } from '@/state/store';
import { useMarket } from '@/data/loader';
import { allocation, computeStats } from '@/engine/metrics';
import { totalValue } from '@/engine/trading';
import { instName, inst } from '@/engine/universe';
import { bondProduct } from '@/engine/finance';
import { formatDateHe } from '@/engine/dates';
import { CompareChart, Donut, GroupedBars } from '@/ui/charts';
import { Change, Empty, SectionTitle, Stat, Term } from '@/ui/components';
import { clsx, fmtMoney, fmtNum, fmtPct } from '@/ui/format';

export default function Stats() {
  const market = useMarket();
  const me = useCurrentProfile()!;
  const portfolios = useGame((s) => s.portfolios);
  const profiles = useGame((s) => s.profiles);
  const mine = Object.values(portfolios).filter((p) => p.ownerId === me.id && !p.archived);
  const [pid, setPid] = useState(me.activePortfolioId ?? mine[0]?.id);
  const p = mine.find((x) => x.id === pid) ?? mine[0];
  const s = useMemo(() => (p ? computeStats(p, market) : undefined), [p, market]);

  const drawdown = useMemo(() => {
    if (!p) return [];
    let peak = p.startCash;
    return p.equity.map(([d, v]) => {
      peak = Math.max(peak, v);
      return [d, (v / peak - 1) * 100] as [string, number];
    });
  }, [p]);

  const monthly = useMemo(() => {
    if (!p) return [];
    const m = new Map<string, { buys: number; sells: number }>();
    for (const t of p.txs) {
      if (!['buy', 'sell', 'option_buy', 'option_sell', 'bond_buy', 'bond_sell'].includes(t.type)) continue;
      const k = t.date.slice(0, 7);
      const e = m.get(k) ?? { buys: 0, sells: 0 };
      if (t.type.includes('buy')) e.buys++;
      else e.sells++;
      m.set(k, e);
    }
    return [...m.entries()].sort().slice(-8);
  }, [p]);

  const family = useMemo(() => {
    const all = Object.values(portfolios).filter((x) => !x.archived);
    const holders = new Map<string, Set<string>>();
    let trades = 0;
    for (const x of all) {
      for (const pos of x.positions) {
        const id = pos.kind === 'stock' ? pos.instrumentId : pos.kind === 'option' ? pos.underlying : pos.productId;
        if (!holders.has(id)) holders.set(id, new Set());
        holders.get(id)!.add(x.ownerId);
      }
      trades += x.txs.filter((t) => ['buy', 'sell', 'option_buy', 'option_sell', 'bond_buy', 'bond_sell'].includes(t.type)).length;
    }
    const popular = [...holders.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 5);
    const totalStart = all.reduce((a, x) => a + x.startCash * (x.baseCurrency === 'USD' ? market.fx('USD', 'ILS', market.asOf) : 1), 0);
    const totalNow = all.reduce((a, x) => a + totalValue(x, market) * (x.baseCurrency === 'USD' ? market.fx('USD', 'ILS', market.asOf) : 1), 0);
    return { count: all.length, trades, popular, totalStart, totalNow, players: Object.keys(profiles).length };
  }, [portfolios, profiles, market]);

  if (!p || !s) return <Empty emoji="📊" title="אין עדיין נתונים – פתחו תיק והתחילו לסחור" />;
  const cur = p.baseCurrency;
  const adult = me.ageGroup !== 'kid';
  const txName = (id?: string) => (id ? (bondProduct(id)?.nameHe ?? instName(id)) : '');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">📊 סטטיסטיקות</h1>
      {mine.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {mine.map((x) => (
            <button key={x.id} onClick={() => setPid(x.id)} className={clsx('chip', x.id === p.id && 'chip-on')}>
              {x.emoji} {x.name}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label={<Term id="return">תשואה</Term>}>
          <Change value={s.returnPct} big />
        </Stat>
        <Stat label="שווי">{fmtMoney(s.value, cur)}</Stat>
        <Stat label="מול S&P 500" sub="ההפרש בנקודות אחוז">
          <Change value={s.returnPct - s.benchmarkReturn.US} big />
        </Stat>
        <Stat label="מול ת״א-125" sub="ההפרש בנקודות אחוז">
          <Change value={s.returnPct - s.benchmarkReturn.IL} big />
        </Stat>
        <Stat label={<Term id="max-drawdown">הירידה הכי גדולה</Term>} sub="מהשיא לשפל">
          <span className="text-down num">{fmtPct(s.maxDrawdown)}</span>
        </Stat>
        <Stat label={<Term id="win-rate">אחוז הצלחה</Term>} sub={`${s.wins} מתוך ${s.closedTrades} מכירות ברווח`}>
          {s.closedTrades ? fmtPct(s.winRate, 0, false) : '—'}
        </Stat>
        <Stat label="עסקאות">{s.trades}</Stat>
        <Stat label={<Term id="fee">עמלות ששולמו</Term>}>{fmtMoney(s.fees, cur)}</Stat>
        <Stat label={<Term id="dividend">דיבידנדים</Term>}>{fmtMoney(s.dividends, cur)}</Stat>
        <Stat label={<Term id="coupon">ריבית מאג״ח</Term>}>{fmtMoney(s.coupons, cur)}</Stat>
        <Stat label={<Term id="realized-pnl">רווח ממומש</Term>}>
          <span className={s.realizedPnl >= 0 ? 'text-up' : 'text-down'}>{fmtMoney(s.realizedPnl, cur)}</span>
        </Stat>
        {adult && (
          <Stat label={<Term id="volatility">תנודתיות שנתית</Term>} sub={<span><Term id="sharpe">שארפ</Term>: {fmtNum(s.sharpe, 2)}</span>}>
            {fmtPct(s.volatility, 1, false)}
          </Stat>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="text-sm text-slate-500">🏅 העסקה הכי טובה</div>
          {s.bestTrade ? (
            <div className="font-bold">
              {txName(s.bestTrade.instrumentId)} · <span className="text-up num">+{fmtMoney(s.bestTrade.pnl ?? 0, cur)}</span>
              <div className="text-xs text-slate-500 font-normal">{formatDateHe(s.bestTrade.date)}</div>
            </div>
          ) : (
            <div className="text-slate-400">עוד אין מכירה ברווח</div>
          )}
        </div>
        <div className="card p-4">
          <div className="text-sm text-slate-500">📚 העסקה שהכי לימדה אותי (הפסד)</div>
          {s.worstTrade ? (
            <div className="font-bold">
              {txName(s.worstTrade.instrumentId)} · <span className="text-down num">{fmtMoney(s.worstTrade.pnl ?? 0, cur)}</span>
              <div className="text-xs text-slate-500 font-normal">{formatDateHe(s.worstTrade.date)}</div>
            </div>
          ) : (
            <div className="text-slate-400">אין הפסדים ממומשים 👏</div>
          )}
        </div>
      </div>
      {drawdown.length > 2 && (
        <div className="card p-4">
          <SectionTitle>
            🌊 <Term id="max-drawdown">ירידות מהשיא</Term> (באחוזים)
          </SectionTitle>
          <CompareChart series={[{ name: 'מרחק מהשיא', color: '#e34948', data: drawdown }]} height={160} format={(v) => `${fmtNum(v, 1)}%`} />
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        {monthly.length > 0 && (
          <div className="card p-4">
            <SectionTitle>🗓️ פעילות לפי חודש</SectionTitle>
            <GroupedBars groups={monthly.map(([k, v]) => ({ label: k.slice(2).replace('-', '/'), values: [v.buys, v.sells] }))} seriesNames={['קניות', 'מכירות']} format={(v) => String(v)} />
          </div>
        )}
        <div className="card p-4">
          <SectionTitle>🌍 ישראל מול ארה״ב</SectionTitle>
          <Donut slices={allocation(p, market, 'country').map((x) => ({ label: x.label, emoji: x.emoji, value: x.value }))} size={130} />
        </div>
      </div>
      <div className="card p-4">
        <SectionTitle>👨‍👩‍👧‍👦 סטטיסטיקות משפחתיות</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="שחקנים">{family.players}</Stat>
          <Stat label="תיקים פעילים">{family.count}</Stat>
          <Stat label="סה״כ עסקאות">{family.trades}</Stat>
          <Stat label="כל התיקים יחד (₪)" sub={`התחילו ב-${fmtMoney(family.totalStart, 'ILS')}`}>
            {fmtMoney(family.totalNow, 'ILS')}
          </Stat>
        </div>
        {family.popular.length > 0 && (
          <div className="mt-3">
            <div className="text-sm font-semibold mb-1">⭐ הכי פופולריות במשפחה</div>
            <div className="flex flex-wrap gap-2">
              {family.popular.map(([id, set]) => (
                <span key={id} className="chip">
                  {inst(id)?.emoji ?? bondProduct(id)?.emoji ?? '📄'} {txName(id)} · {set.size} שחקנים
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
