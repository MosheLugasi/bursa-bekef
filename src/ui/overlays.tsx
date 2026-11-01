import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUI } from '@/state/ui';
import { useCurrentProfile, useGame } from '@/state/store';
import { TERMS, eventsBetween } from '@/content';
import { COACH } from '@/game/coach';
import { ACH_BY_ID } from '@/game/achievements';
import { LEVELS } from '@/game/xp';
import { markCoachSeen, markTermRead } from '@/game/actions';
import { formatDateHe } from '@/engine/dates';
import { RichText, Sheet, Segmented, Change } from './components';
import { clsx, fmtMoney } from './format';

export function GlossarySheet() {
  const id = useUI((s) => s.term);
  const open = useUI((s) => s.openTerm);
  const profile = useCurrentProfile();
  const [tab, setTab] = useState<'kid' | 'adult'>('kid');
  useEffect(() => {
    if (id && profile) {
      setTab(profile.ageGroup === 'adult' ? 'adult' : 'kid');
      markTermRead(profile.id, id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const t = id ? TERMS[id] : undefined;
  return (
    <Sheet open={!!t} onClose={() => open(undefined)} title={<span>📖 {t?.term}</span>}>
      {t && (
        <div className="space-y-3">
          {t.en && <div className="text-sm text-slate-500" dir="ltr">{t.en}</div>}
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'kid', label: '🧒 בקצרה' },
              { value: 'adult', label: '🧑 הסבר מלא' }
            ]}
          />
          <div className="text-lg leading-relaxed">
            <RichText text={tab === 'kid' ? t.kid : t.adult} />
          </div>
          {t.example && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
              <div className="font-semibold mb-1">💡 דוגמה</div>
              <RichText text={t.example} />
            </div>
          )}
          {t.related && t.related.length > 0 && (
            <div>
              <div className="text-sm text-slate-500 mb-1">מושגים קשורים:</div>
              <div className="flex flex-wrap gap-2">
                {t.related
                  .filter((r) => TERMS[r])
                  .map((r) => (
                    <button key={r} className="chip hover:bg-brand-50" onClick={() => open(r)}>
                      {TERMS[r].term}
                    </button>
                  ))}
              </div>
            </div>
          )}
          <Link to="/glossary" className="block text-center text-brand-700 font-semibold pt-2" onClick={() => open(undefined)}>
            לכל המילון 📚
          </Link>
        </div>
      )}
    </Sheet>
  );
}

export function CoachModal() {
  const key = useUI((s) => s.coach);
  const openCoach = useUI((s) => s.openCoach);
  const profile = useCurrentProfile();
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [key]);
  const steps = key ? COACH[key] : undefined;
  if (!steps || !key) return null;
  const s = steps[step];
  const close = () => {
    if (profile) markCoachSeen(profile.id, key);
    openCoach(undefined);
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/50 p-3 animate-fadein">
      <div className="w-full sm:max-w-md bg-white rounded-3xl shadow-2xl p-5 animate-pop safe-bottom">
        <div className="flex items-start gap-3">
          <div className="text-5xl shrink-0">{s.emoji}</div>
          <div className="flex-1">
            <div className="text-xs font-semibold text-brand-600 mb-0.5">🐂 שורי מסביר · {step + 1}/{steps.length}</div>
            <div className="text-xl font-bold mb-1">{s.title}</div>
            <div className="text-base leading-relaxed text-slate-700">
              <RichText text={s.text} />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          <button className="btn-ghost text-sm" onClick={close}>
            דלג
          </button>
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <span key={i} className={clsx('w-2 h-2 rounded-full', i === step ? 'bg-brand-600' : 'bg-slate-200')} />
            ))}
          </div>
          {step < steps.length - 1 ? (
            <button className="btn-primary" onClick={() => setStep(step + 1)}>
              הבא ←
            </button>
          ) : (
            <button className="btn-primary" onClick={close}>
              הבנתי! 👍
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);
  return (
    <div className="fixed top-3 inset-x-0 z-[70] flex flex-col items-center gap-2 pointer-events-none px-3">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={clsx(
            'pointer-events-auto animate-pop rounded-2xl px-4 py-2.5 shadow-lg text-sm font-semibold max-w-md flex items-center gap-2',
            t.kind === 'good' && 'bg-emerald-600 text-white',
            t.kind === 'bad' && 'bg-rose-600 text-white',
            t.kind === 'xp' && 'bg-amber-400 text-amber-950',
            t.kind === 'info' && 'bg-slate-800 text-white'
          )}
        >
          <span>{t.emoji}</span>
          <span>{t.text}</span>
        </button>
      ))}
    </div>
  );
}

export function Celebrations() {
  const c = useUI((s) => s.celebrations[0]);
  const pop = useUI((s) => s.popCelebration);
  const coach = useUI((s) => s.coach);
  if (!c || coach) return null;
  let emoji = '🎉';
  let title = '';
  let text = '';
  if (c.type === 'achievement') {
    const a = ACH_BY_ID.get(c.id);
    emoji = a?.emoji ?? '🏅';
    title = 'הישג חדש!';
    text = `${a?.title ?? ''} – ${a?.desc ?? ''} (+${a?.xp ?? 0} XP)`;
  } else if (c.type === 'level') {
    const l = LEVELS.find((x) => x.level === c.level);
    emoji = l?.emoji ?? '⭐';
    title = `עליתם לרמה ${c.level}!`;
    text = `התואר החדש שלכם: ${l?.title ?? ''}`;
  } else {
    emoji = '🔓';
    title = 'יכולת חדשה נפתחה!';
    text = c.feature;
  }
  return (
    <div className="fixed inset-0 z-[65] grid place-items-center bg-slate-900/40 p-4 animate-fadein" onClick={pop}>
      <div className="bg-white rounded-3xl p-6 text-center max-w-sm w-full shadow-2xl animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className="text-7xl mb-2">{emoji}</div>
        <div className="text-2xl font-extrabold mb-1">{title}</div>
        <div className="text-slate-700">{text}</div>
        <button className="btn-primary mt-5 w-full text-lg" onClick={pop}>
          יש! 🎉
        </button>
      </div>
    </div>
  );
}

export function SummaryModal() {
  const s = useUI((x) => x.summary);
  const close = useUI((x) => x.showSummary);
  const portfolio = useGame((g) => (s ? g.portfolios[s.portfolioId] : undefined));
  if (!s || !portfolio) return null;
  const news = eventsBetween(s.from, s.to);
  const diff = s.valueAfter - s.valueBefore;
  const pct = s.valueBefore > 0 ? s.valueAfter / s.valueBefore - 1 : 0;
  const cur = portfolio.baseCurrency;
  return (
    <Sheet open onClose={() => close(undefined)} title={<span>⏩ מה קרה עד {formatDateHe(s.to)}?</span>} wide>
      <div className="space-y-4">
        <div className={clsx('rounded-2xl p-4 text-center', diff >= 0 ? 'bg-up-bg' : 'bg-down-bg')}>
          <div className="text-sm text-slate-600">
            {portfolio.emoji} {portfolio.name}: מ-{formatDateHe(s.from)}
          </div>
          <div className="text-3xl font-extrabold num mt-1">{fmtMoney(s.valueAfter, cur)}</div>
          <div className="mt-1 flex items-center justify-center gap-2">
            <Change value={pct} big />
            <span className={clsx('num font-semibold', diff >= 0 ? 'text-up' : 'text-down')}>
              {diff >= 0 ? '+' : ''}
              {fmtMoney(diff, cur)}
            </span>
          </div>
        </div>
        {s.events.length > 0 && (
          <div>
            <div className="font-bold mb-2">💼 בתיק שלכם</div>
            <ul className="space-y-2">
              {s.events.slice(0, 12).map((e, i) => (
                <li key={i} className="rounded-xl bg-slate-50 p-3 text-sm">
                  <div className="text-xs text-slate-500">{formatDateHe(e.date)}</div>
                  {e.text}
                </li>
              ))}
            </ul>
          </div>
        )}
        {news.length > 0 && (
          <div>
            <div className="font-bold mb-2">📰 חדשות מהעולם בתקופה הזו</div>
            <ul className="space-y-2">
              {news.slice(-6).map((n) => (
                <li key={n.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="text-xs text-slate-500">{formatDateHe(n.date)}</div>
                  <div className="font-semibold">
                    {n.emoji} {n.title}
                  </div>
                  <div className="text-sm text-slate-700 mt-1">
                    <RichText text={n.kid} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {s.events.length === 0 && news.length === 0 && <div className="text-center text-slate-500">היה שקט יחסית. השוק המשיך לזוז כרגיל 🙂</div>}
        <button className="btn-primary w-full" onClick={() => close(undefined)}>
          המשך 👍
        </button>
      </div>
    </Sheet>
  );
}
