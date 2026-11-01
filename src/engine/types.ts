import type { ISODate } from './dates';
import type { Currency } from './market';
import type { OptionRight } from './finance';

export interface StockPosition {
  kind: 'stock';
  id: string;
  instrumentId: string;
  qty: number;
  /** מחיר ממוצע למניה במטבע הנכס (כולל עמלות) */
  avgCost: number;
  /** עלות ממוצעת למניה במטבע התיק (כולל המרת מט״ח ועמלות) */
  avgCostBase: number;
  openedAt: ISODate;
  stopLoss?: number;
  takeProfit?: number;
}

export interface OptionPosition {
  kind: 'option';
  id: string;
  underlying: string;
  right: OptionRight;
  strike: number;
  expiry: ISODate;
  contracts: number;
  multiplier: number; // בדרך כלל 100
  /** פרמיה ממוצעת למניה במטבע הנכס */
  avgPremium: number;
  /** עלות כוללת ממוצעת לחוזה במטבע התיק */
  avgCostBase: number;
  openedAt: ISODate;
}

export interface BondPosition {
  kind: 'bond';
  id: string;
  productId: string;
  currency: Currency;
  curve: 'US' | 'IL';
  spread: number;
  couponRate: number;
  freq: 1 | 2;
  issueDate: ISODate;
  maturity: ISODate;
  units: number; // כל יחידה = ערך נקוב 1,000
  /** מחיר ל-100 ערך נקוב בקנייה */
  avgPrice: number;
  /** עלות ליחידה במטבע התיק */
  avgCostBase: number;
  openedAt: ISODate;
  lastCouponDate: ISODate;
}

export type Position = StockPosition | OptionPosition | BondPosition;

export interface LimitOrder {
  id: string;
  side: 'buy' | 'sell';
  instrumentId: string;
  qty: number;
  limitPrice: number;
  createdAt: ISODate;
  /** פקודה בתוקף עד (כולל). ריק = עד ביטול */
  expiresAt?: ISODate;
}

export type TxType =
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'split'
  | 'option_buy'
  | 'option_sell'
  | 'option_expire'
  | 'bond_buy'
  | 'bond_sell'
  | 'coupon'
  | 'bond_maturity'
  | 'order_cancel'
  | 'deposit';

export type TxReason = 'market' | 'limit' | 'stop_loss' | 'take_profit' | 'expiry' | 'maturity' | 'auto' | 'manual';

export interface Transaction {
  id: string;
  date: ISODate;
  type: TxType;
  instrumentId?: string;
  /** כמות (מניות / חוזים / יחידות אג״ח) */
  qty?: number;
  /** מחיר ליחידה במטבע הנכס */
  price?: number;
  currency?: Currency;
  fx?: number;
  fee?: number; // במטבע הנכס
  /** שינוי במזומן במטבע התיק (+ כניסה, - יציאה) */
  cash: number;
  /** רווח/הפסד ממומש במטבע התיק (במכירות) */
  pnl?: number;
  reason?: TxReason;
  note?: string;
  meta?: Record<string, string | number>;
}

export type GameMode = 'live' | 'history';

export interface PortfolioSettings {
  feeRate: number; // 0.001 = 0.1%
  minFee: number; // במטבע הנכס
  optionFeePerContract: number;
}

export interface Portfolio {
  id: string;
  name: string;
  ownerId: string;
  emoji: string;
  color: string;
  mode: GameMode;
  challengeId?: string;
  baseCurrency: Currency;
  startCash: number;
  cash: number;
  startDate: ISODate;
  /** במצב היסטורי – התאריך המדומה; במצב חי – יום המסחר האחרון שעובד */
  currentDate: ISODate;
  endDate?: ISODate;
  positions: Position[];
  orders: LimitOrder[];
  txs: Transaction[];
  /** [תאריך, שווי כולל במטבע התיק] */
  equity: [ISODate, number][];
  settings: PortfolioSettings;
  createdAt: string;
  updatedAt: string;
  finished?: boolean;
  archived?: boolean;
  /** מונים לסטטיסטיקות והישגים */
  counters: {
    dividends: number; // סכום במטבע התיק
    coupons: number;
    fees: number; // במטבע התיק
    stopLossHits: number;
    takeProfitHits: number;
    limitFills: number;
  };
}

/** אירוע שקרה בזמן קידום הזמן – להצגה בסיכום "מה קרה בזמן שלא הייתם" */
export interface GameEvent {
  date: ISODate;
  kind: 'fill' | 'stop_loss' | 'take_profit' | 'dividend' | 'coupon' | 'maturity' | 'expiry' | 'split' | 'cancel';
  text: string;
  amount?: number;
  instrumentId?: string;
  good?: boolean;
}

export const DEFAULT_SETTINGS: PortfolioSettings = {
  feeRate: 0.001,
  minFee: 1,
  optionFeePerContract: 1
};
