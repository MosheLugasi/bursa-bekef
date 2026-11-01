import { useEffect, useMemo, useState } from 'react';
import type { Portfolio } from '@/engine/types';
import { useMarket } from '@/data/loader';
import { inst } from '@/engine/universe';
import { calcFee, executeBuy, executeSell, maxQtyForAmount, pendingBuyReserve, placeLimitOrder, setProtection, stockPosition, totalValue } from '@/engine/trading';
import { commitTrade } from '@/game/actions';
import { hasFeature } from '@/game/features';
import { useCurrentProfile } from '@/state/store';
import { useUI } from '@/state/ui';
import { Segmented, Sheet, Stepper, Term } from './components';
import { clsx, fmtMoney, fmtNum, fmtPrice } from './format';

export function TradeSheet({ p, instrumentId, side: initialSide, onClose }: { p: Portfolio; instrumentId: string; side: 'buy' | 'sell'; onClose: () => void }) {
  const market = useMarket();
  const profile = useCurrentProfile()!;
  const openCoach = useUI((s) => s.openCoach);
  const i = inst(instrumentId)!;
  const date = p.currentDate;
  const price = market.price(instrumentId, date);
  const pos = stockPosition(p, instrumentId);
  const [side, setSide] = useState<'buy' | 'sell'>(initialSide);
  const [type, setType] = useState<'market' | 'limit'>('market');
  const [qty, setQty] = useState(1);
  const [limit, setLimit] = useState(+(price * (initialSide === 'buy' ? 0.97 : 1.03)).toFixed(2));
  const [useSL, setUseSL] = useState(false);
  const [useTP, setUseTP] = useState(false);
  const [slPct, setSlPct] = useState(10);
  const [tpPct, setTpPct] = useState(20);
  const canLimit = hasFeature(profile, 'limit');
  const canSL = hasFeature(profile, 'stopLoss');
  const canTP = hasFeature(profile, 'takeProfit');
  const fx = market.fx(i.currency, p.baseCurrency, date);
  const portfolioValue = useMemo(() => totalValue(p, market), [p, market]);
  const available = p.cash - pendingBuyReserve(p, market);
  const pendingSell = p.orders.filter((o) => o.side === 'sell' && o.instrumentId === instrumentId).reduce((a, o) => a + o.qty, 0);
  const maxSell = Math.max(0, (pos?.qty ?? 0) - pendingSell);
  const execPrice = type === 'limit' ? limit : price;
  const maxBuy = useMemo(() => maxQtyForAmount({ ...p, cash: Math.max(0, available) }, market, instrumentId, Math.max(0, available)), [p, market, instrumentId, available]);

  useEffect(() => {
    if (side === 'sell') setQty(Math.max(1, Math.min(qty, maxSell)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side]);
  useEffect(() => {
    if (!profile.seenCoach[side]) openCoach(side);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side]);

  const notional = execPrice * qty;
  const fee = calcFee(p, notional);
  const totalBase = (side === 'buy' ? notional + fee : notional - fee) * fx;
  const share = portfolioValue > 0 ? ((pos?.qty ?? 0) * price * fx + (side === 'buy' ? notional * fx : -notional * fx)) / portfolioValue : 0;
  const warnings: string[] = [];
  if (side === 'buy' && share > 0.3) warnings.push(`🥚 אחרי הקנייה ${Math.round(share * 100)}% מהתיק יהיה בחברה אחת. זה הרבה ביצים בסל אחד – שקלו [[diversification|פיזור]].`);
  if (notional > 0 && fee / notional > 0.01) warnings.push(`🧾 העמלה היא ${fmtNum((fee / notional) * 100, 1)}% מהעסקה – בעסקאות קטנות העמלה "אוכלת" חלק גדול מהרווח.`);
  if (side === 'buy' && totalBase > available + 1e-6) warnings.push('💸 אין מספיק מזומן פנוי לעסקה הזו.');
  if (side === 'sell' && pos && execPrice * (1 - p.settings.feeRate) < pos.avgCost) warnings.push('📉 מכירה במחיר הזה היא בהפסד ביחס למחיר שקניתם. זה בסדר לפעמים – רק שיהיה מתוך החלטה ולא מתוך [[panic-selling|פאניקה]].');

  const submit = () => {
    if (type === 'limit') {
      const r = placeLimitOrder(p, market, { side, instrumentId, qty, limitPrice: limit });
      if (commitTrade(r, `פקודת ${side === 'buy' ? 'קנייה' : 'מכירה'} נשלחה וממתינה למחיר ${fmtPrice(limit, i.currency)} 🎯`)) onClose();
      return;
    }
    if (side === 'buy') {
      const r = executeBuy(p, market, instrumentId, qty);
      if (r.ok && (useSL || useTP)) {
        const pr = setProtection(r.value.portfolio, market, instrumentId, useSL ? +(price * (1 - slPct / 100)).toFixed(2) : undefined, useTP ? +(price * (1 + tpPct / 100)).toFixed(2) : undefined);
        if (pr.ok) r.value.portfolio = pr.value;
      }
      if (commitTrade(r, `קניתם ${qty} מניות ${i.nameHe} 🎉`)) onClose();
    } else {
      const r = executeSell(p, market, instrumentId, qty);
      if (commitTrade(r, `מכרתם ${qty} מניות ${i.nameHe}`)) onClose();
    }
  };

  const disabled = qty <= 0 || (side === 'buy' ? totalBase > available + 1e-6 : qty > maxSell) || (type === 'limit' && !(limit > 0));

  return (
    <Sheet open onClose={onClose} title={<span>{i.emoji} {i.nameHe}</span>}>
      <div className="space-y-4">
        <Segmented
          value={side}
          onChange={setSide}
          options={[
            { value: 'buy', label: '🛒 קנייה' },
            { value: 'sell', label: `💸 מכירה${pos ? ` (${pos.qty})` : ''}` }
          ]}
        />
        {side === 'sell' && !pos ? (
          <div className="text-center text-slate-500 py-6">אין לכם מניות של {i.nameHe} בתיק הזה.</div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">
                <Term id="share-price">מחיר אחרון</Term>
              </span>
              <span className="font-bold num text-lg">{fmtPrice(price, i.currency)}</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-600 mb-1">איך לבצע?</div>
              <Segmented
                value={type}
                onChange={(v) => {
                  if (v === 'limit' && !canLimit) return;
                  if (v === 'limit' && !profile.seenCoach.limit) openCoach('limit');
                  setType(v);
                }}
                options={[
                  { value: 'market', label: '⚡ עכשיו (מחיר שוק)' },
                  { value: 'limit', label: canLimit ? '🎯 במחיר שאבחר (לימיט)' : '🔒 לימיט' }
                ]}
              />
              {!canLimit && <div className="text-xs text-slate-500 mt-1">🔒 פקודות לימיט נפתחות אחרי השיעור "סוגי פקודות" באקדמיה.</div>}
            </div>
            {type === 'limit' && (
              <label className="block">
                <span className="text-sm font-semibold text-slate-600">
                  {side === 'buy' ? 'לקנות רק אם המחיר יירד ל- (או פחות)' : 'למכור רק אם המחיר יעלה ל- (או יותר)'}
                </span>
                <input className="input mt-1 num" inputMode="decimal" value={limit} onChange={(e) => setLimit(Number(e.target.value.replace(/[^\d.]/g, '')) || 0)} />
                <span className="text-xs text-slate-500">
                  {fmtNum(((limit / price - 1) * 100), 1)}% מהמחיר הנוכחי. ה<Term id="pending-order">פקודה ממתינה</Term> עד שהמחיר מגיע (נבדק בכל יום מסחר).
                </span>
              </label>
            )}
            <div>
              <div className="text-sm font-semibold text-slate-600 mb-1">כמה מניות?</div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Stepper value={qty} onChange={setQty} min={1} max={side === 'buy' ? Math.max(1, maxBuy) : Math.max(1, maxSell)} />
                <div className="flex gap-1">
                  {(side === 'buy' ? [0.1, 0.25, 0.5, 1] : [0.25, 0.5, 1]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      className="chip"
                      onClick={() => setQty(Math.max(1, side === 'buy' ? maxQtyForAmount({ ...p, cash: available }, market, instrumentId, available * f) : Math.floor(maxSell * f)))}
                    >
                      {f === 1 ? 'מקסימום' : `${f * 100}%`}
                    </button>
                  ))}
                </div>
              </div>
              {side === 'buy' && <div className="text-xs text-slate-500 mt-1">מזומן פנוי: <span className="num">{fmtMoney(available, p.baseCurrency)}</span> · אפשר לקנות עד {maxBuy} מניות</div>}
            </div>
            {side === 'buy' && type === 'market' && (
              <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="text-sm font-semibold">🛡️ הגנה אוטומטית (לא חובה)</div>
                <label className={clsx('flex items-center gap-2 text-sm', !canSL && 'opacity-50')}>
                  <input type="checkbox" disabled={!canSL} checked={useSL} onChange={(e) => { setUseSL(e.target.checked); if (e.target.checked && !profile.seenCoach.stopLoss) openCoach('stopLoss'); }} className="w-5 h-5" />
                  <Term id="stop-loss">סטופ לוס</Term>: למכור אם יירד
                  <input className="input w-16 py-1 text-center num" value={slPct} disabled={!useSL} onChange={(e) => setSlPct(Math.min(90, Number(e.target.value.replace(/\D/g, '')) || 0))} />%
                  {useSL && <span className="num text-slate-500">({fmtPrice(price * (1 - slPct / 100), i.currency)})</span>}
                </label>
                <label className={clsx('flex items-center gap-2 text-sm', !canTP && 'opacity-50')}>
                  <input type="checkbox" disabled={!canTP} checked={useTP} onChange={(e) => { setUseTP(e.target.checked); if (e.target.checked && !profile.seenCoach.takeProfit) openCoach('takeProfit'); }} className="w-5 h-5" />
                  <Term id="take-profit">טייק פרופיט</Term>: למכור אם יעלה
                  <input className="input w-16 py-1 text-center num" value={tpPct} disabled={!useTP} onChange={(e) => setTpPct(Math.min(500, Number(e.target.value.replace(/\D/g, '')) || 0))} />%
                  {useTP && <span className="num text-slate-500">({fmtPrice(price * (1 + tpPct / 100), i.currency)})</span>}
                </label>
                {(!canSL || !canTP) && <div className="text-xs text-slate-500">🔒 נפתח אחרי השיעור "סטופ לוס וטייק פרופיט".</div>}
              </div>
            )}
            <div className="rounded-xl bg-slate-50 p-3 text-sm space-y-1.5">
              <Row label={`${qty} × ${fmtPrice(execPrice, i.currency)}`} value={fmtMoney(notional, i.currency, 2)} />
              <Row label={<Term id="fee">עמלה</Term>} value={fmtMoney(fee, i.currency, 2)} />
              {i.currency !== p.baseCurrency && <Row label={<Term id="usd-ils">שער המרה</Term>} value={`1 ${i.currency === 'USD' ? '$' : '₪'} = ${fmtNum(fx, 3)} ${p.baseCurrency === 'ILS' ? '₪' : '$'}`} />}
              <div className="border-t border-slate-200 pt-1.5">
                <Row label={<strong>{side === 'buy' ? 'סה״כ לתשלום' : 'סה״כ תקבלו'}</strong>} value={<strong>{fmtMoney(totalBase, p.baseCurrency, 2)}</strong>} />
              </div>
              {type === 'limit' && <div className="text-xs text-slate-500">* בפקודת לימיט הסכום הסופי תלוי במחיר הביצוע בפועל.</div>}
            </div>
            {warnings.map((w) => (
              <WarningText key={w} text={w} />
            ))}
            <button className={clsx('w-full text-lg', side === 'buy' ? 'btn-buy' : 'btn-sell')} disabled={disabled} onClick={submit}>
              {type === 'limit' ? '🎯 שליחת פקודה' : side === 'buy' ? `🛒 קנייה של ${qty} מניות` : `💸 מכירה של ${qty} מניות`}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}

import { RichText } from './components';
function WarningText({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm p-3">
      <RichText text={text} />
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-600">{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}

export function ProtectionSheet({ p, instrumentId, onClose }: { p: Portfolio; instrumentId: string; onClose: () => void }) {
  const market = useMarket();
  const profile = useCurrentProfile()!;
  const pos = stockPosition(p, instrumentId)!;
  const i = inst(instrumentId)!;
  const price = market.price(instrumentId, p.currentDate);
  const [sl, setSl] = useState(pos.stopLoss ? String(pos.stopLoss) : '');
  const [tp, setTp] = useState(pos.takeProfit ? String(pos.takeProfit) : '');
  const canSL = hasFeature(profile, 'stopLoss');
  const canTP = hasFeature(profile, 'takeProfit');
  return (
    <Sheet open onClose={onClose} title="🛡️ הגנה על המניות">
      <div className="space-y-3">
        <div className="text-sm text-slate-600">
          מחיר נוכחי: <span className="num font-bold">{fmtPrice(price, i.currency)}</span> · מחיר קנייה ממוצע: <span className="num">{fmtPrice(pos.avgCost, i.currency)}</span>
        </div>
        <label className={clsx('block', !canSL && 'opacity-50')}>
          <span className="text-sm font-semibold"><Term id="stop-loss">סטופ לוס</Term> – למכור הכל אם המחיר יירד אל (ריק = בלי)</span>
          <input className="input mt-1 num" disabled={!canSL} inputMode="decimal" value={sl} onChange={(e) => setSl(e.target.value.replace(/[^\d.]/g, ''))} placeholder={fmtNum(price * 0.9)} />
        </label>
        <label className={clsx('block', !canTP && 'opacity-50')}>
          <span className="text-sm font-semibold"><Term id="take-profit">טייק פרופיט</Term> – למכור הכל אם המחיר יעלה אל (ריק = בלי)</span>
          <input className="input mt-1 num" disabled={!canTP} inputMode="decimal" value={tp} onChange={(e) => setTp(e.target.value.replace(/[^\d.]/g, ''))} placeholder={fmtNum(price * 1.2)} />
        </label>
        <button
          className="btn-primary w-full"
          onClick={() => {
            const r = setProtection(p, market, instrumentId, sl ? Number(sl) : undefined, tp ? Number(tp) : undefined);
            if (commitTrade(r, 'ההגנה עודכנה 🛡️')) onClose();
          }}
        >
          שמירה
        </button>
      </div>
    </Sheet>
  );
}
