import { useCallback, useEffect, useState } from 'react';
import { adminData, errText, type AdminFamily } from '@/state/cloud';
import { listAppUsers, type AppUser } from '@/state/admin';

export interface PendingPerson {
  email: string;
  name: string | null;
  created_at: string;
  requested: boolean;
}
export interface AdminView {
  families: AdminFamily[];
  users: AppUser[];
  pending: PendingPerson[];
  error?: string;
}

/** כל הנתונים למסך הניהול: משפחות, משתמשים, ומי שממתין לאישור (נכנס/ביקש ואין לו משפחה) */
export function useAdminData(enabled: boolean) {
  const [data, setData] = useState<AdminView>();
  const load = useCallback(async () => {
    let usersErr: string | undefined;
    const [d, users] = await Promise.all([adminData(), listAppUsers().catch((e) => ((usersErr = errText(e)), [] as AppUser[]))]);
    const inFamily = new Set(d.families.flatMap((f) => f.family_members.map((m) => m.email)));
    const map = new Map<string, PendingPerson>();
    for (const u of users) if (!inFamily.has(u.email)) map.set(u.email, { email: u.email, name: u.name, created_at: u.created_at, requested: false });
    for (const r of d.requests) if (!inFamily.has(r.email)) map.set(r.email, { email: r.email, name: r.name ?? map.get(r.email)?.name ?? null, created_at: r.created_at, requested: true });
    setData({ families: d.families, users, pending: [...map.values()], error: d.error ?? usersErr });
  }, []);
  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);
  return { data, load };
}