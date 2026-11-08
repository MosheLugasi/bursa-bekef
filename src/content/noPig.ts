// בלי חזירים במשחק. התוכן שלנו כבר נקי; כאן מסננים טקסטים שמגיעים ממקורות חיצוניים
// (חדשות יומיות ותקצירי חברות באנגלית). זהירות: ״להחזיר״ / ״מחזיר״ הם פעלים ולא חזירים.
const PIG = /🐷|🐖|🐽|🐗|🐾?חזרזיר|(?<![א-ת])[ובכלשה]?חזיר(?:ים|ה|ות|ון|ונים)?(?![א-ת])|\bpig(?:s|let|lets|gy)?\b|\bpork\b|\bhogs?\b|\bswine\b|peppa/i;

export const hasPig = (text: string): boolean => PIG.test(text);

/** מסיר אזכורים: קודם את המותג ״Peppa Pig״ מתוך רשימות, ואחר כך משפטים שלמים שעדיין מזכירים חזיר */
export function withoutPigs(text: string): string {
  const t = text.replace(/,?\s*(?:and\s+)?peppa pig\b/gi, '');
  if (!hasPig(t)) return t;
  return t
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !hasPig(s))
    .join(' ');
}
