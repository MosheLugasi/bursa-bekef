import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CHEST_COUNT,
  CHEST_EVERY,
  JOURNEY,
  JOURNEY_CHAPTERS,
  JOURNEY_XP,
  answerOrder,
  chestsEarned,
  stationIndex,
  stickerKind,
  type JourneyStation,
  type StickerKind
} from '@/game/journey';
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

const CHAPTER_AT = new Map(JOURNEY_CHAPTERS.map((c) => [c.start, c]));

/** מדבקה באלבום */
export function Sticker({ emoji, name, kind, big }: { emoji: string; name: string; kind: StickerKind; big?: boolean }) {
  return (
    <div className={clsx('flex flex-col items-center gap-1 text-center', kind === 'none' && 'opacity-70')}>
      <div
        className={clsx(
          'relative grid place-items-center rounded-2xl border-4 shadow',
          big ? 'w-24 h-24 text-6xl' : 'w-14 h-14 text-3xl',
          kind === 'gold' ? 'border-amber-400 bg-gradient-to-br from-amber-100 to-yellow-50' : kind === 'normal' ? 'border-sky-300 bg-white' : 'border-dashed border-slate-300 bg-slate-100 text-slate-400'
        )}
      >
        <span className={clsx(kind === 'none' && 'grayscale opacity-40')}>{kind === 'none' ? '❔' : emoji}</span>
        {kind === 'gold' && <span className={clsx('absolute -top-2 -left-2', big ? 'text-2xl' : 'text-base')}>✨</span>}
      </div>
      <div className={clsx('font-bold leading-tight', big ? 'text-base' : 'text-[10px]')}>{kind === 'none' ? '???' : name}</div>
    </div>
  );
}

function Album({ profile }: { profile: Profile }) {
  return (
    <div className="card p-4 animate-fadein">
      <div className="flex items-center justify-between mb-3">
        <div className="font-extrabold text-lg">📒 האלבום של שורי</div>
        <div className="text-xs text-slate-600">3 כוכבים = מדבקת זהב ✨</div>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-x-2 gap-y-3">
        {JOURNEY.map((s) => (
          <Sticker key={s.id} emoji={s.sticker.emoji} name={s.sticker.name} kind={stickerKind(profile.journey, s.id)} />
        ))}
      </div>
    </div>
  );
}

function Chests({ profile }: { profile: Profile }) {
  const update = useGame((s) => s.updateProfile);
  const [opening, setOpening] = useState(false);
  const done = JOURNEY.filter((s) => profile.journey?.[s.id]).length;
  const earned = chestsEarned(done);
  const claimed = Math.min(profile.journeyChests ?? 0, CHEST_COUNT);
  const ready = earned > claimed;
  const open = () => {
    if (opening || !ready) return;
    setOpening(true);
    setTimeout(() => {
      update(profile.id, (p) => ({ ...p, journeyChests: (p.journeyChests ?? 0) + 1 }));
      awardXp(profile.id, JOURNEY_XP.chest, 'פתחתם תיבת אוצר! 🎁');
      fireConfetti(true);
      setOpening(false);
    }, 700);
  };
  return (
    <div className={clsx('card p-3', ready && 'ring-2 ring-amber-400 bg-amber-50/60')}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-bold">
          🎁 תיבות אוצר <span className="text-slate-500 font-normal">· כל {CHEST_EVERY} תחנות</span>
        </div>
        {ready ? (
          <button type="button" onClick={open} className="btn-primary !py-1.5 anim-pulse-ring">
            {opening ? 'פותחים…' : 'פתחו את התיבה! 🎁'}
          </button>
        ) : (
          <div className="text-xs text-slate-500">
            {claimed >= CHEST_COUNT ? 'פתחתם את כל התיבות! 🏆' : `התיבה הבאה אחרי עוד ${(claimed + 1) * CHEST_EVERY - done} תחנות`}
          </div>
        )}
      </div>
      <div className="flex justify-between mt-2" aria-hidden="true">
        {Array.from({ length: CHEST_COUNT }, (_, i) => (
          <span
            key={i}
            className={clsx('text-2xl transition', i < claimed ? '' : i < earned ? (opening && i === claimed ? 'anim-shake inline-block' : 'anim-bob') : 'grayscale opacity-30')}
          >
            {i < claimed ? '🧰' : '🎁'}
          </span>
        ))}
      </div>
    </div>
  );
}

export function JourneyMap() {
  const profile = useCurrentProfile()!;
  const nav = useNavigate();
  const [album, setAlbum] = useState(false);
  useCoachOnce('journey');
  const cur = unlockedIndex(profile);
  const done = JOURNEY.filter((s) => profile.journey?.[s.id]).length;
  const stars = JOURNEY.reduce((a, s) => a + (profile.journey?.[s.id]?.stars ?? 0), 0);
  const gold = JOURNEY.filter((s) => stickerKind(profile.journey, s.id) === 'gold').length;
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
            <span className="num">{`${done}/${JOURNEY.length}`}</span> תחנות
          </span>
          <ProgressBar value={done / JOURNEY.length} className="flex-1" color="bg-amber-400" />
          <span>
            ⭐ <span className="num">{stars}</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button type="button" onClick={() => setAlbum(!album)} className={clsx('rounded-xl border-2 px-3 py-2 text-sm font-bold text-right transition', album ? 'border-amber-400 bg-amber-100' : 'border-amber-200 bg-white hover:bg-amber-50')}>
            📒 האלבום שלי
            <div className="text-xs font-normal text-slate-600">
              <span className="num">{done}</span> מדבקות · ✨ <span className="num">{gold}</span> זהב
            </div>
          </button>
          <Link to="/practice" className="rounded-xl border-2 border-emerald-200 bg-white hover:bg-emerald-50 px-3 py-2 text-sm font-bold">
            🏋️ זירת האימון
            <div className="text-xs font-normal text-slate-600">תרגול אחוזים ותשואה</div>
          </Link>
        </div>
      </div>

      {album && <Album profile={profile} />}
      <Chests profile={profile} />

      <div className="relative py-2">
        {JOURNEY.map((s, i) => {
          const res = profile.journey?.[s.id];
          const locked = i > cur && !res; // תחנות שכבר הושלמו תמיד פתוחות (גם אם נוספו תחנות חדשות לפניהן)
          const current = i === cur && !res;
          const side = i % 2 === 0 ? 'right' : 'left';
          const chapter = CHAPTER_AT.get(s.id);
          const nextIsChapter = !!JOURNEY[i + 1] && CHAPTER_AT.has(JOURNEY[i + 1].id);
          const isGold = res && res.stars >= 3;
          return (
            <div key={s.id}>
              {chapter && (
                <div className="my-2 flex items-center gap-3 rounded-2xl bg-white/80 border border-slate-200 px-4 py-2 shadow-sm">
                  <span className="text-3xl">{chapter.emoji}</span>
                  <div className="flex-1">
                    <div className="font-extrabold">{chapter.title}</div>
                    <div className="text-xs text-slate-600">{chapter.subtitle}</div>
                  </div>
                </div>
              )}
              <div className="relative">
                {i < JOURNEY.length - 1 && !nextIsChapter && (
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
                        isGold ? 'bg-amber-100 border-amber-500 ring-4 ring-amber-200' : res ? 'bg-amber-100 border-amber-400' : current ? 'bg-white border-brand-500 anim-pulse-ring' : 'bg-white border-slate-200'
                      )}
                    >
                      {locked ? '🔒' : s.emoji}
                    </span>
                    {isGold && <span className="absolute -top-1 right-3 text-lg">✨</span>}
                    {current && <span className="absolute -top-3 -left-2 text-3xl anim-bob">🐂</span>}
                    <span className="mt-1 text-sm font-extrabold leading-tight">{s.title}</span>
                    <span className="text-xs">{res ? '⭐'.repeat(res.stars) + '☆'.repeat(3 - res.stars) : current ? 'לחצו להתחיל!' : ''}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {done === JOURNEY.length && (
        <div className="card p-5 text-center">
          <div className="text-5xl">🎓</div>
          <div className="font-extrabold text-lg mt-1">סיימתם את המסע!</div>
          <p className="text-slate-600 text-sm">אפשר לחזור לכל תחנה ולאסוף מדבקות זהב – או להמשיך לזירת האימון, לאקדמיה ולשוק.</p>
          <div className="flex gap-2 justify-center mt-3 flex-wrap">
            <Link to="/practice" className="btn-soft">
              🏋️ לזירת האימון
            </Link>
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

interface Finish {
  stars: number;
  prevStars: number;
  chestReady: boolean;
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
  const [finished, setFinished] = useState<Finish | null>(null);
  const card = station.cards[step];
  const total = station.cards.length + station.quiz.length;
  const progress = finished !== null ? 1 : qi < 0 ? step / total : (station.cards.length + qi) / total;
  const next = JOURNEY[idx + 1];

  const finish = () => {
    const stars = mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1;
    const prev = profile.journey?.[station.id];
    update(profile.id, (p) => ({ ...p, journey: { ...(p.journey ?? {}), [station.id]: { stars: Math.max(stars, prev?.stars ?? 0), at: new Date().toISOString() } } }));
    const after = useGame.getState().profiles[profile.id];
    if (!prev) {
      awardXp(profile.id, JOURNEY_XP.station, `תחנה הושלמה: ${station.title}`);
      if (JOURNEY.every((s) => after.journey?.[s.id]) && !after.achievements['journey-done']) awardXp(profile.id, JOURNEY_XP.finish, 'סיימתם את כל המסע! 🗺️');
    }
    checkAchievements(profile.id);
    fireConfetti(stars === 3);
    const doneAfter = JOURNEY.filter((s) => after.journey?.[s.id]).length;
    setFinished({ stars, prevStars: prev?.stars ?? 0, chestReady: chestsEarned(doneAfter) > (after.journeyChests ?? 0) });
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

  const best = finished ? Math.max(finished.stars, finished.prevStars) : 0;
  const stickerMsg = !finished
    ? ''
    : finished.prevStars === 0
      ? best >= 3
        ? '🎁 מדבקת זהב חדשה לאלבום! ✨'
        : '🎁 מדבקה חדשה לאלבום!'
      : finished.stars >= 3 && finished.prevStars < 3
        ? '✨ שדרגתם למדבקת זהב!'
        : best >= 3
          ? 'מדבקת הזהב כבר באלבום ✨'
          : 'המדבקה כבר באלבום – 3 כוכבים יהפכו אותה לזהב ✨';

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
            {answerOrder(station.quiz[qi]).map((i) => {
              const q = station.quiz[qi];
              const o = q.options[i];
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
              <span key={i} className={clsx('inline-block anim-grow', i >= finished.stars && 'grayscale opacity-30')} style={{ animationDelay: `${0.2 + i * 0.25}s` }}>
                ⭐
              </span>
            ))}
          </div>
          <div className="text-slate-600">{finished.stars === 3 ? 'מושלם! עניתם נכון על הכל בפעם הראשונה 🐂👏' : 'כל הכבוד! אפשר לחזור לתחנה ולנסות לקבל 3 כוכבים.'}</div>
          <div className="mt-4 rounded-2xl bg-gradient-to-b from-amber-50 to-white border border-amber-100 p-3">
            <div className="text-sm font-extrabold text-amber-800 mb-2">{stickerMsg}</div>
            <div className="inline-block anim-grow" style={{ animationDelay: '0.9s' }}>
              <Sticker emoji={station.sticker.emoji} name={station.sticker.name} kind={best >= 3 ? 'gold' : 'normal'} big />
            </div>
          </div>
          {finished.chestReady && (
            <Link to="/journey" className="mt-3 block rounded-2xl bg-amber-100 border-2 border-amber-300 px-3 py-2 font-extrabold text-amber-900 anim-pulse-ring">
              🎁 תיבת אוצר חדשה מחכה לכם במפה!
            </Link>
          )}
          <div className="flex gap-2 justify-center mt-5 flex-wrap">
            <button className="btn-soft" onClick={() => nav('/journey')}>
              🗺️ למפה
            </button>
            {station.lesson && (
              <Link to={`/learn/${station.lesson.id}`} className="btn-soft">
                🎓 {station.lesson.label}
              </Link>
            )}
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
