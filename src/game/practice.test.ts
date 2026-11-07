import { describe, expect, it } from 'vitest';
import { makeQuestion, recordAnswer, seeded, PRACTICE_XP, type PracticeKind, type PracticeLevel } from './practice';
import { JOURNEY, JOURNEY_CHAPTERS, CHEST_COUNT, chestsEarned, stickerKind, PERCENT_STATIONS, RETURN_STATIONS, answerOrder } from './journey';
import { GLOSSARY } from '@/content/glossary';

const strip = (s: string) => s.replace(/[⁦-⁩‎]/g, '');
const num = (s: string) => Number(strip(s).replace(/[₪%,\s]/g, ''));

describe('practice generator', () => {
  const kinds: PracticeKind[] = ['percent-of', 'what-percent', 'discount', 'change', 'return', 'compare', 'updown', 'recover'];
  it('produces valid questions with distinct options and integer answers at every level', () => {
    const rng = seeded(42);
    for (const level of [1, 2, 3] as PracticeLevel[]) {
      for (let i = 0; i < 600; i++) {
        const q = makeQuestion(level, rng);
        expect(q.options.length).toBeGreaterThanOrEqual(3);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
        expect(Number.isInteger(q.value), `${q.kind}: ${q.text} = ${q.value}`).toBe(true);
        expect(q.text.length).toBeGreaterThan(5);
        expect(q.explain.length).toBeGreaterThan(5);
        if (q.kind !== 'compare') expect(num(q.options[q.answer])).toBe(q.value);
      }
    }
  });

  it('computes the right answers', () => {
    const rng = seeded(7);
    for (const kind of kinds) {
      for (let i = 0; i < 200; i++) {
        const level = (kind === 'updown' || kind === 'recover' ? 3 : kind === 'compare' || kind === 'change' ? 2 : 1 + (i % 3)) as PracticeLevel;
        const q = makeQuestion(level, rng, kind);
        const t = strip(q.text);
        const nums = [...t.matchAll(/(\d[\d,]*)/g)].map((m) => Number(m[1].replace(/,/g, '')));
        if (q.kind === 'percent-of') {
          const [p, a] = nums;
          expect(q.value).toBe((a * p) / 100);
        } else if (q.kind === 'discount') {
          const [price, d] = nums;
          const save = (price * d) / 100;
          expect(q.value).toBe(t.includes('כמה משלמים') ? price - save : save);
        } else if (q.kind === 'return') {
          const [inv, x] = nums;
          const profit = t.includes('הרווחתם') ? x : x - inv;
          expect(q.value).toBe((profit / inv) * 100);
        } else if (q.kind === 'change') {
          const [a, b] = nums;
          expect(q.value).toBeCloseTo((Math.abs(b - a) / a) * 100, 9);
        } else if (q.kind === 'recover') {
          const low = nums[1];
          expect(q.value).toBeCloseTo(((100 - low) / low) * 100, 9);
        } else if (q.kind === 'compare') {
          expect(['נועה', 'יואב', 'מאיה', 'איתי', 'שירה', 'עומר', 'דנה', 'אורי', 'תמר', 'עידו']).toContain(q.options[q.answer]);
        } else if (q.kind === 'what-percent' && q.grid !== undefined) {
          expect(q.value).toBe(q.grid);
        }
      }
    }
  });

  it('caps daily XP, pays streak bonus and the daily-goal bonus once', () => {
    let s = recordAnswer(undefined, true, 1, 1, '2026-11-07');
    expect(s.xp).toBe(PRACTICE_XP.perCorrect[1]);
    let total = s.xp;
    let goals = 0;
    for (let i = 2; i <= 40; i++) {
      s = recordAnswer(s.stats, true, 3, i, '2026-11-07');
      total += s.xp;
      if (s.goalReached) goals++;
    }
    expect(goals).toBe(1);
    expect(s.stats.dayXp).toBeLessThanOrEqual(PRACTICE_XP.dailyCap);
    expect(total).toBe(PRACTICE_XP.dailyCap + PRACTICE_XP.dailyGoalBonus);
    expect(s.stats.bestStreak).toBe(40);
    expect(s.stats.hardCorrect).toBe(39);
    // יום חדש – מתחילים מחדש
    const next = recordAnswer(s.stats, true, 1, 1, '2026-11-08');
    expect(next.xp).toBe(PRACTICE_XP.perCorrect[1]);
    expect(next.stats.dayCorrect).toBe(1);
    // תשובה שגויה – בלי XP
    const wrong = recordAnswer(next.stats, false, 1, 0, '2026-11-08');
    expect(wrong.xp).toBe(0);
    expect(wrong.stats.answered).toBe(next.stats.answered + 1);
  });
});

describe('journey: percent & return worlds', () => {
  it('has the new stations in order, valid content and stickers', () => {
    const ids = JOURNEY.map((s) => s.id);
    for (const id of [...PERCENT_STATIONS, ...RETURN_STATIONS]) expect(ids).toContain(id);
    expect(ids.indexOf('percent-up-down')).toBeLessThan(ids.indexOf('return'));
    expect(ids.indexOf('return')).toBeLessThan(ids.indexOf('return-compare'));
    expect(new Set(ids).size).toBe(ids.length);
    const terms = new Set(GLOSSARY.map((g) => g.id));
    const stickerEmojis = new Set<string>();
    for (const st of JOURNEY) {
      expect(st.sticker.emoji.length).toBeGreaterThan(0);
      stickerEmojis.add(st.sticker.emoji);
      expect(st.cards.length).toBeGreaterThanOrEqual(2);
      for (const c of [...st.cards.map((c) => c.text), ...st.quiz.map((q) => q.explain)]) for (const m of c.matchAll(/\[\[([^\]|]+)/g)) expect(terms.has(m[1]), `${st.id}: ${m[1]}`).toBe(true);
      for (const q of st.quiz) {
        expect(q.answer).toBeLessThan(q.options.length);
        expect(answerOrder(q).length).toBe(q.options.length);
      }
    }
    expect(stickerEmojis.size).toBe(JOURNEY.length);
    for (const ch of JOURNEY_CHAPTERS) expect(ids).toContain(ch.start);
  });

  it('awards stickers and chests', () => {
    expect(stickerKind(undefined, 'money')).toBe('none');
    expect(stickerKind({ money: { stars: 2 } }, 'money')).toBe('normal');
    expect(stickerKind({ money: { stars: 3 } }, 'money')).toBe('gold');
    expect(chestsEarned(2)).toBe(0);
    expect(chestsEarned(3)).toBe(1);
    expect(chestsEarned(JOURNEY.length)).toBe(CHEST_COUNT);
  });
});
