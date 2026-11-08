import { useEffect, useState, type ReactNode } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useMarketStore } from '@/data/loader';
import { useActivePortfolio, useCurrentProfile, useGame, useSession } from '@/state/store';
import { checkAchievements, processLivePortfolios, touchStreak } from '@/game/actions';
import { levelFor } from '@/game/xp';
import { CoachModal, Celebrations, GlossarySheet, SummaryModal, Toasts } from '@/ui/overlays';
import { ProgressBar } from '@/ui/components';
import { CoachButton } from '@/ui/CoachFab';
import { useUI } from '@/state/ui';
import { clsx } from '@/ui/format';
import { initCloud, useCloud } from '@/state/cloud';
import Accounts from '@/pages/Accounts';
import { CloudGate } from '@/ui/Account';
import Welcome from '@/pages/Welcome';
import Home from '@/pages/Home';
import Market from '@/pages/Market';
import Asset from '@/pages/Asset';
import PortfolioPage from '@/pages/Portfolio';
import Bonds from '@/pages/Bonds';
import Compete from '@/pages/Compete';
import Stats from '@/pages/Stats';
import Learn from '@/pages/Learn';
import LessonPage from '@/pages/Lesson';
import Glossary from '@/pages/Glossary';
import Predict from '@/pages/Predict';
import News from '@/pages/News';
import Admin from '@/pages/Admin';
import { JourneyMap, JourneyStationPage } from '@/pages/Journey';
import Practice from '@/pages/Practice';

const NAV = [
  { to: '/home', emoji: '🏠', label: 'בית' },
  { to: '/market', emoji: '📈', label: 'שוק' },
  { to: '/portfolio', emoji: '💼', label: 'התיק' },
  { to: '/compete', emoji: '🏆', label: 'תחרות' },
  { to: '/learn', emoji: '🎓', label: 'לומדים' }
];
const MORE = [
  { to: '/journey', emoji: '🗺️', label: 'המסע של שורי' },
  { to: '/practice', emoji: '🏋️', label: 'זירת האימון' },
  { to: '/bonds', emoji: '📜', label: 'אג״ח' },
  { to: '/stats', emoji: '📊', label: 'סטטיסטיקות' },
  { to: '/news', emoji: '📰', label: 'חדשות' },
  { to: '/predict', emoji: '🔮', label: 'מה יקרה אחר כך?' },
  { to: '/glossary', emoji: '📖', label: 'מילון מושגים' },
  { to: '/admin', emoji: '⚙️', label: 'ניהול' }
];
const ACCOUNTS_LINK = { to: '/accounts', emoji: '🛡️', label: 'חשבונות ומשתמשים' };
/** קישור לניהול החשבונות – רק למנהל המשחק */
function useMore() {
  const isAdmin = useCloud((s) => s.isAdmin);
  return isAdmin ? [...MORE, ACCOUNTS_LINK] : MORE;
}

function Header() {
  const profile = useCurrentProfile();
  const portfolio = useActivePortfolio();
  const logout = useSession((s) => s.logout);
  const nav = useNavigate();
  const lvl = profile ? levelFor(profile.xp) : undefined;
  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-slate-100">
      <div className="max-w-6xl mx-auto flex items-center gap-3 px-3 py-2">
        <button onClick={() => nav('/home')} className="font-extrabold text-lg text-brand-700 whitespace-nowrap">
          🐂 בורסה בכיף
        </button>
        {portfolio && (
          <button onClick={() => nav('/portfolio')} className="hidden sm:flex chip max-w-48 truncate">
            {portfolio.emoji} <span className="truncate">{portfolio.name}</span>
          </button>
        )}
        <div className="flex-1" />
        {profile && <CoachButton />}
        {profile && lvl && (
          <div className="flex items-center gap-2">
            <div className="hidden xs:block sm:block w-28">
              <div className="text-[11px] text-slate-500 leading-none mb-1">
                {lvl.emoji} רמה {lvl.level} · {profile.xp} XP
              </div>
              <ProgressBar value={lvl.progress} className="h-1.5" color="bg-amber-400" />
            </div>
            {profile.streak.count > 1 && <span className="text-sm font-bold text-orange-600" title="ימים ברצף">🔥{profile.streak.count}</span>}
            <button
              onClick={() => {
                logout();
                nav('/');
              }}
              className="w-10 h-10 rounded-full grid place-items-center text-2xl shadow-sm border-2"
              style={{ background: profile.color + '22', borderColor: profile.color }}
              title={`${profile.name} – החלפת שחקן`}
            >
              {profile.avatar}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function BottomNav() {
  const [more, setMore] = useState(false);
  const moreItems = useMore();
  const loc = useLocation();
  useEffect(() => setMore(false), [loc.pathname]);
  return (
    <>
      {more && (
        <div className="fixed inset-0 z-40 bg-slate-900/30 md:hidden" onClick={() => setMore(false)}>
          <div className="absolute bottom-[68px] inset-x-2 bg-white rounded-2xl shadow-xl p-2 grid grid-cols-3 gap-1 safe-bottom" onClick={(e) => e.stopPropagation()}>
            {moreItems.map((m) => (
              <NavLink key={m.to} to={m.to} className="flex flex-col items-center gap-1 rounded-xl p-3 hover:bg-slate-50 text-sm font-medium">
                <span className="text-2xl">{m.emoji}</span>
                {m.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 safe-bottom">
        <div className="grid grid-cols-6">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => clsx('flex flex-col items-center py-2 text-[11px] font-semibold', isActive ? 'text-brand-700' : 'text-slate-500')}>
              <span className="text-xl leading-6">{n.emoji}</span>
              {n.label}
            </NavLink>
          ))}
          <button onClick={() => setMore(!more)} className={clsx('flex flex-col items-center py-2 text-[11px] font-semibold', more ? 'text-brand-700' : 'text-slate-500')}>
            <span className="text-xl leading-6">☰</span>
            עוד
          </button>
        </div>
      </nav>
    </>
  );
}

function SideNav() {
  const moreItems = useMore();
  return (
    <aside className="hidden md:block w-52 shrink-0">
      <nav className="sticky top-16 space-y-1 py-4">
        {[...NAV, ...moreItems].map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold', isActive ? 'bg-brand-600 text-white shadow' : 'text-slate-700 hover:bg-white')}
          >
            <span className="text-xl">{n.emoji}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

function SyntheticBanner() {
  const m = useMarketStore((s) => s.market);
  if (!m?.manifest.synthetic) return null;
  return <div className="bg-amber-100 text-amber-900 text-center text-sm py-1.5 px-2 font-semibold">⚠️ מצב פיתוח: מוצגים נתונים סינתטיים (לא אמיתיים). באתר המפורסם מוצגים נתוני מסחר אמיתיים.</div>;
}

function Shell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  useEffect(() => {
    // סוגרים חלונות קופצים כשעוברים מסך
    useUI.getState().showSummary(undefined);
    useUI.getState().openTerm(undefined);
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  return (
    <div className="min-h-screen flex flex-col">
      <SyntheticBanner />
      <Header />
      <div className="flex-1 max-w-6xl w-full mx-auto flex gap-4 px-3">
        <SideNav />
        <main className="flex-1 min-w-0 py-3 pb-28 md:pb-10">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}

function RequireProfile({ children }: { children: ReactNode }) {
  const profile = useCurrentProfile();
  if (!profile) return <Navigate to="/" replace />;
  return <Shell>{children}</Shell>;
}

function Loading({ error }: { error?: string }) {
  return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <div className="text-6xl animate-bounce">🐂</div>
        <div className="text-xl font-bold mt-3">{error ? 'אופס, לא הצלחנו לטעון את נתוני הבורסה' : 'טוענים את נתוני הבורסה...'}</div>
        {error && (
          <>
            <div className="text-sm text-slate-500 mt-2" dir="ltr">
              {error}
            </div>
            <button className="btn-primary mt-4" onClick={() => location.reload()}>
              נסו שוב
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const status = useMarketStore((s) => s.status);
  const error = useMarketStore((s) => s.error);
  const load = useMarketStore((s) => s.load);
  const profileId = useSession((s) => s.profileId);
  const exists = useGame((s) => (profileId ? !!s.profiles[profileId] : false));
  const logout = useSession((s) => s.logout);

  useEffect(() => {
    load().then((m) => {
      if (m) processLivePortfolios().then(() => checkAchievements());
    });
    initCloud();
  }, [load]);

  useEffect(() => {
    if (profileId && !exists) logout();
    if (profileId && exists && status === 'ready') touchStreak(profileId);
  }, [profileId, exists, status, logout]);

  if (status !== 'ready') return <Loading error={status === 'error' ? error : undefined} />;

  return (
    <HashRouter>
      <Toasts />
      <GlossarySheet />
      <CoachModal />
      <Celebrations />
      <SummaryModal />
      <CloudGate />
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/home" element={<RequireProfile><Home /></RequireProfile>} />
        <Route path="/market" element={<RequireProfile><Market /></RequireProfile>} />
        <Route path="/asset/:id" element={<RequireProfile><Asset /></RequireProfile>} />
        <Route path="/portfolio" element={<RequireProfile><PortfolioPage /></RequireProfile>} />
        <Route path="/bonds" element={<RequireProfile><Bonds /></RequireProfile>} />
        <Route path="/compete" element={<RequireProfile><Compete /></RequireProfile>} />
        <Route path="/stats" element={<RequireProfile><Stats /></RequireProfile>} />
        <Route path="/learn" element={<RequireProfile><Learn /></RequireProfile>} />
        <Route path="/learn/:id" element={<RequireProfile><LessonPage /></RequireProfile>} />
        <Route path="/journey" element={<RequireProfile><JourneyMap /></RequireProfile>} />
        <Route path="/journey/:id" element={<RequireProfile><JourneyStationPage /></RequireProfile>} />
        <Route path="/practice" element={<RequireProfile><Practice /></RequireProfile>} />
        <Route path="/glossary" element={<RequireProfile><Glossary /></RequireProfile>} />
        <Route path="/predict" element={<RequireProfile><Predict /></RequireProfile>} />
        <Route path="/news" element={<RequireProfile><News /></RequireProfile>} />
        <Route path="/admin" element={profileId ? <Shell><Admin /></Shell> : <Admin />} />
        <Route path="/accounts" element={profileId ? <Shell><Accounts /></Shell> : <Accounts />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}