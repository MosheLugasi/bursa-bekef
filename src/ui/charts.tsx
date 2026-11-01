import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AreaSeries,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type SeriesMarker,
  type Time
} from 'lightweight-charts';
import { formatDateHe } from '@/engine/dates';
import type { Bar } from '@/engine/market';
import { clsx, fmtNum } from './format';

export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

const baseOptions = {
  autoSize: true,
  layout: { background: { color: 'transparent' }, textColor: '#52514e', fontFamily: 'Rubik Variable, Rubik, system-ui, sans-serif', attributionLogo: false },
  grid: { vertLines: { visible: false }, horzLines: { color: '#f1f0ed' } },
  rightPriceScale: { borderVisible: false },
  timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
  crosshair: { mode: 0 as const },
  handleScroll: { vertTouchDrag: false },
  localization: { locale: 'he-IL' }
};

export interface ChartMarker {
  date: string;
  kind: 'buy' | 'sell' | 'news';
  text?: string;
}

export function PriceChart({
  line,
  bars,
  mode,
  markers = [],
  height = 260,
  digits = 2
}: {
  line: { date: string; value: number }[];
  bars?: Bar[];
  mode: 'line' | 'candle';
  markers?: ChartMarker[];
  height?: number;
  digits?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ date: string; value: number } | null>(null);
  const first = line[0]?.value ?? 0;
  const last = line[line.length - 1]?.value ?? 0;
  const up = last >= first;

  useEffect(() => {
    if (!ref.current || !line.length) return;
    const chart: IChartApi = createChart(ref.current, { ...baseOptions, height, localization: { locale: 'he-IL', priceFormatter: (p: number) => fmtNum(p, digits) } });
    let series;
    if (mode === 'candle' && bars && bars.length) {
      series = chart.addSeries(CandlestickSeries, {
        upColor: '#0ca30c',
        downColor: '#d03b3b',
        borderVisible: false,
        wickUpColor: '#0ca30c',
        wickDownColor: '#d03b3b'
      });
      series.setData(bars.map((b) => ({ time: b.date as Time, open: b.o, high: b.h, low: b.l, close: b.c })));
      const vol = chart.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' }, color: '#cbd5e1' });
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      vol.setData(bars.map((b) => ({ time: b.date as Time, value: b.v, color: b.c >= b.o ? '#bbe5bb' : '#f3c4c4' })));
    } else {
      series = chart.addSeries(AreaSeries, {
        lineColor: up ? '#0ca30c' : '#d03b3b',
        topColor: up ? 'rgba(12,163,12,0.22)' : 'rgba(208,59,59,0.2)',
        bottomColor: 'rgba(255,255,255,0)',
        lineWidth: 2,
        priceLineVisible: false
      });
      series.setData(line.map((p) => ({ time: p.date as Time, value: p.value })));
    }
    const dates = new Set(line.map((l) => l.date));
    const mk: SeriesMarker<Time>[] = markers
      .filter((m) => dates.has(m.date))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((m) =>
        m.kind === 'buy'
          ? { time: m.date as Time, position: 'belowBar', shape: 'arrowUp', color: '#2a78d6', text: m.text ?? 'קנייה', size: 1.2 }
          : m.kind === 'sell'
            ? { time: m.date as Time, position: 'aboveBar', shape: 'arrowDown', color: '#eb6834', text: m.text ?? 'מכירה', size: 1.2 }
            : { time: m.date as Time, position: 'aboveBar', shape: 'circle', color: '#6250d6', text: m.text ?? '📰', size: 1 }
      );
    if (mk.length) createSeriesMarkers(series, mk);
    chart.timeScale().fitContent();
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) return setHover(null);
      const d = param.seriesData.get(series!) as { value?: number; close?: number } | undefined;
      const v = d?.value ?? d?.close;
      if (v === undefined) return setHover(null);
      setHover({ date: String(param.time), value: v });
    });
    return () => chart.remove();
  }, [line, bars, mode, markers, height, up, digits]);

  if (!line.length) return <div className="h-40 grid place-items-center text-slate-400">אין נתונים לתקופה הזו</div>;
  return (
    <div className="relative" dir="ltr">
      <div className="absolute top-1 left-2 z-10 text-xs text-slate-600 bg-white/80 rounded px-1.5 pointer-events-none" dir="rtl">
        {hover ? (
          <>
            {formatDateHe(hover.date)} · <span className="num font-semibold">{fmtNum(hover.value, digits)}</span>
          </>
        ) : (
          'גררו את האצבע על הגרף כדי לראות מחיר בכל יום'
        )}
      </div>
      <div ref={ref} style={{ height }} />
    </div>
  );
}

/** גרף השוואה בין כמה סדרות (תיק מול מדדים) */
export function CompareChart({ series, height = 240, format }: { series: { name: string; color: string; data: [string, number][] }[]; height?: number; format: (v: number) => string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ date: string; values: number[] } | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, { ...baseOptions, height, localization: { locale: 'he-IL', priceFormatter: format } });
    const apis = series.map((s, i) => {
      const api = chart.addSeries(LineSeries, { color: s.color, lineWidth: i === 0 ? 3 : 2, lineStyle: i === 0 ? 0 : 2, priceLineVisible: false, lastValueVisible: i === 0 });
      api.setData(s.data.map(([d, v]) => ({ time: d as Time, value: v })));
      return api;
    });
    chart.timeScale().fitContent();
    chart.subscribeCrosshairMove((param) => {
      if (!param.time) return setHover(null);
      setHover({ date: String(param.time), values: apis.map((a) => (param.seriesData.get(a) as { value?: number } | undefined)?.value ?? NaN) });
    });
    return () => chart.remove();
  }, [series, height, format]);
  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-1 text-sm">
        {series.map((s, i) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span className="inline-block w-4 rounded" style={{ height: i === 0 ? 4 : 3, background: s.color }} />
            <span className="text-slate-700">{s.name}</span>
            {hover && Number.isFinite(hover.values[i]) && <span className="num text-slate-900 font-semibold">{format(hover.values[i])}</span>}
          </span>
        ))}
        {hover && <span className="text-slate-500 text-xs self-center">{formatDateHe(hover.date)}</span>}
      </div>
      <div dir="ltr" ref={ref} style={{ height }} />
    </div>
  );
}

/** טבעת חלוקה (דונאט) */
export function Donut({ slices, size = 150, center }: { slices: { label: string; emoji?: string; value: number }[]; size?: number; center?: React.ReactNode }) {
  const total = slices.reduce((a, s) => a + Math.max(0, s.value), 0) || 1;
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 2 : 0;
  let acc = 0;
  const [hi, setHi] = useState<number | null>(null);
  return (
    <div className="flex items-center gap-4 flex-wrap justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }} role="img" aria-label="חלוקת התיק">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={18} />
          {slices.map((s, i) => {
            const len = (Math.max(0, s.value) / total) * c;
            const dash = Math.max(0, len - gap);
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth={hi === i ? 22 : 18}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-acc}
                onMouseEnter={() => setHi(i)}
                onMouseLeave={() => setHi(null)}
              >
                <title>{`${s.label}: ${((s.value / total) * 100).toFixed(1)}%`}</title>
              </circle>
            );
            acc += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center text-sm font-semibold px-6">
          {hi !== null ? (
            <div>
              <div>{slices[hi].emoji} {slices[hi].label}</div>
              <div className="num">{((slices[hi].value / total) * 100).toFixed(1)}%</div>
            </div>
          ) : (
            center
          )}
        </div>
      </div>
      <ul className="text-sm space-y-1 min-w-36">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2" onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
            <span className="flex-1">
              {s.emoji} {s.label}
            </span>
            <span className="num text-slate-600">{((s.value / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** עמודות מקובצות לפי שנה (הכנסות מול רווח) – תומך בערכים שליליים */
export function GroupedBars({
  groups,
  seriesNames,
  format,
  height = 170
}: {
  groups: { label: string; values: (number | null)[] }[];
  seriesNames: string[];
  format: (v: number) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<{ g: number; s: number } | null>(null);
  const all = groups.flatMap((g) => g.values.filter((v): v is number => v !== null && Number.isFinite(v)));
  const max = Math.max(0, ...all);
  const min = Math.min(0, ...all);
  const span = max - min || 1;
  const W = 320;
  const H = height;
  const zeroY = 8 + ((max - 0) / span) * (H - 30);
  const gw = W / Math.max(1, groups.length);
  const bw = Math.min(26, (gw - 14) / seriesNames.length);
  const scale = (v: number) => (Math.abs(v) / span) * (H - 30);
  return (
    <div>
      <div className="flex gap-4 text-sm mb-1">
        {seriesNames.map((n, i) => (
          <span key={n} className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: SERIES_COLORS[i] }} />
            {n}
          </span>
        ))}
        {hover && (
          <span className="text-slate-700 font-semibold">
            {groups[hover.g].label}: <span className="num">{format(groups[hover.g].values[hover.s] ?? NaN)}</span>
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ direction: 'ltr' }} role="img">
        <line x1={0} x2={W} y1={zeroY} y2={zeroY} stroke="#cbd5e1" strokeWidth={1} />
        {groups.map((g, gi) => {
          // סדר כרונולוגי משמאל לימין (כמו בגרפי זמן)
          const x0 = gi * gw + (gw - bw * seriesNames.length - 2 * (seriesNames.length - 1)) / 2;
          return (
            <g key={g.label}>
              {g.values.map((v, si) => {
                if (v === null || !Number.isFinite(v)) return null;
                const h = Math.max(1, scale(v));
                const y = v >= 0 ? zeroY - h : zeroY;
                return (
                  <rect
                    key={si}
                    x={x0 + si * (bw + 2)}
                    y={y}
                    width={bw}
                    height={h}
                    rx={4}
                    fill={SERIES_COLORS[si]}
                    opacity={hover && (hover.g !== gi || hover.s !== si) ? 0.55 : 1}
                    onMouseEnter={() => setHover({ g: gi, s: si })}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => setHover({ g: gi, s: si })}
                  >
                    <title>{`${seriesNames[si]} ${g.label}: ${format(v)}`}</title>
                  </rect>
                );
              })}
              <text x={gi * gw + gw / 2} y={H - 4} textAnchor="middle" fontSize={11} fill="#52514e">
                {g.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** גרף רווח/הפסד של אופציה ביום הפקיעה */
export function PayoffChart({ right, strike, premium, spot, multiplier = 100, contracts = 1, format }: { right: 'call' | 'put'; strike: number; premium: number; spot: number; multiplier?: number; contracts?: number; format: (v: number) => string }) {
  const W = 320;
  const H = 160;
  const lo = Math.min(spot, strike) * 0.7;
  const hi = Math.max(spot, strike) * 1.3;
  const pts = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const S = lo + ((hi - lo) * i) / 60;
      const intrinsic = right === 'call' ? Math.max(0, S - strike) : Math.max(0, strike - S);
      out.push([S, (intrinsic - premium) * multiplier * contracts]);
    }
    return out;
  }, [lo, hi, right, strike, premium, multiplier, contracts]);
  const ys = pts.map((p) => p[1]);
  const ymax = Math.max(...ys, 1);
  const ymin = Math.min(...ys, -1);
  const X = (s: number) => ((s - lo) / (hi - lo)) * W;
  const Y = (v: number) => 8 + ((ymax - v) / (ymax - ymin)) * (H - 24);
  const be = right === 'call' ? strike + premium : strike - premium;
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ direction: 'ltr' }} role="img" aria-label="רווח והפסד ביום הפקיעה">
      <rect x={0} y={Y(0)} width={W} height={H - Y(0) - 16} fill="#fdecec" opacity={0.6} />
      <rect x={0} y={8} width={W} height={Math.max(0, Y(0) - 8)} fill="#e7f7e7" opacity={0.6} />
      <line x1={0} x2={W} y1={Y(0)} y2={Y(0)} stroke="#94a3b8" />
      <path d={path} fill="none" stroke="#2a78d6" strokeWidth={2.5} />
      <line x1={X(spot)} x2={X(spot)} y1={8} y2={H - 16} stroke="#eb6834" strokeDasharray="4 3" />
      <text x={X(spot)} y={H - 4} fontSize={10} textAnchor="middle" fill="#eb6834">
        היום {fmtNum(spot)}
      </text>
      {be > lo && be < hi && (
        <>
          <circle cx={X(be)} cy={Y(0)} r={4} fill="#6250d6" />
          <text x={X(be)} y={Y(0) - 8} fontSize={10} textAnchor="middle" fill="#6250d6">
            איזון {fmtNum(be)}
          </text>
        </>
      )}
      <text x={4} y={16} fontSize={10} fill="#0a7a0a">
        רווח
      </text>
      <text x={4} y={H - 20} fontSize={10} fill="#c22f2f">
        הפסד מקסימלי {format(premium * multiplier * contracts)}
      </text>
    </svg>
  );
}

export function RangeBar({ low, high, value, labelLow, labelHigh }: { low: number; high: number; value: number; labelLow: string; labelHigh: string }) {
  const pos = high > low ? (value - low) / (high - low) : 0.5;
  return (
    <div>
      <div className="relative h-2 rounded-full bg-gradient-to-l from-emerald-200 via-slate-200 to-rose-200" dir="ltr">
        <div className={clsx('absolute -top-1 w-4 h-4 rounded-full bg-brand-600 border-2 border-white shadow')} style={{ left: `calc(${Math.max(0, Math.min(1, pos)) * 100}% - 8px)` }} />
      </div>
      <div className="flex justify-between text-xs text-slate-500 mt-1" dir="ltr">
        <span className="num">{labelLow}</span>
        <span className="num">{labelHigh}</span>
      </div>
    </div>
  );
}
