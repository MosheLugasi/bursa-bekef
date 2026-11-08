import type { AdminFamily } from '@/state/cloud';
import type { AppUser } from '@/state/admin';

/** כל המשתמשים שנכנסו לאפליקציה, ולאיזו משפחה הם שייכים */
export function UsersList({ users, families }: { users: AppUser[]; families: AdminFamily[] }) {
  const famsOf = (email: string) => families.filter((f) => f.family_members.some((m) => m.email === email)).map((f) => f.name);
  if (!users.length) return <div className="text-sm text-slate-500">עוד אין משתמשים.</div>;
  return (
    <div className="divide-y divide-slate-100">
      {users.map((u) => {
        const fams = famsOf(u.email);
        return (
          <div key={u.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <span className="flex-1 min-w-48">
              <strong className="ml-1">{u.name ?? 'ללא שם'}</strong>
              <span dir="ltr" className="text-slate-600 break-all">{u.email}</span>
            </span>
            {u.role === 'admin' && <span className="chip text-xs">🛡️ מנהל</span>}
            {fams.length ? fams.map((n) => <span key={n} className="chip text-xs">🏠 {n}</span>) : <span className="chip text-xs bg-amber-50">⏳ ממתין לאישור</span>}
            <span className="text-xs text-slate-400">{new Date(u.created_at).toLocaleDateString('he-IL')}</span>
          </div>
        );
      })}
    </div>
  );
}