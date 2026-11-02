// טקסט "מתוארך": {{YYYY-MM-DD|טקסט}} מוצג רק כשתאריך המשחק הגיע לתאריך הזה.
// {{<YYYY-MM-DD|טקסט}} – ההפך: מוצג רק במכונת הזמן לפני התאריך (למשל מטה ישן לפני מעבר).
// כך במכונת הזמן לא רואים בדפי החברות אירועים שעוד לא קרו ("ספוילרים" מהעתיד).
import type { CompanyProfile } from './types';

const MARK = /\{\{(<?)(\d{4}-\d{2}-\d{2})\|([^{}]*)\}\}/g;

/** מחזיר את הטקסט כפי שהיה ידוע בתאריך (date). בלי תאריך (שוק חי) – מציג הכל ומסיר את הסימונים. */
export function atDate(text: string, date?: string): string {
  if (!text || !text.includes('{{')) return text;
  const out = text.replace(MARK, (_m, before: string, d: string, t: string) => {
    const show = before ? !!date && date < d : !date || d <= date;
    return show ? t : '';
  });
  return out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .replace(/\([ \t]*\)/g, '')
    .replace(/^[ \t,;–-]+/, '')
    .trim();
}

export function hasDated(text: string): boolean {
  return /\{\{<?\d{4}-\d{2}-\d{2}\|/.test(text);
}

/** פרופיל חברה כפי שהיה נכון לתאריך: מסנן משפטים ופריטים מאוחרים יותר */
export function profileAt(p: CompanyProfile, date?: string): CompanyProfile {
  const s = (x: string) => atDate(x, date);
  const list = (xs: string[] | undefined) => (xs ?? []).map(s).filter((x) => x.length > 0);
  return {
    ...p,
    tagline: s(p.tagline),
    kid: s(p.kid),
    adult: s(p.adult),
    howMakesMoney: list(p.howMakesMoney),
    products: list(p.products),
    funFacts: list(p.funFacts),
    risks: list(p.risks),
    opportunities: list(p.opportunities),
    competitors: list(p.competitors),
    israelConnection: p.israelConnection ? s(p.israelConnection) || undefined : undefined,
    headquarters: p.headquarters ? s(p.headquarters) || undefined : undefined
  };
}
