// חשבונות ענן (לא חובה) – Supabase + התחברות עם Google.
// משפחה = חשבון. מנהל האפליקציה מאשר חשבונות Google ומגדיר לכל משפחה כמה שחקנים מותר לפתוח.
// כל "מסמך" (שחקן / תיק / הגדרות) נשמר כשורה בטבלה family_docs, מוגן ב-RLS לפי חברות במשפחה.
// בלי הגדרת ענן (או בלי התחברות) המשחק עובד כמו קודם – נשמר רק במכשיר.
import { create } from 'zustand';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_APP_SETTINGS, useGame } from './store';
import type { GameState } from './types';

interface CloudConfig {
  url: string;
  anonKey: string;
}

const CFG_KEY = 'bursa-bekef-cloud';
const FAMILY_KEY = 'bursa-bekef-family'; // המשפחה שנבחרה במכשיר
const LINKED_KEY = 'bursa-bekef-linked-family'; // לאיזו משפחה שייכים הנתונים שבמכשיר
const META_PREFIX = 'bursa-bekef-sync-';
const BACKUP_KEY = 'bursa-bekef-backup';

export function builtInConfig(): CloudConfig | undefined {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return url && anonKey ? { url, anonKey } : undefined;
}

export function loadConfig(): CloudConfig | undefined {
  try {
    const c = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
    if (c?.url && c?.anonKey) return c;
  } catch {
    /* ignore */
  }
  return builtInConfig();
}

export function saveConfig(c?: CloudConfig) {
  if (c) localStorage.setItem(CFG_KEY, JSON.stringify(c));
  else localStorage.removeItem(CFG_KEY);
}

export const cloudConfigured = () => !!loadConfig();

// ---------- מצב

export interface Family {
  id: string;
  name: string;
  max_profiles: number;
  active: boolean;
  role: 'owner' | 'member';
}

export type CloudStatus =
  | 'off' // לא הוגדר ענן
  | 'loading'
  | 'signed-out'
  | 'no-access' // מחובר, אבל אין משפחה מאושרת
  | 'pick-family' // יש כמה משפחות – צריך לבחור
  | 'link' // יש במכשיר נתונים שלא שייכים למשפחה – צריך להחליט
  | 'syncing'
  | 'ok'
  | 'error';

interface CloudState {
  status: CloudStatus;
  email?: string;
  name?: string;
  isAdmin: boolean;
  families: Family[];
  family?: Family;
  requested?: boolean;
  error?: string;
  lastSync?: string;
  set: (p: Partial<CloudState>) => void;
}
export const useCloud = create<CloudState>((set) => ({ status: 'off', isAdmin: false, families: [], set: (p) => set(p) }));
const setCloud = (p: Partial<CloudState>) => useCloud.getState().set(p);

let client: SupabaseClient | null = null;
let applying = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let syncing: Promise<void> | null = null;
let initDone = false;

export async function getClient(): Promise<SupabaseClient | null> {
  const cfg = loadConfig();
  if (!cfg) return null;
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, storageKey: 'bursa-bekef-auth', flowType: 'pkce', detectSessionInUrl: true, autoRefreshToken: true }
    });
  }
  return client;
}

// ---------- מסמכים וסנכרון

interface Meta {
  pushed: Record<string, string>; // docId -> updatedAt שנשלח/התקבל
  lastPull?: string;
}
const metaKey = (fid: string) => META_PREFIX + fid;
function loadMeta(fid: string): Meta {
  try {
    const m = JSON.parse(localStorage.getItem(metaKey(fid)) || '');
    if (m && typeof m === 'object' && m.pushed) return m as Meta;
  } catch {
    /* ignore */
  }
  return { pushed: {} };
}
function saveMeta(fid: string, m: Meta) {
  localStorage.setItem(metaKey(fid), JSON.stringify(m));
}

type Doc = { id: string; data: unknown; updatedAt: string };

export function localDocs(s: GameState): Doc[] {
  const docs: Doc[] = [];
  if (s.settings.updatedAt) docs.push({ id: 'settings', data: s.settings, updatedAt: s.settings.updatedAt });
  for (const p of Object.values(s.profiles)) docs.push({ id: 'profile:' + p.id, data: p, updatedAt: p.updatedAt });
  for (const p of Object.values(s.portfolios)) docs.push({ id: 'portfolio:' + p.id, data: p, updatedAt: p.updatedAt });
  return docs;
}

const t = (s?: string) => (s ? Date.parse(s) || 0 : 0);

export interface RemoteRow {
  id: string;
  data: { updatedAt?: string } | null;
  deleted: boolean;
  updated_at: string;
}

/** מיזוג שורות מהענן לתוך המצב המקומי (האחרון שעודכן מנצח). פונקציה טהורה – לבדיקות. */
export function mergeRemote(st: GameState, rows: RemoteRow[], pushed: Record<string, string>): { next: GameState; changed: boolean } {
  const next: GameState = { profiles: { ...st.profiles }, portfolios: { ...st.portfolios }, settings: st.settings, deleted: { ...st.deleted } };
  let changed = false;
  for (const r of rows) {
    const [kind, id] = r.id.includes(':') ? (r.id.split(/:(.*)/s) as [string, string]) : [r.id, ''];
    const local = kind === 'profile' ? next.profiles[id] : kind === 'portfolio' ? next.portfolios[id] : kind === 'settings' ? next.settings : undefined;
    const localTs = t(local?.updatedAt);
    if (r.deleted) {
      if (local && localTs <= t(r.updated_at)) {
        if (kind === 'profile') delete next.profiles[id];
        if (kind === 'portfolio') delete next.portfolios[id];
        changed = true;
      }
      pushed[r.id] = r.updated_at;
      continue;
    }
    if (!r.data) continue;
    const remoteTs = t(r.data.updatedAt ?? r.updated_at);
    if (!local || remoteTs > localTs) {
      if (kind === 'profile') next.profiles[id] = r.data as never;
      else if (kind === 'portfolio') next.portfolios[id] = r.data as never;
      else if (kind === 'settings') next.settings = { ...DEFAULT_APP_SETTINGS, ...(r.data as GameState['settings']) };
      else continue;
      pushed[r.id] = (r.data.updatedAt as string) ?? r.updated_at;
      changed = true;
    } else if (remoteTs === localTs) pushed[r.id] = local!.updatedAt;
  }
  return { next, changed };
}

function quotaMessage(e: unknown): string | undefined {
  const m = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  const q = /PROFILE_QUOTA (\d+)/.exec(m);
  if (q) return `הגעתם למספר השחקנים המקסימלי בחשבון (${q[1]}). כדי להוסיף עוד – בקשו מהמנהל להגדיל את המכסה.`;
  return undefined;
}

async function doSync(): Promise<void> {
  const sb = await getClient();
  const fam = useCloud.getState().family;
  if (!sb || !fam || localStorage.getItem(LINKED_KEY) !== fam.id) return;
  setCloud({ status: 'syncing' });
  const meta = loadMeta(fam.id);
  try {
    // 1) משיכה (עם חפיפה של 2 דקות, כדי לא לפספס כתיבות מקבילות)
    let q = sb.from('family_docs').select('id,data,deleted,updated_at,synced_at').eq('family_id', fam.id);
    if (meta.lastPull) q = q.gt('synced_at', new Date(t(meta.lastPull) - 120_000).toISOString());
    const { data: rows, error } = await q;
    if (error) throw error;
    let maxPulled = meta.lastPull;
    if (rows?.length) {
      for (const r of rows as (RemoteRow & { synced_at: string })[]) if (!maxPulled || t(r.synced_at) > t(maxPulled)) maxPulled = r.synced_at;
      const { next, changed } = mergeRemote(useGame.getState(), rows as RemoteRow[], meta.pushed);
      if (changed) {
        applying = true;
        useGame.setState(next);
        applying = false;
      }
    }
    meta.lastPull = maxPulled;
    // 2) דחיפה
    const st = useGame.getState();
    const ups: { family_id: string; id: string; data: unknown; deleted: boolean; updated_at: string }[] = [];
    for (const d of localDocs(st)) if (meta.pushed[d.id] !== d.updatedAt) ups.push({ family_id: fam.id, id: d.id, data: d.data, deleted: false, updated_at: d.updatedAt || new Date().toISOString() });
    for (const [id, ts] of Object.entries(st.deleted)) if (meta.pushed[id] !== ts) ups.push({ family_id: fam.id, id, data: null, deleted: true, updated_at: ts });
    let quotaErr: string | undefined;
    // קודם הכל חוץ משחקנים חדשים (כדי שחריגה ממכסת השחקנים לא תעצור את שאר הנתונים)
    const isNewProfile = (u: (typeof ups)[number]) => u.id.startsWith('profile:') && !u.deleted && !(u.id in meta.pushed);
    const batch = ups.filter((u) => !isNewProfile(u));
    if (batch.length) {
      const { error: e2 } = await sb.from('family_docs').upsert(batch, { onConflict: 'family_id,id' });
      if (e2) throw e2;
      for (const u of batch) meta.pushed[u.id] = u.deleted ? u.updated_at : ((u.data as { updatedAt?: string })?.updatedAt ?? u.updated_at);
    }
    for (const u of ups.filter(isNewProfile)) {
      const { error: e3 } = await sb.from('family_docs').upsert([u], { onConflict: 'family_id,id' });
      if (e3) {
        quotaErr = quotaMessage(e3);
        if (!quotaErr) throw e3;
        continue;
      }
      meta.pushed[u.id] = (u.data as { updatedAt?: string })?.updatedAt ?? u.updated_at;
    }
    saveMeta(fam.id, meta);
    setCloud({ status: quotaErr ? 'error' : 'ok', error: quotaErr, lastSync: new Date().toISOString() });
  } catch (e) {
    saveMeta(fam.id, meta);
    setCloud({ status: 'error', error: quotaMessage(e) ?? (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)) });
  }
}

export function syncNow(): Promise<void> {
  if (!syncing) syncing = doSync().finally(() => (syncing = null));
  return syncing;
}

// ---------- חשבון

async function loadAccount(): Promise<void> {
  const sb = await getClient();
  if (!sb) return setCloud({ status: 'off' });
  const { data: sess } = await sb.auth.getSession();
  const user = sess.session?.user;
  if (!user) return setCloud({ status: 'signed-out', email: undefined, name: undefined, isAdmin: false, families: [], family: undefined });
  const email = (user.email ?? '').toLowerCase();
  const name = (user.user_metadata?.full_name as string | undefined) ?? (user.user_metadata?.name as string | undefined);
  setCloud({ email, name });
  try {
    const [adm, mem] = await Promise.all([
      sb.from('app_admins').select('email').eq('email', email).maybeSingle(),
      sb.from('family_members').select('role, families(id,name,max_profiles,active)').eq('email', email)
    ]);
    if (mem.error) throw mem.error;
    const families: Family[] = [];
    for (const r of (mem.data ?? []) as unknown as { role: Family['role']; families: Omit<Family, 'role'> | null }[]) {
      if (r.families?.active) families.push({ ...r.families, role: r.role });
    }
    const isAdmin = !!adm.data;
    setCloud({ isAdmin, families });
    if (!families.length) {
      const req = await sb.from('access_requests').select('email').eq('email', email).maybeSingle();
      return setCloud({ status: 'no-access', requested: !!req.data, family: undefined });
    }
    const saved = localStorage.getItem(FAMILY_KEY);
    const pick = families.find((f) => f.id === saved) ?? (families.length === 1 ? families[0] : undefined);
    if (!pick) return setCloud({ status: 'pick-family', family: undefined });
    await selectFamily(pick.id);
  } catch (e) {
    setCloud({ status: 'error', error: e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e) });
  }
}

/** בחירת משפחה במכשיר. אם יש במכשיר שחקנים שלא שייכים אליה – שואלים מה לעשות (status: link). */
export async function selectFamily(id: string): Promise<void> {
  const fam = useCloud.getState().families.find((f) => f.id === id);
  if (!fam) return;
  localStorage.setItem(FAMILY_KEY, id);
  setCloud({ family: fam });
  const linked = localStorage.getItem(LINKED_KEY);
  const hasLocal = Object.keys(useGame.getState().profiles).length > 0;
  if (linked !== id) {
    if (hasLocal) return setCloud({ status: 'link' });
    linkFamily('replace');
    return;
  }
  await syncNow();
}

/**
 * חיבור הנתונים שבמכשיר למשפחה:
 *  upload  – מעלים את השחקנים והתיקים מהמכשיר לחשבון (וממזגים עם מה שכבר שם)
 *  replace – שומרים גיבוי מקומי, מנקים את המכשיר ומורידים את נתוני החשבון
 */
export async function linkFamily(mode: 'upload' | 'replace'): Promise<void> {
  const fam = useCloud.getState().family;
  if (!fam) return;
  if (mode === 'replace') {
    const st = useGame.getState();
    if (Object.keys(st.profiles).length) {
      const backup: GameState = { profiles: st.profiles, portfolios: st.portfolios, settings: st.settings, deleted: st.deleted };
      try {
        localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: new Date().toISOString(), state: backup }));
      } catch {
        /* אין מקום – ממשיכים בלי גיבוי */
      }
    }
    applying = true;
    useGame.getState().resetAll();
    applying = false;
  }
  localStorage.setItem(LINKED_KEY, fam.id);
  saveMeta(fam.id, { pushed: {} });
  await syncNow();
}

export function localBackup(): { at: string; state: GameState } | undefined {
  try {
    return JSON.parse(localStorage.getItem(BACKUP_KEY) || 'null') ?? undefined;
  } catch {
    return undefined;
  }
}

export async function signInWithGoogle(): Promise<string | undefined> {
  const sb = await getClient();
  if (!sb) return 'החיבור לענן לא הוגדר';
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } }
  });
  return error?.message;
}

export async function cloudSignOut() {
  const sb = await getClient();
  await sb?.auth.signOut();
  localStorage.removeItem(FAMILY_KEY);
  setCloud({ status: 'signed-out', email: undefined, name: undefined, isAdmin: false, families: [], family: undefined, error: undefined });
}

export async function requestAccess(): Promise<string | undefined> {
  const sb = await getClient();
  const { email, name } = useCloud.getState();
  if (!sb || !email) return 'צריך להתחבר קודם';
  const { error } = await sb.from('access_requests').upsert({ email, name: name ?? null }, { onConflict: 'email', ignoreDuplicates: true });
  if (error) return error.message;
  setCloud({ requested: true });
  return undefined;
}

/** האם מותר להוסיף עוד שחקן (לפי מכסת המשפחה בענן) */
export function canAddProfile(): { ok: boolean; max?: number } {
  const { family, status } = useCloud.getState();
  if (!family || status === 'link' || localStorage.getItem(LINKED_KEY) !== family.id) return { ok: true };
  const n = Object.keys(useGame.getState().profiles).length;
  return { ok: n < family.max_profiles, max: family.max_profiles };
}

/** מופעל פעם אחת בעליית האפליקציה */
export async function initCloud() {
  if (initDone) return;
  initDone = true;
  const sb = await getClient();
  if (!sb) return setCloud({ status: 'off' });
  setCloud({ status: 'loading' });
  // החזרה מ-Google: ?code=... – הספרייה מחליפה אותו לחיבור; אחר כך מנקים את הכתובת
  await sb.auth.getSession();
  if (/[?&]code=/.test(location.search) || /[?&]error=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
  sb.auth.onAuthStateChange((ev) => {
    if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') setTimeout(loadAccount, 0);
  });
  await loadAccount();
  setInterval(() => useCloud.getState().family && syncNow(), 30_000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && useCloud.getState().family && syncNow());
  useGame.subscribe(() => {
    if (applying || !useCloud.getState().family) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(syncNow, 2000);
  });
}

export function resetCloudClient() {
  client = null;
  initDone = false;
}

// ---------- ניהול (בעלי משפחה ומנהל האפליקציה)

export interface Member {
  family_id: string;
  email: string;
  role: 'owner' | 'member';
}
export interface AdminFamily {
  id: string;
  name: string;
  max_profiles: number;
  active: boolean;
  created_at: string;
  family_members: { email: string; role: 'owner' | 'member' }[];
  stats?: { profiles: number; portfolios: number; last_sync: string | null };
}
export interface AccessRequest {
  email: string;
  name: string | null;
  created_at: string;
}

const norm = (e: string) => e.trim().toLowerCase();
const errMsg = (e: { message: string } | null) => e?.message;

export async function listMembers(familyId: string): Promise<Member[]> {
  const sb = await getClient();
  const { data } = (await sb?.from('family_members').select('family_id,email,role').eq('family_id', familyId).order('created_at')) ?? { data: [] };
  return (data ?? []) as Member[];
}
export async function addMember(familyId: string, email: string, role: Member['role'] = 'member') {
  const sb = await getClient();
  if (!sb) return 'אין חיבור';
  return errMsg((await sb.from('family_members').insert({ family_id: familyId, email: norm(email), role })).error);
}
export async function removeMember(familyId: string, email: string) {
  const sb = await getClient();
  if (!sb) return 'אין חיבור';
  return errMsg((await sb.from('family_members').delete().eq('family_id', familyId).eq('email', email)).error);
}

export async function adminData(): Promise<{ families: AdminFamily[]; requests: AccessRequest[]; error?: string }> {
  const sb = await getClient();
  if (!sb) return { families: [], requests: [], error: 'אין חיבור' };
  const [f, r, s] = await Promise.all([
    sb.from('families').select('id,name,max_profiles,active,created_at,family_members(email,role)').order('created_at', { ascending: false }),
    sb.from('access_requests').select('email,name,created_at').order('created_at'),
    sb.rpc('admin_family_stats')
  ]);
  const stats = new Map<string, AdminFamily['stats']>(((s.data ?? []) as { family_id: string; profiles: number; portfolios: number; last_sync: string | null }[]).map((x) => [x.family_id, { profiles: Number(x.profiles), portfolios: Number(x.portfolios), last_sync: x.last_sync }]));
  const families = ((f.data ?? []) as AdminFamily[]).map((x) => ({ ...x, stats: stats.get(x.id) }));
  return { families, requests: (r.data ?? []) as AccessRequest[], error: f.error?.message ?? r.error?.message };
}

export async function adminCreateFamily(name: string, ownerEmail: string, maxProfiles: number): Promise<string | undefined> {
  const sb = await getClient();
  if (!sb) return 'אין חיבור';
  const { data, error } = await sb.from('families').insert({ name: name.trim() || 'משפחה', max_profiles: maxProfiles }).select('id').single();
  if (error) return error.message;
  const e2 = await addMember(data.id, ownerEmail, 'owner');
  if (e2) return e2;
  await sb.from('access_requests').delete().eq('email', norm(ownerEmail));
  return undefined;
}
export async function adminUpdateFamily(id: string, patch: Partial<Pick<AdminFamily, 'name' | 'max_profiles' | 'active'>>) {
  const sb = await getClient();
  if (!sb) return 'אין חיבור';
  return errMsg((await sb.from('families').update(patch).eq('id', id)).error);
}
export async function adminDeleteFamily(id: string) {
  const sb = await getClient();
  if (!sb) return 'אין חיבור';
  return errMsg((await sb.from('families').delete().eq('id', id)).error);
}
export async function adminDeleteRequest(email: string) {
  const sb = await getClient();
  if (!sb) return 'אין חיבור';
  return errMsg((await sb.from('access_requests').delete().eq('email', email)).error);
}

/** רענון החשבון (למשל אחרי שהמנהל אישר) */
export const refreshAccount = () => loadAccount();
