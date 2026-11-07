// כלים משותפים לאיורי המסע של שורי
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { clsx } from '../format';

export function useTick(ms: number, max = 1e9) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const h = setInterval(() => setT((x) => (x + 1) % max), ms);
    return () => clearInterval(h);
  }, [ms, max]);
  return t;
}

export const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

export function Big({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span className={clsx('inline-block leading-none select-none', className)} style={style} aria-hidden="true">
      {children}
    </span>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('rounded-full bg-white/90 shadow px-3 py-1 text-sm font-bold text-slate-800', className)}>{children}</div>;
}

/** מספר מעוצב לילדים: שלם בלי נקודה, אחרת עד 2 ספרות אחרי הנקודה */
export function fmtNum(n: number): string {
  const r = Math.round(n * 100) / 100;
  return r.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
