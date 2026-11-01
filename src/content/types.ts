// טיפוסים של תוכן לימודי (נכתב ידנית בעברית).
// כל טקסט יכול להכיל הפניה למונח מהמילון בתחביר: [[termId|טקסט להצגה]]  או  [[termId]]
// האפליקציה הופכת את זה לקישור שלחיצה עליו פותחת הסבר.

/** פרופיל חברה מותאם לילדים ולמבוגרים */
export interface CompanyProfile {
  id: string; // תואם ל-id ב-universe.json
  /** משפט אחד קליט: "החברה שמייצרת את האייפון" */
  tagline: string;
  /** הסבר לילד בן 7-10: 2-4 משפטים פשוטים */
  kid: string;
  /** הסבר למבוגר מתחיל: מודל עסקי, מקורות הכנסה, מיצוב, 3-6 משפטים */
  adult: string;
  /** איך החברה מרוויחה כסף – רשימת מקורות הכנסה עיקריים */
  howMakesMoney: string[];
  /** מוצרים/מותגים מוכרים */
  products: string[];
  /** עובדות מעניינות לילדים (2-4) */
  funFacts: string[];
  /** מה יכול להזיק לחברה (סיכונים) – בשפה פשוטה (2-3) */
  risks: string[];
  /** מה יכול לעזור לחברה לגדול (2-3) */
  opportunities: string[];
  /** מתחרים: ids מתוך universe.json אם קיימים, אחרת שמות בעברית */
  competitors: string[];
  founded?: number;
  headquarters?: string; // בעברית, למשל "קופרטינו, קליפורניה, ארה״ב"
  /** קשר לישראל אם יש (מרכזי פיתוח, רכישות של חברות ישראליות וכו׳) */
  israelConnection?: string;
}

/** מונח במילון המושגים */
export interface GlossaryTerm {
  id: string;
  term: string; // שם המונח בעברית
  en?: string; // שם באנגלית
  /** הסבר לילדים – משפט או שניים, עם דימוי מעולם הילדים */
  kid: string;
  /** הסבר מלא למבוגרים */
  adult: string;
  /** דוגמה מספרית או סיפורית */
  example?: string;
  /** מונחים קשורים (ids) */
  related?: string[];
  category: 'basics' | 'orders' | 'charts' | 'reports' | 'bonds' | 'options' | 'macro' | 'strategy' | 'funds';
}

export interface LessonSlide {
  title: string;
  emoji?: string;
  /** טקסט לילדים (פשוט). אפשר להשתמש ב-[[termId]] */
  body: string;
  /** הרחבה למבוגרים (אופציונלי) */
  adult?: string;
}

export interface QuizQuestion {
  q: string;
  options: string[];
  /** אינדקס התשובה הנכונה */
  answer: number;
  /** הסבר שמוצג אחרי תשובה */
  explain: string;
}

export interface Lesson {
  id: string;
  title: string;
  emoji: string;
  /** 1 = מתחילים (גיל 7+), 2 = מתקדמים (גיל 10+), 3 = מומחים (גיל 13+/מבוגרים) */
  level: 1 | 2 | 3;
  /** משך משוער בדקות */
  minutes: number;
  summary: string;
  slides: LessonSlide[];
  quiz: QuizQuestion[];
  /** פיצ׳ר במשחק שהשיעור "פותח" (אופציונלי) */
  unlocks?: 'limit' | 'stopLoss' | 'takeProfit' | 'bonds' | 'options' | 'candles' | 'fundamentals';
}

/** אירוע היסטורי אמיתי בשוק */
export interface MarketEvent {
  id: string;
  /** YYYY-MM-DD – התאריך שבו האירוע קרה/נודע (חייב להיות מדויק) */
  date: string;
  title: string;
  emoji: string;
  category: 'pandemic' | 'rates' | 'tech' | 'war' | 'earnings' | 'politics' | 'energy' | 'company' | 'crisis' | 'market';
  /** מניות/קרנות מושפעות (ids מתוך universe.json) */
  tickers: string[];
  /** כיוון ההשפעה הצפוי על המניות שהוזכרו: up / down / mixed */
  impact: 'up' | 'down' | 'mixed';
  /** הסבר לילדים: מה קרה ולמה זה השפיע על השוק */
  kid: string;
  /** הסבר למבוגרים */
  adult: string;
  /** השיעור/המסקנה למשקיע */
  lesson: string;
  /** שאלה למשחק "מה יקרה אחר כך?" (אופציונלי) */
  predictQuestion?: string;
}
