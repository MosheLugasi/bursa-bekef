import type { Portfolio } from '@/engine/types';
import type { ISODate } from '@/engine/dates';

export type AgeGroup = 'kid' | 'teen' | 'adult';

export interface Profile {
  id: string;
  name: string;
  avatar: string; // אימוג׳י
  color: string;
  ageGroup: AgeGroup;
  /** גיבוב של קוד PIN (אופציונלי) */
  pinHash?: string;
  xp: number;
  achievements: Record<string, string>; // id -> תאריך פתיחה
  lessons: Record<string, { score: number; total: number; at: string }>;
  seenCoach: Record<string, boolean>;
  readCompanies: string[];
  readTerms: string[];
  streak: { last: ISODate; count: number; best: number };
  quiz: { lastDate: ISODate; answered: number; correct: number; lastResult?: boolean };
  predictions: { played: number; correct: number; seen: string[] };
  watchlist: string[];
  unlockAll?: boolean;
  daily?: { date: string; trades: number };
  activePortfolioId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  familyName: string;
  adminPinHash?: string;
  defaultStartCash: number;
  defaultCurrency: 'ILS' | 'USD';
  feeRate: number;
  minFee: number;
  cloud?: { url: string; anonKey: string };
  updatedAt: string;
}

export interface GameState {
  profiles: Record<string, Profile>;
  portfolios: Record<string, Portfolio>;
  settings: AppSettings;
  /** מחיקות (לצורך סנכרון ענן) */
  deleted: Record<string, string>;
}
