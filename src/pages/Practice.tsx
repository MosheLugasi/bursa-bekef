// "זירת האימון של שורי" – תרגול אינסופי באחוזים ובתשואה, עם רצף, XP ויעד יומי
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentProfile, useGame } from '@/state/store';
import { useUI } from '@/state/ui';
import { awardXp, checkAchievements, fireConfetti } from '@/game/actions';
import { KIND_LABEL, LEVELS, PRACTICE_XP, makeQuestion, recordAnswer, type PracticeLevel, type PracticeQuestion } from '@/game/practice';
import { todayISO } from '@/engine/dates';
import { HelpButton, ProgressBar, useCoachOnce } from '@/ui/components';
import { clsx } from '@/ui/format';

const CHEERS = ['מעולה!', 'כל הכבוד!', 'בול!', 'אלופים!', 'וואו!', 'יפה מאוד!', 'גאונים!'];
const CHEER_EMOJI = ['🎉', '🌟', '💪', '🚀', '🐂', '🥳', '🏆'];

function MiniGrid({ n }: { n: number }) {
  return (
    <div className="grid grid-cols-10 gap-[2px] w-[120px] h-[120px] mx-auto" aria-hidden="true">
      {Array.from({ length: 100 }, (_, i) => (
        <span key={i} className={clsx('rounded-[2px]', i < n ? 'bg-violet-500' : 'bg-slate-200')} />
      ))}
    </div>
  );
}

export default function Practice() {
  const profile = useCurrentProfile()!;
  const update = useGame((s) => s.updateProfile);
  const toast = useUI((s) => s.toast);
  useCoachOnce('practice');
  const [level, setLevel] = useState<PracticeLevel>(profile.ageGroup === 'adult' ? 2 : 1);
  const [q, setQ] = useState<PracticeQuestion>(() => makeQuestion(profile.ageGroup === 'adult' ? 2 : 1));
  const [picked, setPicked] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [gained, setGained] = useState(0);
  const [hint, setHint] = useState(false);
  const [cheer, setCheer] = useState(0);
  const [sessionRight, setSessionRight] = useState(0);
  const [sessionAll, setSessionAll] = useState(0);

  const today = todayISO();
  const st = profile.practice;
  const dayCorrect = st?.day === today ? st.dayCorrect ?? 0 : 0;
  const dayXp = st?.day === today ? st.dayXp ?? 0 : 0;
  const capped = dayXp >= PRACTICE_XP.dailyCap;
  const right = picked !== null && picked === q.answer;
  const levelInfo = useMemo(() => LEVELS.find((l) => l.level === level)!, [level]);

  const nextQuestion = (lvl: PracticeLevel = level) => {
    setQ(makeQuestion(lvl));
    setPicked(null);
    setHint(false);
    setGained(0);
  };

  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const ok = i === q.answer;
    const newStreak = ok ? streak + 1 : 0;
    setStreak(newStreak);
    setSessionAll((x) => x + 1);
    if (ok) setSessionRight((x) => x + 1);
    const res = recordAnswer(profile.practice, ok, level, newStreak, today);
    update(profile.id, (p) => ({ ...p, practice: res.stats }));
    setGained(res.xp);
    if (ok) {
      setCheer(Math.floor(Math.random() * CHEERS.length));
      if (res.xp > 0) awardXp(profile.id, res.xp);
      if (res.streakBonus) {
        fireConfetti(newStreak >= 10);
        toast({ emoji: '🔥', text: `${newStreak} תשובות נכונות ברצף!`, kind: 'good' });
      }
      if (res.goalReached) {
        fireConfetti(true);
        toast({ emoji: '🎯', text: `יעד יומי הושג! +${PRACTICE_XP.dailyGoalBonus} XP בונוס`, kind: 'good' });
      }
      checkAchievements(profile.id);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">🏋️ זירת האימון של שורי</h1>
          <p className="text-sm text-slate-600">תרגול אחוזים ותשואה – כל תשובה נכונה שווה XP</p>
        </div>
        <HelpButton coachKey="practice" />
      </div>

      <div className="grid grid-cols-3 gap-2" role="group" aria-label="רמת קושי">
        {LEVELS.map((l) => (
          <button
            key={l.level}
            type="button"
            onClick={() => {
              setLevel(l.level);
              nextQuestion(l.level);
            }}
            aria-pressed={level === l.level}
            className={clsx('rounded-2xl border-2 px-2 py-2 text-center transition', level === l.level ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50')}
          >
            <div className="text-2xl">{l.emoji}</div>
            <div className="text-sm font-extrabold">{l.title}</div>
            <div className="text-[11px] text-slate-500">
              <span className="num">{`+${PRACTICE_XP.perCorrect[l.level]} XP`}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="card p-3">
        <div className="flex items-center gap-3 text-sm font-bold">
          <span className={clsx('text-2xl', streak > 0 && 'anim-bob')} title="רצף">
            🔥
          </span>
          <span>
            רצף: <span className="num text-orange-600 text-lg">{streak}</span>
          </span>
          <span className="text-slate-400">|</span>
          <span>
            🏅 שיא: <span className="num">{Math.max(st?.bestStreak ?? 0, streak)}</span>
          </span>
          <span className="flex-1" />
          <span className="text-xs text-slate-500">
            XP היום: <span className="num">{`${dayXp}/${PRACTICE_XP.dailyCap}`}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs font-bold">
          <span>🎯 יעד יומי</span>
          <ProgressBar value={Math.min(1, dayCorrect / PRACTICE_XP.dailyGoal)} className="flex-1" color={dayCorrect >= PRACTICE_XP.dailyGoal ? 'bg-emerald-500' : 'bg-amber-400'} />
          <span>
            <span className="num">{`${Math.min(dayCorrect, PRACTICE_XP.dailyGoal)}/${PRACTICE_XP.dailyGoal}`}</span>
            {dayCorrect >= PRACTICE_XP.dailyGoal && ' ✅'}
          </span>
        </div>
      </div>

      <div className={clsx('card p-5 animate-fadein', picked !== null && !right && 'anim-shake')} key={q.text + level}>
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="rounded-full bg-brand-50 text-brand-700 px-2 py-0.5">{KIND_LABEL[q.kind]}</span>
          <span className="text-slate-500">
            {levelInfo.emoji} {levelInfo.title}
          </span>
        </div>
        <div className="text-center text-5xl my-2">{picked === null ? '🤔' : right ? CHEER_EMOJI[cheer] : '🙈'}</div>
        {q.grid !== undefined && <MiniGrid n={q.grid} />}
        <div className="text-xl font-extrabold text-center my-3 leading-relaxed">{q.text}</div>
        <div className="grid grid-cols-2 gap-2">
          {q.options.map((o, i) => {
            const isRight = picked !== null && i === q.answer;
            const isWrong = picked === i && i !== q.answer;
            return (
              <button
                key={i}
                type="button"
                disabled={picked !== null}
                onClick={() => choose(i)}
                className={clsx(
                  'rounded-2xl border-2 px-3 py-3 text-lg font-extrabold transition',
                  q.options.length === 3 && i === 2 && 'col-span-2',
                  isRight ? 'border-emerald-500 bg-up-bg' : isWrong ? 'border-rose-400 bg-down-bg' : picked !== null ? 'border-slate-100 bg-white opacity-60' : 'border-slate-200 bg-white hover:border-brand-400 hover:bg-brand-50 active:scale-95'
                )}
              >
                {isRight ? '✅ ' : isWrong ? '❌ ' : ''}
                {o}
              </button>
            );
          })}
        </div>
        {picked === null && (
          <div className="text-center mt-3">
            {hint ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm font-semibold animate-fadein">{q.hint}</div>
            ) : (
              <button type="button" className="text-sm font-bold text-amber-700" onClick={() => setHint(true)}>
                💡 רמז
              </button>
            )}
          </div>
        )}
        {picked !== null && (
          <div className="mt-4 space-y-3 animate-fadein">
            <div className={clsx('rounded-xl p-3 text-center', right ? 'bg-up-bg' : 'bg-amber-50 border border-amber-200')}>
              <div className="font-extrabold text-lg">
                {right ? (
                  <>
                    {CHEERS[cheer]} {gained > 0 ? <span className="text-emerald-700 num">{`+${gained} XP`}</span> : capped ? <span className="text-xs text-slate-500">(הגעתם לתקרת ה-XP היומית – אבל האימון ממשיך!)</span> : null}
                  </>
                ) : (
                  <>
                    לא נורא! התשובה הנכונה: <span className="text-emerald-700">{q.options[q.answer]}</span>
                  </>
                )}
              </div>
              <div className="text-sm mt-1 leading-relaxed">{q.explain}</div>
            </div>
            {right && streak >= 5 && level < 3 && streak % 5 === 0 && (
              <button
                type="button"
                className="w-full rounded-xl border-2 border-dashed border-emerald-400 bg-emerald-50 px-3 py-2 font-bold text-emerald-800"
                onClick={() => {
                  const l = (level + 1) as PracticeLevel;
                  setLevel(l);
                  nextQuestion(l);
                }}
              >
                🚀 {streak} ברצף! רוצים לעלות לשלב {LEVELS[level].title}?
              </button>
            )}
            <button type="button" className="btn-primary w-full text-lg" onClick={() => nextQuestion()}>
              שאלה הבאה ←
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          באימון הזה: <span className="num">{`${sessionRight}/${sessionAll}`}</span> נכונות · בסך הכל: <span className="num">{st?.correct ?? 0}</span> ✅
        </span>
        <Link to="/journey" className="font-bold text-brand-700">
          🗺️ למסע של שורי
        </Link>
      </div>
    </div>
  );
}
