import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useActivePortfolio, useCurrentProfile, useGame } from '@/state/store';
import { useMarket, loadNews, type NewsItem } from '@/data/loader';
import { INSTRUMENTS } from '@/engine/universe';
import { formatDateHe, todayISO } from '@/engine/dates';
import { LESSONS, QUIZ_BANK, eventsUntil, GLOSSARY } from '@/content';
import { levelFor, XP } from '@/game/xp';
import { ACHIEVEMENTS, makeCtx } from '@/game/achievements';
import { awardXp, checkAchievements } from '@/game/actions';
import { Change, ProgressBar, RichText, SectionTitle, useCoachOnce } from '@/ui/components';
import { PortfolioCard, PortfolioSwitcher, TimeMachineBar } from '@/ui/portfolioBits';
import { clsx, fmtPrice } from '@/ui/format';
import { instCurrency } from '@/engine/universe';

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function DailyQuiz() {
  const profile = useCurrentProfile()!;
  const update = useGame((s) => s.updateProfile);
  const today = todayISO();
  const maxLevel = profile.ageGroup === 'kid' ? 1 : profile.ageGroup === 'teen' ? 2 : 3;
  const pool = QUIZ_BANK.filter((q) => q.level <= maxLevel);
  const q = pool[hash(today + profile.id) % pool.length];
  const done = profile.quiz.lastDate === today;
  const [picked, setPicked] = useState<number | null>(null);
  if (!q) return null;
  const answer = (i: number) => {
    if (done || picked !== null) return;
    setPicked(i);
    const ok = i === q.answer;
    update(profile.id, (p) => ({ ...p, quiz: { lastDate: today, answered: p.quiz.answered + 1, correct: p.quiz.correct + (ok ? 1 : 0), lastResult: ok } }));
    awardXp(profile.id, ok ? XP.dailyQuizCorrect : XP.dailyQuizTry, ok ? 'תשובה נכונה!' : 'על הניסיון');
    checkAchievements(profile.id);
  };
  const showResult = picked !== null || done;
  return (
    <div className="card p-4">
      <SectionTitle>🧠 שאלת היום <span className="text-xs font-normal text-slate-500">· {q.topic}</span></SectionTitle>
      <div className="font-semibold mb-3">
        <RichText text={q.q} />
      </div>
      {done && picked === null ? (
        <div className={clsx('rounded-xl p-3 text-sm', profile.quiz.lastResult ? 'bg-up-bg' : 'bg-amber-50')}>
          {profile.quiz.lastResult ? '✅ ענית נכון היום! ' : '🙂 כבר ענית היום. '}
          התשובה: <strong>{q.options[q.answer]}</strong>. <RichText text={q.explain} />
          <div className="text-xs text-slate-500 mt-1">שאלה חדשה מחכה מחר 🌅</div>
        </div>
      ) : (
        <div className="grid gap-2">
          {q.options.map((o, i) => (
            <button
              key={i}
              onClick={() => answer(i)}
              className={clsx(
                'rounded-xl border-2 px-3 py-2.5 text-right font-medium transition',
                !showResult && 'border-slate-200 hover:border-brand-400 hover:bg-brand-50',
                showResult && i === q.answer && 'border-emerald-500 bg-up-bg',
                showResult && picked === i && i !== q.answer && 'border-rose-400 bg-down-bg',
                showResult && i !== q.answer && picked !== i && 'border-slate-100 opacity-60'
              )}
            >
              {showResult && i === q.answer ? '✅ ' : showResult && picked === i ? '❌ ' : ''}
              {o}
            </button>
          ))}
          {showResult && (
            <div className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3">
              <RichText text={q.explain} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const profile = useCurrentProfile()!;
  const p = useActivePortfolio();
  const market = useMarket();
  const portfolios = useGame((s) => s.portfolios);
  const profiles = useGame((s) => s.profiles);
  const date = p?.currentDate ?? market.asOf;
  const lvl = levelFor(profile.xp);
  const [news, setNews] = useState<NewsItem[]>([]);
  useCoachOnce('welcome');
  useEffect(() => {
    loadNews().then(setNews);
  }, []);

  const movers = useMemo(() => {
    const rows = INSTRUMENTS.filter((i) => market.available(i.id, date) && market.tradedOn(i.id, market.snap(date)) !== undefined)
      .map((i) => ({ i, ch: market.dayChange(i.id, date), price: market.price(i.id, date) }))
      .filter((r) => Number.isFinite(r.ch));
    rows.sort((a, b) => b.ch - a.ch);
    return { up: rows.slice(0, 3), down: rows.slice(-3).reverse() };
  }, [market, date]);

  const nextLesson = LESSONS.find((l) => !profile.lessons[l.id] && (profile.ageGroup !== 'kid' || l.level === 1)) ?? LESSONS.find((l) => !profile.lessons[l.id]);
  const nextAch = useMemo(() => {
    const ctx = makeCtx(profile, Object.values(portfolios), Object.values(profiles), market);
    return ACHIEVEMENTS.filter((a) => !profile.achievements[a.id])
      .map((a) => ({ a, prog: a.progress ? a.progress(ctx) : 0 }))
      .sort((x, y) => y.prog - x.prog)
      .slice(0, 3);
  }, [profile, portfolios, profiles, market]);
  const histEvents = p?.mode === 'history' ? eventsUntil(date).slice(0, 3) : [];
  const liveNews = p?.mode !== 'history' ? news.slice(0, 4) : [];
  const tip = GLOSSARY.length ? GLOSSARY[hash(todayISO()) % GLOSSARY.length] : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full grid place-items-center text-4xl border-4" style={{ borderColor: profile.color, background: profile.color + '22' }}>
          {profile.avatar}
        </div>
        <div className="flex-1">
          <div className="text-2xl font-extrabold">שלום {profile.name}! 👋</div>
          <div className="text-sm text-slate-600">
            {lvl.emoji} {lvl.title} · רמה {lvl.level} {lvl.next && <span className="text-slate-400">· עוד {lvl.next.min - profile.xp} XP לרמה הבאה</span>}
          </div>
          <ProgressBar value={lvl.progress} className="mt-1 max-w-xs" color="bg-amber-400" />
        </div>
      </div>

      <PortfolioSwitcher />
      {p ? (
        <div className="grid md:grid-cols-2 gap-4">
          <PortfolioCard p={p} />
          {p.mode === 'history' ? (
            <TimeMachineBar p={p} />
          ) : (
            <div className="card p-4 flex flex-col justify-center">
              <div className="text-sm text-slate-500">📡 נתוני מסחר אמיתיים נכונים ל-</div>
              <div className="text-xl font-bold">{formatDateHe(market.asOf, { weekday: true })}</div>
              <div className="text-sm text-slate-600 mt-1">הנתונים מתעדכנים אוטומטית כל יום אחרי סגירת המסחר. קנייה ומכירה מתבצעות במחיר הסגירה האחרון.</div>
              <div className="flex gap-2 mt-3">
                <Link to="/market" className="btn-primary flex-1">
                  📈 לשוק
                </Link>
                <Link to="/portfolio" className="btn-soft flex-1">
                  💼 לתיק
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-6 text-center">
          <div className="text-5xl">💼</div>
          <div className="font-bold text-lg mt-2">עוד אין לכם תיק השקעות</div>
          <Link to="/portfolio?new=1" className="btn-primary mt-3">
            ✨ פתיחת תיק ראשון
          </Link>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <DailyQuiz />
        <div className="card p-4">
          <SectionTitle action={<Link to="/market" className="text-sm text-brand-700 font-semibold">לכל השוק ←</Link>}>🔥 הכי זזו ב{formatDateHe(market.snap(date))}</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {[movers.up, movers.down].map((list, k) => (
              <ul key={k} className="space-y-1.5">
                {list.map(({ i, ch, price }) => (
                  <li key={i.id}>
                    <Link to={`/asset/${encodeURIComponent(i.id)}`} className="flex items-center gap-2 rounded-lg hover:bg-slate-50 p-1">
                      <span className="text-xl">{i.emoji}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold truncate">{i.nameHe}</span>
                        <span className="block text-xs text-slate-500 num">{fmtPrice(price, instCurrency(i.id))}</span>
                      </span>
                      <Change value={ch} />
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <SectionTitle action={<Link to="/news" className="text-sm text-brand-700 font-semibold">עוד חדשות ←</Link>}>📰 חדשות</SectionTitle>
          {histEvents.length > 0 &&
            histEvents.map((e) => (
              <div key={e.id} className="py-2 border-b last:border-0 border-slate-100">
                <div className="text-xs text-slate-500">{formatDateHe(e.date)}</div>
                <div className="font-semibold">
                  {e.emoji} {e.title}
                </div>
                <div className="text-sm text-slate-600 line-clamp-2">
                  <RichText text={e.kid} />
                </div>
              </div>
            ))}
          {liveNews.map((n) => (
            <div key={n.id} className="py-2 border-b last:border-0 border-slate-100">
              <div className="text-xs text-slate-500">{n.tickers.join(', ')} · {n.time.slice(0, 10)}</div>
              <div className="font-semibold">{n.he?.titleHe ?? n.title}</div>
              {n.he && <div className="text-sm text-slate-600">{n.he.kidHe}</div>}
            </div>
          ))}
          {histEvents.length === 0 && liveNews.length === 0 && <div className="text-slate-500 text-sm">אין חדשות כרגע.</div>}
        </div>
        <div className="space-y-4">
          {nextLesson && (
            <Link to={`/learn/${nextLesson.id}`} className="card p-4 flex items-center gap-3 hover:shadow-md">
              <div className="text-4xl">{nextLesson.emoji}</div>
              <div className="flex-1">
                <div className="text-xs text-brand-600 font-semibold">🎓 השיעור הבא שלכם</div>
                <div className="font-bold">{nextLesson.title}</div>
                <div className="text-sm text-slate-600">{nextLesson.summary}</div>
              </div>
              <span className="text-2xl">←</span>
            </Link>
          )}
          <div className="card p-4">
            <SectionTitle action={<Link to="/compete" className="text-sm text-brand-700 font-semibold">כל ההישגים ←</Link>}>🏅 הישגים קרובים</SectionTitle>
            <ul className="space-y-2">
              {nextAch.map(({ a, prog }) => (
                <li key={a.id} className="flex items-center gap-3">
                  <span className="text-2xl grayscale opacity-70">{a.emoji}</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{a.title}</div>
                    <div className="text-xs text-slate-500">{a.desc}</div>
                    {a.progress && <ProgressBar value={prog} className="mt-1 h-1.5" color="bg-emerald-500" />}
                  </div>
                  <span className="text-xs text-amber-600 font-bold">+{a.xp}</span>
                </li>
              ))}
            </ul>
          </div>
          {tip && (
            <div className="card p-4 bg-amber-50/60">
              <div className="text-xs font-semibold text-amber-700 mb-1">💡 מילה של היום</div>
              <div className="font-bold">{tip.term}</div>
              <div className="text-sm text-slate-700 mt-1">
                <RichText text={tip.kid} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
