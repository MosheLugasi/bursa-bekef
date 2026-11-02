import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LESSON_BY_ID, LESSONS } from '@/content';
import { useCurrentProfile, useGame } from '@/state/store';
import { useUI } from '@/state/ui';
import { awardXp, checkAchievements, fireConfetti } from '@/game/actions';
import { FEATURE_INFO, hasFeature, type Feature } from '@/game/features';
import { XP } from '@/game/xp';
import { Empty, ProgressBar, RichText, useCoachOnce } from '@/ui/components';
import { clsx } from '@/ui/format';

export default function LessonPage() {
  useCoachOnce('lesson');
  const { id } = useParams();
  const lesson = LESSON_BY_ID[id ?? ''];
  const profile = useCurrentProfile()!;
  const update = useGame((s) => s.updateProfile);
  const celebrate = useUI((s) => s.celebrate);
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [showAdult, setShowAdult] = useState(profile.ageGroup === 'adult');
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  if (!lesson) return <Empty emoji="🤷" title="השיעור לא נמצא" />;
  const slides = lesson.slides;
  const inQuiz = step >= slides.length;
  const total = slides.length + lesson.quiz.length;
  const progress = finished ? 1 : (inQuiz ? slides.length + qi : step) / total;
  const nextLesson = LESSONS[LESSONS.findIndex((l) => l.id === lesson.id) + 1];

  const finish = (finalScore: number) => {
    setFinished(true);
    const prev = profile.lessons[lesson.id];
    const before = (Object.keys(FEATURE_INFO) as Feature[]).filter((f) => hasFeature(profile, f));
    update(profile.id, (p) => ({
      ...p,
      lessons: { ...p.lessons, [lesson.id]: { score: Math.max(finalScore, prev?.score ?? 0), total: lesson.quiz.length, at: new Date().toISOString() } }
    }));
    if (!prev) awardXp(profile.id, XP.lessonBase + finalScore * XP.lessonPerCorrect, `סיימתם את "${lesson.title}"`);
    else if (finalScore > prev.score) awardXp(profile.id, (finalScore - prev.score) * XP.lessonPerCorrect, 'שיפור בבוחן');
    const after = useGame.getState().profiles[profile.id];
    const newly = (Object.keys(FEATURE_INFO) as Feature[]).filter((f) => hasFeature(after, f) && !before.includes(f));
    for (const f of newly) celebrate({ type: 'unlock', feature: `${FEATURE_INFO[f].emoji} ${FEATURE_INFO[f].name} – עכשיו אפשר להשתמש בזה במשחק!` });
    fireConfetti(finalScore === lesson.quiz.length);
    checkAchievements(profile.id);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button className="btn-ghost px-2" onClick={() => nav('/learn')}>
          → חזרה
        </button>
        <div className="flex-1">
          <div className="font-bold">
            {lesson.emoji} {lesson.title}
          </div>
          <ProgressBar value={progress} className="mt-1" color="bg-emerald-500" />
        </div>
      </div>

      {!inQuiz && (
        <div className="card p-5 min-h-[320px] flex flex-col animate-fadein" key={step}>
          <div className="text-6xl text-center mb-3">{slides[step].emoji ?? '🐂'}</div>
          <h2 className="text-2xl font-extrabold text-center mb-3">{slides[step].title}</h2>
          <div className="text-lg leading-relaxed flex-1">
            <RichText text={slides[step].body} />
          </div>
          {slides[step].adult && (
            <div className="mt-4">
              <button className="text-sm font-semibold text-brand-700" onClick={() => setShowAdult(!showAdult)}>
                {showAdult ? '▾' : '◂'} 🧑 הרחבה למבוגרים
              </button>
              {showAdult && (
                <div className="mt-2 rounded-xl bg-slate-50 p-3 text-slate-700">
                  <RichText text={slides[step].adult!} />
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 mt-5">
            {step > 0 && (
              <button className="btn-soft" onClick={() => setStep(step - 1)}>
                → הקודם
              </button>
            )}
            <button className="btn-primary flex-1 text-lg" onClick={() => setStep(step + 1)}>
              {step === slides.length - 1 ? '🎯 לבוחן!' : 'הבא ←'}
            </button>
          </div>
        </div>
      )}

      {inQuiz && !finished && (
        <div className="card p-5 animate-fadein" key={'q' + qi}>
          <div className="text-sm text-brand-600 font-semibold mb-1">
            שאלה {qi + 1} מתוך {lesson.quiz.length}
          </div>
          <div className="text-xl font-bold mb-4">
            <RichText text={lesson.quiz[qi].q} />
          </div>
          <div className="grid gap-2">
            {lesson.quiz[qi].options.map((o, i) => {
              const q = lesson.quiz[qi];
              const show = picked !== null;
              return (
                <button
                  key={i}
                  disabled={show}
                  onClick={() => {
                    setPicked(i);
                    if (i === q.answer) setScore(score + 1);
                  }}
                  className={clsx(
                    'rounded-xl border-2 px-4 py-3 text-right font-medium text-lg transition',
                    !show && 'border-slate-200 hover:border-brand-400 hover:bg-brand-50',
                    show && i === q.answer && 'border-emerald-500 bg-up-bg',
                    show && picked === i && i !== q.answer && 'border-rose-400 bg-down-bg',
                    show && i !== q.answer && picked !== i && 'opacity-50 border-slate-100'
                  )}
                >
                  {show && i === q.answer ? '✅ ' : show && picked === i ? '❌ ' : ''}
                  <RichText text={o} plain />
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className="mt-4 space-y-3">
              <div className={clsx('rounded-xl p-3', picked === lesson.quiz[qi].answer ? 'bg-up-bg' : 'bg-amber-50')}>
                <div className="font-bold">{picked === lesson.quiz[qi].answer ? '🎉 נכון!' : '🙂 כמעט!'}</div>
                <RichText text={lesson.quiz[qi].explain} />
              </div>
              <button
                className="btn-primary w-full text-lg"
                onClick={() => {
                  if (qi === lesson.quiz.length - 1) finish(score);
                  else {
                    setQi(qi + 1);
                    setPicked(null);
                  }
                }}
              >
                {qi === lesson.quiz.length - 1 ? 'סיום 🏁' : 'לשאלה הבאה ←'}
              </button>
            </div>
          )}
        </div>
      )}

      {finished && (
        <div className="card p-6 text-center animate-pop">
          <div className="text-7xl">{score === lesson.quiz.length ? '🏆' : score >= lesson.quiz.length * 0.6 ? '🌟' : '💪'}</div>
          <div className="text-2xl font-extrabold mt-2">
            {score} מתוך {lesson.quiz.length} תשובות נכונות!
          </div>
          <div className="text-slate-600 mt-1">{score === lesson.quiz.length ? 'מושלם! שורי גאה בכם 🐂' : 'כל הכבוד! אפשר לחזור על השיעור כדי לשפר.'}</div>
          <div className="flex gap-2 mt-5 justify-center flex-wrap">
            <button
              className="btn-soft"
              onClick={() => {
                setStep(0);
                setQi(0);
                setPicked(null);
                setScore(0);
                setFinished(false);
              }}
            >
              🔁 שוב
            </button>
            {nextLesson && (
              <Link to={`/learn/${nextLesson.id}`} className="btn-primary" onClick={() => { setStep(0); setQi(0); setPicked(null); setScore(0); setFinished(false); }}>
                לשיעור הבא: {nextLesson.emoji} {nextLesson.title}
              </Link>
            )}
            <Link to="/market" className="btn-buy">
              📈 לנסות בשוק
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
