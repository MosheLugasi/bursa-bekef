import type { Profile } from '@/state/types';

export type Feature = 'limit' | 'stopLoss' | 'takeProfit' | 'bonds' | 'options' | 'candles' | 'fundamentals';

export const FEATURE_INFO: Record<Feature, { name: string; emoji: string; lesson: string }> = {
  limit: { name: 'פקודות לימיט', emoji: '🎯', lesson: 'order-types' },
  stopLoss: { name: 'סטופ לוס', emoji: '🛡️', lesson: 'stop-loss-take-profit' },
  takeProfit: { name: 'טייק פרופיט', emoji: '💰', lesson: 'stop-loss-take-profit' },
  bonds: { name: 'אג״ח', emoji: '📜', lesson: 'bonds-basics' },
  options: { name: 'אופציות', emoji: '🎟️', lesson: 'options-1' },
  candles: { name: 'גרף נרות', emoji: '🕯️', lesson: 'reading-charts' },
  fundamentals: { name: 'ניתוח דוחות', emoji: '📊', lesson: 'reading-reports' }
};

/**
 * ילדים פותחים יכולות דרך שיעורים באקדמיה (מנגנון משחקי של "ללמוד כדי לפתוח").
 * נוער מקבלים הכל חוץ מאופציות. מבוגרים מקבלים הכל (עם הדרכה בשימוש הראשון).
 */
export function hasFeature(p: Profile | undefined, f: Feature): boolean {
  if (!p) return false;
  if (p.unlockAll || p.ageGroup === 'adult') return true;
  if (p.ageGroup === 'teen' && f !== 'options') return true;
  return !!p.lessons[FEATURE_INFO[f].lesson];
}
