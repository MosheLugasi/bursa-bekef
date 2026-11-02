import { useMemo, useState } from 'react';
import { EVENTS } from '@/content';
import type { MarketEvent } from '@/content/types';
import { useMarket } from '@/data/loader';
import { addDays, addMonths, formatDateHe } from '@/engine/dates';
import { inst } from '@/engine/universe';
import { useCurrentProfile, useGame } from '@/state/store';
import { awardXp, checkAchievements, fireConfetti } from '@/game/actions';
import { XP } from '@/game/xp';
import { PriceChart } from '@/ui/charts';
import { Change, Empty, RichText, useCoachOnce } from '@/ui/components';
import { clsx } from '@/ui/format';

interface Round {
  e: MarketEvent;
  ticker: string;
  d0: string;
  d1: string;
  change: number;
}

export default function Predict() {
  useCoachOnce('predict');
  const market = useMarket();
  const profile = useCurrentProfile()!;
  const update = useGame((s) => s.updateProfile);
  const [guess, setGuess] = useState<'up' | 'down' | null>(null);
  const [seed, setSeed] = useState(0);

  const rounds = useMemo<Round[]>(() => {
    const out: Round[] = [];
    for (const e of EVENTS) {
      if (e.impact === 'mixed' && !e.predictQuestion) continue;
      const ticker = e.tickers.find((t) => market.available(t, e.date));
      if (!ticker) continue;
      const d0 = market.snap(addDays(market.nextDate(addDays(e.date, -1)), 0));
      const d1 = addMonths(d0, 1);
      if (d1 > market.asOf || d0 < market.first) continue;
      const change = market.change(ticker, d0, d1);
      if (!Number.isFinite(change)) continue;
      out.push({ e, ticker, d0, d1, change });
    }
    return out;
  }, [market]);

  const round = useMemo(() => {
    const unseen = rounds.filter((r) => !profile.predictions.seen.includes(r.e.id));
    const pool = unseen.length ? unseen : rounds;
    return pool.length ? pool[(seed * 7 + profile.predictions.played * 13) % pool.length] : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds, seed]);

  const before = useMemo(() => (round ? market.closeSeries(round.ticker, addMonths(round.d0, -3), round.d0) : []), [round, market]);
  const after = useMemo(() => (round ? market.closeSeries(round.ticker, addMonths(round.d0, -3), round.d1) : []), [round, market]);

  if (!round) return <Empty emoji="🔮" title="אין כרגע אירועים זמינים למשחק" />;
  const i = inst(round.ticker)!;
  const actual = round.change >= 0 ? 'up' : 'down';
  const right = guess === actual;

  const choose = (g: 'up' | 'down') => {
    if (guess) return;
    setGuess(g);
    const ok = g === actual;
    update(profile.id, (p) => ({
      ...p,
      predictions: { played: p.predictions.played + 1, correct: p.predictions.correct + (ok ? 1 : 0), seen: [...p.predictions.seen.filter((x) => x !== round.e.id), round.e.id] }
    }));
    awardXp(profile.id, ok ? XP.predictCorrect : XP.predictPlay, ok ? 'ניחוש נכון!' : 'על הניסיון');
    if (ok) fireConfetti();
    checkAchievements(profile.id);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">🔮 מה יקרה אחר כך?</h1>
        <div className="text-sm text-slate-600">
          ✅ {profile.predictions.correct}/{profile.predictions.played}
        </div>
      </div>
      <div className="card p-4">
        <div className="text-xs text-slate-500">{formatDateHe(round.e.date, { weekday: true })}</div>
        <div className="text-xl font-extrabold">
          {round.e.emoji} {round.e.title}
        </div>
        <div className="mt-2 text-base leading-relaxed">
          <RichText text={profile.ageGroup === 'adult' ? round.e.adult : round.e.kid} />
        </div>
      </div>
      <div className="card p-4">
        <div className="font-bold mb-1">
          {i.emoji} {i.nameHe} – הגרף עד {guess ? formatDateHe(round.d1) : 'יום האירוע'}
        </div>
        <PriceChart line={guess ? after : before} mode="line" markers={[{ date: round.d0, kind: 'news', text: '📰' }]} height={220} />
      </div>
      {!guess ? (
        <div className="card p-4">
          <div className="font-bold text-lg mb-3">{round.e.predictQuestion ?? `מה לדעתכם יקרה למחיר של ${i.nameHe} בחודש הקרוב?`}</div>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-buy text-xl py-4" onClick={() => choose('up')}>
              📈 יעלה
            </button>
            <button className="btn-sell text-xl py-4" onClick={() => choose('down')}>
              📉 ירד
            </button>
          </div>
        </div>
      ) : (
        <div className={clsx('card p-4 animate-pop', right ? 'bg-up-bg' : 'bg-amber-50')}>
          <div className="text-2xl font-extrabold">{right ? '🎉 צדקתם!' : '🤔 הפעם השוק הפתיע'}</div>
          <div className="mt-1">
            בחודש שאחרי, {i.nameHe} {round.change >= 0 ? 'עלתה' : 'ירדה'} <Change value={round.change} big />
          </div>
          <div className="mt-3 rounded-xl bg-white/70 p-3">
            <div className="font-semibold">💡 מה לומדים מזה?</div>
            <RichText text={round.e.lesson} />
          </div>
          <div className="text-xs text-slate-500 mt-2">זכרו: גם מקצוענים לא יודעים לנחש את השוק בטווח הקצר. מה שחשוב הוא להבין למה דברים קורים.</div>
          <button
            className="btn-primary w-full mt-4 text-lg"
            onClick={() => {
              setGuess(null);
              setSeed(seed + 1);
            }}
          >
            לאירוע הבא ←
          </button>
        </div>
      )}
    </div>
  );
}
