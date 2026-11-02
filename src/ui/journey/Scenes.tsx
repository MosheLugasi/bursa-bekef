// איורים מונפשים למסע של שורי (SVG + אימוג׳י + אנימציות CSS). חלקם אינטראקטיביים.
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { SceneId } from '@/game/journey';
import { fireConfetti } from '@/game/actions';
import { clsx } from '../format';

function useTick(ms: number, max = 1e9) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const h = setInterval(() => setT((x) => (x + 1) % max), ms);
    return () => clearInterval(h);
  }, [ms, max]);
  return t;
}

const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

function Big({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span className={clsx('inline-block leading-none select-none', className)} style={style} aria-hidden="true">
      {children}
    </span>
  );
}

function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('rounded-full bg-white/90 shadow px-3 py-1 text-sm font-bold text-slate-800', className)}>{children}</div>;
}

// ---------- תחנה 1: כסף
function Piggy() {
  const t = useTick(1100, 100);
  return (
    <div className="h-full grid place-items-center relative">
      {[0, 0.8, 1.6].map((d, i) => (
        <Big key={i} className="absolute top-6 text-4xl anim-fall" style={{ ...delay(d), left: `${44 + i * 5}%` }}>
          🪙
        </Big>
      ))}
      <Big className="text-8xl anim-bob mt-10">🐷</Big>
      <Label className="absolute bottom-3">בקופה: <span className="num">{(t % 10) * 5 + 5} ₪</span></Label>
    </div>
  );
}

function Shrink() {
  const t = useTick(1500, 3);
  const years = ['פעם', 'אחר כך', 'היום'];
  return (
    <div className="h-full flex items-center justify-around px-4">
      <div className="text-center">
        <Big className="text-6xl">💰</Big>
        <Label className="mt-2">בקופה: <span className="num">10 ₪</span></Label>
      </div>
      <div className="text-center">
        <Big className="text-7xl anim-wiggle">🍦</Big>
        <Label className="mt-2 anim-grow" key={t}>
          {years[t]}: <span className="num">{5 + t} ₪</span> {t > 0 && '⬆️'}
        </Label>
        <div className="text-xs text-slate-600 mt-1">כמה ארטיקים אפשר לקנות? <span className="num font-bold">{Math.floor(10 / (5 + t))}</span></div>
      </div>
    </div>
  );
}

function Tree() {
  const t = useTick(1300, 4);
  const stages = ['🌰', '🌱', '🌿', '🌳'];
  return (
    <div className="h-full grid place-items-center relative">
      <Big key={t} className="text-8xl anim-grow">{stages[t]}</Big>
      {t === 3 &&
        [0, 1, 2, 3].map((i) => (
          <Big key={i} className="absolute text-2xl anim-grow" style={{ ...delay(0.2 * i), top: `${28 + (i % 2) * 14}%`, left: `${38 + i * 7}%` }}>
            🪙
          </Big>
        ))}
      <div className="absolute bottom-3 w-2/3 h-3 rounded-full bg-amber-800/30" />
    </div>
  );
}

// ---------- תחנה 2: חברה
function Lemonade() {
  return (
    <div className="h-full relative overflow-hidden">
      <svg viewBox="0 0 300 200" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <rect x="70" y="95" width="160" height="70" rx="6" fill="#f59e0b" />
        <rect x="70" y="95" width="160" height="12" fill="#b45309" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <rect key={i} x={60 + i * 22.5} y="45" width="22.5" height="28" fill={i % 2 ? '#fff' : '#ef4444'} />
        ))}
        <rect x="75" y="73" width="6" height="30" fill="#92400e" />
        <rect x="219" y="73" width="6" height="30" fill="#92400e" />
        <text x="150" y="140" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#fff">לימונדה 5₪</text>
      </svg>
      <Big className="absolute text-4xl" style={{ top: '38%', left: '43%' }}>🧒</Big>
      <Big className="absolute text-3xl anim-float" style={{ top: '43%', left: '62%' }}>🍋</Big>
      <Big className="absolute text-3xl" style={{ top: '43%', left: '28%' }}>🥤</Big>
      <div className="absolute bottom-1 inset-x-0 flex justify-center">
        {['👧', '👦', '👩'].map((p, i) => (
          <Big key={p} className="text-4xl anim-walk absolute" style={delay(i * 2)}>
            {p}
          </Big>
        ))}
      </div>
      <Big className="absolute text-lg font-bold text-emerald-700 anim-rise" style={{ top: '30%', left: '58%' }}>+5₪</Big>
    </div>
  );
}

function Profit() {
  const rows = [
    { label: '💵 הכנסות (מכירות)', v: 30, color: 'bg-emerald-500' },
    { label: '🍋 הוצאות (לימונים וסוכר)', v: 10, color: 'bg-rose-400' },
    { label: '😃 רווח', v: 20, color: 'bg-amber-400' }
  ];
  return (
    <div className="h-full flex flex-col justify-center gap-3 px-6" dir="rtl">
      {rows.map((r, i) => (
        <div key={r.label}>
          <div className="flex justify-between text-sm font-bold text-slate-700">
            <span>{r.label}</span>
            <span className="num">{r.v} ₪</span>
          </div>
          <div className="h-5 rounded-full bg-white/70 overflow-hidden">
            <div className={clsx('h-full rounded-full anim-grow origin-right', r.color)} style={{ width: `${(r.v / 30) * 100}%`, ...delay(i * 0.5) }} />
          </div>
        </div>
      ))}
      <div className="text-center text-sm font-bold text-slate-700">30 − 10 = <span className="text-amber-600 text-lg">20 ₪ רווח</span></div>
    </div>
  );
}

function Brands() {
  const items = ['🥤', '🎬', '🍫', '👟', '🍎', '🎮', '🍔', '🏰'];
  return (
    <div className="h-full grid grid-cols-4 place-items-center p-4">
      {items.map((e, i) => (
        <Big key={e} className="text-5xl anim-grow" style={delay(i * 0.18)}>
          <span className="anim-float" style={delay(i * 0.3)}>{e}</span>
        </Big>
      ))}
    </div>
  );
}

// ---------- תחנה 3: מניה
function wedge(i: number, n: number, r: number, cx = 100, cy = 100) {
  const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
  const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
  return `M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 0 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} Z`;
}

function Pizza() {
  const [mine, setMine] = useState<number[]>([]);
  const n = 8;
  return (
    <div className="h-full flex items-center justify-center gap-4 px-3">
      <svg viewBox="0 0 200 200" className="h-[88%]" role="img" aria-label="פיצה עם 8 משולשים – לחצו כדי לקנות">
        <circle cx="100" cy="100" r="92" fill="#d97706" />
        {Array.from({ length: n }, (_, i) => {
          const sel = mine.includes(i);
          const mid = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2;
          return (
            <g
              key={i}
              onClick={() => setMine(sel ? mine.filter((x) => x !== i) : [...mine, i])}
              style={{ transform: sel ? `translate(${Math.cos(mid) * 8}px, ${Math.sin(mid) * 8}px)` : undefined, transition: 'transform .25s', cursor: 'pointer' }}
            >
              <path d={wedge(i, n, 84)} fill={sel ? '#fde047' : '#fbbf24'} stroke="#b45309" strokeWidth="2" />
              <circle cx={100 + Math.cos(mid) * 52} cy={100 + Math.sin(mid) * 52} r="7" fill="#dc2626" />
              {sel && (
                <text x={100 + Math.cos(mid) * 30} y={100 + Math.sin(mid) * 30 + 6} textAnchor="middle" fontSize="16">
                  🙋
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="text-center min-w-28">
        <div className="text-sm text-slate-600">יש לכם</div>
        <div className="text-3xl font-extrabold num">{mine.length}/{n}</div>
        <div className="text-sm text-slate-600">מניות</div>
        <Label className="mt-2">
          <span className="num">{Math.round((mine.length / n) * 100)}%</span> מהחברה
        </Label>
      </div>
    </div>
  );
}

function Owners() {
  const people = ['👧', '👴', '👩', '🧑', '👦', '👵', '🧔', '👩‍🦱'];
  return (
    <div className="h-full relative grid place-items-center">
      <Big className="text-6xl anim-spin-slow">🍕</Big>
      {people.map((p, i) => {
        const a = (i / people.length) * Math.PI * 2;
        return (
          <Big key={p} className="absolute text-4xl anim-bob" style={{ left: `calc(50% + ${Math.cos(a) * 38}% - 18px)`, top: `calc(50% + ${Math.sin(a) * 36}% - 18px)`, ...delay(i * 0.2) }}>
            {p}
          </Big>
        );
      })}
    </div>
  );
}

function ManySlices() {
  return (
    <div className="h-full flex items-center justify-center gap-4">
      <svg viewBox="0 0 200 200" className="h-[85%] anim-spin-slow" aria-hidden="true">
        <circle cx="100" cy="100" r="90" fill="#fbbf24" stroke="#b45309" strokeWidth="3" />
        {Array.from({ length: 64 }, (_, i) => {
          const a = (i / 64) * Math.PI * 2;
          return <line key={i} x1="100" y1="100" x2={100 + Math.cos(a) * 90} y2={100 + Math.sin(a) * 90} stroke="#b45309" strokeWidth="1" />;
        })}
      </svg>
      <Label className="text-base">× מיליוני חתיכות!</Label>
    </div>
  );
}

// ---------- תחנה 4: בורסה
function Ticker({ sym, base, seed }: { sym: string; base: number; seed: number }) {
  const t = useTick(1100 + seed * 130);
  const px = useMemo(() => base * (1 + Math.sin(t * 1.3 + seed) * 0.03), [t, base, seed]);
  const up = Math.cos(t * 1.3 + seed) >= 0;
  return (
    <div className="flex justify-between gap-2 font-mono text-xs sm:text-sm whitespace-nowrap" dir="ltr">
      <span className="font-bold text-slate-100">{sym}</span>
      <span className={up ? 'text-emerald-400' : 'text-rose-400'}>
        {px.toFixed(2)} {up ? '▲' : '▼'}
      </span>
    </div>
  );
}

function Market() {
  return (
    <div className="h-full flex items-center justify-around gap-2 px-2">
      <div className="text-center">
        <div className="grid grid-cols-2 gap-1 justify-items-center">
          {['🙋', '🙋‍♀️', '🧑'].map((p, i) => (
            <Big key={p} className="text-3xl sm:text-4xl anim-bob" style={delay(i * 0.3)}>
              {p}
            </Big>
          ))}
        </div>
        <Label className="mt-2 !px-2 !text-xs whitespace-nowrap">רוצים לקנות</Label>
      </div>
      <div className="rounded-xl bg-slate-900 p-3 shadow-lg w-32 shrink-0 space-y-1">
        <div className="text-[10px] text-slate-400 text-center">לוח הבורסה</div>
        <Ticker sym="AAPL" base={344} seed={1} />
        <Ticker sym="TEVA" base={128} seed={2} />
        <Ticker sym="KO" base={95} seed={3} />
      </div>
      <div className="text-center">
        <div className="grid grid-cols-2 gap-1 justify-items-center">
          {['🙋‍♂️', '👩‍💼', '👨'].map((p, i) => (
            <Big key={p} className="text-3xl sm:text-4xl anim-bob" style={delay(0.15 + i * 0.3)}>
              {p}
            </Big>
          ))}
        </div>
        <Label className="mt-2 !px-2 !text-xs whitespace-nowrap">רוצים למכור</Label>
      </div>
    </div>
  );
}

function TwoExchanges() {
  return (
    <div className="h-full flex items-center justify-around px-4">
      <div className="text-center">
        <Big className="text-6xl anim-float">🏛️</Big>
        <Label className="mt-2">🇮🇱 תל אביב</Label>
      </div>
      <div className="text-3xl anim-wiggle">🔁</div>
      <div className="text-center">
        <Big className="text-6xl anim-float" style={delay(0.6)}>🗽</Big>
        <Label className="mt-2">🇺🇸 ניו יורק</Label>
      </div>
    </div>
  );
}

function Screen() {
  const list = ['AAPL 🍎', 'KO 🥤', 'TEVA 💊', 'NFLX 🎬', 'DIS 🏰', 'NKE 👟', 'STRS 🍫', 'NVDA 🧠'];
  return (
    <div className="h-full grid place-items-center">
      <div className="w-32 h-[85%] rounded-[1.6rem] bg-slate-900 p-2 shadow-xl relative overflow-hidden border-4 border-slate-700">
        <div className="absolute inset-x-2 top-2 bottom-2 overflow-hidden rounded-xl bg-white">
          <div className="anim-ticker-scroll">
            {[...list, ...list].map((x, i) => (
              <div key={i} className="px-2 py-1.5 text-sm font-bold border-b border-slate-100 flex justify-between" dir="ltr">
                {x}
                <span className={i % 3 ? 'text-emerald-600' : 'text-rose-600'}>{i % 3 ? '▲' : '▼'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- תחנה 5: מחיר
function SupplyDemand() {
  const [buyers, setBuyers] = useState(3);
  const [sellers, setSellers] = useState(3);
  const price = Math.max(20, 100 + (buyers - sellers) * 8);
  const trend = buyers > sellers ? 'up' : buyers < sellers ? 'down' : 'flat';
  return (
    <div className="h-full flex flex-col justify-between p-3">
      <div className="flex justify-between items-start">
        <div className="flex flex-wrap gap-0.5 w-[38%]">
          {Array.from({ length: buyers }, (_, i) => (
            <Big key={i} className="text-2xl anim-grow">🙋</Big>
          ))}
        </div>
        <div className="text-center">
          <div className={clsx('text-4xl font-extrabold num transition-colors', trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-rose-600' : 'text-slate-700')}>{price} ₪</div>
          <div className="text-2xl">{trend === 'up' ? '📈' : trend === 'down' ? '📉' : '⚖️'}</div>
        </div>
        <div className="flex flex-wrap gap-0.5 w-[38%] justify-end">
          {Array.from({ length: sellers }, (_, i) => (
            <Big key={i} className="text-2xl anim-grow">🙋‍♂️</Big>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" className="btn-buy py-2 text-sm" onClick={() => setBuyers(Math.min(10, buyers + 1))}>
          ➕ עוד קונה
        </button>
        <button type="button" className="btn-soft py-2 text-sm" onClick={() => (setBuyers(3), setSellers(3))}>
          🔄 איפוס
        </button>
        <button type="button" className="btn-sell py-2 text-sm" onClick={() => setSellers(Math.min(10, sellers + 1))}>
          ➕ עוד מוכר
        </button>
      </div>
    </div>
  );
}

function NewsEffect() {
  const t = useTick(2400, 2);
  const good = t === 0;
  return (
    <div className="h-full flex items-center justify-around px-4">
      <div key={t} className="anim-grow bg-white rounded-xl shadow-lg p-3 w-44 text-center border-t-8 border-slate-800">
        <div className="text-xs text-slate-500">📰 עיתון הבורסה</div>
        <div className="font-extrabold mt-1">{good ? '🚀 מוצר חדש ומגניב!' : '⚠️ תקלה במפעל!'}</div>
      </div>
      <div className="text-center">
        <Big key={'a' + t} className={clsx('text-6xl anim-grow', good ? 'text-emerald-600' : 'text-rose-600')}>{good ? '📈' : '📉'}</Big>
        <div className={clsx('font-bold mt-1', good ? 'text-emerald-700' : 'text-rose-700')}>{good ? 'כולם רוצים לקנות' : 'הרבה רוצים למכור'}</div>
      </div>
    </div>
  );
}

const CHART_PTS = [8, 14, 11, 19, 16, 25, 21, 30, 27, 36, 31, 44, 40, 52];
function Chart() {
  const w = 280;
  const h = 150;
  const max = 56;
  const pts = CHART_PTS.map((v, i) => [(i / (CHART_PTS.length - 1)) * (w - 20) + 10, h - 10 - (v / max) * (h - 20)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <div className="h-full grid place-items-center" dir="ltr">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-[92%]" aria-hidden="true">
        <path d={`${d} L${last[0]},${h - 10} L10,${h - 10} Z`} fill="rgba(12,163,12,.12)" />
        <path d={d} fill="none" stroke="#0ca30c" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" className="anim-draw" style={{ ['--len' as string]: 600 } as CSSProperties} />
        <circle cx={last[0]} cy={last[1]} r="7" fill="#0ca30c" className="anim-pulse-dot" />
      </svg>
    </div>
  );
}

// ---------- תחנה 6: תשואה
function ReturnSlider() {
  const [sell, setSell] = useState(120);
  const pnl = sell - 100;
  const pct = pnl;
  return (
    <div className="h-full flex flex-col justify-center gap-3 px-5">
      <div className="flex items-end justify-around h-24">
        <div className="text-center">
          <div className="w-14 bg-slate-400 rounded-t-lg mx-auto" style={{ height: 50 }} />
          <div className="text-xs font-bold mt-1">קניתם: <span className="num">100 ₪</span></div>
        </div>
        <div className="text-center">
          <div className={clsx('w-14 rounded-t-lg mx-auto transition-all', pnl >= 0 ? 'bg-emerald-500' : 'bg-rose-500')} style={{ height: Math.max(8, sell / 2) }} />
          <div className="text-xs font-bold mt-1">מכרתם: <span className="num">{sell} ₪</span></div>
        </div>
      </div>
      <input type="range" min={50} max={180} step={5} value={sell} onChange={(e) => setSell(Number(e.target.value))} className="w-full accent-brand-600" aria-label="מחיר המכירה" />
      <div className={clsx('text-center font-extrabold text-lg', pnl > 0 ? 'text-emerald-700' : pnl < 0 ? 'text-rose-700' : 'text-slate-700')}>
        {pnl > 0 ? `🤑 רווח של ${pnl} ₪ = תשואה של +${pct}%` : pnl < 0 ? `😬 הפסד של ${-pnl} ₪ = תשואה של ${pct}%` : 'בלי רווח ובלי הפסד'}
      </div>
    </div>
  );
}

function Percent() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3">
      <div className="flex items-center gap-3 text-2xl font-extrabold" dir="ltr">
        <span className="rounded-xl bg-white px-3 py-2 shadow num">100 ₪</span>
        <span className="anim-wiggle">➡️</span>
        <span className="rounded-xl bg-emerald-100 px-3 py-2 shadow num text-emerald-800">110 ₪</span>
      </div>
      <Big className="text-5xl anim-bob text-emerald-700 font-extrabold">+10%</Big>
      <div className="text-sm text-slate-700">כל 100 ₪ גדלו ב-10 ₪</div>
    </div>
  );
}

function Loss() {
  const pts = [30, 26, 20, 15, 18, 24, 29, 35];
  const w = 280;
  const h = 140;
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${10 + (i / (pts.length - 1)) * (w - 20)},${h - 10 - (v / 40) * (h - 20)}`).join(' ');
  return (
    <div className="h-full flex items-center justify-center gap-2" dir="ltr">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-[70%]" aria-hidden="true">
        <path d={d} fill="none" stroke="#2a78d6" strokeWidth="4" strokeLinejoin="round" className="anim-draw" style={{ ['--len' as string]: 500 } as CSSProperties} />
      </svg>
      <Big className="text-5xl anim-bob">💪</Big>
    </div>
  );
}

// ---------- תחנה 7: דיבידנד
function Dividend() {
  return (
    <div className="h-full relative">
      <div className="absolute top-3 inset-x-0 text-center">
        <Big className="text-6xl">🏭</Big>
        <div className="relative z-10 inline-block rounded-full bg-white/90 shadow px-2 py-0.5 text-xs font-bold text-slate-700">רווח השנה!</div>
      </div>
      {[0, 1, 2].map((i) =>
        [0, 0.8, 1.6].map((d) => (
          <Big key={`${i}-${d}`} className="absolute text-2xl anim-fall" style={{ ...delay(d + i * 0.3), top: '30%', left: `${22 + i * 26}%` }}>
            🍬
          </Big>
        ))
      )}
      <div className="absolute bottom-3 inset-x-0 flex justify-around">
        {['🤲', '🤲', '🤲'].map((h, i) => (
          <div key={i} className="text-center">
            <Big className="text-4xl">{h}</Big>
            <div className="text-[11px] font-bold">בעל מניה</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DividendCount() {
  return (
    <div className="h-full flex flex-col justify-center gap-4 px-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold w-24">מניה אחת:</span>
        <Big className="text-2xl anim-grow">🍬</Big>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold w-24">10 מניות:</span>
        <div className="flex flex-wrap gap-0.5">
          {Array.from({ length: 10 }, (_, i) => (
            <Big key={i} className="text-2xl anim-grow" style={delay(0.1 * i)}>
              🍬
            </Big>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- תחנה 8: פיזור
function Eggs() {
  const [mode, setMode] = useState<'one' | 'three'>('one');
  const [dropped, setDropped] = useState(false);
  const baskets = mode === 'one' ? [6] : [2, 2, 2];
  const lost = dropped ? (mode === 'one' ? 6 : 2) : 0;
  return (
    <div className="h-full flex flex-col justify-between p-3">
      <div className="flex justify-center gap-2">
        {(['one', 'three'] as const).map((m) => (
          <button key={m} type="button" onClick={() => (setMode(m), setDropped(false))} className={clsx('chip', mode === m && 'chip-on')}>
            {m === 'one' ? '🧺 סל אחד' : '🧺🧺🧺 שלושה סלים'}
          </button>
        ))}
      </div>
      <div className="flex justify-center gap-5 items-end">
        {baskets.map((n, bi) => {
          const broken = dropped && bi === 0;
          return (
            <div key={bi + mode} className={clsx('text-center', broken && 'anim-shake')}>
              <div className="text-xl">{(broken ? '🍳' : '🥚').repeat(n)}</div>
              <Big className="text-4xl">🧺</Big>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn-sell py-2 text-sm" onClick={() => setDropped(true)} disabled={dropped}>
          💥 להפיל סל!
        </button>
        <div className="text-sm font-bold text-slate-700">{dropped ? (lost === 6 ? 'אוי! כל 6 הביצים נשברו 😱' : 'רק 2 נשברו – 4 ניצלו 😅') : 'מה יקרה?'}</div>
      </div>
    </div>
  );
}

function DiversifyPortfolio() {
  const slices = [
    { e: '💻', c: '#2a78d6' },
    { e: '🍔', c: '#eb6834' },
    { e: '🏦', c: '#1baf7a' },
    { e: '💊', c: '#eda100' },
    { e: '⚡', c: '#6250d6' }
  ];
  return (
    <div className="h-full grid place-items-center">
      <svg viewBox="0 0 200 200" className="h-[88%] anim-spin-slow" aria-hidden="true">
        {slices.map((s, i) => {
          const mid = ((i + 0.5) / slices.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <g key={i}>
              <path d={wedge(i, slices.length, 88)} fill={s.c} stroke="#fff" strokeWidth="3" />
              <text x={100 + Math.cos(mid) * 55} y={100 + Math.sin(mid) * 55 + 8} textAnchor="middle" fontSize="24">
                {s.e}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function IndexBasket() {
  const logos = ['🍎', '🧠', '🔍', '📦', '🥤', '💳', '🏦', '🎬', '👟', '🛒'];
  return (
    <div className="h-full relative">
      <div className="absolute inset-x-0 top-4 flex justify-center flex-wrap gap-1 px-8">
        {logos.map((l, i) => (
          <Big key={l} className="text-3xl anim-fly-in" style={{ ...delay(i * 0.15), ['--fx' as string]: `${(i - 5) * 12}px` } as CSSProperties}>
            {l}
          </Big>
        ))}
      </div>
      <div className="absolute bottom-3 inset-x-0 text-center">
        <Big className="text-7xl">🧺</Big>
        <Label className="inline-block">500 חברות בסל אחד!</Label>
      </div>
    </div>
  );
}

// ---------- תחנה 9: סבלנות
function Rollercoaster() {
  const path = 'M10,120 C40,60 60,60 80,95 S120,140 140,80 S180,20 200,70 S240,110 290,25';
  return (
    <div className="h-full grid place-items-center" dir="ltr">
      <svg viewBox="0 0 300 150" className="w-[95%]" aria-hidden="true">
        <path d={path} fill="none" stroke="#94a3b8" strokeWidth="8" strokeLinecap="round" />
        <path d={path} fill="none" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="6 6" />
        {[30, 90, 150, 210, 270].map((x) => (
          <line key={x} x1={x} y1="148" x2={x} y2="100" stroke="#cbd5e1" strokeWidth="3" />
        ))}
        <g>
          <text fontSize="26" textAnchor="middle" y="-6">
            🚃
          </text>
          <animateMotion dur="6s" repeatCount="indefinite" path={path} rotate="auto" />
        </g>
        <text x="282" y="18" fontSize="22">
          🏁
        </text>
      </svg>
    </div>
  );
}

function TimeGrow() {
  const t = useTick(900, 5);
  return (
    <div className="h-full relative overflow-hidden">
      <svg viewBox="0 0 300 150" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <path d="M0,40 L300,140 L300,150 L0,150 Z" fill="#e0f2fe" />
      </svg>
      <div className="absolute transition-all duration-700" style={{ left: `${8 + t * 18}%`, top: `${12 + t * 12}%` }}>
        <div className="rounded-full bg-white border-2 border-sky-200 shadow transition-all duration-700" style={{ width: 18 + t * 12, height: 18 + t * 12 }} />
      </div>
      <Label className="absolute bottom-3 right-3">
        שנה <span className="num">{t + 1}</span> ⛄
      </Label>
    </div>
  );
}

function Calm() {
  const t = useTick(1000, 8);
  const inhale = t % 8 < 4;
  return (
    <div className="h-full grid place-items-center relative">
      <div className={clsx('absolute rounded-full bg-sky-200/70 transition-all duration-1000', inhale ? 'w-44 h-44' : 'w-24 h-24')} />
      <Big className="text-6xl relative">🧘</Big>
      <Label className="absolute bottom-3">{inhale ? 'שואפים... 🌬️' : 'נושפים... 😌'}</Label>
    </div>
  );
}

// ---------- תחנה 10: מוכנים
function Trophy() {
  useEffect(() => {
    fireConfetti(true);
  }, []);
  return (
    <div className="h-full grid place-items-center relative">
      <Big className="text-8xl anim-bob">🏆</Big>
      {['⭐', '⭐', '⭐'].map((s, i) => (
        <Big key={i} className="absolute text-3xl anim-grow" style={{ ...delay(0.3 + i * 0.25), top: '12%', left: `${32 + i * 15}%` }}>
          {s}
        </Big>
      ))}
    </div>
  );
}

function FirstTrade() {
  return (
    <div className="h-full grid place-items-center">
      <div className="w-36 rounded-[1.6rem] bg-slate-900 p-2 shadow-xl border-4 border-slate-700">
        <div className="rounded-xl bg-white p-3 text-center space-y-2">
          <div className="text-3xl">🍫</div>
          <div className="font-bold text-sm">שטראוס</div>
          <div className="rounded-xl bg-emerald-600 text-white font-bold py-2 anim-pulse-ring">🛒 קנייה</div>
        </div>
      </div>
    </div>
  );
}

// ---------- תחנה: אג״ח
function Lend() {
  const move = (from: string, to: string, d = 0): CSSProperties => ({ ['--from' as string]: from, ['--to' as string]: to, ...delay(d) });
  return (
    <div className="h-full relative flex items-center justify-between px-5">
      <div className="text-center z-10">
        <Big className="text-6xl anim-bob">🧒</Big>
        <Label className="mt-2">אתם</Label>
      </div>
      <div className="absolute inset-x-0 top-[22%] flex justify-center pointer-events-none">
        <span className="anim-slide-x text-center" style={move('90px', '-90px')}>
          <Big className="text-4xl">💵</Big>
          <span className="block text-xs font-bold num">100 ₪</span>
        </span>
      </div>
      <div className="absolute inset-x-0 top-[55%] flex justify-center pointer-events-none">
        <span className="anim-slide-x text-center" style={move('-90px', '90px', 1.2)}>
          <Big className="text-4xl">📜</Big>
          <span className="block text-xs font-bold">פתק הלוואה</span>
        </span>
      </div>
      <div className="text-center z-10">
        <Big className="text-6xl anim-float">🏛️</Big>
        <Label className="mt-2">מדינה / חברה</Label>
      </div>
    </div>
  );
}

function Coupons() {
  const [year, setYear] = useState(0);
  const done = year === 5;
  const got = year * 5 + (done ? 100 : 0);
  useEffect(() => {
    if (done) fireConfetti(false);
  }, [done]);
  return (
    <div className="h-full flex flex-col justify-center gap-2 px-4">
      <div className="flex justify-between items-end">
        {[1, 2, 3, 4, 5].map((y) => (
          <div key={y} className="flex flex-col items-center gap-1 w-14">
            <div className="h-14 flex flex-col-reverse items-center">
              {y <= year && (
                <Big key={'c' + y} className="text-2xl anim-grow">
                  🪙
                </Big>
              )}
              {y === 5 && done && (
                <Big className="text-2xl anim-grow" style={delay(0.25)}>
                  💵
                </Big>
              )}
            </div>
            <div className={clsx('w-12 rounded-xl py-1.5 text-center text-xs font-bold transition', y <= year ? 'bg-amber-300' : 'bg-white/80')}>שנה {y}</div>
          </div>
        ))}
      </div>
      <div className={clsx('text-center font-bold', done ? 'text-emerald-700' : 'text-slate-700')}>
        {done ? '🎉 יום הפדיון! קיבלתם בחזרה את ה-100 ₪' : 'כל שנה: 🪙 = 5 ₪ ״תודה״'}
      </div>
      <div className="text-center text-sm">
        קיבלתם עד עכשיו: <span className="num font-extrabold text-emerald-700 text-lg">{got} ₪</span>
      </div>
      <button className="btn-primary mx-auto" onClick={() => setYear((y) => (y >= 5 ? 0 : y + 1))}>
        {done ? '🔄 עוד פעם' : '⏭️ שנה הבאה'}
      </button>
    </div>
  );
}

function WhoBorrows() {
  const rows = [
    { e: '🏛️', name: 'המדינה', risk: 1, thanks: 3 },
    { e: '🏢', name: 'חברה גדולה', risk: 2, thanks: 5 },
    { e: '🎲', name: 'חברה בצרות', risk: 3, thanks: 10 }
  ];
  const cols = 'grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-x-2';
  return (
    <div className="h-full flex flex-col justify-center gap-2 px-4">
      <div className={clsx(cols, 'text-xs font-bold text-slate-600 px-3')}>
        <span>מי לווה?</span>
        <span className="text-center">סיכון</span>
        <span className="text-center">״תודה״ בשנה</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.name} className={clsx(cols, 'rounded-2xl bg-white/90 shadow px-3 py-1.5 anim-fly-in')} style={delay(0.2 + i * 0.3)}>
          <span className="font-bold whitespace-nowrap">
            <span className="text-2xl align-middle">{r.e}</span> {r.name}
          </span>
          <span className="text-center text-sm">{'⚠️'.repeat(r.risk)}</span>
          <span className="text-center num font-extrabold text-emerald-700">{r.thanks} ₪</span>
        </div>
      ))}
      <div className="text-center text-sm font-bold text-slate-700">יותר סיכון = ״תודה״ גדולה יותר (המספרים לדוגמה)</div>
    </div>
  );
}

function Seesaw() {
  const [rate, setRate] = useState(4);
  // פתק ישן: 100 ₪, ״תודה״ של 4 ₪ בשנה, עוד 5 שנים לפדיון
  const price = useMemo(() => {
    const r = rate / 100;
    let p = 100 / (1 + r) ** 5;
    for (let t = 1; t <= 5; t++) p += 4 / (1 + r) ** t;
    return p;
  }, [rate]);
  const angle = -(rate - 4) * 4;
  return (
    <div className="h-full flex flex-col justify-center gap-2 px-5">
      <div className="relative h-32">
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-0 h-0 border-x-[20px] border-x-transparent border-b-[34px] border-b-slate-500" />
        <div className="absolute inset-x-2 bottom-[34px] h-2.5 rounded-full bg-amber-700 transition-transform duration-500" style={{ transform: `rotate(${angle}deg)` }}>
          <div className="absolute bottom-2 right-0 text-center w-24">
            <Big className="text-3xl">📈</Big>
            <div className="text-xs font-bold whitespace-nowrap">
              ריבית בשוק <span className="num">{rate}%</span>
            </div>
          </div>
          <div className="absolute bottom-2 left-0 text-center w-24">
            <Big className="text-3xl">📜</Big>
            <div className="text-xs font-bold whitespace-nowrap">
              מחיר הפתק <span className="num">{price.toFixed(0)} ₪</span>
            </div>
          </div>
        </div>
      </div>
      <input type="range" min={1} max={8} step={1} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-full accent-brand-600" aria-label="הריבית בשוק" />
      <div className={clsx('text-center text-sm font-bold', rate > 4 ? 'text-rose-700' : rate < 4 ? 'text-emerald-700' : 'text-slate-700')}>
        {rate > 4 ? '📉 הריבית עלתה – הפתק הישן (4%) שווה פחות' : rate < 4 ? '📈 הריבית ירדה – הפתק הישן (4%) שווה יותר' : 'הפתק נותן 4% – בדיוק כמו הריבית בשוק'}
      </div>
    </div>
  );
}

// ---------- תחנה: אופציות
function OptionTicket() {
  return (
    <div className="h-full flex items-center justify-center gap-5 px-4">
      <Big className="text-7xl anim-float">🚲</Big>
      <div className="rotate-[-4deg]">
        <div className="rounded-2xl border-4 border-dashed border-rose-400 bg-white px-4 py-3 shadow-lg text-center anim-bob">
          <div className="text-3xl">🎟️</div>
          <div className="font-extrabold">שובר זכות</div>
          <div className="text-xs mt-1">
            לקנות אופניים ב-<span className="num font-bold">100 ₪</span>
          </div>
          <div className="text-xs">עד סוף החודש ⏰</div>
          <div className="mt-2 rounded-full bg-rose-500 text-white text-xs font-bold px-2 py-0.5">
            מחיר השובר: <span className="num">5 ₪</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionPlay() {
  const [px, setPx] = useState(150);
  const use = px > 100;
  const pnl = use ? px - 105 : -5;
  return (
    <div className="h-full flex flex-col justify-center gap-2 px-5">
      <div className="flex items-center justify-center gap-4">
        <Big className="text-5xl">🚲</Big>
        <div className="text-center">
          <div className="text-xs font-bold text-slate-600">המחיר בחנות בסוף החודש</div>
          <div className="text-3xl font-extrabold num">{px} ₪</div>
        </div>
        <Big className={clsx('text-4xl transition', use ? 'anim-bob' : 'grayscale opacity-40')}>🎟️</Big>
      </div>
      <input type="range" min={60} max={160} step={5} value={px} onChange={(e) => setPx(Number(e.target.value))} className="w-full accent-brand-600" aria-label="המחיר בחנות" />
      <div className={clsx('rounded-xl px-3 py-2 text-center text-sm font-bold', !use ? 'bg-rose-100 text-rose-800' : pnl > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
        {!use
          ? '🙅 לא משתמשים בשובר – בחנות זה לא יקר יותר. מפסידים רק את ה-5 ₪ ששילמנו עליו'
          : pnl > 0
            ? `🤑 משתמשים בשובר! קונים ב-100 ₪ במקום ${px} ₪. רווח: ${pnl} ₪ (אחרי 5 ₪ על השובר)`
            : `משתמשים בשובר וקונים ב-100 ₪, אבל אחרי 5 ₪ על השובר – ${pnl === 0 ? 'יוצאים בדיוק באפס' : `הפסד של ${-pnl} ₪`}`}
      </div>
    </div>
  );
}

function Umbrella() {
  return (
    <div className="h-full relative">
      {[5, 15, 25, 33, 72, 82, 92].map((x, i) => (
        <Big key={x} className="absolute text-lg anim-fall" style={{ ...delay(i * 0.35), left: `${x}%`, top: '4%' }}>
          💧
        </Big>
      ))}
      <div className="absolute inset-0 flex items-center justify-center gap-8">
        <div className="flex flex-col items-center">
          <Big className="text-6xl anim-wiggle relative z-10">☂️</Big>
          <Big className="text-5xl -mt-2">🧒</Big>
          <Label className="mt-1 !text-xs !px-2 whitespace-nowrap">
            ואני עדיין מוכר ב-<span className="num">100 ₪</span>
          </Label>
        </div>
        <div className="flex flex-col items-center">
          <Big className="text-5xl">📉</Big>
          <Label className="mt-2 !text-xs !px-2 whitespace-nowrap">
            המניה ירדה ל-<span className="num">70 ₪</span>
          </Label>
        </div>
      </div>
    </div>
  );
}

function Hourglass() {
  const t = useTick(650, 16);
  const days = Math.max(0, 30 - Math.round((t * 30) / 11));
  const value = 5 * Math.sqrt(days / 30);
  const expired = days === 0;
  return (
    <div className="h-full flex items-center justify-center gap-6 px-4">
      <Big className={clsx('text-6xl', !expired && 'anim-wiggle')}>{expired ? '⌛' : '⏳'}</Big>
      <div className="relative">
        <div className="rounded-2xl border-4 border-dashed border-rose-400 bg-white px-5 py-3 text-center transition-opacity duration-500" style={{ opacity: 0.3 + 0.7 * (days / 30) }}>
          <div className="text-3xl">🎟️</div>
          <div className="text-xs font-bold">
            נשארו <span className="num">{days}</span> ימים
          </div>
          <div className="text-sm font-extrabold">
            שווי השובר: <span className="num">{value.toFixed(1)} ₪</span>
          </div>
        </div>
        {expired && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="rotate-[-14deg] rounded-lg border-4 border-rose-600 bg-white/90 px-2 py-0.5 text-lg font-extrabold text-rose-600 anim-grow">פג תוקף!</span>
          </div>
        )}
      </div>
    </div>
  );
}

const SCENES: Record<SceneId, () => ReactNode> = {
  piggy: Piggy,
  shrink: Shrink,
  tree: Tree,
  lemonade: Lemonade,
  profit: Profit,
  brands: Brands,
  pizza: Pizza,
  owners: Owners,
  'many-slices': ManySlices,
  market: Market,
  'two-exchanges': TwoExchanges,
  screen: Screen,
  'supply-demand': SupplyDemand,
  'news-effect': NewsEffect,
  chart: Chart,
  'return-slider': ReturnSlider,
  percent: Percent,
  loss: Loss,
  dividend: Dividend,
  'dividend-count': DividendCount,
  eggs: Eggs,
  'diversify-portfolio': DiversifyPortfolio,
  'index-basket': IndexBasket,
  rollercoaster: Rollercoaster,
  'time-grow': TimeGrow,
  calm: Calm,
  trophy: Trophy,
  'first-trade': FirstTrade,
  lend: Lend,
  coupons: Coupons,
  'who-borrows': WhoBorrows,
  seesaw: Seesaw,
  'option-ticket': OptionTicket,
  'option-play': OptionPlay,
  umbrella: Umbrella,
  hourglass: Hourglass
};

export function Scene({ id, from, to }: { id: SceneId; from: string; to: string }) {
  const C = SCENES[id];
  return (
    <div className="relative h-60 sm:h-64 rounded-3xl overflow-hidden border border-white shadow-inner" style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}>
      <C />
    </div>
  );
}
