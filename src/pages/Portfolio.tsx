import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useActivePortfolio, useCurrentProfile, useGame } from '@/state/store';
import { useMarket } from '@/data/loader';
import { valuate, cancelOrder, sellBond, sellOption, type HoldingView } from '@/engine/trading';
import { allocation, benchmarkEquity, computeStats } from '@/engine/metrics';
import { formatDateHe } from '@/engine/dates';
import { instName, inst } from '@/engine/universe';
import { bondProduct } from '@/engine/finance';
import { commitTrade } from '@/game/actions';
import { CompareChart, Donut } from '@/ui/charts';
import { Change, Empty, HelpButton, Segmented, SectionTitle, Stat, Term, useCoachOnce } from '@/ui/components';
import { NewPortfolioSheet } from '@/ui/forms';
import { PortfolioSwitcher, TimeMachineBar } from '@/ui/portfolioBits';
import { clsx, fmtMoney, fmtPct, fmtPrice } from '@/ui/format';
import type { Transaction } from '@/engine/types';

const TX_LABEL: Record<Transaction['type'], string> = {
  buy: '🛒 קנייה',
  sell: '💸 מכירה',
  dividend: '🍬 דיבידנד',
  split: '✂️ פיצול',
  option_buy: '🎟️ קניית אופציה',
  option_sell: '🎟️ מכירת אופציה',
  option_expire: '⌛ פקיעת אופציה',
  bond_buy: '📜 קניית אג״ח',
  bond_sell: '📜 מכירת אג״ח',
  coupon: '🧾 ריבית מאג״ח',
  bond_maturity: '🏁 פדיון אג״ח',
  order_cancel: '❌ ביטול',
  deposit: '💵 הפקדה'
};

const REASON: Record<string, string> = { limit: 'לימיט', stop_loss: 'סטופ לוס', take_profit: 'טייק פרופיט', expiry: 'פקיעה', maturity: 'פדיון' };

export default function PortfolioPage() {
  const market = useMarket();
  const profile = useCurrentProfile()!;
  const p = useActivePortfolio();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(params.get('new') === '1');
  const [alloc, setAlloc] = useState<'sector' | 'type' | 'country'>('sector');
  const [showAllTx, setShowAllTx] = useState(false);
  const nav = useNavigate();
  const archive = useGame((s) => s.setPortfolio);
  useCoachOnce('portfolio', !!p && !creating);

  const v = useMemo(() => (p ? valuate(p, market) : undefined), [p, market]);
  const stats = useMemo(() => (p ? computeStats(p, market) : undefined), [p, market]);
  const chartSeries = useMemo(() => {
    if (!p || p.equity.length < 2) return [];
    return [
      { name: `${p.emoji} התיק שלי`, color: '#2a78d6', data: p.equity },
      { name: '🇺🇸 S&P 500', color: '#eb6834', data: benchmarkEquity(p, market, 'SPY') },
      { name: '🇮🇱 ת״א-125', color: '#1baf7a', data: benchmarkEquity(p, market, 'TA125') }
    ];
  }, [p, market]);

  const closeCreate = () => {
    setCreating(false);
    if (params.get('new')) setParams({});
  };

  if (!p || !v || !stats) {
    return (
      <>
        <Empty emoji="💼" title="בואו נפתח את התיק הראשון שלכם!">
          <button className="btn-primary mt-4 text-lg" onClick={() => setCreating(true)}>
            ✨ פתיחת תיק
          </button>
        </Empty>
        {creating && <NewPortfolioSheet ownerId={profile.id} onClose={closeCreate} />}
      </>
    );
  }
  const cur = p.baseCurrency;
  const sells = (h: HoldingView) => {
    if (h.position.kind === 'stock') nav(`/asset/${encodeURIComponent(h.instrumentId)}`);
    else if (h.position.kind === 'option') commitTrade(sellOption(p, market, h.position.id, h.position.contracts), 'האופציה נמכרה');
    else commitTrade(sellBond(p, market, h.position.id, h.position.units), 'האג״ח נמכרה');
  };
  const txs = [...p.txs].reverse();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">
          {p.emoji} {p.name}
        </h1>
        <div className="flex gap-2">
          <button className="btn-soft text-sm" onClick={() => setCreating(true)}>
            ➕ תיק חדש
          </button>
          <HelpButton coachKey="portfolio" />
        </div>
      </div>
      <PortfolioSwitcher />
      <TimeMachineBar p={p} />

      <div className="card p-4">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="text-sm text-slate-500">שווי כולל</div>
            <div className="text-4xl font-extrabold num">{fmtMoney(v.total, cur)}</div>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <Change value={stats.returnPct} big />
              <span className={clsx('num font-semibold', stats.pnl >= 0 ? 'text-up' : 'text-down')}>
                {stats.pnl >= 0 ? '+' : ''}
                {fmtMoney(stats.pnl, cur)}
              </span>
              <span className="text-slate-500">מאז {formatDateHe(p.startDate)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 min-w-56">
            <Stat label={<Term id="cash">מזומן</Term>}>{fmtMoney(v.cash, cur)}</Stat>
            <Stat label="מושקע">{fmtMoney(v.invested, cur)}</Stat>
          </div>
        </div>
        {chartSeries.length > 0 && (
          <div className="mt-4">
            <div className="text-sm text-slate-600 mb-1">
              התיק מול <Term id="benchmark">מדדי ייחוס</Term> (כמה היה שווה הכסף אם הייתם קונים את המדד ביום הראשון)
            </div>
            <CompareChart series={chartSeries} format={(x) => fmtMoney(x, cur)} />
            <div className="flex gap-3 text-sm mt-2 flex-wrap">
              <span>
                S&P 500 באותה תקופה: <Change value={stats.benchmarkReturn.US} />
              </span>
              <span>
                ת״א-125: <Change value={stats.benchmarkReturn.IL} />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="card p-4">
        <SectionTitle action={<Link to="/market" className="text-sm text-brand-700 font-semibold">➕ לקנות עוד</Link>}>📦 מה יש בתיק</SectionTitle>
        {v.holdings.length === 0 ? (
          <div className="text-center py-6 text-slate-500">
            התיק עדיין ריק – כל הכסף במזומן.{' '}
            <Link to="/market" className="text-brand-700 font-semibold">
              לכו לשוק ובחרו חברה ראשונה 🛒
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {v.holdings.map((h) => (
              <button key={h.position.id} onClick={() => sells(h)} className="w-full flex items-center gap-3 py-3 text-right hover:bg-slate-50 rounded-lg px-1">
                <span className="text-2xl w-9 text-center">{h.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold truncate">{h.label}</span>
                  <span className="block text-xs text-slate-500">
                    {h.position.kind === 'stock' && `${h.qty} מניות · ${fmtPrice(h.price, h.currency)}`}
                    {h.position.kind === 'option' && `${h.qty} חוזים · פרמיה ${fmtPrice(h.price, h.currency)} · לחצו למכירה`}
                    {h.position.kind === 'bond' && `${h.qty} יח׳ · ריבית ${h.position.couponRate}% · פדיון ${formatDateHe(h.position.maturity, { short: true })} · לחצו למכירה`}
                    {h.position.kind === 'stock' && (h.position.stopLoss || h.position.takeProfit) && ' · 🛡️'}
                  </span>
                </span>
                <span className="text-left">
                  <span className="block font-bold num">{fmtMoney(h.valueBase, cur)}</span>
                  <span className={clsx('block text-xs num font-semibold', h.pnlBase >= 0 ? 'text-up' : 'text-down')}>
                    {h.pnlBase >= 0 ? '▲ +' : '▼ '}
                    {fmtMoney(h.pnlBase, cur)} ({fmtPct(h.pnlPct)})
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {p.orders.length > 0 && (
        <div className="card p-4">
          <SectionTitle>⏳ <Term id="pending-order">פקודות ממתינות</Term></SectionTitle>
          <ul className="space-y-2">
            {p.orders.map((o) => (
              <li key={o.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <span className="text-xl">{o.side === 'buy' ? '🛒' : '💸'}</span>
                <span className="flex-1 text-sm">
                  {o.side === 'buy' ? 'לקנות' : 'למכור'} {o.qty} {instName(o.instrumentId)} כשהמחיר {o.side === 'buy' ? 'יירד ל-' : 'יעלה ל-'}
                  <span className="num font-bold">{fmtPrice(o.limitPrice, inst(o.instrumentId)?.currency ?? 'USD')}</span>
                </span>
                <button className="btn-ghost text-sm text-down" onClick={() => commitTrade({ ok: true, value: cancelOrder(p, o.id) }, 'הפקודה בוטלה')}>
                  ביטול
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {v.holdings.length > 0 && (
        <div className="card p-4">
          <SectionTitle>🥧 איך הכסף מחולק (<Term id="diversification">פיזור</Term>)</SectionTitle>
          <Segmented
            value={alloc}
            onChange={setAlloc}
            options={[
              { value: 'sector', label: 'לפי תחום' },
              { value: 'type', label: 'לפי סוג' },
              { value: 'country', label: 'לפי מדינה' }
            ]}
            className="mb-3"
          />
          <Donut slices={allocation(p, market, alloc).map((s) => ({ label: s.label, emoji: s.emoji, value: s.value }))} center={<span className="text-slate-500">התיק</span>} />
        </div>
      )}

      <div className="card p-4">
        <SectionTitle action={<Link to="/stats" className="text-sm text-brand-700 font-semibold">📊 סטטיסטיקות מלאות ←</Link>}>📜 היסטוריית פעולות</SectionTitle>
        <ul className="divide-y divide-slate-100 text-sm">
          {(showAllTx ? txs : txs.slice(0, 12)).map((t) => (
            <li key={t.id} className="py-2 flex items-center gap-2">
              <span className="w-28 shrink-0">{TX_LABEL[t.type]}</span>
              <span className="flex-1 min-w-0 truncate">
                {t.instrumentId ? (bondProduct(t.instrumentId)?.nameHe ?? instName(t.instrumentId)) : t.note}
                {t.qty ? ` · ${t.qty}` : ''}
                {t.reason && REASON[t.reason] ? ` · ${REASON[t.reason]}` : ''}
              </span>
              <span className="text-left shrink-0">
                <span className={clsx('block num font-semibold', t.cash >= 0 ? 'text-up' : 'text-slate-700')}>
                  {t.cash >= 0 ? '+' : ''}
                  {fmtMoney(t.cash, cur)}
                </span>
                <span className="block text-[11px] text-slate-400">{formatDateHe(t.date, { short: true })}</span>
              </span>
            </li>
          ))}
        </ul>
        {txs.length > 12 && (
          <button className="btn-ghost w-full mt-2 text-sm" onClick={() => setShowAllTx(!showAllTx)}>
            {showAllTx ? 'הצג פחות' : `הצג הכל (${txs.length})`}
          </button>
        )}
      </div>

      <div className="text-center">
        <button
          className="btn-ghost text-sm text-slate-400"
          onClick={() => {
            if (confirm(`להעביר את "${p.name}" לארכיון? (אפשר לשחזר מאזור הניהול)`)) archive({ ...p, archived: true });
          }}
        >
          🗄️ העברת התיק לארכיון
        </button>
      </div>
      {creating && <NewPortfolioSheet ownerId={profile.id} onClose={closeCreate} />}
    </div>
  );
}
