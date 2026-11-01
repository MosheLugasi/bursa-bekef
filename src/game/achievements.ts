import type { MarketData } from '@/engine/market';
import type { Portfolio } from '@/engine/types';
import { totalValue } from '@/engine/trading';
import { benchmarkReturn } from '@/engine/metrics';
import { daysBetween } from '@/engine/dates';
import { inst } from '@/engine/universe';
import type { Profile } from '@/state/types';
import { leagueOf } from './challenges';

export interface AchCtx {
  profile: Profile;
  mine: Portfolio[];
  all: Portfolio[];
  profiles: Profile[];
  market: MarketData;
  value: (p: Portfolio) => number;
}

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  xp: number;
  category: 'trading' | 'performance' | 'learning' | 'streak' | 'competition';
  check: (c: AchCtx) => boolean;
  /** התקדמות 0..1 (אופציונלי, להצגה) */
  progress?: (c: AchCtx) => number;
}

const txs = (c: AchCtx) => c.mine.flatMap((p) => p.txs);
const hasTx = (c: AchCtx, f: (t: Portfolio['txs'][number]) => boolean) => c.mine.some((p) => p.txs.some(f));
const ret = (c: AchCtx, p: Portfolio) => c.value(p) / p.startCash - 1;
const bestRet = (c: AchCtx) => Math.max(-1, ...c.mine.map((p) => ret(c, p)));
const lessonsDone = (c: AchCtx) => Object.keys(c.profile.lessons).length;
const clamp = (x: number) => Math.max(0, Math.min(1, x));

function heldSectors(p: Portfolio): Set<string> {
  const s = new Set<string>();
  for (const pos of p.positions) if (pos.kind === 'stock') s.add(inst(pos.instrumentId)?.sector ?? '');
  return s;
}

function longestHoldDays(p: Portfolio): number {
  let best = 0;
  for (const pos of p.positions) if (pos.kind === 'stock') best = Math.max(best, daysBetween(pos.openedAt, p.currentDate));
  return best;
}

function rankInLeague(c: AchCtx, p: Portfolio): { rank: number; size: number; owners: number } {
  const lg = leagueOf(p);
  const peers = c.all.filter((x) => leagueOf(x) === lg && !x.archived && x.txs.length > 0);
  const sorted = [...peers].sort((a, b) => ret(c, b) - ret(c, a));
  return { rank: sorted.findIndex((x) => x.id === p.id) + 1, size: peers.length, owners: new Set(peers.map((x) => x.ownerId)).size };
}

export const ACHIEVEMENTS: Achievement[] = [
  // ---- מסחר
  { id: 'first-trade', emoji: '🛒', title: 'הקנייה הראשונה', desc: 'קנו מניה או קרן בפעם הראשונה', xp: 25, category: 'trading', check: (c) => hasTx(c, (t) => t.type === 'buy') },
  { id: 'first-sell', emoji: '💸', title: 'מכירה ראשונה', desc: 'מכרו מניה בפעם הראשונה', xp: 20, category: 'trading', check: (c) => hasTx(c, (t) => t.type === 'sell') },
  { id: 'first-profit', emoji: '🤑', title: 'רווח ראשון', desc: 'מכרו משהו ברווח', xp: 30, category: 'trading', check: (c) => hasTx(c, (t) => (t.pnl ?? 0) > 0) },
  { id: 'both-sides', emoji: '🌊', title: 'שני צדי הים', desc: 'החזיקו בו-זמנית מניה ישראלית ומניה אמריקאית', xp: 30, category: 'trading', check: (c) => c.mine.some((p) => { const m = new Set(p.positions.filter((x) => x.kind === 'stock').map((x) => (x.kind === 'stock' ? inst(x.instrumentId)?.market : ''))); return m.has('IL') && m.has('US'); }) },
  { id: 'diversified', emoji: '🧺', title: 'סל מגוון', desc: 'החזיקו מניות מ-5 תחומים (סקטורים) שונים בו-זמנית', xp: 50, category: 'trading', check: (c) => c.mine.some((p) => heldSectors(p).size >= 5), progress: (c) => clamp(Math.max(0, ...c.mine.map((p) => heldSectors(p).size)) / 5) },
  { id: 'collector', emoji: '🔟', title: 'אספן', desc: 'החזיקו 10 נכסים שונים באותו תיק', xp: 40, category: 'trading', check: (c) => c.mine.some((p) => p.positions.length >= 10), progress: (c) => clamp(Math.max(0, ...c.mine.map((p) => p.positions.length)) / 10) },
  { id: 'index-investor', emoji: '🧭', title: 'משקיע מדדים', desc: 'קנו קרן סל או קרן מחקה מדד', xp: 25, category: 'trading', check: (c) => hasTx(c, (t) => t.type === 'buy' && ['etf', 'fund'].includes(inst(t.instrumentId ?? '')?.type ?? '')) },
  { id: 'first-bond', emoji: '📜', title: 'מלווה כסף', desc: 'קנו אג״ח בפעם הראשונה', xp: 30, category: 'trading', check: (c) => hasTx(c, (t) => t.type === 'bond_buy') },
  { id: 'first-option', emoji: '🎟️', title: 'כרטיס אופציה', desc: 'קנו אופציה בפעם הראשונה', xp: 30, category: 'trading', check: (c) => hasTx(c, (t) => t.type === 'option_buy') },
  { id: 'limit-fill', emoji: '🎯', title: 'סבלנות משתלמת', desc: 'פקודת לימיט שלכם בוצעה', xp: 30, category: 'trading', check: (c) => c.mine.some((p) => p.counters.limitFills > 0) },
  { id: 'stop-saved', emoji: '🛡️', title: 'הסטופ שמר עליי', desc: 'סטופ לוס הופעל והגן עליכם מהמשך ירידה', xp: 30, category: 'trading', check: (c) => c.mine.some((p) => p.counters.stopLossHits > 0) },
  { id: 'tp-hit', emoji: '💰', title: 'לקחתי רווח', desc: 'טייק פרופיט הופעל ומימש לכם רווח', xp: 35, category: 'trading', check: (c) => c.mine.some((p) => p.counters.takeProfitHits > 0) },
  { id: 'dividend', emoji: '🍬', title: 'דיבידנד ראשון', desc: 'קיבלו דיבידנד מחברה', xp: 25, category: 'trading', check: (c) => c.mine.some((p) => p.counters.dividends > 0) },
  { id: 'dividend-king', emoji: '👑', title: 'אוסף דיבידנדים', desc: 'קיבלו דיבידנדים בסך 1,000 לפחות', xp: 60, category: 'trading', check: (c) => c.mine.some((p) => p.counters.dividends >= 1000), progress: (c) => clamp(Math.max(0, ...c.mine.map((p) => p.counters.dividends)) / 1000) },
  { id: 'coupon', emoji: '🧾', title: 'ריבית ראשונה', desc: 'קיבלו תשלום ריבית (קופון) מאג״ח', xp: 25, category: 'trading', check: (c) => c.mine.some((p) => p.counters.coupons > 0) },
  { id: 'split', emoji: '✂️', title: 'עדי פיצול', desc: 'החזיקו מניה כשהחברה פיצלה אותה', xp: 25, category: 'trading', check: (c) => hasTx(c, (t) => t.type === 'split') },
  { id: 'option-win', emoji: '🚀', title: 'אופציה מנצחת', desc: 'הרוויחו מאופציה', xp: 50, category: 'trading', check: (c) => hasTx(c, (t) => (t.type === 'option_sell' || t.type === 'option_expire') && (t.pnl ?? 0) > 0) },
  { id: 'bond-maturity', emoji: '🏁', title: 'עד הסוף', desc: 'החזיקו אג״ח עד הפדיון', xp: 50, category: 'trading', check: (c) => hasTx(c, (t) => t.type === 'bond_maturity') },
  { id: 'trader-25', emoji: '⚡', title: 'סוחר פעיל', desc: 'בצעו 25 עסקאות', xp: 40, category: 'trading', check: (c) => txs(c).filter((t) => ['buy', 'sell', 'option_buy', 'option_sell', 'bond_buy', 'bond_sell'].includes(t.type)).length >= 25, progress: (c) => clamp(txs(c).filter((t) => ['buy', 'sell', 'option_buy', 'option_sell', 'bond_buy', 'bond_sell'].includes(t.type)).length / 25) },
  // ---- ביצועים
  { id: 'ret-5', emoji: '📈', title: 'בכיוון הנכון', desc: 'תיק עם תשואה של 5% ומעלה', xp: 30, category: 'performance', check: (c) => bestRet(c) >= 0.05, progress: (c) => clamp(bestRet(c) / 0.05) },
  { id: 'ret-10', emoji: '🔥', title: 'עשר אחוז!', desc: 'תיק עם תשואה של 10% ומעלה', xp: 50, category: 'performance', check: (c) => bestRet(c) >= 0.1, progress: (c) => clamp(bestRet(c) / 0.1) },
  { id: 'ret-25', emoji: '🚀', title: 'טיל', desc: 'תיק עם תשואה של 25% ומעלה', xp: 80, category: 'performance', check: (c) => bestRet(c) >= 0.25, progress: (c) => clamp(bestRet(c) / 0.25) },
  { id: 'ret-50', emoji: '🌕', title: 'עד הירח', desc: 'תיק עם תשואה של 50% ומעלה', xp: 120, category: 'performance', check: (c) => bestRet(c) >= 0.5, progress: (c) => clamp(bestRet(c) / 0.5) },
  { id: 'doubled', emoji: '💎', title: 'הכפלתי!', desc: 'הכפילו את הכסף בתיק', xp: 200, category: 'performance', check: (c) => bestRet(c) >= 1, progress: (c) => clamp(bestRet(c)) },
  {
    id: 'beat-market',
    emoji: '🏆',
    title: 'ניצחתי את השוק',
    desc: 'תיק שעבר את מדד S&P 500 אחרי חודש מסחר לפחות',
    xp: 80,
    category: 'performance',
    check: (c) => c.mine.some((p) => p.equity.length >= 20 && p.txs.length > 0 && ret(c, p) > benchmarkReturn(c.market, 'SPY', p))
  },
  { id: 'patient', emoji: '⏳', title: 'סבלנות', desc: 'החזיקו מניה 30 יום לפחות', xp: 30, category: 'performance', check: (c) => c.mine.some((p) => longestHoldDays(p) >= 30), progress: (c) => clamp(Math.max(0, ...c.mine.map(longestHoldDays)) / 30) },
  { id: 'diamond', emoji: '🙌', title: 'ידיים של יהלום', desc: 'החזיקו מניה שנה שלמה', xp: 80, category: 'performance', check: (c) => c.mine.some((p) => longestHoldDays(p) >= 365), progress: (c) => clamp(Math.max(0, ...c.mine.map(longestHoldDays)) / 365) },
  {
    id: 'comeback',
    emoji: '↩️',
    title: 'קאמבק',
    desc: 'תיק שירד ביותר מ-10% וחזר לרווח',
    xp: 70,
    category: 'performance',
    check: (c) =>
      c.mine.some((p) => {
        let low = false;
        for (const [, v] of p.equity) {
          if (v < p.startCash * 0.9) low = true;
          else if (low && v > p.startCash) return true;
        }
        return false;
      })
  },
  {
    id: 'storm',
    emoji: '🌪️',
    title: 'שרדתי את הסערה',
    desc: 'תיק שירד ביותר מ-20% מהשיא – וחזר לשיא חדש',
    xp: 100,
    category: 'performance',
    check: (c) =>
      c.mine.some((p) => {
        let peak = p.startCash;
        let deep = false;
        for (const [, v] of p.equity) {
          if (v > peak) {
            if (deep) return true;
            peak = v;
          } else if (v < peak * 0.8) deep = true;
        }
        return false;
      })
  },
  { id: 'time-traveler', emoji: '⏰', title: 'נוסעים בזמן', desc: 'התקדמו שנה שלמה במכונת הזמן', xp: 50, category: 'performance', check: (c) => c.mine.some((p) => p.mode === 'history' && daysBetween(p.startDate, p.currentDate) >= 365) },
  { id: 'challenge-done', emoji: '🏁', title: 'סיימתי אתגר', desc: 'סיימו אתגר של מכונת הזמן', xp: 60, category: 'performance', check: (c) => c.mine.some((p) => p.finished) },
  { id: 'challenge-win', emoji: '🥇', title: 'גיבורי האתגר', desc: 'סיימו אתגר עם תשואה גבוהה מהמדד', xp: 120, category: 'performance', check: (c) => c.mine.some((p) => p.finished && ret(c, p) > benchmarkReturn(c.market, 'SPY', p)) },
  // ---- למידה
  { id: 'first-lesson', emoji: '🎓', title: 'השיעור הראשון', desc: 'סיימו שיעור באקדמיה', xp: 20, category: 'learning', check: (c) => lessonsDone(c) >= 1 },
  { id: 'lessons-5', emoji: '📚', title: 'תלמידים חרוצים', desc: 'סיימו 5 שיעורים', xp: 50, category: 'learning', check: (c) => lessonsDone(c) >= 5, progress: (c) => clamp(lessonsDone(c) / 5) },
  { id: 'lessons-all', emoji: '🧑‍🎓', title: 'בוגרי האקדמיה', desc: 'סיימו את כל השיעורים', xp: 200, category: 'learning', check: (c) => lessonsDone(c) >= 20, progress: (c) => clamp(lessonsDone(c) / 20) },
  { id: 'perfect-quiz', emoji: '💯', title: 'מאה אחוז', desc: 'ענו נכון על כל השאלות בבוחן של שיעור', xp: 30, category: 'learning', check: (c) => Object.values(c.profile.lessons).some((l) => l.total > 0 && l.score === l.total) },
  { id: 'quiz-7', emoji: '🧠', title: 'מוח של משקיע', desc: 'ענו נכון על 7 שאלות יומיות', xp: 50, category: 'learning', check: (c) => c.profile.quiz.correct >= 7, progress: (c) => clamp(c.profile.quiz.correct / 7) },
  { id: 'researcher', emoji: '🔎', title: 'חוקרים', desc: 'קראו על 10 חברות שונות', xp: 30, category: 'learning', check: (c) => c.profile.readCompanies.length >= 10, progress: (c) => clamp(c.profile.readCompanies.length / 10) },
  { id: 'researcher-30', emoji: '🕵️', title: 'בלשי בורסה', desc: 'קראו על 30 חברות שונות', xp: 80, category: 'learning', check: (c) => c.profile.readCompanies.length >= 30, progress: (c) => clamp(c.profile.readCompanies.length / 30) },
  { id: 'words-20', emoji: '📖', title: 'מילון מהלך', desc: 'פתחו הסבר של 20 מושגים', xp: 30, category: 'learning', check: (c) => c.profile.readTerms.length >= 20, progress: (c) => clamp(c.profile.readTerms.length / 20) },
  { id: 'predict-5', emoji: '🔮', title: 'נביאים', desc: 'נחשו נכון 5 פעמים ב״מה יקרה אחר כך?״', xp: 50, category: 'learning', check: (c) => c.profile.predictions.correct >= 5, progress: (c) => clamp(c.profile.predictions.correct / 5) },
  // ---- רצף
  { id: 'streak-3', emoji: '🔥', title: '3 ימים ברצף', desc: 'שחקו 3 ימים ברצף', xp: 20, category: 'streak', check: (c) => c.profile.streak.best >= 3, progress: (c) => clamp(c.profile.streak.best / 3) },
  { id: 'streak-7', emoji: '⚡', title: 'שבוע ברצף', desc: 'שחקו 7 ימים ברצף', xp: 50, category: 'streak', check: (c) => c.profile.streak.best >= 7, progress: (c) => clamp(c.profile.streak.best / 7) },
  { id: 'streak-30', emoji: '🌟', title: 'חודש ברצף', desc: 'שחקו 30 ימים ברצף', xp: 150, category: 'streak', check: (c) => c.profile.streak.best >= 30, progress: (c) => clamp(c.profile.streak.best / 30) },
  // ---- תחרות
  {
    id: 'league-leader',
    emoji: '👑',
    title: 'מקום ראשון',
    desc: 'תיק שלכם במקום הראשון בליגה (עם לפחות שחקן נוסף)',
    xp: 80,
    category: 'competition',
    check: (c) => c.mine.some((p) => { const r = rankInLeague(c, p); return r.rank === 1 && r.owners >= 2; })
  },
  {
    id: 'podium',
    emoji: '🥉',
    title: 'על הפודיום',
    desc: 'תיק שלכם בין שלושת הראשונים בליגה עם 4 תיקים לפחות',
    xp: 50,
    category: 'competition',
    check: (c) => c.mine.some((p) => { const r = rankInLeague(c, p); return r.rank >= 1 && r.rank <= 3 && r.size >= 4; })
  },
  {
    id: 'xp-leader',
    emoji: '🌟',
    title: 'הכי חרוצים',
    desc: 'הכי הרבה נקודות ניסיון (XP) מכל השחקנים',
    xp: 60,
    category: 'competition',
    check: (c) => c.profile.xp >= 200 && c.profiles.length >= 2 && c.profiles.every((p) => p.id === c.profile.id || p.xp < c.profile.xp)
  }
];

export const ACH_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function makeCtx(profile: Profile, all: Portfolio[], profiles: Profile[], market: MarketData): AchCtx {
  const cache = new Map<string, number>();
  const value = (p: Portfolio) => {
    let v = cache.get(p.id);
    if (v === undefined) {
      v = totalValue(p, market);
      cache.set(p.id, v);
    }
    return v;
  };
  return { profile, mine: all.filter((p) => p.ownerId === profile.id && !p.archived), all: all.filter((p) => !p.archived), profiles, market, value };
}

export function newlyUnlocked(ctx: AchCtx): string[] {
  const out: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (ctx.profile.achievements[a.id]) continue;
    try {
      if (a.check(ctx)) out.push(a.id);
    } catch {
      /* מתעלמים משגיאות בבדיקה */
    }
  }
  return out;
}
