import { useMemo, useState } from 'react';
import { GLOSSARY, TERM_CATEGORIES } from '@/content';
import { useCurrentProfile } from '@/state/store';
import { useUI } from '@/state/ui';
import { RichText, useCoachOnce } from '@/ui/components';
import { clsx } from '@/ui/format';
import type { GlossaryTerm } from '@/content/types';

export default function Glossary() {
  useCoachOnce('glossary');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<GlossaryTerm['category'] | ''>('');
  const open = useUI((s) => s.openTerm);
  const profile = useCurrentProfile()!;
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return GLOSSARY.filter((t) => (!cat || t.category === cat) && (!s || t.term.toLowerCase().includes(s) || (t.en ?? '').toLowerCase().includes(s) || t.kid.includes(q.trim()))).sort((a, b) => a.term.localeCompare(b.term, 'he'));
  }, [q, cat]);
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-extrabold">📖 מילון מושגים</h1>
      <div className="text-sm text-slate-600">
        {GLOSSARY.length} מושגים · קראתם {profile.readTerms.length} · כל מושג חדש = +1 XP
      </div>
      <input className="input" placeholder="🔍 חיפוש מושג (למשל: דיבידנד, P/E, אופציה)" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        <button className={clsx('chip', !cat && 'chip-on')} onClick={() => setCat('')}>
          הכל
        </button>
        {(Object.keys(TERM_CATEGORIES) as GlossaryTerm['category'][]).map((c) => (
          <button key={c} className={clsx('chip', cat === c && 'chip-on')} onClick={() => setCat(c)}>
            {TERM_CATEGORIES[c]}
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {list.map((t) => (
          <button key={t.id} onClick={() => open(t.id)} className="card p-3 text-right hover:shadow-md">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">{t.term}</span>
              {profile.readTerms.includes(t.id) && <span className="text-xs text-emerald-600">✓</span>}
            </div>
            <div className="text-sm text-slate-600 line-clamp-2">
              <RichText text={t.kid} plain />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
