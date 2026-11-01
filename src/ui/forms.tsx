import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AgeGroup, Profile } from '@/state/types';
import { hashPin, useGame } from '@/state/store';
import { CHALLENGES } from '@/game/challenges';
import { useMarket } from '@/data/loader';
import { addDays, formatDateHe } from '@/engine/dates';
import { Segmented, Sheet } from './components';
import { clsx, fmtMoney } from './format';

export const AVATARS = ['🦁', '🐯', '🐻', '🐼', '🦊', '🐸', '🐵', '🦄', '🐲', '🐙', '🦖', '🐧', '🐨', '🐰', '🦉', '🐬', '🚀', '⚽', '🎸', '👑', '🧙', '🦸', '👩', '👨', '👧', '👦', '👵', '👴'];
export const COLORS = ['#4f46e5', '#2a78d6', '#1baf7a', '#eb6834', '#e87ba4', '#6250d6', '#eda100', '#e34948', '#0f766e', '#475569'];
export const PORTFOLIO_EMOJIS = ['💼', '🚀', '🐂', '💎', '🌱', '🏆', '🦄', '🔥', '🌍', '🎯', '🍀', '⭐'];

export const AGE_LABEL: Record<AgeGroup, string> = { kid: '🧒 ילד/ה (7-10)', teen: '🧑 נער/ה (11-15)', adult: '🧔 מבוגר/ת' };

export interface ProfileDraft {
  name: string;
  avatar: string;
  color: string;
  ageGroup: AgeGroup;
  pin: string;
  unlockAll?: boolean;
}

export function ProfileForm({ initial, onSave, onCancel, saveLabel = 'שמירה', showUnlock }: { initial?: Partial<Profile>; onSave: (d: ProfileDraft) => void; onCancel?: () => void; saveLabel?: string; showUnlock?: boolean }) {
  const [d, setD] = useState<ProfileDraft>({
    name: initial?.name ?? '',
    avatar: initial?.avatar ?? AVATARS[Math.floor(Math.random() * 16)],
    color: initial?.color ?? COLORS[Math.floor(Math.random() * COLORS.length)],
    ageGroup: initial?.ageGroup ?? 'kid',
    pin: '',
    unlockAll: initial?.unlockAll
  });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (d.name.trim()) onSave(d);
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-full grid place-items-center text-4xl border-4 shrink-0" style={{ borderColor: d.color, background: d.color + '22' }}>
          {d.avatar}
        </div>
        <label className="flex-1">
          <span className="text-sm font-semibold text-slate-600">שם</span>
          <input className="input mt-1" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="למשל: נועה" maxLength={20} autoFocus />
        </label>
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-600 mb-1">דמות</div>
        <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5">
          {AVATARS.map((a) => (
            <button type="button" key={a} onClick={() => setD({ ...d, avatar: a })} className={clsx('h-10 rounded-xl text-2xl', d.avatar === a ? 'bg-brand-100 ring-2 ring-brand-500' : 'bg-slate-50 hover:bg-slate-100')}>
              {a}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-600 mb-1">צבע</div>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button type="button" key={c} onClick={() => setD({ ...d, color: c })} className={clsx('w-8 h-8 rounded-full', d.color === c && 'ring-4 ring-offset-2 ring-slate-300')} style={{ background: c }} aria-label={c} />
          ))}
        </div>
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-600 mb-1">גיל (קובע את רמת ההסברים ואילו יכולות פתוחות מההתחלה)</div>
        <Segmented value={d.ageGroup} onChange={(v) => setD({ ...d, ageGroup: v })} options={(Object.keys(AGE_LABEL) as AgeGroup[]).map((k) => ({ value: k, label: AGE_LABEL[k] }))} />
      </div>
      <label className="block">
        <span className="text-sm font-semibold text-slate-600">קוד PIN אישי (לא חובה, 4 ספרות)</span>
        <input className="input mt-1 num text-center tracking-[0.5em]" inputMode="numeric" maxLength={4} value={d.pin} onChange={(e) => setD({ ...d, pin: e.target.value.replace(/\D/g, '') })} placeholder={initial?.pinHash ? 'השאירו ריק כדי לא לשנות' : '••••'} />
      </label>
      {showUnlock && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={!!d.unlockAll} onChange={(e) => setD({ ...d, unlockAll: e.target.checked })} className="w-5 h-5" />
          <span>לפתוח את כל היכולות (אופציות, אג״ח, לימיט...) בלי לחכות לשיעורים</span>
        </label>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={!d.name.trim()}>
          {saveLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            ביטול
          </button>
        )}
      </div>
    </form>
  );
}

export function PinPad({ title, onSubmit, onCancel, error }: { title: string; onSubmit: (pin: string) => void; onCancel: () => void; error?: string }) {
  const [pin, setPin] = useState('');
  const press = (k: string) => {
    const next = (pin + k).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      onSubmit(next);
      setTimeout(() => setPin(''), 150);
    }
  };
  return (
    <Sheet open onClose={onCancel} title={title}>
      <div className="flex justify-center gap-3 my-3" dir="ltr">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={clsx('w-4 h-4 rounded-full', i < pin.length ? 'bg-brand-600' : 'bg-slate-200')} />
        ))}
      </div>
      {error && <div className="text-center text-down font-semibold mb-2">{error}</div>}
      <div className="grid grid-cols-3 gap-2 max-w-64 mx-auto" dir="ltr">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k) =>
          k === '' ? (
            <span key="empty" />
          ) : (
            <button key={k} type="button" className="h-14 rounded-2xl bg-slate-100 text-2xl font-bold hover:bg-slate-200 active:scale-95" onClick={() => (k === '⌫' ? setPin(pin.slice(0, -1)) : press(k))}>
              {k}
            </button>
          )
        )}
      </div>
    </Sheet>
  );
}

export function checkPin(pin: string, hash?: string): boolean {
  return !hash || hashPin(pin) === hash;
}

export function NewPortfolioSheet({ ownerId, onClose, stay }: { ownerId: string; onClose: () => void; stay?: boolean }) {
  const market = useMarket();
  const settings = useGame((s) => s.settings);
  const owner = useGame((s) => s.profiles[ownerId]);
  const addPortfolio = useGame((s) => s.addPortfolio);
  const nav = useNavigate();
  const [mode, setMode] = useState<'live' | 'history'>('live');
  const [challengeId, setChallengeId] = useState(CHALLENGES[1].id);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(PORTFOLIO_EMOJIS[0]);
  const [cur, setCur] = useState<'ILS' | 'USD'>(settings.defaultCurrency);
  const [cash, setCash] = useState(settings.defaultStartCash);
  const [fees, setFees] = useState(true);
  const ch = CHALLENGES.find((c) => c.id === challengeId)!;
  const create = () => {
    const start = mode === 'live' ? market.asOf : market.nextDate(addDays(ch.start, -1));
    const end = mode === 'history' && ch.end ? market.snap(ch.end) : undefined;
    const id = addPortfolio({
      ownerId,
      name: name || (mode === 'live' ? `התיק של ${owner?.name ?? ''}` : `${ch.emoji} ${ch.title}`),
      emoji,
      color: owner?.color ?? '#4f46e5',
      mode,
      challengeId: mode === 'history' ? challengeId : undefined,
      startDate: start,
      endDate: end,
      baseCurrency: cur,
      startCash: cash,
      fees
    });
    onClose();
    if (!stay) nav('/portfolio');
    return id;
  };
  return (
    <Sheet open onClose={onClose} title="✨ תיק השקעות חדש" wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setMode('live')} className={clsx('rounded-2xl border-2 p-3 text-right', mode === 'live' ? 'border-brand-500 bg-brand-50' : 'border-slate-200')}>
            <div className="text-3xl">📡</div>
            <div className="font-bold">שוק חי</div>
            <div className="text-xs text-slate-600">מחירים אמיתיים מהימים האחרונים, מתעדכן כל יום. סבלנות!</div>
          </button>
          <button type="button" onClick={() => setMode('history')} className={clsx('rounded-2xl border-2 p-3 text-right', mode === 'history' ? 'border-brand-500 bg-brand-50' : 'border-slate-200')}>
            <div className="text-3xl">⏰</div>
            <div className="font-bold">מכונת הזמן</div>
            <div className="text-xs text-slate-600">מתחילים בעבר ומתקדמים בזמן בקצב שלכם – עם היסטוריה אמיתית.</div>
          </button>
        </div>
        {mode === 'history' && (
          <div className="space-y-2">
            <div className="text-sm font-semibold text-slate-600">בחרו אתגר</div>
            {CHALLENGES.map((c) => (
              <button type="button" key={c.id} onClick={() => setChallengeId(c.id)} className={clsx('w-full rounded-xl border-2 p-3 text-right flex gap-3', challengeId === c.id ? 'border-brand-500 bg-brand-50' : 'border-slate-100 bg-white')}>
                <span className="text-3xl">{c.emoji}</span>
                <span className="flex-1">
                  <span className="font-bold block">
                    {c.title} <span className="text-xs text-slate-500 font-normal">{'⭐'.repeat(c.difficulty)}</span>
                  </span>
                  <span className="text-xs text-slate-500 block">
                    {formatDateHe(c.start)} {c.end ? `← ${formatDateHe(c.end)}` : '← היום'}
                  </span>
                  <span className="text-sm text-slate-700 block mt-1">{owner?.ageGroup === 'adult' ? c.adult : c.kid}</span>
                </span>
              </button>
            ))}
          </div>
        )}
        <label className="block">
          <span className="text-sm font-semibold text-slate-600">שם התיק</span>
          <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder={mode === 'live' ? 'למשל: התיק של יואב' : ch.title} maxLength={30} />
        </label>
        <div className="flex gap-1.5 flex-wrap">
          {PORTFOLIO_EMOJIS.map((e) => (
            <button type="button" key={e} onClick={() => setEmoji(e)} className={clsx('w-10 h-10 rounded-xl text-2xl', emoji === e ? 'bg-brand-100 ring-2 ring-brand-500' : 'bg-slate-50')}>
              {e}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="text-sm font-semibold text-slate-600">מטבע התיק</span>
            <Segmented value={cur} onChange={setCur} options={[{ value: 'ILS', label: '₪ שקל' }, { value: 'USD', label: '$ דולר' }]} className="mt-1" />
          </label>
          <label>
            <span className="text-sm font-semibold text-slate-600">סכום התחלתי</span>
            <select className="input mt-1" value={cash} onChange={(e) => setCash(Number(e.target.value))}>
              {[10_000, 25_000, 50_000, 100_000, 250_000, 1_000_000].map((v) => (
                <option key={v} value={v}>
                  {fmtMoney(v, cur)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="w-5 h-5" checked={fees} onChange={(e) => setFees(e.target.checked)} />
          <span>עמלות מסחר כמו במציאות (מומלץ – מלמד לא לקנות ולמכור כל רגע)</span>
        </label>
        <button className="btn-primary w-full text-lg" onClick={create}>
          יוצאים לדרך! 🚀
        </button>
      </div>
    </Sheet>
  );
}
