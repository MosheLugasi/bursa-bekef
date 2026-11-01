import { COMPANIES_US } from './companies-us';
import { COMPANIES_IL } from './companies-il';
import { GLOSSARY } from './glossary';
import { LESSONS } from './lessons';
import { QUIZ_BANK } from './quizbank';
import { EVENTS } from './events';
import type { CompanyProfile, GlossaryTerm, Lesson, MarketEvent } from './types';

export const COMPANIES: Record<string, CompanyProfile> = { ...COMPANIES_US, ...COMPANIES_IL };
export const TERMS: Record<string, GlossaryTerm> = Object.fromEntries(GLOSSARY.map((t) => [t.id, t]));
export { GLOSSARY, LESSONS, QUIZ_BANK, EVENTS };

export const LESSON_BY_ID: Record<string, Lesson> = Object.fromEntries(LESSONS.map((l) => [l.id, l]));

export const TERM_CATEGORIES: Record<GlossaryTerm['category'], string> = {
  basics: 'יסודות',
  funds: 'מדדים וקרנות',
  orders: 'פקודות מסחר',
  charts: 'גרפים',
  reports: 'דוחות וניתוח חברות',
  bonds: 'אג״ח',
  options: 'אופציות',
  macro: 'כלכלה וריבית',
  strategy: 'אסטרטגיה ופסיכולוגיה'
};

/** אירועים היסטוריים עד תאריך (כולל), מהחדש לישן */
export function eventsUntil(date: string, ticker?: string): MarketEvent[] {
  return EVENTS.filter((e) => e.date <= date && (!ticker || e.tickers.includes(ticker))).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function eventsBetween(fromExcl: string, toIncl: string): MarketEvent[] {
  return EVENTS.filter((e) => e.date > fromExcl && e.date <= toIncl).sort((a, b) => (a.date < b.date ? -1 : 1));
}
