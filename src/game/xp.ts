export interface Level {
  level: number;
  title: string;
  emoji: string;
  min: number;
}

export const LEVELS: Level[] = [
  { level: 1, title: 'טירון', emoji: '🐣', min: 0 },
  { level: 2, title: 'חוסך צעיר', emoji: '🐷', min: 100 },
  { level: 3, title: 'סוחר מתחיל', emoji: '🌱', min: 250 },
  { level: 4, title: 'חוקר חברות', emoji: '🔎', min: 500 },
  { level: 5, title: 'משקיע צעיר', emoji: '📈', min: 800 },
  { level: 6, title: 'מנהל תיק', emoji: '💼', min: 1200 },
  { level: 7, title: 'אנליסט', emoji: '🧮', min: 1700 },
  { level: 8, title: 'אסטרטג', emoji: '🧭', min: 2300 },
  { level: 9, title: 'מומחה שוק', emoji: '🎯', min: 3000 },
  { level: 10, title: 'שור מנוסה', emoji: '🐂', min: 4000 },
  { level: 11, title: 'כריש בורסה', emoji: '🦈', min: 5200 },
  { level: 12, title: 'אשף ההשקעות', emoji: '🧙', min: 6600 },
  { level: 13, title: 'מלך הדיבידנדים', emoji: '👑', min: 8200 },
  { level: 14, title: 'אגדת וול סטריט', emoji: '🌟', min: 10000 },
  { level: 15, title: 'וורן באפט הבא', emoji: '🏆', min: 12500 }
];

export function levelFor(xp: number) {
  let cur = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.min) cur = l;
  const next = LEVELS.find((l) => l.level === cur.level + 1);
  const progress = next ? (xp - cur.min) / (next.min - cur.min) : 1;
  return { ...cur, next, progress: Math.max(0, Math.min(1, progress)) };
}

/** כמה XP מקבלים על כל פעולה */
export const XP = {
  trade: 5,
  firstTradeOfDay: 10,
  lessonBase: 40,
  lessonPerCorrect: 10,
  dailyQuizCorrect: 15,
  dailyQuizTry: 3,
  dailyLogin: 10,
  readCompany: 3,
  readTerm: 1,
  predictPlay: 5,
  predictCorrect: 20
};
