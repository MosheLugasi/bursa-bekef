import { Link } from 'react-router-dom';
import { useCurrentProfile, useGame } from '@/state/store';
import { useUI } from '@/state/ui';
import { COACH_TOPICS } from '@/game/coach';
import { JOURNEY } from '@/game/journey';
import { LESSONS, EVENTS } from '@/content';
import { FEATURE_INFO, type Feature } from '@/game/features';
import { HelpButton, ProgressBar, SectionTitle, useCoachOnce } from '@/ui/components';
import { clsx } from '@/ui/format';

const LEVELS: Record<number, string> = { 1: '🌱 מתחילים (גיל 7+)', 2: '🌿 מתקדמים (גיל 10+)', 3: '🌳 מומחים (גיל 13+ ומבוגרים)' };
const UNLOCK_TO_FEATURE: Record<string, Feature> = { limit: 'limit', stopLoss: 'stopLoss', takeProfit: 'takeProfit', bonds: 'bonds', options: 'options', candles: 'candles', fundamentals: 'fundamentals' };

export default function Learn() {
  const profile = useCurrentProfile()!;
  const update = useGame((s) => s.updateProfile);
  const openCoach = useUI((s) => s.openCoach);
  const toast = useUI((s) => s.toast);
  useCoachOnce('academy');
  const done = Object.keys(profile.lessons).length;
  const jDone = JOURNEY.filter((st) => profile.journey?.[st.id]).length;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">🎓 האקדמיה של שורי</h1>
        <HelpButton coachKey="academy" />
      </div>
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="font-bold">
            סיימתם {done} מתוך {LESSONS.length} שיעורים
          </div>
          <div className="text-2xl">{done === LESSONS.length ? '🧑‍🎓' : '📚'}</div>
        </div>
        <ProgressBar value={done / LESSONS.length} className="mt-2" color="bg-emerald-500" />
      </div>
      <Link to="/journey" className="card p-4 flex items-center gap-4 hover:shadow-md bg-gradient-to-l from-amber-50 to-emerald-50 border-amber-100">
        <div className="text-5xl anim-bob">🗺️</div>
        <div className="flex-1">
          <div className="text-xs font-bold text-amber-700">{jDone === 0 ? 'מתחילים כאן!' : jDone === JOURNEY.length ? 'סיימתם – אפשר לשחק שוב' : 'ממשיכים במסע'}</div>
          <div className="font-extrabold text-lg">המסע של שורי</div>
          <div className="text-sm text-slate-600">הרפתקה עם ציורים ומשחקים: מה זו בורסה, מה זו מניה, תשואה ועוד</div>
          <ProgressBar value={jDone / JOURNEY.length} className="mt-2" color="bg-amber-400" />
        </div>
        <div className="text-sm font-bold text-amber-700 whitespace-nowrap">
          {jDone}/{JOURNEY.length} ⭐
        </div>
      </Link>
      <div className="grid sm:grid-cols-3 gap-3">
        <Link to="/predict" className="card p-4 hover:shadow-md bg-violet-50/60">
          <div className="text-3xl">🔮</div>
          <div className="font-bold">מה יקרה אחר כך?</div>
          <div className="text-sm text-slate-600">משחק ניחושים על אירועים אמיתיים מההיסטוריה ({EVENTS.length} אירועים)</div>
        </Link>
        <Link to="/glossary" className="card p-4 hover:shadow-md bg-amber-50/60">
          <div className="text-3xl">📖</div>
          <div className="font-bold">מילון מושגים</div>
          <div className="text-sm text-slate-600">כל המילים של הבורסה, בהסבר לילדים ולמבוגרים</div>
        </Link>
        <Link to="/news" className="card p-4 hover:shadow-md bg-sky-50/60">
          <div className="text-3xl">📰</div>
          <div className="font-bold">ציר הזמן של השוק</div>
          <div className="text-sm text-slate-600">אירועים שהזיזו את הבורסה – ומה אפשר ללמוד מהם</div>
        </Link>
      </div>
      {[1, 2, 3].map((lvl) => (
        <div key={lvl}>
          <SectionTitle>{LEVELS[lvl]}</SectionTitle>
          <div className="grid sm:grid-cols-2 gap-3">
            {LESSONS.filter((l) => l.level === lvl).map((l) => {
              const res = profile.lessons[l.id];
              const feat = l.unlocks ? UNLOCK_TO_FEATURE[l.unlocks] : undefined;
              const stars = res ? (res.score === res.total ? 3 : res.score >= res.total * 0.6 ? 2 : 1) : 0;
              return (
                <Link key={l.id} to={`/learn/${l.id}`} className={clsx('card p-4 flex gap-3 hover:shadow-md transition', res && 'bg-emerald-50/50 border-emerald-100')}>
                  <div className="text-4xl">{l.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold">{l.title}</div>
                    <div className="text-sm text-slate-600">{l.summary}</div>
                    <div className="text-xs text-slate-500 mt-1 flex gap-2 flex-wrap">
                      <span>⏱️ {l.minutes} דק׳</span>
                      {feat && (
                        <span className="text-brand-700 font-semibold">
                          {res ? '🔓' : '🔒'} פותח: {FEATURE_INFO[feat].name}
                          {l.unlocks === 'stopLoss' ? ' + טייק פרופיט' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-lg">{res ? '⭐'.repeat(stars) : '▶️'}</div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      <div className="card p-4">
        <SectionTitle>🐂 ההסברים של שורי</SectionTitle>
        <p className="text-sm text-slate-600 mb-3">אפשר לפתוח כל הסבר שוב, מתי שרוצים. ✓ = כבר ראיתם.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {COACH_TOPICS.map((t) => (
            <button key={t.key} onClick={() => openCoach(t.key)} className="rounded-xl border border-slate-200 bg-white p-2.5 text-right hover:bg-brand-50 hover:border-brand-200 flex items-center gap-2">
              <span className="text-2xl">{t.emoji}</span>
              <span className="flex-1 text-sm font-semibold">{t.title}</span>
              {profile.seenCoach[t.key] && <span className="text-xs text-emerald-600">✓</span>}
            </button>
          ))}
        </div>
        <button
          className="btn-soft mt-3"
          onClick={() => {
            update(profile.id, (x) => ({ ...x, seenCoach: {} }));
            toast({ emoji: '🐂', text: 'מעכשיו שורי יסביר שוב כל מסך בפעם הראשונה שתגיעו אליו', kind: 'info' });
          }}
        >
          🔄 להתחיל את כל ההדרכות מההתחלה
        </button>
      </div>
    </div>
  );
}
