// פעולות משחק שמחברות בין המנוע, המצב והממשק (XP, הישגים, קידום זמן, עסקאות)
import confetti from 'canvas-confetti';
import { useGame, useSession } from '@/state/store';
import { useUI } from '@/state/ui';
import { useMarketStore, ensureDetails } from '@/data/loader';
import type { Portfolio } from '@/engine/types';
import { advance, detailsNeeded, recordEquity } from '@/engine/process';
import { totalValue, type Result, type TradeOutcome } from '@/engine/trading';
import { addDays, todayISO, type ISODate } from '@/engine/dates';
import { ACH_BY_ID, makeCtx, newlyUnlocked } from './achievements';
import { levelFor, XP } from './xp';

export function fireConfetti(big = false) {
  try {
    confetti({ particleCount: big ? 160 : 70, spread: big ? 100 : 65, origin: { y: 0.7 }, disableForReducedMotion: true });
  } catch {
    /* אין קנבס בסביבת בדיקות */
  }
}

export function awardXp(profileId: string, amount: number, reason?: string) {
  if (amount <= 0) return;
  const g = useGame.getState();
  const before = g.profiles[profileId];
  if (!before) return;
  const oldLevel = levelFor(before.xp).level;
  g.updateProfile(profileId, (p) => ({ ...p, xp: p.xp + amount }));
  const newLevel = levelFor(before.xp + amount).level;
  if (reason) useUI.getState().toast({ emoji: '⭐', text: `+${amount} XP · ${reason}`, kind: 'xp' });
  if (newLevel > oldLevel) {
    useUI.getState().celebrate({ type: 'level', level: newLevel });
    fireConfetti(true);
  }
}

/** בודק הישגים חדשים לשחקן ופותח אותם */
export function checkAchievements(profileId?: string) {
  const market = useMarketStore.getState().market;
  if (!market) return;
  const g = useGame.getState();
  const ids = profileId ? [profileId] : Object.keys(g.profiles);
  const all = Object.values(g.portfolios);
  for (const id of ids) {
    const profile = useGame.getState().profiles[id];
    if (!profile) continue;
    const ctx = makeCtx(profile, all, Object.values(useGame.getState().profiles), market);
    const fresh = newlyUnlocked(ctx);
    if (!fresh.length) continue;
    const at = new Date().toISOString();
    g.updateProfile(id, (p) => ({ ...p, achievements: { ...p.achievements, ...Object.fromEntries(fresh.map((a) => [a, at])) } }));
    const isMe = useSession.getState().profileId === id;
    let xp = 0;
    for (const a of fresh) {
      xp += ACH_BY_ID.get(a)?.xp ?? 0;
      if (isMe) useUI.getState().celebrate({ type: 'achievement', id: a });
    }
    if (isMe && fresh.length) fireConfetti();
    awardXp(id, xp);
  }
}

/** רצף ימים + בונוס כניסה יומית */
export function touchStreak(profileId: string) {
  const p = useGame.getState().profiles[profileId];
  if (!p) return;
  const today = todayISO();
  if (p.streak.last === today) return;
  const yesterday = addDays(today, -1);
  const count = p.streak.last === yesterday ? p.streak.count + 1 : 1;
  useGame.getState().updateProfile(profileId, (x) => ({ ...x, streak: { last: today, count, best: Math.max(x.streak.best, count) } }));
  awardXp(profileId, XP.dailyLogin + Math.min(20, (count - 1) * 2), count > 1 ? `${count} ימים ברצף 🔥` : 'ברוכים השבים!');
  checkAchievements(profileId);
}

export function markCompanyRead(profileId: string, id: string) {
  const p = useGame.getState().profiles[profileId];
  if (!p || p.readCompanies.includes(id)) return;
  useGame.getState().updateProfile(profileId, (x) => ({ ...x, readCompanies: [...x.readCompanies, id] }));
  awardXp(profileId, XP.readCompany);
  checkAchievements(profileId);
}

export function markTermRead(profileId: string, id: string) {
  const p = useGame.getState().profiles[profileId];
  if (!p || p.readTerms.includes(id)) return;
  useGame.getState().updateProfile(profileId, (x) => ({ ...x, readTerms: [...x.readTerms, id] }));
  awardXp(profileId, XP.readTerm);
  checkAchievements(profileId);
}

export function markCoachSeen(profileId: string, key: string) {
  useGame.getState().updateProfile(profileId, (p) => ({ ...p, seenCoach: { ...p.seenCoach, [key]: true } }));
}

/** שמירת תוצאת עסקה: מעדכן תיק, נקודת שווי, XP והישגים */
export function commitTrade(res: Result<TradeOutcome | Portfolio>, successText: string): boolean {
  const ui = useUI.getState();
  if (!res.ok) {
    ui.toast({ emoji: '😕', text: res.error, kind: 'bad' });
    return false;
  }
  const market = useMarketStore.getState().market!;
  const p = 'portfolio' in res.value ? res.value.portfolio : res.value;
  useGame.getState().setPortfolio(recordEquity(p, market));
  ui.toast({ emoji: '✅', text: successText, kind: 'good' });
  if ('portfolio' in res.value) {
    // XP על עסקאות: עד 10 עסקאות ביום אמיתי (כדי שלא ישתלם "לחוות" XP בקנייה ומכירה)
    const today = todayISO();
    const prof = useGame.getState().profiles[p.ownerId];
    if (prof) {
      const d = prof.daily?.date === today ? prof.daily : { date: today, trades: 0 };
      if (d.trades < 10) {
        useGame.getState().updateProfile(p.ownerId, (x) => ({ ...x, daily: { date: today, trades: d.trades + 1 } }));
        awardXp(p.ownerId, XP.trade + (d.trades === 0 ? XP.firstTradeOfDay : 0));
      }
    }
  }
  checkAchievements(p.ownerId);
  return true;
}

/** קידום הזמן בתיק (מכונת הזמן) או עיבוד ימים חדשים (שוק חי) */
export async function advancePortfolio(portfolioId: string, target: ISODate, opts: { silent?: boolean } = {}) {
  const market = useMarketStore.getState().market;
  const p = useGame.getState().portfolios[portfolioId];
  if (!market || !p) return;
  await ensureDetails(market, detailsNeeded(p));
  const before = totalValue(p, market);
  const from = p.currentDate;
  const res = advance(p, market, target);
  if (res.portfolio === p) return;
  useGame.getState().setPortfolio(res.portfolio);
  const after = totalValue(res.portfolio, market);
  if (!opts.silent || res.events.length) {
    useUI.getState().showSummary({ portfolioId, from, to: res.portfolio.currentDate, events: res.events, valueBefore: before, valueAfter: after });
  }
  checkAchievements(p.ownerId);
}

/** בעת טעינה: מעבד את כל תיקי השוק החי עד יום המסחר האחרון בנתונים */
export async function processLivePortfolios() {
  const market = useMarketStore.getState().market;
  if (!market) return;
  const me = useSession.getState().profileId;
  for (const p of Object.values(useGame.getState().portfolios)) {
    if (p.mode !== 'live' || p.archived || p.currentDate >= market.asOf) continue;
    await advancePortfolio(p.id, market.asOf, { silent: p.ownerId !== me });
  }
}
