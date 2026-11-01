import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Portfolio } from '@/engine/types';
import { useMarket } from '@/data/loader';
import { addDays, addMonths, daysBetween, formatDateHe, type ISODate } from '@/engine/dates';
import { totalValue } from '@/engine/trading';
import { advancePortfolio } from '@/game/actions';
import { challenge } from '@/game/challenges';
import { useCurrentProfile, useGame } from '@/state/store';
import { Change, ProgressBar, Sparkline, useCoachOnce } from './components';
import { clsx, fmtMoney } from './format';

export function TimeMachineBar({ p }: { p: Portfolio }) {
  const market = useMarket();
  const [busy, setBusy] = useState(false);
  useCoachOnce('timeMachine', p.mode === 'history');
  if (p.mode !== 'history') return null;
  const limit: ISODate = p.endDate && p.endDate < market.asOf ? p.endDate : market.asOf;
  const atEnd = p.currentDate >= limit;
  const ch = challenge(p.challengeId);
  const total = daysBetween(p.startDate, limit);
  const progress = total > 0 ? daysBetween(p.startDate, p.currentDate) / total : 1;
  const go = async (target: ISODate) => {
    setBusy(true);
    try {
      await advancePortfolio(p.id, target > limit ? limit : target);
    } finally {
      setBusy(false);
    }
  };
  const steps: { label: string; target: () => ISODate }[] = [
    { label: '+יום', target: () => market.nextDate(p.currentDate) },
    { label: '+שבוע', target: () => addDays(p.currentDate, 7) },
    { label: '+חודש', target: () => addMonths(p.currentDate, 1) },
    { label: '+3 חודשים', target: () => addMonths(p.currentDate, 3) }
  ];
  return (
    <div className="rounded-2xl bg-gradient-to-l from-indigo-600 to-violet-600 text-white p-4 shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs opacity-80">⏰ מכונת הזמן {ch ? `· ${ch.emoji} ${ch.title}` : ''}</div>
          <div className="text-xl font-extrabold">{formatDateHe(p.currentDate, { weekday: true })}</div>
        </div>
        {atEnd && <div className="text-sm font-bold bg-white/20 rounded-xl px-3 py-1">{p.endDate && p.currentDate >= p.endDate ? '🏁 האתגר הסתיים!' : 'הגעתם להיום 🎉'}</div>}
      </div>
      <ProgressBar value={progress} className="mt-3 bg-white/20" color="bg-amber-300" />
      <div className="flex justify-between text-[11px] opacity-80 mt-1">
        <span>{formatDateHe(p.startDate, { short: true })}</span>
        <span>{formatDateHe(limit, { short: true })}</span>
      </div>
      {!atEnd && (
        <div className="grid grid-cols-4 gap-2 mt-3">
          {steps.map((s) => (
            <button key={s.label} disabled={busy} onClick={() => go(s.target())} className="rounded-xl bg-white/15 hover:bg-white/25 py-2 font-bold text-sm active:scale-95 transition disabled:opacity-50">
              {s.label} ⏩
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PortfolioCard({ p, compact }: { p: Portfolio; compact?: boolean }) {
  const market = useMarket();
  const nav = useNavigate();
  const value = useMemo(() => totalValue(p, market), [p, market]);
  const ret = value / p.startCash - 1;
  const eq = p.equity.slice(-60).map((e) => e[1]);
  const prev = p.equity.length > 1 ? p.equity[p.equity.length - 2][1] : p.startCash;
  const day = prev > 0 ? value / prev - 1 : 0;
  return (
    <button onClick={() => nav('/portfolio')} className="card p-4 w-full text-right hover:shadow-md transition">
      <div className="flex items-center justify-between">
        <div className="font-bold flex items-center gap-2">
          <span className="text-2xl">{p.emoji}</span>
          <span className="truncate">{p.name}</span>
          <span className={clsx('text-xs rounded-full px-2 py-0.5', p.mode === 'live' ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700')}>{p.mode === 'live' ? '📡 חי' : '⏰ מכונת זמן'}</span>
        </div>
        {!compact && <Sparkline values={eq} width={90} height={30} />}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2 flex-wrap">
        <div>
          <div className="text-xs text-slate-500">שווי התיק</div>
          <div className="text-3xl font-extrabold num">{fmtMoney(value, p.baseCurrency)}</div>
        </div>
        <div className="text-left space-y-1">
          <div className="text-xs text-slate-500">
            מתחילת הדרך <Change value={ret} />
          </div>
          <div className="text-xs text-slate-500">
            ביום האחרון <Change value={day} />
          </div>
        </div>
      </div>
    </button>
  );
}

export function PortfolioSwitcher() {
  const profile = useCurrentProfile();
  const portfolios = useGame((s) => s.portfolios);
  const update = useGame((s) => s.updateProfile);
  if (!profile) return null;
  const mine = Object.values(portfolios).filter((p) => p.ownerId === profile.id && !p.archived);
  if (mine.length < 2) return null;
  const active = profile.activePortfolioId ?? mine[0].id;
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      {mine.map((p) => (
        <button key={p.id} onClick={() => update(profile.id, (x) => ({ ...x, activePortfolioId: p.id }))} className={clsx('chip', active === p.id && 'chip-on')}>
          {p.emoji} {p.name}
        </button>
      ))}
    </div>
  );
}
