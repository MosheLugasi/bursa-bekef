import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useActivePortfolio, useCurrentProfile } from '@/state/store';
import { useMarket } from '@/data/loader';
import { BOND_FACE, BOND_PRODUCTS, bondPricePer100, bondsAvailable, couponDates, curveYield, macaulayDuration, quoteNewBond, type BondProduct } from '@/engine/finance';
import { buyBond, calcFee } from '@/engine/trading';
import { formatDateHe } from '@/engine/dates';
import { INSTRUMENTS } from '@/engine/universe';
import { hasFeature } from '@/game/features';
import { commitTrade } from '@/game/actions';
import { Empty, HelpButton, Locked, SectionTitle, Sheet, Stepper, Term, useCoachOnce } from '@/ui/components';
import { clsx, fmtMoney, fmtNum, fmtPct } from '@/ui/format';

const RISK = ['', '🟢 נמוך מאוד', '🟢 נמוך', '🟡 בינוני', '🔴 גבוה'];

function BuyBond({ product, onClose }: { product: BondProduct; onClose: () => void }) {
  const market = useMarket();
  const p = useActivePortfolio()!;
  const [units, setUnits] = useState(1);
  const q = quoteNewBond(market, product, p.currentDate)!;
  const fx = market.fx(product.currency, p.baseCurrency, p.currentDate);
  const notional = (q.pricePer100 / 100) * BOND_FACE * units;
  const fee = calcFee(p, notional);
  const total = (notional + fee) * fx;
  const couponEach = (q.couponRate / 100 / product.freq) * BOND_FACE * units;
  const nCoupons = couponDates(p.currentDate, q.maturity, product.freq).length;
  const dur = macaulayDuration(q.couponRate, product.freq, p.currentDate, q.maturity, p.currentDate, q.yieldPct);
  const up1 = bondPricePer100(q.couponRate, product.freq, p.currentDate, q.maturity, p.currentDate, q.yieldPct + 1);
  const dn1 = bondPricePer100(q.couponRate, product.freq, p.currentDate, q.maturity, p.currentDate, Math.max(0.05, q.yieldPct - 1));
  const sym = product.currency === 'USD' ? '$' : '₪';
  return (
    <Sheet open onClose={onClose} title={<span>{product.emoji} {product.nameHe}</span>}>
      <div className="space-y-4">
        <p className="text-slate-700">{product.descHe}</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Info k={<Term id="coupon">ריבית שנתית (קופון)</Term>} v={`${fmtNum(q.couponRate, 3)}%`} />
          <Info k={<Term id="maturity">מועד פדיון</Term>} v={formatDateHe(q.maturity)} />
          <Info k={<Term id="face-value">ערך נקוב ליחידה</Term>} v={`${sym}${BOND_FACE.toLocaleString('he-IL')}`} />
          <Info k={<Term id="credit-rating">דירוג (להמחשה)</Term>} v={product.rating} />
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-600 mb-1">כמה יחידות?</div>
          <Stepper value={units} onChange={setUnits} min={1} max={1000} />
        </div>
        <div className="rounded-xl bg-sky-50 p-3 text-sm space-y-1">
          <div>
            💵 תקבלו ריבית של <strong className="num">{sym}{fmtNum(couponEach)}</strong> {product.freq === 2 ? 'כל חצי שנה' : 'כל שנה'} – {nCoupons} תשלומים.
          </div>
          <div>
            🏁 בסוף ({formatDateHe(q.maturity)}) יחזרו אליכם <strong className="num">{sym}{(BOND_FACE * units).toLocaleString('he-IL')}</strong>.
          </div>
          <div>
            🧮 סה״כ ריבית לאורך כל התקופה: <strong className="num">{sym}{fmtNum(couponEach * nCoupons)}</strong>
          </div>
        </div>
        <div className="rounded-xl bg-amber-50 p-3 text-sm">
          <div className="font-semibold mb-1">🎢 מה יקרה למחיר אם הריבית בשוק תשתנה מחר?</div>
          <div>
            ריבית תעלה ב-1% → מחיר האג״ח ירד ל-<span className="num font-bold">{fmtNum(up1)}</span> (<span className="text-down">{fmtPct(up1 / q.pricePer100 - 1)}</span>)
          </div>
          <div>
            ריבית תרד ב-1% → מחיר האג״ח יעלה ל-<span className="num font-bold">{fmtNum(dn1)}</span> (<span className="text-up">{fmtPct(dn1 / q.pricePer100 - 1)}</span>)
          </div>
          <div className="text-xs text-slate-600 mt-1">
            <Term id="duration">מח״מ</Term>: {fmtNum(dur, 1)} שנים – ככל שהוא ארוך יותר, האג״ח רגישה יותר לשינויי ריבית.
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>
            עלות כוללת (כולל <Term id="fee">עמלה</Term>)
          </span>
          <span className="font-bold num text-lg">{fmtMoney(total, p.baseCurrency, 2)}</span>
        </div>
        <button className="btn-buy w-full text-lg" disabled={total > p.cash} onClick={() => commitTrade(buyBond(p, market, product.id, units), `קניתם ${units} יח׳ ${product.nameHe} 📜`) && onClose()}>
          📜 קנייה
        </button>
        {total > p.cash && <div className="text-sm text-down text-center">אין מספיק מזומן</div>}
      </div>
    </Sheet>
  );
}

function Info({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2.5">
      <div className="text-xs text-slate-500">{k}</div>
      <div className="font-bold num">{v}</div>
    </div>
  );
}

export default function Bonds() {
  const market = useMarket();
  const profile = useCurrentProfile()!;
  const p = useActivePortfolio();
  const [sel, setSel] = useState<BondProduct | null>(null);
  const unlocked = hasFeature(profile, 'bonds');
  useCoachOnce('bonds', unlocked);
  if (!p) return <Empty emoji="💼" title="צריך קודם לפתוח תיק" />;
  const date = p.currentDate;
  const bondFunds = INSTRUMENTS.filter((i) => i.sector === 'bondfunds');
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">📜 אג״ח</h1>
        <HelpButton coachKey="bonds" />
      </div>
      <div className="card p-4 text-slate-700">
        <Term id="bond">אג״ח</Term> = הלוואה. אתם מלווים כסף לממשלה או לחברה, מקבלים <Term id="coupon">ריבית</Term> קבועה, ובסוף מקבלים את הכסף בחזרה. הריביות כאן מחושבות מ<Term id="ytm">תשואות</Term> אמיתיות של אג״ח ממשלתיות ביום {formatDateHe(market.snap(date))}.
        <div className="flex gap-3 mt-3 flex-wrap text-sm">
          {[
            ['🇺🇸 ריבית שנה בארה״ב', curveYield(market, 'US', 1, date)],
            ['🇺🇸 10 שנים בארה״ב', curveYield(market, 'US', 10, date)],
            ['🇮🇱 10 שנים בישראל', curveYield(market, 'IL', 10, date)]
          ].map(([l, v]) => (
            <span key={l as string} className="chip">
              {l as string}: <span className="num font-bold">{Number.isFinite(v as number) ? `${fmtNum(v as number, 2)}%` : '—'}</span>
            </span>
          ))}
        </div>
      </div>
      {!unlocked ? (
        <Locked feature="bonds" />
      ) : (
        <>
          <SectionTitle>🏛️ אג״ח חדשות להנפקה</SectionTitle>
          <div className="grid sm:grid-cols-2 gap-3">
            {BOND_PRODUCTS.map((b) => {
              const ok = bondsAvailable(market, b.curve, date);
              const q = ok ? quoteNewBond(market, b, date) : undefined;
              return (
                <button key={b.id} disabled={!q} onClick={() => setSel(b)} className={clsx('card p-4 text-right hover:shadow-md transition', !q && 'opacity-50')}>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{b.emoji}</span>
                    <span className="flex-1">
                      <span className="block font-bold">{b.nameHe}</span>
                      <span className="block text-xs text-slate-500">
                        {b.kind === 'government' ? 'ממשלתית' : 'של חברה (קונצרנית)'} · סיכון {RISK[b.risk]}
                      </span>
                    </span>
                    <span className="text-left">
                      <span className="block text-2xl font-extrabold text-brand-700 num">{q ? `${fmtNum(q.couponRate, 2)}%` : '—'}</span>
                      <span className="block text-xs text-slate-500">ריבית בשנה</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
      <SectionTitle>🧺 <Term id="bond-fund">קרנות אג״ח</Term> (נסחרות כמו מניה)</SectionTitle>
      <div className="card divide-y divide-slate-100">
        {bondFunds.map((i) => (
          <Link key={i.id} to={`/asset/${encodeURIComponent(i.id)}`} className="flex items-center gap-3 p-3 hover:bg-slate-50">
            <span className="text-2xl">{i.emoji}</span>
            <span className="flex-1 font-semibold">{i.nameHe}</span>
            <span dir="ltr" className="text-sm text-slate-500">
              {i.id}
            </span>
          </Link>
        ))}
      </div>
      {sel && <BuyBond product={sel} onClose={() => setSel(null)} />}
    </div>
  );
}
