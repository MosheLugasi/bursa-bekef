import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Portfolio } from '@/engine/types';
import { DEFAULT_SETTINGS } from '@/engine/types';
import { uid } from '@/engine/trading';
import type { AgeGroup, AppSettings, GameState, Profile } from './types';
import type { ISODate } from '@/engine/dates';
import type { Currency } from '@/engine/market';

export function hashPin(pin: string): string {
  // גיבוב פשוט (FNV-1a) – מספיק כדי שקוד ה-PIN לא יישמר כטקסט גלוי. זה משחק משפחתי, לא כספת.
  let h = 0x811c9dc5;
  const s = 'bursa-bekef:' + pin;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

const now = () => new Date().toISOString();

export const DEFAULT_APP_SETTINGS: AppSettings = {
  familyName: '',
  defaultStartCash: 100_000,
  defaultCurrency: 'ILS',
  feeRate: DEFAULT_SETTINGS.feeRate,
  minFee: DEFAULT_SETTINGS.minFee,
  updatedAt: ''
};

export interface NewProfile {
  name: string;
  avatar: string;
  color: string;
  ageGroup: AgeGroup;
  pin?: string;
}

export interface NewPortfolio {
  ownerId: string;
  name: string;
  emoji: string;
  color: string;
  mode: 'live' | 'history';
  challengeId?: string;
  startDate: ISODate;
  endDate?: ISODate;
  baseCurrency: Currency;
  startCash: number;
  fees: boolean;
}

interface Actions {
  setup: (familyName: string, adminPin?: string) => void;
  addProfile: (p: NewProfile) => string;
  updateProfile: (id: string, fn: (p: Profile) => Profile) => void;
  deleteProfile: (id: string) => void;
  addPortfolio: (p: NewPortfolio) => string;
  setPortfolio: (p: Portfolio) => void;
  deletePortfolio: (id: string) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  replaceAll: (s: GameState) => void;
  resetAll: () => void;
}

export type Store = GameState & Actions;

const empty: GameState = { profiles: {}, portfolios: {}, settings: { ...DEFAULT_APP_SETTINGS }, deleted: {} };

export const useGame = create<Store>()(
  persist(
    (set, get) => ({
      ...empty,
      setup: (familyName, adminPin) =>
        set((s) => ({ settings: { ...s.settings, familyName, adminPinHash: adminPin ? hashPin(adminPin) : undefined, updatedAt: now() } })),
      addProfile: (np) => {
        const id = uid('u_');
        const profile: Profile = {
          id,
          name: np.name.trim(),
          avatar: np.avatar,
          color: np.color,
          ageGroup: np.ageGroup,
          pinHash: np.pin ? hashPin(np.pin) : undefined,
          xp: 0,
          achievements: {},
          lessons: {},
          seenCoach: {},
          readCompanies: [],
          readTerms: [],
          streak: { last: '', count: 0, best: 0 },
          quiz: { lastDate: '', answered: 0, correct: 0 },
          predictions: { played: 0, correct: 0, seen: [] },
          watchlist: [],
          createdAt: now(),
          updatedAt: now()
        };
        set((s) => ({ profiles: { ...s.profiles, [id]: profile } }));
        return id;
      },
      updateProfile: (id, fn) =>
        set((s) => {
          const p = s.profiles[id];
          if (!p) return {};
          return { profiles: { ...s.profiles, [id]: { ...fn(p), updatedAt: now() } } };
        }),
      deleteProfile: (id) =>
        set((s) => {
          const profiles = { ...s.profiles };
          delete profiles[id];
          const portfolios: Record<string, Portfolio> = {};
          const deleted = { ...s.deleted, ['profile:' + id]: now() };
          for (const [k, v] of Object.entries(s.portfolios)) {
            if (v.ownerId === id) deleted['portfolio:' + k] = now();
            else portfolios[k] = v;
          }
          return { profiles, portfolios, deleted };
        }),
      addPortfolio: (np) => {
        const id = uid('pf_');
        const settings = get().settings;
        const p: Portfolio = {
          id,
          name: np.name.trim() || 'התיק שלי',
          ownerId: np.ownerId,
          emoji: np.emoji,
          color: np.color,
          mode: np.mode,
          challengeId: np.challengeId,
          baseCurrency: np.baseCurrency,
          startCash: np.startCash,
          cash: np.startCash,
          startDate: np.startDate,
          currentDate: np.startDate,
          endDate: np.endDate,
          positions: [],
          orders: [],
          txs: [{ id: uid('tx_'), date: np.startDate, type: 'deposit', cash: np.startCash, note: 'כסף התחלתי' }],
          equity: [[np.startDate, np.startCash]],
          settings: np.fees
            ? { feeRate: settings.feeRate, minFee: settings.minFee, optionFeePerContract: DEFAULT_SETTINGS.optionFeePerContract }
            : { feeRate: 0, minFee: 0, optionFeePerContract: 0 },
          createdAt: now(),
          updatedAt: now(),
          counters: { dividends: 0, coupons: 0, fees: 0, stopLossHits: 0, takeProfitHits: 0, limitFills: 0 }
        };
        set((s) => ({
          portfolios: { ...s.portfolios, [id]: p },
          profiles: s.profiles[np.ownerId]
            ? { ...s.profiles, [np.ownerId]: { ...s.profiles[np.ownerId], activePortfolioId: id, updatedAt: now() } }
            : s.profiles
        }));
        return id;
      },
      setPortfolio: (p) => set((s) => ({ portfolios: { ...s.portfolios, [p.id]: { ...p, updatedAt: now() } } })),
      deletePortfolio: (id) =>
        set((s) => {
          const portfolios = { ...s.portfolios };
          delete portfolios[id];
          return { portfolios, deleted: { ...s.deleted, ['portfolio:' + id]: now() } };
        }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch, updatedAt: now() } })),
      replaceAll: (st) => set(() => ({ profiles: st.profiles || {}, portfolios: st.portfolios || {}, settings: { ...DEFAULT_APP_SETTINGS, ...st.settings }, deleted: st.deleted || {} })),
      resetAll: () => set(() => ({ ...empty, settings: { ...DEFAULT_APP_SETTINGS } }))
    }),
    {
      name: 'bursa-bekef-game',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ profiles: s.profiles, portfolios: s.portfolios, settings: s.settings, deleted: s.deleted })
    }
  )
);

// ---------------- סשן (לא מסונכרן – לכל מכשיר בנפרד)
interface Session {
  profileId?: string;
  adminUnlocked: boolean;
  login: (id: string) => void;
  logout: () => void;
  setAdmin: (v: boolean) => void;
}

export const useSession = create<Session>()(
  persist(
    (set) => ({
      profileId: undefined,
      adminUnlocked: false,
      login: (id) => set({ profileId: id }),
      logout: () => set({ profileId: undefined, adminUnlocked: false }),
      setAdmin: (v) => set({ adminUnlocked: v })
    }),
    { name: 'bursa-bekef-session', partialize: (s) => ({ profileId: s.profileId }) }
  )
);

export function useCurrentProfile(): Profile | undefined {
  const id = useSession((s) => s.profileId);
  return useGame((s) => (id ? s.profiles[id] : undefined));
}

export function useActivePortfolio(): Portfolio | undefined {
  const profile = useCurrentProfile();
  return useGame((s) => {
    if (!profile) return undefined;
    const own = Object.values(s.portfolios).filter((p) => p.ownerId === profile.id && !p.archived);
    return (profile.activePortfolioId && s.portfolios[profile.activePortfolioId]?.ownerId === profile.id ? s.portfolios[profile.activePortfolioId] : undefined) ?? own[0];
  });
}
