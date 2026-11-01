import raw from '../content/universe.json';
import type { Currency } from './market';

export interface Instrument {
  id: string;
  symbol: string;
  market: 'US' | 'IL';
  type: 'stock' | 'etf' | 'fund';
  currency: Currency;
  nameHe: string;
  nameEn: string;
  sector: string;
  emoji: string;
  optionable: boolean;
  israeli?: boolean;
  benchmark?: boolean;
  indexScale?: number;
}

export interface Sector {
  nameHe: string;
  emoji: string;
}

export const INSTRUMENTS: Instrument[] = (raw.instruments as Instrument[]).map((i) => ({ ...i }));
export const SECTORS: Record<string, Sector> = raw.sectors;
const byId = new Map(INSTRUMENTS.map((i) => [i.id, i]));

export function inst(id: string): Instrument | undefined {
  return byId.get(id);
}

export function instName(id: string): string {
  return byId.get(id)?.nameHe ?? id;
}

export function instCurrency(id: string): Currency {
  return byId.get(id)?.currency ?? 'USD';
}

export function sectorOf(id: string): Sector | undefined {
  const i = byId.get(id);
  return i ? SECTORS[i.sector] : undefined;
}

export function peers(id: string): Instrument[] {
  const i = byId.get(id);
  if (!i) return [];
  return INSTRUMENTS.filter((x) => x.sector === i.sector && x.id !== id);
}

export const US_BENCHMARK = 'SPY';
export const IL_BENCHMARK = 'TA125';
