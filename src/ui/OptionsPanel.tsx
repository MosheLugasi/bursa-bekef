import { useMemo, useState } from 'react';
import type { Portfolio, OptionPosition } from '@/engine/types';
import { useMarket } from '@/data/loader';
import { availableExpiries, breakeven, gameVol, optionPrice, strikeGrid, type OptionRight } from '@/engine/finance';
import { buyOption, optionLabel, quoteOption, sellOption } from '@/engine/trading';
import { formatDateHe, daysBetween } from '@/engine/dates';
import { inst } from '@/engine/universe';
import { hasFeature } from '@/game/features';
import { commitTrade } from '@/game/actions';
import { useCurrentProfile } from '@/state/store';
import { PayoffChart } from './charts';
import { Locked, SectionTitle, Stepper, Term, useCoachOnce } from './components';
import { clsx, fmtMoney, fmtNum, fmtPct, fmtPrice } from './format';

export function OptionsPanel({ p, underlying }: { p: Portfolio; underlying: string }) {
  const market = useMarket();
  const profile = useCurrentProfile()!;
  const unlocked = hasFeature(profile, 'options');
  useCoachOnce('options', unlocked);
  const i = inst(underlying)!;
  const date = p.currentDate;
  const S = market.price(underlying, date);
  const expiries = useMemo(() => availableExpiries(date), [date]);
  const strikes = useMemo(() => strikeGrid(S, 4), [S]);
  const [right, setRight] = useState<OptionRight>('call');
  const [expiry, setExpiry] = useState(expiries[1] ?? expiries[0]);
  const [strike, setStrike] = useState(strikes[4] ?? strikes[0]);
  const [contracts, setContracts] = useState(1);
  const vol = gameVol(market, underlying, date);
  const mine = p.positions.filter((x) => x.kind === 'option' && x.underlying === underlying) as OptionPosition[];

  if (!unlocked) return <Locked feature="options" />;
  if (!i.optionable) return <div className="text-slate-500 text-center py-6">אין אופציות על הנכס הזה במשחק (רק על מניות וקרנות אמריקאיות גדולות).</div>;

  const q = quoteOption(p, market, underlying, right, strike, expiry, contracts);
  const premium = q.ok ? q.value.premium : 0;
  const be = breakeven(right, strike, premium);
  const move = be / S - 1;

  return (
    <div className="space-y-4">
      <SectionTitle help="options">🎟️ אופציות על {i.nameHe}</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {(['call', 'put'] as const).map((r) => (
          <button key={r} onClick={() => setRight(r)} className={clsx('rounded-2xl border-2 p-3 text-right', right === r ? 'border-brand-500 bg-brand-50' : 'border-slate-200')}>
            <div className="text-2xl">{r === 'call' ? '📈' : '📉'}</div>
            <div className="font-bold">
              <Term id={r}>{r === 'call' ? 'קול (Call)' : 'פוט (Put)'}</Term>
            </div>
            <div className="text-xs text-slate-600">{r === 'call' ? 'מרוויחים אם המניה עולה מעל מחיר המימוש' : 'מרוויחים אם המניה יורדת מתחת למחיר המימוש'}</div>
          </button>
        ))}
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-600 mb-1">
          <Term id="expiration">מועד פקיעה</Term>
        </div>
        <div className="flex gap-2 flex-wrap">
          {expiries.map((e) => (
            <button key={e} onClick={() => setExpiry(e)} className={clsx('chip', expiry === e && 'chip-on')}>
              {formatDateHe(e, { short: true })} <span className="opacity-70 text-xs">({daysBetween(date, e)} ימים)</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-600 mb-1">
          <Term id="strike">מחיר מימוש</Term> · המניה עכשיו ב-<span className="num">{fmtPrice(S, i.currency)}</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
          {strikes.map((k) => {
            const prem = optionPrice(market, underlying, right, k, expiry, date);
            const itm = right === 'call' ? S > k : S < k;
            return (
              <button key={k} onClick={() => setStrike(k)} className={clsx('rounded-xl border-2 p-2 text-center', strike === k ? 'border-brand-500 bg-brand-50' : 'border-slate-100', itm && strike !== k && 'bg-emerald-50/50')}>
                <div className="font-bold num">{fmtNum(k, k < 10 ? 2 : 0)}</div>
                <div className="text-xs text-slate-500 num">{fmtNum(prem)}</div>
              </button>
            );
          })}
        </div>
        <div className="text-xs text-slate-500 mt-1">
          המספר הקטן = <Term id="premium">פרמיה</Term> למניה. רקע ירוק = <Term id="itm">בתוך הכסף</Term>. <Term id="implied-volatility">תנודתיות</Term> בחישוב: {fmtPct(vol, 0, false)} (מודל <Term id="black-scholes">בלק-שולס</Term>).
        </div>
      </div>
      <div className="rounded-2xl bg-slate-50 p-3 space-y-3">
        <PayoffChart right={right} strike={strike} premium={premium} spot={S} contracts={contracts} format={(v) => fmtMoney(v, i.currency, 0)} />
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-xs text-slate-500">עלות (<Term id="contract">חוזה</Term> = 100 מניות)</div>
            <div className="font-bold num">{q.ok ? fmtMoney(q.value.totalBase, p.baseCurrency, 0) : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">
              <Term id="breakeven">נקודת איזון</Term> בפקיעה
            </div>
            <div className="font-bold num">
              {fmtPrice(be, i.currency)} <span className="text-xs text-slate-500">({fmtPct(move)})</span>
            </div>
          </div>
          <div className="col-span-2 text-xs text-slate-600">
            💡 כדי להרוויח בפקיעה, המניה צריכה {right === 'call' ? 'לעלות' : 'לרדת'} ביותר מ-{fmtPct(Math.abs(move), 1, false)} עד {formatDateHe(expiry)}. ההפסד המקסימלי הוא כל הפרמיה ששילמתם.
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Stepper value={contracts} onChange={setContracts} min={1} max={100} />
          <button
            className="btn-buy flex-1"
            disabled={!q.ok || premium < 0.01}
            onClick={() => commitTrade(buyOption(p, market, { underlying, right, strike, expiry, contracts }), `קניתם ${contracts} חוזי ${right === 'call' ? 'קול' : 'פוט'} 🎟️`)}
          >
            🎟️ קנייה
          </button>
        </div>
        {!q.ok && <div className="text-sm text-down">{q.error}</div>}
      </div>
      {mine.length > 0 && (
        <div>
          <SectionTitle>האופציות שלכם</SectionTitle>
          <ul className="space-y-2">
            {mine.map((o) => {
              const prem = optionPrice(market, o.underlying, o.right, o.strike, o.expiry, date);
              const val = prem * o.multiplier * o.contracts * market.fx(i.currency, p.baseCurrency, date);
              const pnl = val - o.avgCostBase * o.contracts;
              return (
                <li key={o.id} className="rounded-xl border border-slate-100 p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="font-semibold">{optionLabel(o)}</div>
                    <div className="text-xs text-slate-500">
                      {o.contracts} חוזים · שווי {fmtMoney(val, p.baseCurrency)} ·{' '}
                      <span className={pnl >= 0 ? 'text-up' : 'text-down'}>
                        {pnl >= 0 ? '+' : ''}
                        {fmtMoney(pnl, p.baseCurrency)}
                      </span>
                    </div>
                  </div>
                  <button className="btn-sell text-sm py-1.5" onClick={() => commitTrade(sellOption(p, market, o.id, o.contracts), 'מכרתם את האופציה')}>
                    מכירה
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
