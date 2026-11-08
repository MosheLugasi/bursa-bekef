import { useState } from 'react';
import { adminDeleteFamily, adminUpdateFamily, type AdminFamily } from '@/state/cloud';
import type { AppUser } from '@/state/admin';
import { clsx } from '@/ui/format';
import { FamilyMembersEditor } from './FamilyMembersEditor';

/** כרטיס ניהול של חשבון משפחה: חברים, מכסת שחקנים, השבתה ומחיקה */
export function FamilyCard({ f, users, onChange }: { f: AdminFamily; users: Map<string, AppUser>; onChange: (email?: string) => void }) {
  const [msg, setMsg] = useState<string>();
  const [del, setDel] = useState(false);
  const run = async (p: Promise<string | undefined>, email?: string) => {
    const e = await p;
    setMsg(e);
    onChange(email);
    return e;
  };
  return (
    <div className={clsx('rounded-xl border p-3 text-sm space-y-2', f.active ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-100 opacity-70')}>
      <div className="flex items-center gap-2">
        <span className="text-xl">🏠</span>
        <span className="font-bold flex-1">{f.name}</span>
        {!f.active && <span className="chip text-xs">מושבת</span>}
      </div>
      <div className="text-xs text-slate-600">
        שחקנים <span className="num font-bold">{f.stats?.profiles ?? 0}</span>/<span className="num">{f.max_profiles}</span> · תיקים <span className="num">{f.stats?.portfolios ?? 0}</span>
        {f.stats?.last_sync && <> · פעילות אחרונה {new Date(f.stats.last_sync).toLocaleDateString('he-IL')}</>}
      </div>
      <FamilyMembersEditor f={f} users={users} run={run} />
      <div className="flex flex-wrap gap-2 items-center pt-1">
        <span className="text-xs">מכסת שחקנים:</span>
        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => run(adminUpdateFamily(f.id, { max_profiles: Math.max(1, f.max_profiles - 1) }))}>−</button>
        <span className="num font-bold">{f.max_profiles}</span>
        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => run(adminUpdateFamily(f.id, { max_profiles: Math.min(50, f.max_profiles + 1) }))}>+</button>
        <span className="flex-1" />
        <button className="btn-ghost text-xs" onClick={() => run(adminUpdateFamily(f.id, { active: !f.active }))}>{f.active ? '⏸️ השבתה' : '▶️ הפעלה'}</button>
        {!del ? (
          <button className="btn-ghost text-xs text-down" onClick={() => setDel(true)}>🗑️</button>
        ) : (
          <button className="btn-sell text-xs" onClick={() => run(adminDeleteFamily(f.id))}>מחיקה סופית (כולל הנתונים)</button>
        )}
      </div>
      {msg && <div className="text-xs text-down">{msg}</div>}
    </div>
  );
}