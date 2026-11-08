// פעולות ניהול למנהל המשחק: משתמשים רשומים, הזמנות ושיוך למשפחות
import { addMember, adminDeleteRequest, errText, getClient, norm, type Member } from './cloud';

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  created_at: string;
}

export async function listAppUsers(): Promise<AppUser[]> {
  const b = await getClient();
  if (!b) return [];
  const rows = (await b.entities.User.list('-created_date', 1000)) as { id: string; email: string; full_name?: string | null; role?: string; created_date: string }[];
  return rows.map((u) => ({ id: u.id, email: norm(u.email ?? ''), name: u.full_name ?? null, role: u.role ?? 'user', created_at: u.created_date }));
}

/** שליחת הזמנה במייל להצטרף לאפליקציה */
export async function inviteAppUser(email: string): Promise<string | undefined> {
  const b = await getClient();
  if (!b) return 'אין חיבור';
  try {
    await b.auth.inviteUser(norm(email), 'user');
  } catch (e) {
    return errText(e);
  }
  return undefined;
}

/** אישור משתמש ע״י צירוף למשפחה קיימת */
export async function approveToFamily(familyId: string, email: string, role: Member['role']): Promise<string | undefined> {
  const e = await addMember(familyId, email, role);
  if (e) return e;
  await adminDeleteRequest(email);
  return undefined;
}