import { useState } from 'react';
import { adminCreateFamily, adminDeleteRequest, type AdminFamily } from '@/state/cloud';
import { approveToFamily } from '@/state/admin';
import { clsx } from '@/ui/format';
import type { PendingPerson } from './useAdminData';

/** משתמש שממתין לאישור: פתיחת משפחה חדשה עבורו או צירוף למשפחה קיימת */
export function PendingRow({ p, families, onDone }: { p: PendingPerson; families: AdminFamily[]; onDone: (email: string) => void }) {
  const [mode, setMode] = useState<'new' | 'join'>('new');
  const [name, setName] = useState(p.name ? `משפחת ${p.name.split(' ').slice(-1)[0]}` : '');
  const [max, setMax] = useState(4);
  const [fid, setFid] = useState(families[0]?.id ?? '');
  const [role, setRole] = useState<'owner' | 'member'>('member');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const run = async (task: Promise<string | undefined>) => {
    setBusy(true);
    const e = await task;
    setBusy(false);
    setMsg(e);
    if (!e) onDone(p.email);
  };
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <strong>{p.name ?? 'ללא שם'}</strong>
        <span dir="ltr" className="break-all text-slate-600">{p.email}</span>
        {p.requested && <span className="chip text-xs">🙋 ביקש/ה גישה</span>}
        <span className="text-xs text-slate-500">{new Date(p.created_at).toLocaleDateString('he-IL')}</span>
      </div>
      <div className="flex gap-1">
        <button className={clsx('chip text-xs', mode === 'new' && 'chip-on')} onClick={() => setMode('new')}>🏠 משפחה חדשה</button>
        <button className={clsx('chip text-xs', mode === 'join' && 'chip-on')} disabled={!families.length} onClick={() => setMode('join')}>➕ צירוף למשפחה קיימת</button>
      </div>
      {mode === 'new' ? (
        <div className="flex flex-wrap gap-2 items-center">
          <input className="input text-sm flex-1 min-w-32" placeholder="שם המשפחה" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="text-xs flex items-center gap-1">
            שחקנים:
            <input className="input text-sm w-16 num" type="number" min={1} max={50} value={max} onChange={(e) => setMax(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
          </label>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <select className="input text-sm flex-1 min-w-32" value={fid} onChange={(e) => setFid(e.target.value)}>
            {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select className="input text-sm w-28" value={role} onChange={(e) => setRole(e.target.value as 'owner' | 'member')}>
            <option value="member">שותף</option>
            <option value="owner">בעלים</option>
          </select>
        </div>
      )}
      <div className="flex gap-2">
        <button className="btn-buy text-sm flex-1" disabled={busy || (mode === 'join' && !fid)} onClick={() => run(mode === 'new' ? adminCreateFamily(name, p.email, max) : approveToFamily(fid, p.email, role))}>
          {busy ? 'שומרים...' : '✅ אישור'}
        </button>
        {p.requested && (
          <button className="btn-ghost text-sm" disabled={busy} onClick={() => run(adminDeleteRequest(p.email))}>דחיית הבקשה</button>
        )}
      </div>
      {msg && <div className="text-xs text-down">{msg}</div>}
    </div>
  );
}