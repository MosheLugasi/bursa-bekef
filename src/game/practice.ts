// "זירת האימון של שורי" – מחולל שאלות תרגול באחוזים ובתשואה (פונקציות טהורות, נבדקות בטסטים).
// כל המספרים "נחמדים" לילדים: התשובות הן מספרים שלמים.

export type Rng = () => number;
export type PracticeLevel = 1 | 2 | 3;
export type PracticeKind = 'percent-of' | 'what-percent' | 'discount' | 'change' | 'return' | 'compare' | 'updown' | 'recover';

export interface PracticeQuestion {
  kind: PracticeKind;
  level: PracticeLevel;
  text: string;
  /** אפשרויות מעורבבות */
  options: string[];
  /** אינדקס התשובה הנכונה ב-options */
  answer: number;
  /** הערך המספרי הנכון (לבדיקות) */
  value: number;
  explain: string;
  hint: string;
  /** לשאלות "כמה אחוז מתוך 100" – כמה משבצות לצבוע באיור */
  grid?: number;
}

export const LEVELS: { level: PracticeLevel; emoji: string; title: string; desc: string }[] = [
  { level: 1, emoji: '🌱', title: 'קל', desc: '10%, 50%, 25% ותשואה על 100 ₪' },
  { level: 2, emoji: '🌿', title: 'בינוני', desc: 'הנחות, שינוי באחוזים והשוואת תשואות' },
  { level: 3, emoji: '🌳', title: 'מאתגר', desc: 'כל אחוז, הפסדים, עלייה וירידה' }
];

export const KIND_LABEL: Record<PracticeKind, string> = {
  'percent-of': '🧮 אחוז מסכום',
  'what-percent': '💯 כמה אחוז?',
  discount: '🏷️ מבצע בחנות',
  change: '📊 שינוי באחוזים',
  return: '💹 תשואה',
  compare: '🏁 מי הצליח יותר?',
  updown: '🪀 עולה ויורד',
  recover: '🧗 לחזור למעלה'
};

const KINDS: Record<PracticeLevel, PracticeKind[]> = {
  1: ['percent-of', 'percent-of', 'what-percent', 'discount', 'return'],
  2: ['percent-of', 'what-percent', 'discount', 'change', 'return', 'return', 'compare'],
  3: ['percent-of', 'discount', 'change', 'return', 'return', 'compare', 'updown', 'recover']
};

/** XP לתשובה נכונה לפי רמה, ותקרה יומית */
export const PRACTICE_XP = { perCorrect: { 1: 3, 2: 4, 3: 5 } as Record<PracticeLevel, number>, streakBonus: 5, dailyCap: 60, dailyGoal: 10, dailyGoalBonus: 15 };

// ---------- כלים
const LRI = '⁦';
const PDI = '⁩';
/** ביטוי חשבוני שנשאר משמאל לימין בתוך משפט עברי */
export const eq = (s: string) => LRI + s + PDI;

export function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  return r.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
const ils = (n: number) => `${fmt(n)} ₪`;
export const pct = (n: number) => (n < 0 ? `${LRI}-${fmt(-n)}%${PDI}` : `${fmt(n)}%`);

const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length) % xs.length];

function shuffle<T>(rng: Rng, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** בונה אפשרויות: התשובה הנכונה + 2-3 מסיחים שונים זה מזה */
function options(rng: Rng, correct: number, wrong: number[], format: (n: number) => string, opts: { allowNegative?: boolean; allowZero?: boolean } = {}) {
  const seen = new Set([format(correct)]);
  const ds: string[] = [];
  const ok = (n: number) => Number.isFinite(n) && (opts.allowNegative || n > 0 || (opts.allowZero && n === 0));
  for (const w of wrong) {
    const r = Math.round(w * 100) / 100;
    const f = format(r);
    if (!ok(r) || seen.has(f)) continue;
    seen.add(f);
    ds.push(f);
    if (ds.length === 3) break;
  }
  // תמיד לפחות 2 מסיחים
  let k = 1;
  while (ds.length < 2) {
    const step = Math.max(1, Math.round(Math.abs(correct) / 10)) * k;
    for (const c of [correct + step, correct - step]) {
      const f = format(c);
      if (ok(c) && !seen.has(f) && ds.length < 3) {
        seen.add(f);
        ds.push(f);
      }
    }
    k++;
  }
  const all = shuffle(rng, [format(correct), ...ds]);
  return { options: all, answer: all.indexOf(format(correct)) };
}

// ---------- מחוללים לפי סוג
function trickOf(p: number, a: number): string {
  const ten = a / 10;
  switch (p) {
    case 10:
      return `10% = מחלקים ב-10: ${eq(`${fmt(a)} ÷ 10 = ${fmt(ten)}`)}`;
    case 50:
      return `50% = חצי: חצי מ-${fmt(a)} זה ${fmt(a / 2)}`;
    case 25:
      return `25% = חצי של חצי: ${fmt(a)} ← ${fmt(a / 2)} ← ${fmt(a / 4)}`;
    case 100:
      return '100% = הכל!';
    case 1:
      return `1% = מחלקים ב-100: ${eq(`${fmt(a)} ÷ 100 = ${fmt(a / 100)}`)}`;
    case 5:
      return `5% = חצי של 10%: 10% זה ${fmt(ten)}, וחצי מזה ${fmt(ten / 2)}`;
    case 75:
      return `75% = שלושה רבעים: רבע זה ${fmt(a / 4)}, ${eq(`${fmt(a / 4)} × 3 = ${fmt((a * 3) / 4)}`)}`;
    default:
      if (p % 10 === 0) return `${p}% = ${p / 10} פעמים 10%: 10% זה ${fmt(ten)}, ${eq(`${fmt(ten)} × ${p / 10} = ${fmt((a * p) / 100)}`)}`;
      return `מחלקים ב-100 וכופלים ב-${p}: ${eq(`${fmt(a)} ÷ 100 × ${p} = ${fmt((a * p) / 100)}`)}`;
  }
}

function hintOf(p: number): string {
  if (p === 10) return '💡 10% = מחלקים ב-10';
  if (p === 50) return '💡 50% = חצי';
  if (p === 25) return '💡 25% = חצי של חצי';
  if (p === 100) return '💡 100% = הכל';
  if (p === 1) return '💡 1% = מחלקים ב-100';
  if (p === 5) return '💡 5% = חצי של 10%';
  if (p === 75) return '💡 75% = שלושה רבעים';
  if (p % 10 === 0) return `💡 קודם מוצאים 10%, ואז כופלים ב-${p / 10}`;
  return '💡 מחלקים ב-100 (זה 1%) וכופלים במספר האחוזים';
}

function percentOfParams(rng: Rng, level: PracticeLevel): { p: number; a: number } {
  if (level === 1) {
    const p = pick(rng, [10, 10, 50, 50, 25, 100] as const);
    if (p === 25) return { p, a: pick(rng, [20, 40, 60, 80, 100, 200]) };
    if (p === 50) return { p, a: int(rng, 1, 10) * 10 };
    if (p === 100) return { p, a: int(rng, 1, 10) * 10 };
    return { p, a: int(rng, 1, 20) * 10 };
  }
  if (level === 2) {
    const p = pick(rng, [5, 20, 25, 30, 40, 75, 1, 10, 50] as const);
    if (p === 1) return { p, a: int(rng, 1, 9) * 100 };
    return { p, a: int(rng, 1, 20) * 20 };
  }
  return { p: int(rng, 1, 19) * 5, a: int(rng, 1, 50) * 20 };
}

function genPercentOf(rng: Rng, level: PracticeLevel): PracticeQuestion {
  const { p, a } = percentOfParams(rng, level);
  const v = (a * p) / 100;
  const o = options(rng, v, [a - v, p, v * 10, v * 2, v / 2, a / p], ils);
  return { kind: 'percent-of', level, text: `כמה זה ${p}% מ-${ils(a)}?`, ...o, value: v, explain: trickOf(p, a), hint: hintOf(p) };
}

function genWhatPercent(rng: Rng, level: PracticeLevel): PracticeQuestion {
  if (level === 1 || rng() < 0.4) {
    const k = pick(rng, [10, 20, 25, 30, 40, 50, 60, 75, 80, 90, 100, 5]);
    const o = options(rng, k, [100 - k, k / 10, k * 2, k / 2], pct);
    return {
      kind: 'what-percent',
      level,
      text: `צבעתם ${k} משבצות מתוך 100. כמה אחוז צבעתם?`,
      ...o,
      value: k,
      grid: k,
      explain: `אחוז = כמה מתוך 100. ${k} מתוך 100 = ${k}%.`,
      hint: '💡 אחוז = כמה מתוך 100'
    };
  }
  // k מתוך N, כש-N מתחלק יפה
  const n = pick(rng, [10, 20, 50, 200, 4, 5, 25] as const);
  const step = 100 / n; // כמה אחוז שווה כל פריט
  const k = int(rng, 1, n - 1);
  const v = k * step;
  if (!Number.isInteger(v)) return genWhatPercent(rng, level);
  const o = options(rng, v, [k, 100 - v, v / 2, v * 2], pct);
  const scale = n < 100 ? `כופלים את שניהם ב-${fmt(100 / n)}` : `מחלקים את שניהם ב-${fmt(n / 100)}`;
  return {
    kind: 'what-percent',
    level,
    text: `יש ${n} כדורים, ו-${k} מהם אדומים 🔴. כמה אחוז מהכדורים אדומים?`,
    ...o,
    value: v,
    explain: `רוצים לדעת כמה מתוך 100: ${scale}. ${k} מתוך ${n} = ${fmt(v)} מתוך 100 = ${fmt(v)}%.`,
    hint: `💡 כמה זה ${k} מתוך ${n}, אם היו 100?`
  };
}

const ITEMS = ['🧸 דובי', '🎮 משחק', '👟 נעליים', '⚽ כדור', '📚 ספר', '🎧 אוזניות', '🛹 סקייטבורד', '🚲 אופניים', '🎒 תיק', '🧩 פאזל'];

function genDiscount(rng: Rng, level: PracticeLevel): PracticeQuestion {
  const item = pick(rng, ITEMS);
  let d: number, price: number;
  if (level === 1) {
    d = pick(rng, [10, 50, 50, 25]);
    price = d === 25 ? pick(rng, [20, 40, 80, 100, 200]) : int(rng, 1, 10) * 10;
  } else if (level === 2) {
    d = pick(rng, [20, 25, 30, 40, 75, 10, 50]);
    price = int(rng, 1, 20) * 20;
  } else {
    d = int(rng, 1, 18) * 5;
    price = int(rng, 1, 50) * 20;
  }
  const save = (price * d) / 100;
  const pay = price - save;
  const askPay = rng() < 0.6;
  const v = askPay ? pay : save;
  const o = options(rng, v, askPay ? [save, price + save, price - d, price] : [pay, d, price - d], ils);
  return {
    kind: 'discount',
    level,
    text: `${item} עולה ${ils(price)} ויש ${d}% הנחה. ${askPay ? 'כמה משלמים?' : 'כמה חוסכים?'}`,
    ...o,
    value: v,
    explain: `ההנחה: ${d}% מ-${ils(price)} = ${ils(save)}. ${askPay ? `משלמים: ${eq(`${fmt(price)} − ${fmt(save)} = ${fmt(pay)}`)} ₪.` : `חוסכים ${ils(save)} (ומשלמים ${ils(pay)}).`}`,
    hint: askPay ? '💡 קודם מחשבים את ההנחה, ואז מורידים אותה מהמחיר' : hintOf(d)
  };
}

function genChange(rng: Rng, level: PracticeLevel): PracticeQuestion {
  // שינוי מ-a ל-b באחוזים
  let a: number, p: number;
  if (level <= 2) {
    a = pick(rng, [100, 100, 50, 200, 20]);
    p = pick(rng, [10, 20, 25, 50, -10, -20, -50, 100]);
  } else {
    a = pick(rng, [40, 80, 200, 300, 400, 500]);
    p = pick(rng, [5, 15, 25, 35, 60, -5, -15, -25, -40, -75]);
  }
  const b = a + (a * p) / 100;
  if (!Number.isInteger(b)) return genChange(rng, level);
  const diff = b - a;
  const up = p > 0;
  const o = options(rng, Math.abs(p), [Math.abs(diff), (b / a) * 100, Math.abs(p) * 2, Math.abs(p) / 2], pct);
  return {
    kind: 'change',
    level,
    text: `מחיר של ${ils(a)} ${up ? 'עלה' : 'ירד'} ל-${ils(b)}. בכמה אחוז הוא ${up ? 'עלה' : 'ירד'}?`,
    ...o,
    value: Math.abs(p),
    explain: `השינוי: ${ils(Math.abs(diff))} מתוך ${ils(a)}. ${eq(`${fmt(Math.abs(diff))} ÷ ${fmt(a)} × 100 = ${fmt(Math.abs(p))}%`)}.`,
    hint: '💡 מחשבים את השינוי בשקלים, ובודקים כמה זה מתוך המחיר ההתחלתי'
  };
}

function genReturn(rng: Rng, level: PracticeLevel): PracticeQuestion {
  let inv: number, r: number;
  if (level === 1) {
    inv = 100;
    r = pick(rng, [5, 10, 15, 20, 25, 30, 50]);
  } else if (level === 2) {
    inv = pick(rng, [50, 200, 20, 10, 500, 100]);
    r = pick(rng, [10, 20, 25, 50, 5, -10, -20, -50]);
  } else {
    inv = int(rng, 1, 50) * 20;
    r = pick(rng, [5, 10, 15, 20, 25, 30, 40, 60, 75, 100, -5, -10, -15, -25, -40, -60]);
  }
  const profit = (inv * r) / 100;
  if (!Number.isInteger(profit)) return genReturn(rng, level);
  const sell = inv + profit;
  const ask = level === 1 && rng() < 0.5 ? 'profit' : 'sell';
  const text =
    ask === 'profit' ? `השקעתם ${ils(inv)} והרווחתם ${ils(profit)}. מה התשואה?` : `השקעתם ${ils(inv)}, ועכשיו ההשקעה שווה ${ils(sell)}. מה התשואה?`;
  const o = options(rng, r, [profit, (sell / inv) * 100, -r, r * 2, r / 2], pct, { allowNegative: true });
  const gain = Math.abs(profit);
  const lossy = r < 0;
  const head =
    ask === 'sell'
      ? lossy
        ? `ההפסד: ${eq(`${fmt(inv)} − ${fmt(sell)} = ${fmt(gain)}`)} ₪. `
        : `הרווח: ${eq(`${fmt(sell)} − ${fmt(inv)} = ${fmt(gain)}`)} ₪. `
      : '';
  const body =
    inv === 100
      ? `על 100 ₪ ${lossy ? 'הפסדתם' : 'הרווחתם'} ${ils(gain)} – תשואה של ${pct(r)}.`
      : `על כל 100 ₪ ${lossy ? 'הפסדתם' : 'הרווחתם'} ${ils(Math.abs(r))}: ${eq(`${fmt(gain)} ÷ ${fmt(inv)} × 100 = ${fmt(Math.abs(r))}%`)}${lossy ? ` – תשואה שלילית של ${pct(r)}` : ''}.`;
  return {
    kind: 'return',
    level,
    text,
    ...o,
    value: r,
    explain: head + body,
    hint: '💡 תשואה = כמה הרווחתם על כל 100 ₪ שהשקעתם'
  };
}

const PAIRS: [{ n: string; f: boolean }, { n: string; f: boolean }][] = [
  [{ n: 'נועה', f: true }, { n: 'יואב', f: false }],
  [{ n: 'איתי', f: false }, { n: 'מאיה', f: true }],
  [{ n: 'שירה', f: true }, { n: 'עומר', f: false }],
  [{ n: 'אורי', f: false }, { n: 'דנה', f: true }],
  [{ n: 'תמר', f: true }, { n: 'עידו', f: false }]
];
const did = (f: boolean, inv: number, profit: number) => `${f ? 'השקיעה' : 'השקיע'} ${ils(inv)} ו${f ? 'הרוויחה' : 'הרוויח'} ${ils(profit)}`;

function genCompare(rng: Rng, level: PracticeLevel): PracticeQuestion {
  const [A, B] = pick(rng, PAIRS);
  const na = A.n;
  const nb = B.n;
  for (let tries = 0; tries < 50; tries++) {
    const invA = pick(rng, level === 2 ? [50, 100, 200, 20] : [40, 80, 200, 250, 400, 500]);
    const invB = pick(rng, level === 2 ? [50, 100, 200, 400] : [20, 50, 160, 300, 500, 1000]);
    const rA = pick(rng, [5, 10, 20, 25, 50]);
    const rB = pick(rng, [5, 10, 20, 25, 50]);
    const pA = (invA * rA) / 100;
    const pB = (invB * rB) / 100;
    if (rA === rB || invA === invB || !Number.isInteger(pA) || !Number.isInteger(pB)) continue;
    // רוב הזמן – "מלכודת": מי שהרוויח יותר שקלים הוא דווקא בעל התשואה הנמוכה
    const trap = (pA > pB) !== (rA > rB);
    if (!trap && rng() < 0.65) continue;
    const winner = rA > rB ? na : nb;
    const all = shuffle(rng, [na, nb, 'אותו דבר']);
    return {
      kind: 'compare',
      level,
      text: `${na} ${did(A.f, invA, pA)}. ${nb} ${did(B.f, invB, pB)}. למי התשואה גבוהה יותר?`,
      options: all,
      answer: all.indexOf(winner),
      value: Math.max(rA, rB),
      explain: `${na}: ${fmt(pA)} מתוך ${fmt(invA)} = ${rA}%. ${nb}: ${fmt(pB)} מתוך ${fmt(invB)} = ${rB}%. לכן ל${winner} תשואה גבוהה יותר${trap ? ' – גם אם הרווח בשקלים קטן יותר!' : '.'}`,
      hint: '💡 בודקים לכל אחד: כמה הרוויח על כל 100 ₪?'
    };
  }
  return genReturn(rng, level);
}

function genUpdown(rng: Rng, level: PracticeLevel): PracticeQuestion {
  const p = pick(rng, [10, 20, 50]);
  const firstUp = rng() < 0.6;
  const mid = firstUp ? 100 + p : 100 - p;
  const end = firstUp ? mid - (mid * p) / 100 : mid + (mid * p) / 100;
  const o = options(rng, end, [100, mid, 100 + p, 100 - 2 * p], ils);
  const sign = firstUp ? ['עלה', 'ירד'] : ['ירד', 'עלה'];
  return {
    kind: 'updown',
    level,
    text: `מחיר של 100 ₪ ${sign[0]} ב-${p}%, ואחר כך ${sign[1]} ב-${p}%. כמה הוא עכשיו?`,
    ...o,
    value: end,
    explain: `קודם: 100 ← ${fmt(mid)}. אחר כך ${p}% מ-${fmt(mid)} זה ${fmt((mid * p) / 100)}, אז מגיעים ל-${fmt(end)} ₪ – לא חוזרים ל-100!`,
    hint: '💡 האחוז השני מחושב מהמחיר החדש, לא מ-100'
  };
}

function genRecover(rng: Rng, level: PracticeLevel): PracticeQuestion {
  const [down, up] = pick(rng, [
    [50, 100],
    [20, 25],
    [75, 300],
    [60, 150],
    [80, 400],
    [50, 100]
  ] as const);
  const low = 100 - down;
  const o = options(rng, up, [down, down * 2, up / 2, 100], pct);
  return {
    kind: 'recover',
    level,
    text: `מניה ירדה מ-100 ₪ ל-${low} ₪ (ירידה של ${down}%). בכמה אחוז היא צריכה לעלות כדי לחזור ל-100 ₪?`,
    ...o,
    value: up,
    explain: `מ-${low} ל-100 צריך לעלות ${100 - low} ₪. ${eq(`${100 - low} ÷ ${low} × 100 = ${up}%`)} – הרבה יותר מ-${down}%!`,
    hint: `💡 העלייה מחושבת מ-${low}, לא מ-100`
  };
}

const GEN: Record<PracticeKind, (rng: Rng, level: PracticeLevel) => PracticeQuestion> = {
  'percent-of': genPercentOf,
  'what-percent': genWhatPercent,
  discount: genDiscount,
  change: genChange,
  return: genReturn,
  compare: genCompare,
  updown: genUpdown,
  recover: genRecover
};

export function makeQuestion(level: PracticeLevel, rng: Rng = Math.random, kind?: PracticeKind): PracticeQuestion {
  const k = kind ?? pick(rng, KINDS[level]);
  return GEN[k](rng, level);
}

/** RNG עם זרע – לבדיקות */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- סטטיסטיקות על הפרופיל
export interface PracticeStats {
  answered: number;
  correct: number;
  bestStreak: number;
  hardCorrect: number;
  day?: string;
  dayCorrect?: number;
  dayXp?: number;
  dayGoal?: boolean;
}

export const EMPTY_STATS: PracticeStats = { answered: 0, correct: 0, bestStreak: 0, hardCorrect: 0 };

/** מעדכן סטטיסטיקות אחרי תשובה ומחזיר כמה XP להעניק (כולל תקרה יומית ובונוסים) */
export function recordAnswer(
  s: PracticeStats | undefined,
  ok: boolean,
  level: PracticeLevel,
  streak: number,
  today: string
): { stats: PracticeStats; xp: number; streakBonus: boolean; goalReached: boolean } {
  const prev = { ...EMPTY_STATS, ...(s ?? {}) };
  const sameDay = prev.day === today;
  const st: PracticeStats = {
    ...prev,
    day: today,
    dayCorrect: sameDay ? prev.dayCorrect ?? 0 : 0,
    dayXp: sameDay ? prev.dayXp ?? 0 : 0,
    dayGoal: sameDay ? prev.dayGoal ?? false : false
  };
  st.answered += 1;
  if (!ok) return { stats: st, xp: 0, streakBonus: false, goalReached: false };
  st.correct += 1;
  st.dayCorrect = (st.dayCorrect ?? 0) + 1;
  if (level === 3) st.hardCorrect += 1;
  st.bestStreak = Math.max(st.bestStreak, streak);
  const streakBonus = streak > 0 && streak % 5 === 0;
  let want = PRACTICE_XP.perCorrect[level] + (streakBonus ? PRACTICE_XP.streakBonus : 0);
  want = Math.max(0, Math.min(want, PRACTICE_XP.dailyCap - (st.dayXp ?? 0)));
  st.dayXp = (st.dayXp ?? 0) + want;
  let goalReached = false;
  let xp = want;
  if (!st.dayGoal && (st.dayCorrect ?? 0) >= PRACTICE_XP.dailyGoal) {
    st.dayGoal = true;
    goalReached = true;
    xp += PRACTICE_XP.dailyGoalBonus;
  }
  return { stats: st, xp, streakBonus, goalReached };
}
