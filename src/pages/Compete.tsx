import { useMemo, useState } from 'react';
import { useCurrentProfile, useGame } from '@/state/store';
import { useMarket } from '@/data/loader';
import { totalValue } from '@/engine/trading';
import { benchmarkReturn } from '@/engine/metrics';
import { formatDateHe } from '@/engine/dates';
import { leagueName, leagueOf, challenge } from '@/game/challenges';
import { ACHIEVEMENTS, makeCtx } from '@/game/achievements';
import { levelFor } from '@/game/xp';
import { Change, HelpButton, ProgressBar, Segmented, SectionTitle, useCoachOnce } from '@/ui/components';
import { clsx, fmtMoney } from '@/ui/format';

const MEDAL = ['🥇', '🥈', '🥉'];
const CATS: Record<string, string> = { trading: '🛒 מסחר', performance: '📈 ביצועים', learning: '🎓 למידה', streak: '🔥 התמדה', competition: '🏆 תחרות' };

export default function Compete() {
  const market = useMarket();
  const me = useCurrentProfile()!;
  const portfolios = useGame((s) => s.portfolios);
  const profiles = useGame((s) => s.profiles);
  const [tab, setTab] = useState<'portfolios' | 'players' | 'achievements'>('portfolios');
  useCoachOnce('leaderboard');

  const leagues = useMemo(() => {
    const map = new Map<string, { id: string; ret: number; value: number; p: (typeof portfolios)[string] }[]>();
    for (const p of Object.values(portfolios)) {
      if (p.archived) continue;
      const value = totalValue(p, market);
      const lg = leagueOf(p);
      if (!map.has(lg)) map.set(lg, []);
      map.get(lg)!.push({ id: p.id, ret: value / p.startCash - 1, value, p });
    }
    for (const list of map.values()) list.sort((a, b) => b.ret - a.ret);
    return [...map.entries()].sort((a, b) => (a[0] === 'live' ? -1 : b[0] === 'live' ? 1 : a[0].localeCompare(b[0])));
  }, [portfolios, market]);

  const [league, setLeague] = useState<string>('');
  const activeLeague = league || leagues[0]?.[0] || 'live';
  const rows = leagues.find((l) => l[0] === activeLeague)?.[1] ?? [];

  // "רוח המדד": תשואת S&P 500 ו-ת״א-125 בתקופת הליגה
  const ghost = useMemo(() => {
    if (!rows.length) return [];
    const ref = rows[0].p;
    const ch = challenge(ref.challengeId);
    const from = activeLeague === 'live' ? rows.reduce((a, r) => (r.p.startDate < a ? r.p.startDate : a), ref.startDate) : ref.startDate;
    const to = activeLeague === 'live' ? market.asOf : rows.reduce((a, r) => (r.p.currentDate > a ? r.p.currentDate : a), ref.currentDate);
    void ch;
    return [
      { name: '👻 רוח S&P 500', ret: benchmarkReturn(market, 'SPY', { ...ref, baseCurrency: 'ILS' }, from, to) },
      { name: '👻 רוח ת״א-125', ret: benchmarkReturn(market, 'TA125', { ...ref, baseCurrency: 'ILS' }, from, to) }
    ].filter((g) => Number.isFinite(g.ret));
  }, [rows, activeLeague, market]);

  const players = useMemo(() => {
    return Object.values(profiles)
      .map((pr) => {
        const mine = Object.values(portfolios).filter((p) => p.ownerId === pr.id && !p.archived);
        const best = mine.length ? Math.max(...mine.map((p) => totalValue(p, market) / p.startCash - 1)) : NaN;
        const trades = mine.reduce((a, p) => a + p.txs.filter((t) => ['buy', 'sell', 'option_buy', 'option_sell', 'bond_buy', 'bond_sell'].includes(t.type)).length, 0);
        return { pr, best, trades, ach: Object.keys(pr.achievements).length, lessons: Object.keys(pr.lessons).length };
      })
      .sort((a, b) => b.pr.xp - a.pr.xp);
  }, [profiles, portfolios, market]);

  const ctx = useMemo(() => makeCtx(me, Object.values(portfolios), Object.values(profiles), market), [me, portfolios, profiles, market]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">🏆 תחרות והישגים</h1>
        <HelpButton coachKey="leaderboard" />
      </div>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'portfolios', label: '💼 תיקים' },
          { value: 'players', label: '🧑‍🤝‍🧑 שחקנים' },
          { value: 'achievements', label: '🏅 ההישגים שלי' }
        ]}
      />

      {tab === 'portfolios' && (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {leagues.map(([lg, list]) => (
              <button key={lg} onClick={() => setLeague(lg)} className={clsx('chip', activeLeague === lg && 'chip-on')}>
                {leagueName(lg)} ({list.length})
              </button>
            ))}
          </div>
          {rows.length === 0 ? (
            <div className="card p-6 text-center text-slate-500">עוד אין תיקים בליגה הזו.</div>
          ) : (
            <>
              <div className="flex items-end justify-center gap-3 pt-4">
                {[1, 0, 2].map((idx) =>
                  rows[idx] ? (
                    <div key={idx} className="flex flex-col items-center w-28">
                      <div className="text-4xl">{profiles[rows[idx].p.ownerId]?.avatar ?? '❓'}</div>
                      <div className="text-sm font-bold truncate max-w-full">{rows[idx].p.name}</div>
                      <Change value={rows[idx].ret} />
                      <div className={clsx('w-full mt-1 rounded-t-xl grid place-items-center text-3xl text-white font-extrabold', idx === 0 ? 'h-24 bg-amber-400' : idx === 1 ? 'h-16 bg-slate-400' : 'h-12 bg-orange-400')}>{MEDAL[idx]}</div>
                    </div>
                  ) : null
                )}
              </div>
              <div className="card divide-y divide-slate-100">
                {rows.map((r, k) => {
                  const owner = profiles[r.p.ownerId];
                  return (
                    <div key={r.id} className={clsx('flex items-center gap-3 p-3', r.p.ownerId === me.id && 'bg-brand-50/60')}>
                      <span className="w-8 text-center font-extrabold text-lg">{MEDAL[k] ?? k + 1}</span>
                      <span className="text-2xl">{owner?.avatar}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-bold truncate">
                          {r.p.emoji} {r.p.name}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {owner?.name} · {r.p.mode === 'history' ? `📅 ${formatDateHe(r.p.currentDate, { short: true })}` : `מאז ${formatDateHe(r.p.startDate, { short: true })}`}
                        </span>
                      </span>
                      <span className="text-left">
                        <Change value={r.ret} />
                        <span className="block text-xs text-slate-500 num">{fmtMoney(r.value, r.p.baseCurrency)}</span>
                      </span>
                    </div>
                  );
                })}
                {ghost.map((g) => (
                  <div key={g.name} className="flex items-center gap-3 p-3 opacity-70">
                    <span className="w-8" />
                    <span className="flex-1 text-sm">{g.name} (באותה תקופה, בשקלים)</span>
                    <Change value={g.ret} />
                  </div>
                ))}
              </div>
              {activeLeague !== 'live' && <div className="text-xs text-slate-500">במכונת הזמן כל תיק מתקדם בקצב שלו – הדירוג הסופי הוגן כשכולם מגיעים לסוף האתגר.</div>}
            </>
          )}
        </>
      )}

      {tab === 'players' && (
        <div className="card divide-y divide-slate-100">
          {players.map(({ pr, best, trades, ach, lessons }, k) => {
            const l = levelFor(pr.xp);
            return (
              <div key={pr.id} className={clsx('flex items-center gap-3 p-3', pr.id === me.id && 'bg-brand-50/60')}>
                <span className="w-8 text-center font-extrabold text-lg">{MEDAL[k] ?? k + 1}</span>
                <span className="w-12 h-12 rounded-full grid place-items-center text-3xl border-2" style={{ borderColor: pr.color }}>
                  {pr.avatar}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold">{pr.name}</span>
                  <span className="block text-xs text-slate-500">
                    {l.emoji} {l.title} · 🏅 {ach} הישגים · 🎓 {lessons} שיעורים · 🛒 {trades} עסקאות
                  </span>
                </span>
                <span className="text-left">
                  <span className="block font-extrabold text-amber-600 num">{pr.xp} XP</span>
                  {Number.isFinite(best) && (
                    <span className="block text-xs">
                      התיק הטוב: <Change value={best} />
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'achievements' && (
        <div className="space-y-4">
          <div className="card p-4 text-center">
            <div className="text-4xl font-extrabold">
              {Object.keys(me.achievements).length}/{ACHIEVEMENTS.length}
            </div>
            <div className="text-slate-500">הישגים נפתחו</div>
            <ProgressBar value={Object.keys(me.achievements).length / ACHIEVEMENTS.length} className="mt-2" color="bg-amber-400" />
          </div>
          {Object.entries(CATS).map(([cat, label]) => (
            <div key={cat}>
              <SectionTitle>{label}</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ACHIEVEMENTS.filter((a) => a.category === cat).map((a) => {
                  const got = me.achievements[a.id];
                  const prog = !got && a.progress ? a.progress(ctx) : got ? 1 : 0;
                  return (
                    <div key={a.id} className={clsx('rounded-2xl p-3 border text-center', got ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100')}>
                      <div className={clsx('text-4xl', !got && 'grayscale opacity-40')}>{a.emoji}</div>
                      <div className="font-bold text-sm mt-1">{a.title}</div>
                      <div className="text-xs text-slate-500">{a.desc}</div>
                      {got ? <div className="text-xs text-amber-700 mt-1">✓ {formatDateHe(got.slice(0, 10), { short: true })}</div> : a.progress ? <ProgressBar value={prog} className="mt-2 h-1.5" color="bg-emerald-500" /> : <div className="text-xs text-slate-400 mt-1">+{a.xp} XP</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
