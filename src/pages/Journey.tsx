import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { JOURNEY, JOURNEY_XP, stationIndex, type JourneyStation } from '@/game/journey';
import { useCurrentProfile, useGame } from '@/state/store';
import type { Profile } from '@/state/types';
import { awardXp, checkAchievements, fireConfetti } from '@/game/actions';
import { Scene } from '@/ui/journey/Scenes';
import { Empty, ProgressBar, RichText, useCoachOnce } from '@/ui/components';
import { clsx } from '@/ui/format';

function unlockedIndex(p: Profile): number {
  // התחנה הראשונה שעוד לא הושלמה פתוחה; כל מה שאחריה נעול
  const i = JOURNEY.findIndex((s) => !p.journey?.[s.id]);
  return i === -1 ? JOURNEY.length - 1 : i;
}

export function JourneyMap() {
  const profile = useCurrentProfile()!;
  const nav = useNavigate();
  useCoachOnce('journey');
  const cur = unlockedIndex(profile);
  const done = JOURNEY.filter((s) => profile.journey?.[s.id]).length;
  const stars = JOURNEY.reduce((a, s) => a + (profile.journey?.[s.id]?.stars ?? 0), 0);
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="card p-4 bg-gradient-to-l from-amber-50 to-emerald-50">
        <div className="flex items-center gap-3">
          <span className="text-5xl anim-bob">🐂</span>
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold">המסע של שורי</h1>
            <p className="text-sm text-slate-600">בואו נגלה יחד איך עובדת הבורסה – תחנה אחרי תחנה!</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 text-sm font-bold">
          <span>
            {done}/{JOURNEY.length} תחנות
          </span>
          <ProgressBar value={done / JOURNEY.length} className="flex-1" color="bg-amber-400" />
          <span>⭐ {stars}</span>
        </div>
      </div>

      <div className="relative py-2">
        {JOURNEY.map((s, i) => {
          const res = profile.journey?.[s.id];
          const locked = i > cur;
          const current = i === cur && !res;
          const side = i % 2 === 0 ? 'right' : 'left';
          return (
            <div key={s.id} className="relative">
              {i < JOURNEY.length - 1 && (
                <svg className="absolute inset-x-0 top-[52px] h-[70px] w-full pointer-events-none" viewBox="0 0 300 70" preserveAspectRatio="none" aria-hidden="true">
                  <path
                    d={side === 'right' ? 'M225,0 C225,40 75,30 75,70' : 'M75,0 C75,40 225,30 225,70'}
                    fill="none"
                    stroke={i < cur ? '#f59e0b' : '#cbd5e1'}
                    strokeWidth="4"
                    strokeDasharray="8 8"
                  />
                </svg>
              )}
              <div className={clsx('flex h-[122px] items-start', side === 'right' ? 'justify-start pr-[12%]' : 'justify-end pl-[12%]')}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => nav(`/journey/${s.id}`)}
                  className={clsx('relative flex flex-col items-center w-28 text-center group', locked && 'opacity-50')}
                >
                  <span
                    className={clsx(
                      'w-[76px] h-[76px] rounded-full grid place-items-center text-4xl border-4 shadow-md transition group-active:scale-95',
                      res ? 'bg-amber-100 border-amber-400' : current ? 'bg-white border-brand-500 anim-pulse-ring' : 'bg-white border-slate-200'
                    )}
                  >
                    {locked ? '🔒' : s.emoji}
                  </span>
                  {current && <span className="absolute -top-3 -left-2 text-3xl anim-bob">🐂</span>}
                  <span className="mt-1 text-sm font-extrabold leading-tight">{s.title}</span>
                  <span className="text-xs">{res ? '⭐'.repeat(res.stars) + '☆'.repeat(3 - res.stars) : current ? 'לחצו להתחיל!' : ''}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {done === JOURNEY.length && (
        <div className="card p-5 text-center">
          <div className="text-5xl">🎓</div>
          <div className="font-extrabold text-lg mt-1">סיימתם את המסע!</div>
          <p className="text-slate-600 text-sm">אפשר לחזור לכל תחנה ולשפר כוכבים – או להמשיך לאקדמיה ולשוק.</p>
          <div className="flex gap-2 justify-center mt-3">
            <Link to="/learn" className="btn-soft">
              🎓 לאקדמיה
            </Link>
            <Link to="/market" className="btn-buy">
              📈 לשוק
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function JourneyStationPage() {
  const { id } = useParams();
  const idx = stationIndex(id ?? '');
  const station = JOURNEY[idx];
  if (!station) return <Empty emoji="🗺️" title="התחנה לא נמצאה" />;
  return <StationPlayer key={station.id} station={station} idx={idx} />;
}

function StationPlayer({ station, idx }: { station: JourneyStation; idx: number }) {
  const profile = useCurrentProfile()!;
  const update = useGame((s) => s.updateProfile);
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [qi, setQi] = useState(-1); // -1 = כרטיסים, 0.. = שאלות
  const [picked, setPicked] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [wrongShake, setWrongShake] = useState(0);
  const [finished, setFinished] = useState<number | null>(null);
  const card = station.cards[step];
  const total = station.cards.length + station.quiz.length;
  const progress = finished !== null ? 1 : qi < 0 ? step / total : (station.cards.length + qi) / total;
  const next = JOURNEY[idx + 1];

  const finish = () => {
    const stars = mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1;
    const prev = profile.journey?.[station.id];
    update(profile.id, (p) => ({ ...p, journey: { ...(p.journey ?? {}), [station.id]: { stars: Math.max(stars, prev?.stars ?? 0), at: new Date().toISOString() } } }));
    if (!prev) {
      awardXp(profile.id, JOURNEY_XP.station, `תחנה הושלמה: ${station.title}`);
      const after = useGame.getState().profiles[profile.id];
      if (JOURNEY.every((s) => after.journey?.[s.id])) awardXp(profile.id, JOURNEY_XP.finish, 'סיימתם את כל המסע! 🗺️');
    }
    checkAchievements(profile.id);
    fireConfetti(stars === 3);
    setFinished(stars);
  };

  const answer = (i: number) => {
    const q = station.quiz[qi];
    if (picked === q.answer) return;
    setPicked(i);
    if (i !== q.answer) {
      setMistakes((m) => m + 1);
      setWrongShake((x) => x + 1);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-3">
      <div className="flex items-center gap-2">
        <button className="btn-ghost px-2" onClick={() => nav('/journey')}>
          → למפה
        </button>
        <div className="flex-1">
          <div className="font-extrabold">
            {station.emoji} {station.title}
          </div>
          <ProgressBar value={progress} className="mt-1" color="bg-amber-400" />
        </div>
      </div>

      {finished === null && qi < 0 && (
        <div className="animate-fadein" key={step}>
          <Scene id={card.scene} from={station.from} to={station.to} />
          <div className="card p-5 mt-3">
            <h2 className="text-2xl font-extrabold mb-2">{card.title}</h2>
            <p className="text-lg leading-relaxed">
              <RichText text={card.text} />
            </p>
            <div className="flex gap-2 mt-4">
              {step > 0 && (
                <button className="btn-soft" onClick={() => setStep(step - 1)}>
                  → הקודם
                </button>
              )}
              <button className="btn-primary flex-1 text-lg" onClick={() => (step < station.cards.length - 1 ? setStep(step + 1) : setQi(0))}>
                {step < station.cards.length - 1 ? 'הבא ←' : '🎯 לשאלה!'}
              </button>
            </div>
          </div>
        </div>
      )}

      {finished === null && qi >= 0 && (
        <div className="card p-5 animate-fadein" key={'q' + qi}>
          <div className="text-center text-5xl mb-2">{picked === null ? '🤔' : picked === station.quiz[qi].answer ? '🎉' : '🙈'}</div>
          <div className="text-sm text-brand-600 font-semibold text-center">
            שאלה {qi + 1} מתוך {station.quiz.length}
          </div>
          <div className="text-xl font-extrabold text-center my-3">{station.quiz[qi].q}</div>
          <div key={wrongShake} className={clsx('grid gap-2', wrongShake > 0 && picked !== station.quiz[qi].answer && 'anim-shake')}>
            {station.quiz[qi].options.map((o, i) => {
              const q = station.quiz[qi];
              const isRight = picked === q.answer && i === q.answer;
              const isWrong = picked === i && i !== q.answer;
              return (
                <button
                  key={i}
                  onClick={() => answer(i)}
                  className={clsx(
                    'rounded-2xl border-2 px-4 py-3 text-lg font-bold transition',
                    isRight ? 'border-emerald-500 bg-up-bg' : isWrong ? 'border-rose-400 bg-down-bg' : 'border-slate-200 bg-white hover:border-brand-400 hover:bg-brand-50'
                  )}
                >
                  {isRight ? '✅ ' : isWrong ? '❌ ' : ''}
                  {o}
                </button>
              );
            })}
          </div>
          {picked !== null && picked !== station.quiz[qi].answer && <div className="text-center text-sm text-slate-600 mt-3">לא נורא! נסו תשובה אחרת 💪</div>}
          {picked === station.quiz[qi].answer && (
            <div className="mt-4 space-y-3 animate-fadein">
              <div className="rounded-xl bg-up-bg p-3 text-center font-semibold">{station.quiz[qi].explain}</div>
              <button
                className="btn-primary w-full text-lg"
                onClick={() => {
                  if (qi < station.quiz.length - 1) {
                    setQi(qi + 1);
                    setPicked(null);
                  } else finish();
                }}
              >
                {qi < station.quiz.length - 1 ? 'לשאלה הבאה ←' : 'סיום התחנה 🏁'}
              </button>
            </div>
          )}
        </div>
      )}

      {finished !== null && (
        <div className="card p-6 text-center animate-pop">
          <div className="text-6xl">{station.emoji}</div>
          <div className="text-2xl font-extrabold mt-2">התחנה הושלמה!</div>
          <div className="text-5xl my-3 tracking-widest">
            {[0, 1, 2].map((i) => (
              <span key={i} className={clsx('inline-block anim-grow', i >= finished && 'grayscale opacity-30')} style={{ animationDelay: `${0.2 + i * 0.25}s` }}>
                ⭐
              </span>
            ))}
          </div>
          <div className="text-slate-600">{finished === 3 ? 'מושלם! ענית נכון על הכל בפעם הראשונה 🐂👏' : 'כל הכבוד! אפשר לחזור לתחנה ולנסות לקבל 3 כוכבים.'}</div>
          <div className="flex gap-2 justify-center mt-5 flex-wrap">
            <button className="btn-soft" onClick={() => nav('/journey')}>
              🗺️ למפה
            </button>
            {next ? (
              <button className="btn-primary" onClick={() => nav(`/journey/${next.id}`)}>
                לתחנה הבאה: {next.emoji} {next.title} ←
              </button>
            ) : (
              <Link to="/market" className="btn-buy">
                📈 לשוק – לקנות את המניה הראשונה!
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
