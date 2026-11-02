import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useActivePortfolio, useCurrentProfile } from '@/state/store';
import { useMarket } from '@/data/loader';
import { INSTRUMENTS, SECTORS, type Instrument } from '@/engine/universe';
import { formatDateHe } from '@/engine/dates';
import { Change, HelpButton, Segmented, Sparkline, useCoachOnce } from '@/ui/components';
import { clsx, fmtPrice } from '@/ui/format';

type Tab = 'IL' | 'US' | 'funds' | 'watch';

export default function Market() {
  const market = useMarket();
  const p = useActivePortfolio();
  const profile = useCurrentProfile()!;
  const date = p?.currentDate ?? market.asOf;
  const [tab, setTab] = useState<Tab>('IL');
  const [q, setQ] = useState('');
  const [sector, setSector] = useState<string>('');
  const history = p?.mode === 'history';
  // במכונת הזמן הדירוג הנוכחי לפי גודל הוא "מידע מהעתיד" – ממיינים לפי א-ב ולא מציגים דירוג
  const [sort, setSort] = useState<'default' | 'up' | 'down' | 'name'>(history ? 'name' : 'default');
  const [familiar, setFamiliar] = useState(false);
  useCoachOnce('market');

  const rows = useMemo(() => {
    let list: Instrument[] = INSTRUMENTS;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((i) => i.nameHe.includes(q.trim()) || i.nameEn.toLowerCase().includes(s) || i.id.toLowerCase().includes(s));
    } else if (tab === 'watch') list = list.filter((i) => profile.watchlist.includes(i.id));
    else if (tab === 'funds') list = list.filter((i) => i.type !== 'stock');
    else list = list.filter((i) => i.type === 'stock' && i.market === tab);
    if (sector) list = list.filter((i) => i.sector === sector);
    if (familiar) list = list.filter((i) => i.core || i.type !== 'stock');
    const out = list.map((i) => {
      const avail = market.available(i.id, date);
      return { i, avail, price: avail ? market.price(i.id, date) : NaN, ch: avail ? market.dayChange(i.id, date) : NaN, spark: avail ? market.spark(i.id, date, 30) : [] };
    });
    if (sort === 'default') out.sort((a, b) => (a.i.rank ?? 999) - (b.i.rank ?? 999));
    if (sort === 'up') out.sort((a, b) => (b.ch || -9) - (a.ch || -9));
    if (sort === 'down') out.sort((a, b) => (a.ch || 9) - (b.ch || 9));
    if (sort === 'name') out.sort((a, b) => a.i.nameHe.localeCompare(b.i.nameHe, 'he'));
    return out;
  }, [q, tab, sector, sort, familiar, market, date, profile.watchlist]);

  const sectors = useMemo(() => {
    const ids = new Set(INSTRUMENTS.filter((i) => (tab === 'funds' ? i.type !== 'stock' : tab === 'watch' ? true : i.type === 'stock' && i.market === tab)).map((i) => i.sector));
    return [...ids];
  }, [tab]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">📈 השוק</h1>
          <div className="text-sm text-slate-500">מחירים נכונים ל{formatDateHe(market.snap(date), { weekday: true })}</div>
        </div>
        <HelpButton coachKey="market" />
      </div>
      <input className="input" placeholder="🔍 חיפוש חברה (למשל: אפל, טבע, NVDA)" value={q} onChange={(e) => setQ(e.target.value)} />
      <Segmented
        value={tab}
        onChange={(v) => {
          setTab(v);
          setSector('');
        }}
        options={[
          { value: 'IL', label: '🇮🇱 ישראל' },
          { value: 'US', label: '🇺🇸 ארה״ב' },
          { value: 'funds', label: '🧺 קרנות' },
          { value: 'watch', label: '⭐ שלי' }
        ]}
      />
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {tab !== 'funds' && (
          <button className={clsx('chip', familiar && 'chip-on')} onClick={() => setFamiliar(!familiar)} title="חברות שילדים מכירים">
            🧒 מוכרות
          </button>
        )}
        <button className={clsx('chip', !sector && 'chip-on')} onClick={() => setSector('')}>
          הכל
        </button>
        {sectors.map((s) => (
          <button key={s} className={clsx('chip', sector === s && 'chip-on')} onClick={() => setSector(s)}>
            {SECTORS[s]?.emoji} {SECTORS[s]?.nameHe}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">מיון:</span>
        {(
          [
            ['default', 'הגדולות קודם'],
            ['up', '▲ עלו הכי הרבה'],
            ['down', '▼ ירדו הכי הרבה'],
            ['name', 'א-ב']
          ] as const
        ).filter(([k]) => !(history && k === 'default')).map(([k, l]) => (
          <button key={k} onClick={() => setSort(k)} className={clsx('rounded-lg px-2 py-1', sort === k ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100')}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'funds' && !q && (
        <Link to="/bonds" className="card p-3 flex items-center gap-3 bg-sky-50/60 hover:shadow-md">
          <span className="text-3xl">📜</span>
          <span className="flex-1">
            <span className="font-bold block">אג״ח – להלוות כסף ולקבל ריבית</span>
            <span className="text-sm text-slate-600">אג״ח ממשלתיות וקונצרניות מישראל ומארה״ב</span>
          </span>
          <span>←</span>
        </Link>
      )}
      {tab === 'watch' && !rows.length && <div className="text-center text-slate-500 py-8">עוד לא סימנתם מניות ב-⭐. היכנסו לדף של חברה ולחצו על הכוכב.</div>}
      <div className="card divide-y divide-slate-100 overflow-hidden">
        {rows.map(({ i, avail, price, ch, spark }) => (
          <Link key={i.id} to={`/asset/${encodeURIComponent(i.id)}`} className={clsx('flex items-center gap-3 px-3 py-3 hover:bg-slate-50', !avail && 'opacity-50')}>
            <span className="text-3xl w-10 text-center">{i.emoji}</span>
            <span className="flex-1 min-w-0">
              <span className="block font-bold truncate">
                {i.nameHe} {i.israeli && <span title="חברה ישראלית">🇮🇱</span>}
              </span>
              <span className="block text-xs text-slate-500 truncate">
                {i.rank && !history && <span className="text-slate-400">#{i.rank} · </span>}
                <span dir="ltr">{i.id.replace('.TA', '')}</span> · {SECTORS[i.sector]?.nameHe}
              </span>
            </span>
            {avail ? (
              <>
                <Sparkline values={spark} width={70} height={28} className="hidden xs:block sm:block" />
                <span className="text-left w-24">
                  <span className="block font-semibold num">{fmtPrice(price, i.currency)}</span>
                  <Change value={ch} />
                </span>
              </>
            ) : (
              <span className="text-xs text-slate-500">עוד לא בבורסה</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
