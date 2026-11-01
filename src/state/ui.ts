import { create } from 'zustand';
import type { GameEvent } from '@/engine/types';
import type { ISODate } from '@/engine/dates';

export interface Toast {
  id: number;
  emoji: string;
  text: string;
  kind: 'info' | 'good' | 'bad' | 'xp';
}

export type Celebration =
  | { type: 'achievement'; id: string }
  | { type: 'level'; level: number }
  | { type: 'unlock'; feature: string };

export interface EventsSummary {
  portfolioId: string;
  from: ISODate;
  to: ISODate;
  events: GameEvent[];
  valueBefore: number;
  valueAfter: number;
}

interface UI {
  toasts: Toast[];
  celebrations: Celebration[];
  term?: string;
  coach?: string;
  summary?: EventsSummary;
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  celebrate: (c: Celebration) => void;
  popCelebration: () => void;
  openTerm: (id?: string) => void;
  openCoach: (key?: string) => void;
  showSummary: (s?: EventsSummary) => void;
}

let tid = 1;

export const useUI = create<UI>((set) => ({
  toasts: [],
  celebrations: [],
  toast: (t) => {
    const id = tid++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 3500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  celebrate: (c) => set((s) => ({ celebrations: [...s.celebrations, c] })),
  popCelebration: () => set((s) => ({ celebrations: s.celebrations.slice(1) })),
  openTerm: (id) => set({ term: id }),
  openCoach: (key) => set({ coach: key }),
  showSummary: (summary) => set({ summary })
}));
