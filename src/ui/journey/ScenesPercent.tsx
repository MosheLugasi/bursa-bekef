// איורים אינטראקטיביים לעולם האחוזים והתשואה במסע של שורי
import { useEffect, useState, type ReactNode } from 'react';
import type { SceneId } from '@/game/journey';
import { fireConfetti } from '@/game/actions';
import { clsx } from '../format';
import { Big, Label, delay, fmtNum, useTick } from './kit';

/** ביטוי חשבוני שנשאר משמאל לימין בתוך עברית */
function Eq({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span dir="ltr" className={clsx('inline-block font-bold whitespace-nowrap', className)} style={{ unicodeBidi: 'isolate' }}>
      {children}
    </span>
  );
}

function Chips<T extends number>({ values, value, onChange, fmt, label }: { values: readonly T[]; value: T; onChange: (v: T) => void; fmt: (v: T) => string; label: string }) {
  return (
    <div className="flex flex-wrap justify-center gap-1" role="group" aria-label={label}>
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={v === value}
          className={clsx('rounded-full px-2.5 py-1 text-xs font-bold border transition', v === value ? 'bg-brand-600 text-white border-brand-600' : 'bg-white/90 border-slate-200 text-slate-700')}
        >
          <span className="num">{fmt(v)}</span>
        </button>
      ))}
    </div>
  );
}

// ---------- 100 משבצות
function Grid100({ count, onPick, color = 'bg-violet-500', size = 170 }: { count: number; onPick?: (n: number) => void; color?: string; size?: number }) {
  return (
    <div className="grid grid-cols-10 gap-[2px] shrink-0" style={{ width: size, height: size }} role="group" aria-label="100 משבצות">
      {Array.from({ length: 100 }, (_, i) => (
        <button
          key={i}
          type="button"
          tabIndex={onPick ? 0 : -1}
          aria-label={`${i + 1}%`}
          disabled={!onPick}
          onClick={() => onPick?.(count === i + 1 ? i : i + 1)}
          className={clsx('rounded-[3px] transition-colors duration-150', i < count ? color : 'bg-white/90', onPick && i >= count && 'hover:bg-violet-200')}
        />
      ))}
    </div>
  );
}

const NAMED: Record<number, string> = { 100: 'הכל! 🎉', 50: 'חצי!', 25: 'רבע!', 75: 'שלושה רבעים!', 10: 'עשירית', 0: 'כלום' };

function HundredGrid() {
  const [n, setN] = useState(30);
  return (
    <div className="h-full flex items-center justify-center gap-4 px-3">
      <Grid100 count={n} onPick={setN} />
      <div className="text-center w-28">
        <div className="text-xs font-bold text-slate-600">צבעתם</div>
        <div className="text-4xl font-extrabold text-violet-700 num">{n}%</div>
        <div className="text-xs text-slate-700">
          <span className="num">{n}</span> מתוך <span className="num">100</span>
        </div>
        <div className="h-5 text-sm font-bold text-violet-700">{NAMED[n] ?? ''}</div>
        <div className="flex gap-1 justify-center mt-1">
          <button type="button" className="w-9 h-9 rounded-full bg-white shadow font-extrabold text-lg" aria-label="פחות משבצת" onClick={() => setN(Math.max(0, n - 1))}>
            −
          </button>
          <button type="button" className="w-9 h-9 rounded-full bg-white shadow font-extrabold text-lg" aria-label="עוד משבצת" onClick={() => setN(Math.min(100, n + 1))}>
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function PercentPies() {
  const items = [
    { p: 100, label: 'הכל' },
    { p: 50, label: 'חצי' },
    { p: 25, label: 'רבע' },
    { p: 10, label: 'עשירית' }
  ];
  return (
    <div className="h-full grid grid-cols-4 items-center px-2 gap-1">
      {items.map((it, i) => (
        <div key={it.p} className="flex flex-col items-center gap-1.5 anim-grow" style={delay(0.15 + i * 0.25)}>
          <div className="w-16 h-16 rounded-full border-4 border-white shadow-md" style={{ background: `conic-gradient(#8b5cf6 0 ${it.p}%, #ffffff 0)` }} aria-hidden="true" />
          <div className="text-xl font-extrabold text-violet-700 num">{it.p}%</div>
          <Label className="!px-2 !py-0.5 !text-xs">{it.label}</Label>
        </div>
      ))}
    </div>
  );
}

const TARGETS = [25, 50, 10, 75, 5, 100];
function PercentChallenge() {
  const [idx, setIdx] = useState(0);
  const [n, setN] = useState(0);
  const target = TARGETS[idx];
  const ok = target !== undefined && n === target;
  useEffect(() => {
    if (!ok) return;
    const h = setTimeout(() => {
      setIdx((i) => i + 1);
      setN(0);
      if (idx === TARGETS.length - 1) fireConfetti(true);
    }, 900);
    return () => clearTimeout(h);
  }, [ok, idx]);
  if (target === undefined)
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2">
        <Big className="text-6xl anim-bob">🏆</Big>
        <div className="font-extrabold text-lg">עברתם את כל האתגרים!</div>
        <div className="text-2xl">{'⭐'.repeat(TARGETS.length)}</div>
        <button type="button" className="btn-soft" onClick={() => setIdx(0)}>
          🔄 עוד פעם
        </button>
      </div>
    );
  return (
    <div className="h-full flex items-center justify-center gap-4 px-3">
      <Grid100 count={n} onPick={setN} color={ok ? 'bg-emerald-500' : 'bg-violet-500'} />
      <div className="text-center w-28">
        <div className="text-xs font-bold text-slate-600">
          אתגר <span className="num">{`${idx + 1}/${TARGETS.length}`}</span>
        </div>
        <div className="text-sm font-bold mt-1">צבעו בדיוק</div>
        <div className="text-4xl font-extrabold text-rose-600 num">{target}%</div>
        <div className={clsx('mt-1 text-sm font-bold', ok ? 'text-emerald-700' : n > target ? 'text-rose-600' : 'text-slate-600')}>
          {ok ? '✅ בול!' : n > target ? 'יותר מדי 🙈' : <>צבעתם <span className="num">{n}%</span></>}
        </div>
        <div className="text-base mt-1" aria-hidden="true">
          {'⭐'.repeat(idx)}
          <span className="opacity-30">{'☆'.repeat(TARGETS.length - idx)}</span>
        </div>
      </div>
    </div>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-4 flex-1 rounded-full bg-white/90 shadow-inner overflow-hidden">
      <div className={clsx('h-full rounded-full transition-all duration-300', color)} style={{ width: `${value}%` }} />
    </div>
  );
}

function PercentEveryday() {
  const t = useTick(110, 1000);
  const battery = Math.min(100, (t * 2) % 140);
  const download = Math.min(100, (t * 3 + 30) % 130);
  return (
    <div className="h-full flex flex-col justify-center gap-3 px-5">
      <div className="flex items-center gap-2">
        <Big className="text-2xl w-8 text-center">🔋</Big>
        <Bar value={battery} color={battery === 100 ? 'bg-emerald-500' : 'bg-lime-400'} />
        <span className="w-12 text-left font-extrabold num">{battery}%</span>
      </div>
      <div className="flex items-center gap-2">
        <Big className="text-2xl w-8 text-center">⬇️</Big>
        <Bar value={download} color="bg-sky-500" />
        <span className="w-12 text-left font-extrabold num">{download}%</span>
      </div>
      <div className="flex items-center gap-2">
        <Big className="text-2xl w-8 text-center">📝</Big>
        <Bar value={90} color="bg-violet-500" />
        <span className="w-12 text-left font-extrabold num">90%</span>
      </div>
      <div className="text-center text-sm font-bold text-slate-700">
        מבחן: <span className="num">90</span> נקודות מתוך <span className="num">100</span> = <span className="num">90%</span> 🎉
      </div>
    </div>
  );
}

// ---------- כמה זה אחוז מסכום
const TEN_AMOUNTS = [100, 50, 200, 30, 70] as const;
function TenPercent() {
  const [a, setA] = useState<(typeof TEN_AMOUNTS)[number]>(100);
  const part = a / 10;
  return (
    <div className="h-full flex flex-col justify-center gap-2 px-4">
      <Chips values={TEN_AMOUNTS} value={a} onChange={setA} fmt={(v) => `${v} ₪`} label="בחירת סכום" />
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={`${a}-${i}`}
            className={clsx('rounded-xl py-1.5 text-center text-sm font-bold shadow anim-grow', i === 0 ? 'bg-amber-300 ring-2 ring-amber-500' : 'bg-white/90')}
            style={delay(i * 0.05)}
          >
            🪙 <span className="num">{fmtNum(part)}</span>
          </div>
        ))}
      </div>
      <div className="text-center font-bold">
        ערימה אחת מתוך 10 = <span className="num text-amber-700">10%</span>
      </div>
      <div className="text-center text-lg font-extrabold">
        <Eq>10% × {a} = {a} ÷ 10 = {fmtNum(part)} ₪</Eq>
      </div>
    </div>
  );
}

const HQ_AMOUNTS = [80, 40, 120, 200] as const;
function HalfQuarter() {
  const [a, setA] = useState<(typeof HQ_AMOUNTS)[number]>(80);
  const [p, setP] = useState<50 | 25>(50);
  const parts = p === 50 ? 2 : 1;
  return (
    <div className="h-full flex flex-col justify-center gap-2 px-4">
      <Chips values={HQ_AMOUNTS} value={a} onChange={setA} fmt={(v) => `${v} ₪`} label="בחירת סכום" />
      <div className="flex justify-center gap-2">
        {([50, 25] as const).map((x) => (
          <button key={x} type="button" onClick={() => setP(x)} className={clsx('rounded-full px-4 py-1 font-extrabold', p === x ? 'bg-emerald-600 text-white' : 'bg-white/90')}>
            <span className="num">{x}%</span> {x === 50 ? 'חצי' : 'רבע'}
          </button>
        ))}
      </div>
      <div className="flex justify-center gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={clsx('w-16 h-12 rounded-lg grid place-items-center text-2xl transition-all duration-300 border-2', i < parts ? 'bg-amber-700 border-amber-900 scale-105' : 'bg-amber-200/70 border-amber-300')}>
            🍫
          </div>
        ))}
      </div>
      <div className="text-center text-lg font-extrabold">
        {p === 50 ? (
          <Eq>50% = {a} ÷ 2 = {a / 2} ₪</Eq>
        ) : (
          <Eq>
            25% = {a} ÷ 2 ÷ 2 = {a / 4} ₪
          </Eq>
        )}
      </div>
    </div>
  );
}

const M_AMOUNTS = [20, 40, 80, 100, 200, 500] as const;
const M_PCTS = [1, 5, 10, 20, 25, 50, 100] as const;
function trickFor(p: number, a: number): string {
  switch (p) {
    case 1:
      return '1% = מחלקים ב-100';
    case 5:
      return `5% = חצי של 10% (10% זה ${fmtNum(a / 10)})`;
    case 10:
      return '10% = מחלקים ב-10';
    case 20:
      return `20% = פעמיים 10% (10% זה ${fmtNum(a / 10)})`;
    case 25:
      return '25% = חצי של חצי';
    case 50:
      return '50% = חצי';
    default:
      return '100% = הכל!';
  }
}
function PercentMachine() {
  const [a, setA] = useState<(typeof M_AMOUNTS)[number]>(200);
  const [p, setP] = useState<(typeof M_PCTS)[number]>(10);
  const res = (a * p) / 100;
  const coins = Math.min(12, Math.max(1, Math.round(res >= 12 ? 12 : res)));
  return (
    <div className="h-full flex flex-col justify-center gap-1.5 px-3">
      <Chips values={M_AMOUNTS} value={a} onChange={setA} fmt={(v) => `${v} ₪`} label="סכום" />
      <Chips values={M_PCTS} value={p} onChange={setP} fmt={(v) => `${v}%`} label="אחוז" />
      <div className="mx-auto mt-1 w-full max-w-xs rounded-2xl bg-slate-800 text-white px-3 py-2 shadow-lg">
        <div className="text-center text-lg font-extrabold">
          <Eq>
            {p}% × {a} ₪ = {fmtNum(res)} ₪
          </Eq>
        </div>
        <div className="text-center text-xs text-amber-200">💡 {trickFor(p, a)}</div>
      </div>
      <div className="flex justify-center flex-wrap gap-0.5 h-7" aria-hidden="true">
        {Array.from({ length: coins }, (_, i) => (
          <span key={`${a}-${p}-${i}`} className="text-xl anim-fly-in" style={delay(i * 0.06)}>
            🪙
          </span>
        ))}
        {res > 12 && <span className="text-sm font-bold self-center">ועוד…</span>}
      </div>
    </div>
  );
}

const FORMULA = [
  { p: 30, a: 200 },
  { p: 7, a: 300 },
  { p: 45, a: 400 },
  { p: 12, a: 500 }
];
function PercentFormula() {
  const [k, setK] = useState(0);
  const t = useTick(1300, 4);
  const { p, a } = FORMULA[k % FORMULA.length];
  const one = a / 100;
  return (
    <div className="h-full flex flex-col justify-center gap-2 px-4" key={k}>
      <div className="text-center text-xl font-extrabold">
        כמה זה <span className="num">{p}%</span> מ-<span className="num">{a} ₪</span>?
      </div>
      <div className={clsx('rounded-xl bg-white/90 px-3 py-2 shadow text-center transition-opacity duration-500', t >= 1 ? 'opacity-100' : 'opacity-0')}>
        <div className="text-xs font-bold text-slate-500">צעד 1: מחלקים ב-100 (זה 1%)</div>
        <Eq className="text-lg">
          {a} ÷ 100 = {fmtNum(one)}
        </Eq>
      </div>
      <div className={clsx('rounded-xl bg-white/90 px-3 py-2 shadow text-center transition-opacity duration-500', t >= 2 ? 'opacity-100' : 'opacity-0')}>
        <div className="text-xs font-bold text-slate-500">צעד 2: כופלים ב-{p}</div>
        <Eq className="text-lg text-emerald-700">
          {fmtNum(one)} × {p} = {fmtNum(one * p)} ₪
        </Eq>
      </div>
      <button type="button" className="btn-soft mx-auto !py-1" onClick={() => setK(k + 1)}>
        🔄 דוגמה אחרת
      </button>
    </div>
  );
}

// ---------- מבצעים
function SaleTag() {
  const t = useTick(1300, 4);
  return (
    <div className="h-full flex items-center justify-center gap-6 px-4">
      <div className="relative">
        <Big className="text-8xl anim-float">🧸</Big>
        <div className={clsx('absolute -top-2 -left-6 rotate-[-12deg] rounded-xl bg-rose-500 text-white font-extrabold px-2 py-1 shadow-lg transition-all duration-500', t >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-50')}>
          <span className="num">20%</span> הנחה!
        </div>
      </div>
      <div className="text-center space-y-1 w-32">
        <div className={clsx('text-2xl font-extrabold transition-all', t >= 2 ? 'line-through text-slate-400 text-lg' : 'text-slate-800')}>
          <span className="num">100 ₪</span>
        </div>
        <div className={clsx('text-3xl font-extrabold text-emerald-700 transition-all duration-500', t >= 2 ? 'opacity-100' : 'opacity-0')}>
          <span className="num">80 ₪</span>
        </div>
        <div className={clsx('rounded-full bg-white/90 shadow px-2 py-0.5 text-xs font-bold transition-opacity duration-500', t >= 3 ? 'opacity-100' : 'opacity-0')}>
          חסכתם <span className="num">20 ₪</span> 🎉
        </div>
      </div>
    </div>
  );
}

const SHOP = [
  { e: '🧸', name: 'דובי', price: 100, d: 20 },
  { e: '🎮', name: 'משחק', price: 200, d: 10 },
  { e: '⚽', name: 'כדור', price: 60, d: 50 },
  { e: '👟', name: 'נעליים', price: 300, d: 25 }
];
function ShopCart() {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const all = SHOP.every((_, i) => open[i]);
  return (
    <div className="h-full flex flex-col justify-center gap-1.5 px-3">
      <div className="grid grid-cols-2 gap-2">
        {SHOP.map((it, i) => {
          const save = (it.price * it.d) / 100;
          return (
            <button
              key={it.name}
              type="button"
              onClick={() => setOpen({ ...open, [i]: true })}
              className={clsx('relative rounded-2xl px-2 py-1.5 shadow text-right transition', open[i] ? 'bg-emerald-50 ring-2 ring-emerald-400' : 'bg-white/95 active:scale-95')}
            >
              <span className="absolute top-1 left-1 rounded-full bg-rose-500 text-white text-[11px] font-extrabold px-1.5 num">-{it.d}%</span>
              <div className="flex items-center gap-1.5">
                <span className="text-3xl">{it.e}</span>
                <div className="leading-tight">
                  <div className="text-xs font-bold">{it.name}</div>
                  <div className={clsx('text-sm font-extrabold num', open[i] && 'line-through text-slate-400')}>{it.price} ₪</div>
                </div>
              </div>
              {open[i] ? (
                <div className="text-[11px] font-bold mt-0.5 anim-grow">
                  חוסכים <span className="num">{save} ₪</span> · משלמים <span className="num text-emerald-700">{it.price - save} ₪</span>
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 mt-0.5">לחצו לגלות 👆</div>
              )}
            </button>
          );
        })}
      </div>
      <div className="text-center text-sm font-bold text-slate-700 h-5">{all ? '🛒 מעולה! גיליתם את כל המבצעים' : ''}</div>
    </div>
  );
}

const DEALS = [
  { e: '📚', item: 'ספר', price: 50, a: { pct: 20 }, b: { ils: 5 } },
  { e: '🎧', item: 'אוזניות', price: 200, a: { pct: 10 }, b: { ils: 30 } },
  { e: '🛹', item: 'סקייטבורד', price: 80, a: { pct: 25 }, b: { ils: 15 } }
];
function BetterDeal() {
  const [r, setR] = useState(0);
  const [pick, setPick] = useState<'a' | 'b' | null>(null);
  const d = DEALS[r % DEALS.length];
  const payA = d.price - (d.price * d.a.pct) / 100;
  const payB = d.price - d.b.ils;
  const best = payA < payB ? 'a' : 'b';
  const card = (k: 'a' | 'b', title: string, pay: number) => (
    <button
      type="button"
      disabled={pick !== null}
      onClick={() => {
        setPick(k);
        if (k === best) fireConfetti();
      }}
      className={clsx(
        'flex-1 rounded-2xl px-2 py-2 shadow text-center transition',
        pick === null ? 'bg-white/95 active:scale-95' : k === best ? 'bg-emerald-100 ring-2 ring-emerald-500' : 'bg-rose-50 opacity-80'
      )}
    >
      <div className="text-xs font-bold text-slate-500">{k === 'a' ? 'חנות א׳ 🏪' : 'חנות ב׳ 🏬'}</div>
      <div className="font-extrabold">{title}</div>
      {pick !== null && (
        <div className="text-sm font-bold mt-1 anim-grow">
          משלמים <span className="num">{pay} ₪</span> {k === best && '🏆'}
        </div>
      )}
    </button>
  );
  return (
    <div className="h-full flex flex-col justify-center gap-2 px-4">
      <div className="text-center">
        <span className="text-3xl align-middle">{d.e}</span> <span className="font-extrabold">{d.item}</span> במחיר <span className="num font-extrabold">{d.price} ₪</span>
      </div>
      <div className="flex gap-2">
        {card('a', `${d.a.pct}% הנחה`, payA)}
        {card('b', `${d.b.ils} ₪ הנחה`, payB)}
      </div>
      <div className="h-8 text-center text-sm font-bold">
        {pick === null ? 'איפה תשלמו פחות? 🤔' : pick === best ? '🎉 נכון! בחרתם את המבצע הזול יותר' : '🙈 כמעט! תסתכלו כמה משלמים בכל חנות'}
      </div>
      {pick !== null && (
        <button
          type="button"
          className="btn-soft mx-auto !py-1"
          onClick={() => {
            setR(r + 1);
            setPick(null);
          }}
        >
          מבצע הבא ←
        </button>
      )}
    </div>
  );
}

// ---------- למעלה ולמטה
function PercentChange() {
  const [v, setV] = useState(100);
  const [hist, setHist] = useState<number[]>([100]);
  const go = (pct: number) => {
    const nv = Math.round(v * (1 + pct / 100) * 100) / 100;
    setV(nv);
    setHist((h) => [...h, nv].slice(-5));
  };
  const h = Math.max(6, Math.min(100, (v / 200) * 100));
  return (
    <div className="h-full flex items-center justify-center gap-4 px-4">
      <div className="flex flex-col items-center">
        <div className="relative w-16 h-40 rounded-xl bg-white/70 shadow-inner overflow-hidden">
          <div className="absolute inset-x-0 border-t-2 border-dashed border-slate-500" style={{ bottom: '50%' }} />
          <div className={clsx('absolute inset-x-1 bottom-0 rounded-t-lg transition-all duration-500', v >= 100 ? 'bg-emerald-500' : 'bg-rose-500')} style={{ height: `${h}%` }} />
        </div>
        <div className="text-xs text-slate-600 mt-1">הקו = <span className="num">100 ₪</span></div>
      </div>
      <div className="flex flex-col items-center gap-2 w-44">
        <div className="text-3xl font-extrabold num">{fmtNum(v)} ₪</div>
        <div className="grid grid-cols-2 gap-1.5 w-full">
          {[10, -10, 50, -50].map((p) => (
            <button key={p} type="button" onClick={() => go(p)} className={clsx('rounded-xl py-1.5 font-extrabold text-white shadow active:scale-95', p > 0 ? 'bg-emerald-600' : 'bg-rose-600')}>
              <span className="num">{p > 0 ? `+${p}%` : `-${-p}%`}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="text-xs font-bold text-brand-700"
          onClick={() => {
            setV(100);
            setHist([100]);
          }}
        >
          🔄 חזרה ל-100
        </button>
        <div className="text-[11px] text-slate-600 text-center" dir="ltr" style={{ unicodeBidi: 'isolate' }}>
          {hist.map((x) => fmtNum(x)).join(' → ')}
        </div>
      </div>
    </div>
  );
}

function UpdownTrap() {
  const t = useTick(1500, 5);
  const steps = [
    { v: 100, e: '💰', note: 'מתחילים' },
    { v: 150, e: '📈', note: '+50%' },
    { v: 75, e: '😮', note: '-50%' }
  ];
  return (
    <div className="h-full flex flex-col justify-center gap-3 px-3">
      <div className="flex items-end justify-center gap-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-end gap-2">
            {i > 0 && <span className={clsx('text-2xl mb-6 transition-opacity', t >= i ? 'opacity-100' : 'opacity-0')}>⬅️</span>}
            <div className={clsx('flex flex-col items-center transition-all duration-500', t >= i ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3')}>
              <Big className="text-3xl">{s.e}</Big>
              <div
                className={clsx('w-16 rounded-t-lg mt-1', i === 0 ? 'bg-slate-400' : i === 1 ? 'bg-emerald-500' : 'bg-rose-500')}
                style={{ height: s.v * 0.55 }}
              />
              <div className="text-lg font-extrabold num">{s.v} ₪</div>
              <div className={clsx('text-xs font-bold num', i === 1 ? 'text-emerald-700' : i === 2 ? 'text-rose-700' : 'text-slate-500')}>{s.note}</div>
            </div>
          </div>
        ))}
      </div>
      <div className={clsx('mx-auto rounded-xl bg-white/90 shadow px-3 py-1 text-sm font-bold text-center transition-opacity duration-500', t >= 3 ? 'opacity-100' : 'opacity-0')}>
        לא חזרנו ל-100! כי <Eq>50% × 150 = 75</Eq>
      </div>
    </div>
  );
}

function Recover() {
  const [up, setUp] = useState(50);
  const v = 50 * (1 + up / 100);
  const done = up === 100;
  useEffect(() => {
    if (done) fireConfetti();
  }, [done]);
  return (
    <div className="h-full flex flex-col justify-center gap-2 px-5">
      <div className="flex items-end justify-center gap-6 h-28">
        <div className="text-center">
          <div className="w-14 bg-slate-400 rounded-t-lg mx-auto" style={{ height: 80 }} />
          <div className="text-xs font-bold mt-1">
            היה: <span className="num">100 ₪</span>
          </div>
        </div>
        <div className="text-center">
          <div className="w-14 bg-rose-500 rounded-t-lg mx-auto" style={{ height: 40 }} />
          <div className="text-xs font-bold mt-1">
            ירד ל: <span className="num">50 ₪</span>
          </div>
        </div>
        <div className="text-center">
          <div className={clsx('w-14 rounded-t-lg mx-auto transition-all duration-300', done ? 'bg-emerald-500' : v > 100 ? 'bg-amber-500' : 'bg-sky-500')} style={{ height: Math.min(110, v * 0.8) }} />
          <div className="text-xs font-bold mt-1">
            עכשיו: <span className="num">{fmtNum(v)} ₪</span>
          </div>
        </div>
      </div>
      <label className="text-center text-sm font-bold">
        עלייה של <span className="num text-sky-700">{up}%</span>
      </label>
      <input type="range" min={0} max={150} step={10} value={up} onChange={(e) => setUp(Number(e.target.value))} className="w-full accent-brand-600" aria-label="אחוז העלייה" />
      <div className={clsx('text-center text-sm font-bold', done ? 'text-emerald-700' : 'text-slate-700')}>
        {done ? '🎉 בדיוק! צריך עלייה של 100% כדי לחזור ל-100' : v < 100 ? 'עוד לא חזרנו ל-100… הזיזו עוד' : 'עברנו את ה-100 – חפשו בדיוק'}
      </div>
    </div>
  );
}

// ---------- מי הרוויח יותר
const NOA = { name: 'נועה', e: '👧', f: true, inv: 50, profit: 10 };
const YOAV = { name: 'יואב', e: '👦', f: false, inv: 200, profit: 20 };
function TwoInvestors() {
  const [pick, setPick] = useState<string | null>(null);
  const kid = (k: typeof NOA, win: boolean) => (
    <button
      type="button"
      disabled={pick !== null}
      onClick={() => {
        setPick(k.name);
        if (win) fireConfetti();
      }}
      className={clsx('flex-1 rounded-2xl bg-white/95 shadow px-2 py-2 text-center transition', pick === null && 'active:scale-95', pick !== null && win && 'ring-2 ring-amber-400')}
    >
      <div className="relative inline-block">
        <Big className="text-5xl">{k.e}</Big>
        {pick !== null && win && <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl anim-grow">👑</span>}
      </div>
      <div className="font-extrabold">{k.name}</div>
      <div className="text-xs">
        {k.f ? 'השקיעה' : 'השקיע'} <span className="num font-bold">{k.inv} ₪</span>
      </div>
      <div className="text-xs">
        {k.f ? 'הרוויחה' : 'הרוויח'} <span className="num font-bold text-emerald-700">{k.profit} ₪</span>
      </div>
      {pick !== null && (
        <div className={clsx('mt-1 text-lg font-extrabold num anim-grow', win ? 'text-amber-600' : 'text-slate-500')}>{(k.profit / k.inv) * 100}%</div>
      )}
    </button>
  );
  return (
    <div className="h-full flex flex-col justify-center gap-2 px-4">
      <div className="flex gap-3">
        {kid(NOA, true)}
        {kid(YOAV, false)}
      </div>
      <div className="text-center text-sm font-bold h-10">
        {pick === null ? 'מי הצליח יותר? לחצו! 🤔' : pick === NOA.name ? '🎉 נכון! לנועה תשואה של 20% – יותר מ-10% של יואב' : '🙈 ליואב יותר שקלים, אבל לנועה תשואה גבוהה יותר!'}
      </div>
    </div>
  );
}

function PerHundred() {
  const t = useTick(2200, 2);
  const scaled = t === 1;
  const row = (k: typeof NOA, factor: string) => {
    const inv = scaled ? 100 : k.inv;
    const profit = scaled ? (k.profit / k.inv) * 100 : k.profit;
    return (
      <div className="flex items-center gap-2">
        <Big className="text-3xl w-9 text-center">{k.e}</Big>
        <div className="flex-1">
          <div className="flex items-center gap-1 h-6">
            <div className="h-full rounded-md bg-slate-300 transition-all duration-700" style={{ width: `${inv / 2.4}%` }} />
            <div className="h-full rounded-md bg-emerald-500 transition-all duration-700" style={{ width: `${profit / 2.4}%` }} />
          </div>
          <div className="text-xs font-bold mt-0.5">
            השקעה <span className="num">{inv} ₪</span> · רווח <span className="num text-emerald-700">{fmtNum(profit)} ₪</span>
            {scaled && (
              <>
                {' '}
                ({factor}) = <span className="num text-amber-700 text-sm">{fmtNum(profit)}%</span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className="h-full flex flex-col justify-center gap-3 px-4">
      <div className="text-center font-extrabold">{scaled ? '✨ כאילו כל אחד השקיע 100 ₪' : 'מה שהיה באמת'}</div>
      {row(NOA, 'פי 2')}
      {row(YOAV, 'חצי')}
      <div className="flex justify-center gap-3 text-[11px] text-slate-600">
        <span>⬜ השקעה</span>
        <span>🟩 רווח</span>
      </div>
    </div>
  );
}

function ReturnFormula() {
  const t = useTick(1200, 5);
  const parts = [
    { txt: 'רווח', cls: 'bg-emerald-100 text-emerald-800' },
    { txt: '÷', cls: '' },
    { txt: 'השקעה', cls: 'bg-slate-100 text-slate-800' },
    { txt: '× 100', cls: '' },
    { txt: '= תשואה %', cls: 'bg-amber-100 text-amber-800' }
  ];
  return (
    <div className="h-full flex flex-col justify-center gap-3 px-3">
      <div className="flex flex-wrap justify-center items-center gap-1.5 text-lg font-extrabold">
        {parts.map((p, i) => (
          <span key={i} className={clsx('rounded-lg px-2 py-1 transition-all duration-500', p.cls, t >= i ? 'opacity-100 scale-100' : 'opacity-0 scale-75')}>
            {p.txt}
          </span>
        ))}
      </div>
      <div className="rounded-xl bg-white/90 shadow px-3 py-2 text-center">
        <div className="text-sm font-bold">{NOA.e} נועה</div>
        <Eq className="text-lg">10 ÷ 50 × 100 = 20%</Eq>
      </div>
      <div className="rounded-xl bg-white/90 shadow px-3 py-2 text-center">
        <div className="text-sm font-bold">{YOAV.e} יואב</div>
        <Eq className="text-lg">20 ÷ 200 × 100 = 10%</Eq>
      </div>
    </div>
  );
}

const RACES = [
  [
    { name: 'נועה', e: '👧', f: true, inv: 100, profit: 15 },
    { name: 'יואב', e: '👦', f: false, inv: 300, profit: 30 }
  ],
  [
    { name: 'מאיה', e: '👩', f: true, inv: 40, profit: 10 },
    { name: 'איתי', e: '🧑', f: false, inv: 80, profit: 16 }
  ],
  [
    { name: 'שירה', e: '👧', f: true, inv: 500, profit: 50 },
    { name: 'עומר', e: '👦', f: false, inv: 20, profit: 6 }
  ]
];
function ReturnRace() {
  const [r, setR] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [go, setGo] = useState(false);
  const pair = RACES[r % RACES.length];
  const rets = pair.map((x) => (x.profit / x.inv) * 100);
  const win = rets[0] > rets[1] ? 0 : 1;
  const max = Math.max(...rets);
  useEffect(() => {
    if (pick === null) return;
    const h = setTimeout(() => setGo(true), 50);
    const c = setTimeout(() => pick === win && fireConfetti(), 1700);
    return () => {
      clearTimeout(h);
      clearTimeout(c);
    };
  }, [pick, win]);
  return (
    <div className="h-full flex flex-col justify-center gap-2 px-3">
      {pair.map((x, i) => (
        <button
          key={x.name}
          type="button"
          disabled={pick !== null}
          onClick={() => setPick(i)}
          className={clsx('rounded-2xl bg-white/90 shadow px-2 py-1.5 text-right transition', pick === null && 'active:scale-[.98] hover:ring-2 hover:ring-brand-300', pick === i && 'ring-2 ring-brand-500')}
        >
          <div className="text-xs font-bold">
            {x.name}: השקעה <span className="num">{x.inv} ₪</span>, רווח <span className="num text-emerald-700">{x.profit} ₪</span>
            {go && (
              <>
                {' · '}
                <span className="num text-amber-700">{fmtNum(rets[i])}%</span>
              </>
            )}
          </div>
          <div className="relative h-8 mt-0.5 rounded-full bg-slate-100">
            <span className="absolute top-0 text-xl" style={{ insetInlineEnd: 4 }}>
              🏁
            </span>
            <span
              className="absolute top-0 text-2xl leading-8"
              style={{ insetInlineStart: go ? `${(rets[i] / max) * 78}%` : '0%', transition: 'inset-inline-start 1.6s ease-in-out' }}
            >
              {x.e}
            </span>
          </div>
        </button>
      ))}
      <div className="text-center text-sm font-bold h-9">
        {pick === null ? 'למי התשואה גבוהה יותר? לחצו על הרץ! 🏃' : !go ? '' : pick === win ? '🎉 צדקתם!' : `🙈 הפעם ${pair[win].name} ${pair[win].f ? 'ניצחה' : 'ניצח'} – תשואה גבוהה יותר`}
        {pick !== null && go && (
          <button
            type="button"
            className="mr-2 text-brand-700 underline"
            onClick={() => {
              setR(r + 1);
              setPick(null);
              setGo(false);
            }}
          >
            סיבוב הבא ←
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- כדור השלג
function YearSteps() {
  const t = useTick(1100, 7);
  const vals = [100, 110, 121, 133.1, 146.41];
  return (
    <div className="h-full flex flex-col justify-end pb-4 px-4">
      <div className="flex items-end justify-center gap-2 h-44">
        {vals.map((v, i) => (
          <div key={i} className={clsx('flex flex-col items-center transition-all duration-500', t >= i ? 'opacity-100' : 'opacity-0')}>
            {i > 0 && <div className="text-xs font-extrabold text-emerald-700 num">+{fmtNum(Math.round((v - vals[i - 1]) * 10) / 10)}</div>}
            <div className="w-12 rounded-t-lg bg-sky-400 border-2 border-white shadow" style={{ height: (v - 60) * 1.4 }} />
            <div className="text-xs font-extrabold num">{fmtNum(Math.round(v * 10) / 10)}</div>
            <div className="text-[10px] text-slate-600">{i === 0 ? 'התחלה' : `שנה ${i}`}</div>
          </div>
        ))}
      </div>
      <div className={clsx('text-center text-sm font-bold mt-1 transition-opacity', t >= 5 ? 'opacity-100' : 'opacity-0')}>התוספת גדלה כל שנה! ❄️</div>
    </div>
  );
}

function SnowballYears() {
  const [y, setY] = useState(10);
  const simple = 100 + 10 * y;
  const comp = 100 * Math.pow(1.1, y);
  const max = Math.max(comp, simple);
  const ball = 1 + Math.sqrt(comp / 100) * 0.55;
  return (
    <div className="h-full flex flex-col justify-center gap-2 px-4">
      <div className="flex items-center gap-3">
        <div className="w-20 h-20 grid place-items-center shrink-0">
          <Big className="text-3xl transition-transform duration-300" style={{ transform: `scale(${Math.min(2, ball)})` }}>
            ⚪
          </Big>
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <div className="text-xs font-bold">➕ תוספת קבועה של 10 ₪ בשנה</div>
            <div className="flex items-center gap-2">
              <div className="h-4 rounded-full bg-slate-400 transition-all duration-300" style={{ width: `${(simple / max) * 58}%` }} />
              <span className="text-sm font-extrabold num">{Math.round(simple)} ₪</span>
            </div>
          </div>
          <div>
            <div className="text-xs font-bold">❄️ כדור שלג: 10% בכל שנה</div>
            <div className="flex items-center gap-2">
              <div className="h-4 rounded-full bg-sky-500 transition-all duration-300" style={{ width: `${(comp / max) * 58}%` }} />
              <span className="text-sm font-extrabold num text-sky-700">{Math.round(comp).toLocaleString('en-US')} ₪</span>
            </div>
          </div>
        </div>
      </div>
      <label className="text-center text-sm font-bold">
        אחרי <span className="num text-sky-700">{y}</span> שנים
      </label>
      <input type="range" min={0} max={30} step={1} value={y} onChange={(e) => setY(Number(e.target.value))} className="w-full accent-brand-600" aria-label="מספר שנים" />
      <div className="text-center text-[11px] text-slate-500">מספרים לדוגמה בלבד</div>
    </div>
  );
}

function StartEarly() {
  const t = useTick(220, 160);
  const age = Math.min(40, 10 + Math.floor(t / 4));
  const a = age >= 10 ? 100 * Math.pow(1.1, age - 10) : 0;
  const b = age >= 20 ? 100 * Math.pow(1.1, age - 20) : 0;
  const size = (v: number) => (v ? Math.min(2.6, 0.6 + Math.sqrt(v / 100) * 0.5) : 0.4);
  return (
    <div className="h-full flex flex-col justify-center gap-2 px-4">
      <div className="text-center font-extrabold">
        גיל <span className="num text-sky-700 text-2xl">{age}</span>
      </div>
      <div className="flex justify-around items-end h-32">
        {[
          { e: '🧒', label: 'התחיל בגיל 10', v: a },
          { e: '🧑', label: 'התחיל בגיל 20', v: b }
        ].map((k) => (
          <div key={k.label} className="flex flex-col items-center gap-1 w-32">
            <div className="h-16 grid place-items-center">
              <Big className={clsx('text-3xl transition-transform duration-200', !k.v && 'opacity-30')} style={{ transform: `scale(${size(k.v)})` }}>
                ⚪
              </Big>
            </div>
            <Big className="text-3xl">{k.e}</Big>
            <div className="text-xs font-bold">{k.label}</div>
            <div className="text-sm font-extrabold num">{k.v ? `${Math.round(k.v).toLocaleString('en-US')} ₪` : 'עוד לא התחיל'}</div>
          </div>
        ))}
      </div>
      <div className="text-center text-[11px] text-slate-500">100 ₪ שגדלים ב-10% בשנה – מספרים לדוגמה</div>
    </div>
  );
}

const R72 = [4, 6, 8, 9, 12] as const;
function Rule72() {
  const [r, setR] = useState<(typeof R72)[number]>(8);
  const years = 72 / r;
  const check = 100 * Math.pow(1 + r / 100, years);
  return (
    <div className="h-full flex flex-col justify-center gap-2 px-4">
      <div className="text-center text-xs font-bold text-slate-600">תשואה בשנה:</div>
      <Chips values={R72} value={r} onChange={setR} fmt={(v) => `${v}%`} label="תשואה שנתית" />
      <div className="text-center text-2xl font-extrabold">
        <Eq>72 ÷ {r} = {years}</Eq> <span className="text-base">שנים</span>
      </div>
      <div className="flex justify-center flex-wrap gap-1" aria-hidden="true">
        {Array.from({ length: years }, (_, i) => (
          <span key={`${r}-${i}`} className="w-4 h-4 rounded-full bg-sky-400 anim-grow" style={delay(i * 0.08)} />
        ))}
      </div>
      <div className="flex items-center justify-center gap-3 text-lg font-extrabold">
        <span>
          💰 <span className="num">100 ₪</span>
        </span>
        <span>⬅️</span>
        <span className="text-emerald-700">
          💰💰 <span className="num">{Math.round(check)} ₪</span>
        </span>
      </div>
      <div className="text-center text-xs text-slate-600">בדיקה: אחרי {years} שנים יש בערך פי 2!</div>
    </div>
  );
}

export const PERCENT_SCENES = {
  'hundred-grid': HundredGrid,
  'percent-pies': PercentPies,
  'percent-challenge': PercentChallenge,
  'percent-everyday': PercentEveryday,
  'ten-percent': TenPercent,
  'half-quarter': HalfQuarter,
  'percent-machine': PercentMachine,
  'percent-formula': PercentFormula,
  'sale-tag': SaleTag,
  'shop-cart': ShopCart,
  'better-deal': BetterDeal,
  'percent-change': PercentChange,
  'updown-trap': UpdownTrap,
  recover: Recover,
  'two-investors': TwoInvestors,
  'per-hundred': PerHundred,
  'return-formula': ReturnFormula,
  'return-race': ReturnRace,
  'year-steps': YearSteps,
  'snowball-years': SnowballYears,
  'start-early': StartEarly,
  rule72: Rule72
} satisfies Partial<Record<SceneId, () => ReactNode>>;
