import { useState } from 'react';
import { addMember, removeMember, type AdminFamily } from '@/state/cloud';
import { inviteAppUser, type AppUser } from '@/state/admin';

/** חברי משפחה (חשבונות Google): הוספה, הסרה והזמנה למי שעוד לא נכנס */
export function FamilyMembersEditor({ f, users, run }: { f: AdminFamily; users: Map<string, AppUser>; run: (p: Promise<string | undefined>, email?: string) => Promise<string | undefined> }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'owner' | 'member'>(f.family_members.length ? 'member' : 'owner');
  const [invited, setInvited] = useState<string[]>([]);
  return (
    <div className="space-y-1">
      {f.family_members.map((m) => {
        const u = users.get(m.email);
        return (
          <div key={m.email} className="flex flex-wrap items-center gap-2 text-xs rounded-lg bg-slate-50 px-2 py-1.5">
            <span className="flex-1 min-w-40">
              {u?.name && <strong className="ml-1">{u.name}</strong>}
              <span dir="ltr" className="break-all text-slate-600">{m.email}</span>
            </span>
            <span className="chip">{m.role === 'owner' ? 'בעלים' : 'שותף'}</span>
            {!u &&
              (invited.includes(m.email) ? (
                <span className="text-emerald-700">✅ הוזמן</span>
              ) : (
                <button className="text-brand-700 font-semibold" title="עוד לא נכנס/ה לאפליקציה" onClick={async () => !(await run(inviteAppUser(m.email))) && setInvited([...invited, m.email])}>
                  📧 הזמנה
                </button>
              ))}
            <button className="text-down" title="הסרה מהמשפחה" onClick={() => confirm(`להסיר את ${m.email} מ${f.name}?`) && run(removeMember(f.id, m.email), m.email)}>
              ✕
            </button>
          </div>
        );
      })}
      <div className="flex gap-2 pt-1">
        <input className="input text-xs flex-1" dir="ltr" type="email" placeholder="email@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select className="input text-xs w-24" value={role} onChange={(e) => setRole(e.target.value as 'owner' | 'member')}>
          <option value="member">שותף</option>
          <option value="owner">בעלים</option>
        </select>
        <button className="btn-soft text-xs" disabled={!email.includes('@')} onClick={async () => !(await run(addMember(f.id, email, role), email.trim().toLowerCase())) && setEmail('')}>
          ➕ הוספה
        </button>
      </div>
    </div>
  );
}