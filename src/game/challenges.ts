import type { ISODate } from '@/engine/dates';

export interface Challenge {
  id: string;
  title: string;
  emoji: string;
  start: ISODate;
  end?: ISODate;
  kid: string;
  adult: string;
  difficulty: 1 | 2 | 3;
}

/** אתגרי "מכונת הזמן" – תקופות אמיתיות בהיסטוריה של השוק */
export const CHALLENGES: Challenge[] = [
  {
    id: 'free-2019',
    title: 'מסע חופשי בזמן',
    emoji: '🚀',
    start: '2019-01-02',
    kid: 'מתחילים בינואר 2019 ומתקדמים בקצב שלכם עד היום. כל מה שקרה בעולם – יקרה גם לכם!',
    adult: 'תיק מינואר 2019 ועד היום, בלי תאריך סיום. מתאים לתרגול השקעה ארוכת טווח דרך כל המחזורים: קורונה, ריבית, בינה מלאכותית ומלחמות.',
    difficulty: 1
  },
  {
    id: 'covid-2020',
    title: 'קורונה: הקריסה והחזרה',
    emoji: '🦠',
    start: '2020-01-02',
    end: '2020-12-31',
    kid: 'שנת 2020: וירוס חדש משנה את העולם. השוק נופל חזק... ואז קורה משהו מפתיע. תצליחו לשמור על קור רוח?',
    adult: 'השנה של הירידה המהירה בהיסטוריה וההתאוששות המהירה שאחריה. מבחן לניהול סיכונים, פיזור ופסיכולוגיה של משקיע.',
    difficulty: 2
  },
  {
    id: 'rates-2022',
    title: 'שנת הריבית',
    emoji: '🏦',
    start: '2022-01-03',
    end: '2022-12-30',
    kid: 'ב-2022 המחירים בעולם עלו מהר, והבנקים המרכזיים העלו ריבית. מניות טכנולוגיה סבלו – אבל לא כולם הפסידו.',
    adult: 'שנה שבה גם מניות וגם אג״ח ירדו יחד. מתאים להבנת הקשר בין אינפלציה, ריבית, מכפילים ומחירי אג״ח.',
    difficulty: 3
  },
  {
    id: 'ai-boom',
    title: 'מהפכת הבינה המלאכותית',
    emoji: '🤖',
    start: '2022-11-01',
    end: '2024-06-28',
    kid: 'בסוף 2022 יצא ChatGPT לעולם. האם תזהו מי החברות שירוויחו מהמהפכה?',
    adult: 'מהשקת ChatGPT ועד אמצע 2024: זיהוי מגמה טכנולוגית, הבנת ציפיות השוק והפתעות בדוחות.',
    difficulty: 2
  },
  {
    id: 'israel-2023',
    title: 'ישראל 2023–2024',
    emoji: '🇮🇱',
    start: '2023-01-02',
    end: '2024-12-31',
    kid: 'שנתיים סוערות לישראל ולבורסה בתל אביב. איך השוק מגיב לאירועים קשים, ואיך הוא מתאושש?',
    adult: 'הבורסה בת״א ושער השקל בתקופה של אי-ודאות פוליטית ומלחמה. מתאים להבנת סיכון מדינה, מט״ח וגיוון בינלאומי.',
    difficulty: 3
  },
  {
    id: 'year-2025',
    title: 'שנת 2025',
    emoji: '🌍',
    start: '2025-01-02',
    end: '2025-12-31',
    kid: 'מכסים, מלחמות, בינה מלאכותית ושיאים חדשים. שנה שלמה של הפתעות – מוכנים?',
    adult: 'שנה עם תנודתיות חדה סביב מכסי סחר וגאופוליטיקה. תרגול של ניהול סיכונים ופיזור בין ישראל לארה״ב.',
    difficulty: 2
  }
];

export function challenge(id?: string): Challenge | undefined {
  return CHALLENGES.find((c) => c.id === id);
}

export function leagueOf(p: { mode: string; challengeId?: string }): string {
  return p.mode === 'live' ? 'live' : `ch:${p.challengeId ?? 'free-2019'}`;
}

export function leagueName(league: string): string {
  if (league === 'live') return '📡 ליגת השוק החי';
  const c = challenge(league.slice(3));
  return c ? `${c.emoji} ${c.title}` : league;
}
