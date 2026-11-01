import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useUI } from '@/state/ui';
import { useCurrentProfile } from '@/state/store';
import { TERMS } from '@/content';
import { FEATURE_INFO, type Feature } from '@/game/features';
import { LESSON_BY_ID } from '@/content';
import { COACH } from '@/game/coach';
import { clsx, fmtPct, upDown } from './format';

// ---------------- טקסט עשיר עם קישורי מילון
const TERM_RE = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]|\*\*([^*]+)\*\*/g;

export function RichText({ text, className, plain }: { text: string; className?: string; plain?: boolean }) {
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  TERM_RE.lastIndex = 0;
  while ((m = TERM_RE.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[3]) parts.push(<strong key={k++}>{m[3]}</strong>);
    else if (plain) parts.push(m[2] ?? TERMS[m[1]]?.term ?? m[1]);
    else parts.push(<Term key={k++} id={m[1]}>{m[2] ?? TERMS[m[1]]?.term ?? m[1]}</Term>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className={clsx('whitespace-pre-line', className)}>{parts}</span>;
}

export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const open = useUI((s) => s.openTerm);
  const known = !!TERMS[id];
  if (!known) return <>{children}</>;
  return (
    <button
      type="button"
      className="term"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        open(id);
      }}
    >
      {children ?? TERMS[id].term}
    </button>
  );
}

// ---------------- מספרים
export function Change({ value, className, digits = 1, big }: { value: number; className?: string; digits?: number; big?: boolean }) {
  // ערך שמתעגל לאפס מוצג כ"ללא שינוי" (כדי לא להציג ▼ 0.0%)
  const d = Math.abs(value * 100) < 0.5 * Math.pow(10, -digits) ? 'flat' : upDown(value);
  return (
    <span
      className={clsx(
        'num font-semibold rounded-md px-1.5 py-0.5',
        big ? 'text-base' : 'text-sm',
        d === 'up' && 'text-up bg-up-bg',
        d === 'down' && 'text-down bg-down-bg',
        d === 'flat' && 'text-slate-500 bg-slate-100',
        className
      )}
    >
      {d === 'up' ? '▲ ' : d === 'down' ? '▼ ' : ''}
      {fmtPct(value, digits, false).replace('-', '')}
    </span>
  );
}

export function PnlText({ value, children }: { value: number; children: ReactNode }) {
  const d = upDown(value);
  return <span className={clsx('num font-semibold', d === 'up' && 'text-up', d === 'down' && 'text-down', d === 'flat' && 'text-slate-500')}>{children}</span>;
}

// ---------------- גרף קטן
export function Sparkline({ values, width = 80, height = 28, className }: { values: number[]; width?: number; height?: number; className?: string }) {
  if (values.length < 2) return <svg width={width} height={height} className={className} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (width - 2) + 1).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`);
  const up = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} className={className} aria-hidden="true" style={{ direction: 'ltr' }}>
      <polyline points={pts.join(' ')} fill="none" stroke={up ? '#0ca30c' : '#d03b3b'} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ---------------- מודאלים
export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 animate-fadein" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={clsx('w-full bg-white rounded-t-3xl sm:rounded-3xl shadow-xl max-h-[92vh] overflow-y-auto animate-slideup safe-bottom', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white/95 backdrop-blur z-10 flex items-center justify-between px-5 pt-4 pb-2">
          <div className="text-lg font-bold">{title}</div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-lg" aria-label="סגירה">
            ✕
          </button>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>
  );
}

// ---------------- שונות
export function ProgressBar({ value, className, color = 'bg-brand-600' }: { value: number; className?: string; color?: string }) {
  return (
    <div className={clsx('h-2.5 rounded-full bg-slate-100 overflow-hidden', className)}>
      <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={clsx('flex gap-1 p-1 rounded-xl bg-slate-100 overflow-x-auto no-scrollbar', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={clsx('flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition', value === o.value ? 'bg-white shadow text-brand-700' : 'text-slate-600 hover:text-slate-900')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 1e9, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, Math.round(v))));
  return (
    <div className="flex items-center gap-2" dir="ltr">
      <button type="button" className="w-11 h-11 rounded-xl bg-slate-100 text-2xl font-bold hover:bg-slate-200" onClick={() => set(value - step)} aria-label="פחות">
        −
      </button>
      <input
        className="input text-center text-xl font-bold num w-28"
        inputMode="numeric"
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => set(Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
      />
      <button type="button" className="w-11 h-11 rounded-xl bg-slate-100 text-2xl font-bold hover:bg-slate-200" onClick={() => set(value + step)} aria-label="יותר">
        +
      </button>
    </div>
  );
}

export function SectionTitle({ children, help, action }: { children: ReactNode; help?: string; action?: ReactNode }) {
  const openCoach = useUI((s) => s.openCoach);
  return (
    <div className="flex items-center justify-between gap-2 mb-2 mt-1">
      <h2 className="text-lg font-bold flex items-center gap-2">
        {children}
        {help && COACH[help] && (
          <button type="button" onClick={() => openCoach(help)} className="w-6 h-6 rounded-full bg-brand-50 text-brand-700 text-xs font-bold hover:bg-brand-100" aria-label="עזרה">
            ?
          </button>
        )}
      </h2>
      {action}
    </div>
  );
}

export function HelpButton({ coachKey }: { coachKey: string }) {
  const openCoach = useUI((s) => s.openCoach);
  return (
    <button type="button" onClick={() => openCoach(coachKey)} className="w-9 h-9 rounded-full bg-white/80 border border-slate-200 text-brand-700 font-bold shadow-sm hover:bg-brand-50" aria-label="הסבר על המסך">
      ❓
    </button>
  );
}

export function Locked({ feature }: { feature: Feature }) {
  const info = FEATURE_INFO[feature];
  const lesson = LESSON_BY_ID[info.lesson];
  return (
    <div className="rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/60 p-4 text-center">
      <div className="text-3xl mb-1">🔒{info.emoji}</div>
      <div className="font-bold">{info.name} עדיין נעול</div>
      <p className="text-sm text-slate-600 mt-1">סיימו את השיעור {lesson ? `"${lesson.title}"` : ''} באקדמיה כדי לפתוח את היכולת הזו.</p>
      <Link to={`/learn/${info.lesson}`} className="btn-primary mt-3">
        🎓 לשיעור
      </Link>
    </div>
  );
}

export function Empty({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="text-5xl mb-2">{emoji}</div>
      <div className="font-bold text-lg">{title}</div>
      {children && <div className="text-slate-600 mt-1">{children}</div>}
    </div>
  );
}

export function Stat({ label, children, sub }: { label: ReactNode; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-xs text-slate-500 mb-0.5">{label}</div>
      <div className="font-bold text-lg leading-tight">{children}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

/** מציג הדרכה בפעם הראשונה שמגיעים למסך */
export function useCoachOnce(key: string, enabled = true) {
  const profile = useCurrentProfile();
  const openCoach = useUI((s) => s.openCoach);
  const current = useUI((s) => s.coach);
  const [fired, setFired] = useState(false);
  useEffect(() => {
    if (!enabled || fired || !profile || current) return;
    if (!profile.seenCoach[key] && COACH[key]) {
      setFired(true);
      openCoach(key);
    }
  }, [enabled, fired, profile, key, openCoach, current]);
}
