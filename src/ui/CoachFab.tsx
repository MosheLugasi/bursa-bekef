import { useLocation } from 'react-router-dom';
import { useUI } from '@/state/ui';
import { useActivePortfolio } from '@/state/store';
import { COACH, coachForPath } from '@/game/coach';

/** כפתור "שורי מסביר" בכותרת של כל מסך – מפעיל מחדש את ההסבר של המסך, גם אם כבר ראו אותו */
export function CoachButton() {
  const { pathname } = useLocation();
  const openCoach = useUI((s) => s.openCoach);
  const p = useActivePortfolio();
  let key = coachForPath(pathname);
  if (key === 'portfolio' && p?.mode === 'history') key = 'timeMachine';
  if (!COACH[key]) return null;
  return (
    <button
      type="button"
      onClick={() => openCoach(key)}
      aria-label="שורי מסביר את המסך"
      title="שורי מסביר את המסך"
      className="flex items-center gap-1.5 rounded-full bg-brand-50 border-2 border-brand-200 h-10 ps-1.5 pe-2.5 hover:border-brand-500 active:scale-95 transition"
    >
      <span className="relative text-2xl leading-none anim-float">
        🐂
        <span className="absolute -top-1 -left-1.5 w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] font-bold grid place-items-center">?</span>
      </span>
      <span className="text-sm font-bold text-brand-700 hidden sm:inline">שורי מסביר</span>
    </button>
  );
}
