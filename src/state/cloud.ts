// חשבונות ענן – Base44 (backend בלבד; האתר עצמו ב-GitHub Pages).
// התחברות עם Google (המפתחות של Base44 – בלי הגדרות ב-Google Cloud).
// משפחה = חשבון (ישות Family). מנהל המשחק (role: admin) מאשר בקשות גישה ומגדיר כמה שחקנים מותר לכל משפחה.
// נתוני המשחק: כל שחקן / תיק / הגדרות = רשומת FamilyDoc. ההרשאות נאכפות בשרת (RLS ב-base44/entities/*.jsonc).
// בלי התחברות המשחק עובד כמו קודם – נשמר רק במכשיר.
import { create } from 'zustand';
import type { Base44Client } from '@base44/sdk';
import { DEFAULT_APP_SETTINGS, useGame } from './store';
import type { GameState } from './types';

/** האפליקציה ב-Base44 (מזהה ציבורי – לא סוד) */
export const DEFAULT_BASE44 = { appId: '6aefa4296b5b048c0f5fb91f', appUrl: 'https://base44.app' };

interface CloudConfig {
  appId: string;
  /** לאן מפנים להתחברות (שרת ה-auth של Base44) */
  appUrl: string;
}

const CFG_KEY = 'bursa-bekef-base44';
const FAMILY_KEY = 'bursa-bekef-family'; // המשפחה שנבחרה במכשיר
const LINKED_KEY = 'bursa-bekef-linked-family'; // לאיזו משפחה שייכים הנתונים שבמכשיר
const META_PREFIX = 'bursa-bekef-sync-';
const BACKUP_KEY = 'bursa-bekef-backup';

export function builtInConfig(): CloudConfig | undefined {
  const env = import.meta.env as Record<string, string | undefined>;
  if (env.VITE_BASE44_DISABLED === '1') return undefined;
  return { appId: env.VITE_BASE44_APP_ID || DEFAULT_BASE44.appId, appUrl: env.VITE_BASE44_APP_URL || DEFAULT_BASE44.appUrl };
}

export function loadConfig(): CloudConfig | undefined {
  try {
    const c = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
    if (c?.appId) return { appId: c.appId, appUrl: c.appUrl || DEFAULT_BASE44.appUrl };
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
  members: string[];
  owners: string[];
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

let client: Base44Client | null = null;
let applying = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let syncing: Promise<void> | null = null;
let initDone = false;

export async function getClient(): Promise<Base44Client | null> {
  const cfg = loadConfig();
  if (!cfg) return null;
  if (!client) {
    const { createClient } = await import('@base44/sdk');
    // הטוקן חוזר מ-Google בכתובת (?access_token=...) – הספרייה שומרת אותו ומנקה את הכתובת
    client = createClient({ appId: cfg.appId, appBaseUrl: cfg.appUrl, analytics: { enabled: false } });
  }
  return client;
}

const norm = (e: string) => e.trim().toLowerCase();
const errText = (e: unknown): string => {
  if (e && typeof e === 'object') {
    const o = e as { message?: string; data?: { message?: string }; response?: { data?: { message?: string } } };
    return o.data?.message ?? o.response?.data?.message ?? o.message ?? String(e);
  }
  return String(e);
};

interface FamilyRecord {
  id: string;
  name: string;
  max_profiles?: number;
  active?: boolean;
  members?: string[];
  owners?: string[];
  created_date?: string;
}
function toFamily(r: FamilyRecord, email: string): Family {
  const members = (r.members ?? []).map(norm);
  const owners = (r.owners ?? []).map(norm);
  return { id: r.id, name: r.name, max_profiles: r.max_profiles ?? 4, active: r.active !== false, members, owners, role: owners.includes(email) ? 'owner' : 'member' };
}

interface DocRecord {
  id: string;
  family_id: string;
  doc_id: string;
  payload?: { updatedAt?: string } | null;
  deleted?: boolean;
  client_updated_at?: string;
  created_by?: string;
  updated_date?: string;
}

// ---------- מסמכים וסנכרון

interface Meta {
  pushed: Record<string, string>; // docId -> updatedAt שנשלח/התקבל
  lastPull?: string;
  /** רשימת החברים שנכתבה לרשומות (כדי לעדכן הרשאות כשמצטרף/עוזב מישהו) */
  membersSig?: string;
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


/** רשומות מהשרת → שורות למיזוג. מסנן רשומות שלא נוצרו על ידי חבר במשפחה (הגנה מ"שתילת" נתונים). */
export function rowsFromRecords(recs: DocRecord[], familyId: string, members: string[]): RemoteRow[] {
  const ok = new Set(members.map(norm));
  return recs
    .filter((r) => r.family_id === familyId && r.doc_id && (!r.created_by || ok.has(norm(r.created_by))))
    .map((r) => ({ id: r.doc_id, data: r.payload ?? null, deleted: !!r.deleted, updated_at: r.client_updated_at || r.updated_date || '' }));
}

async function doSync(): Promise<void> {
  const b = await getClient();
  let fam = useCloud.getState().family;
  if (!b || !fam || localStorage.getItem(LINKED_KEY) !== fam.id) return;
  setCloud({ status: 'syncing' });
  const meta = loadMeta(fam.id);
  try {
    // 0) רענון פרטי המשפחה (חברים, מכסה, השבתה)
    const famRecs = (await b.entities.Family.filter({ id: fam.id })) as FamilyRecord[];
    if (!famRecs.length) return void loadAccount();
    fam = toFamily(famRecs[0], useCloud.getState().email ?? '');
    if (!fam.active || !fam.members.includes(useCloud.getState().email ?? '')) return void loadAccount();
    setCloud({ family: fam, families: useCloud.getState().families.map((f) => (f.id === fam!.id ? fam! : f)) });

    // 1) משיכה (עם חפיפה של 2 דקות, כדי לא לפספס כתיבות מקבילות)
    const q: Record<string, unknown> = { family_id: fam.id };
    if (meta.lastPull) q.updated_date = { $gt: new Date(t(meta.lastPull) - 120_000).toISOString() };
    let recs: DocRecord[];
    try {
      recs = (await b.entities.FamilyDoc.filter(q, 'updated_date', 5000)) as DocRecord[];
    } catch (e) {
      if (!q.updated_date) throw e;
      recs = (await b.entities.FamilyDoc.filter({ family_id: fam.id }, 'updated_date', 5000)) as DocRecord[]; // גיבוי: משיכה מלאה
    }
    let maxPulled = meta.lastPull;
    for (const r of recs) if (r.updated_date && (!maxPulled || t(r.updated_date) > t(maxPulled))) maxPulled = r.updated_date;
    const rows = rowsFromRecords(recs, fam.id, fam.members);
    if (rows.length) {
      const { next, changed } = mergeRemote(useGame.getState(), rows, meta.pushed);
      if (changed) {
        applying = true;
        useGame.setState(next);
        applying = false;
      }
    }
    meta.lastPull = maxPulled;

    // 2) עדכון רשימת החברים ברשומות הקיימות (כשמצטרף/עוזב מישהו)
    const sig = [...fam.members].sort().join(',');
    if (meta.membersSig && meta.membersSig !== sig) await b.entities.FamilyDoc.updateMany({ family_id: fam.id }, { $set: { members: fam.members } });
    meta.membersSig = sig;

    // 3) דחיפה
    const st = useGame.getState();
    const ups: { family_id: string; doc_id: string; payload: unknown; deleted: boolean; client_updated_at: string; members: string[] }[] = [];
    for (const d of localDocs(st)) if (meta.pushed[d.id] !== d.updatedAt) ups.push({ family_id: fam.id, doc_id: d.id, payload: d.data, deleted: false, client_updated_at: d.updatedAt || new Date().toISOString(), members: fam.members });
    for (const [id, ts] of Object.entries(st.deleted)) if (meta.pushed[id] !== ts) ups.push({ family_id: fam.id, doc_id: id, payload: null, deleted: true, client_updated_at: ts, members: fam.members });
    // מכסת שחקנים: שחקנים חדשים מעבר למכסה לא עולים לענן
    let quotaErr: string | undefined;
    const knownProfiles = Object.keys(meta.pushed).filter((k) => k.startsWith('profile:') && !(k in st.deleted)).length;
    let room = Math.max(0, fam.max_profiles - knownProfiles);
    const send = ups.filter((u) => {
      if (!u.doc_id.startsWith('profile:') || u.deleted || u.doc_id in meta.pushed) return true;
      if (room > 0) return room--, true;
      quotaErr = `הגעתם למספר השחקנים המקסימלי בחשבון (${fam!.max_profiles}). כדי להוסיף עוד – בקשו מהמנהל להגדיל את המכסה.`;
      return false;
    });
    for (let i = 0; i < send.length; i += 200) {
      const chunk = send.slice(i, i + 200);
      await b.entities.FamilyDoc.upsert(chunk, { key: ['family_id', 'doc_id'] });
      for (const u of chunk) meta.pushed[u.doc_id] = u.deleted ? u.client_updated_at : ((u.payload as { updatedAt?: string })?.updatedAt ?? u.client_updated_at);
    }
    saveMeta(fam.id, meta);
    setCloud({ status: quotaErr ? 'error' : 'ok', error: quotaErr, lastSync: new Date().toISOString() });
  } catch (e) {
    saveMeta(fam.id, meta);
    setCloud({ status: 'error', error: errText(e) });
  }
}

export function syncNow(): Promise<void> {
  if (!syncing) syncing = doSync().finally(() => (syncing = null));
  return syncing;
}

// ---------- חשבון

async function loadAccount(): Promise<void> {
  const b = await getClient();
  if (!b) return setCloud({ status: 'off' });
  const signedOut = () => setCloud({ status: 'signed-out', email: undefined, name: undefined, isAdmin: false, families: [], family: undefined });
  if (!b.auth.hasToken()) return signedOut();
  let me: { email: string; full_name: string | null; role?: string };
  try {
    me = (await b.auth.me()) as typeof me;
  } catch {
    return signedOut(); // הטוקן פג או לא תקף
  }
  const email = norm(me.email ?? '');
  setCloud({ email, name: me.full_name ?? undefined, isAdmin: me.role === 'admin' });
  try {
    // ההרשאות בשרת כבר מחזירות רק משפחות שאני חבר בהן (מנהל רואה הכל) – מסננים שוב בצד הלקוח
    const recs = (await b.entities.Family.list('-created_date', 1000)) as FamilyRecord[];
    const families = recs.map((r) => toFamily(r, email)).filter((f) => f.active && f.members.includes(email));
    setCloud({ families });
    if (!families.length) {
      const req = (await b.entities.AccessRequest.filter({ email })) as unknown[];
      return setCloud({ status: 'no-access', requested: req.length > 0, family: undefined });
    }
    const saved = localStorage.getItem(FAMILY_KEY);
    const pick = families.find((f) => f.id === saved) ?? (families.length === 1 ? families[0] : undefined);
    if (!pick) return setCloud({ status: 'pick-family', family: undefined });
    await selectFamily(pick.id);
  } catch (e) {
    setCloud({ status: 'error', error: errText(e) });
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
  const b = await getClient();
  if (!b) return 'החיבור לענן לא הוגדר';
  try {
    b.auth.loginWithProvider('google', location.origin + location.pathname);
  } catch (e) {
    return errText(e);
  }
  return undefined;
}

export async function cloudSignOut() {
  // התנתקות מקומית: מוחקים את הטוקן מהמכשיר (בלי לצאת מהאתר)
  for (const k of ['base44_access_token', 'token']) localStorage.removeItem(k);
  client = null;
  localStorage.removeItem(FAMILY_KEY);
  setCloud({ status: 'signed-out', email: undefined, name: undefined, isAdmin: false, families: [], family: undefined, error: undefined });
}

export async function requestAccess(): Promise<string | undefined> {
  const b = await getClient();
  const { email, name } = useCloud.getState();
  if (!b || !email) return 'צריך להתחבר קודם';
  try {
    const existing = (await b.entities.AccessRequest.filter({ email })) as unknown[];
    if (!existing.length) await b.entities.AccessRequest.create({ email, name: name ?? '' });
  } catch (e) {
    return errText(e);
  }
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
  const b = await getClient();
  if (!b) return setCloud({ status: 'off' });
  setCloud({ status: 'loading' });
  await loadAccount();
  setInterval(() => useCloud.getState().family && syncNow(), 30_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (useCloud.getState().family) syncNow();
    else if (useCloud.getState().status === 'no-access') loadAccount();
  });
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

// ---------- ניהול (בעלי משפחה ומנהל המשחק)

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

async function getFamilyRecord(b: Base44Client, id: string): Promise<FamilyRecord | undefined> {
  return ((await b.entities.Family.filter({ id })) as FamilyRecord[])[0];
}

/** אחרי שינוי חברים – מעדכנים את ההרשאות בכל רשומות המשפחה */
async function writeMembers(b: Base44Client, fam: FamilyRecord, members: string[], owners?: string[]) {
  const patch: Record<string, unknown> = { members };
  if (owners) patch.owners = owners;
  await b.entities.Family.update(fam.id, patch);
  await b.entities.FamilyDoc.updateMany({ family_id: fam.id }, { $set: { members } });
}

export async function listMembers(familyId: string): Promise<Member[]> {
  const b = await getClient();
  if (!b) return [];
  const f = await getFamilyRecord(b, familyId);
  if (!f) return [];
  const owners = (f.owners ?? []).map(norm);
  return (f.members ?? []).map((e) => ({ family_id: familyId, email: norm(e), role: owners.includes(norm(e)) ? 'owner' : 'member' }));
}

export async function addMember(familyId: string, email: string, role: Member['role'] = 'member'): Promise<string | undefined> {
  const b = await getClient();
  if (!b) return 'אין חיבור';
  try {
    const f = await getFamilyRecord(b, familyId);
    if (!f) return 'המשפחה לא נמצאה';
    const e = norm(email);
    const members = Array.from(new Set([...(f.members ?? []).map(norm), e]));
    const owners = role === 'owner' ? Array.from(new Set([...(f.owners ?? []).map(norm), e])) : undefined;
    await writeMembers(b, f, members, owners);
  } catch (err) {
    return errText(err);
  }
  return undefined;
}

export async function removeMember(familyId: string, email: string): Promise<string | undefined> {
  const b = await getClient();
  if (!b) return 'אין חיבור';
  try {
    const f = await getFamilyRecord(b, familyId);
    if (!f) return 'המשפחה לא נמצאה';
    const e = norm(email);
    const owners = (f.owners ?? []).map(norm);
    const members = (f.members ?? []).map(norm).filter((x) => x !== e);
    await writeMembers(b, f, members, owners.includes(e) ? owners.filter((x) => x !== e) : undefined);
  } catch (err) {
    return errText(err);
  }
  return undefined;
}

export async function adminData(): Promise<{ families: AdminFamily[]; requests: AccessRequest[]; error?: string }> {
  const b = await getClient();
  if (!b) return { families: [], requests: [], error: 'אין חיבור' };
  try {
    const [fams, reqs, docs] = await Promise.all([
      b.entities.Family.list('-created_date', 1000) as Promise<FamilyRecord[]>,
      b.entities.AccessRequest.list('created_date', 1000) as Promise<{ email: string; name?: string; created_date: string }[]>,
      b.entities.FamilyDoc.filter({ deleted: false }, '-updated_date', 5000, 0, ['family_id', 'doc_id', 'updated_date']) as Promise<DocRecord[]>
    ]);
    const stats = new Map<string, NonNullable<AdminFamily['stats']>>();
    for (const d of docs) {
      const s = stats.get(d.family_id) ?? { profiles: 0, portfolios: 0, last_sync: null };
      if (d.doc_id?.startsWith('profile:')) s.profiles++;
      if (d.doc_id?.startsWith('portfolio:')) s.portfolios++;
      if (d.updated_date && (!s.last_sync || d.updated_date > s.last_sync)) s.last_sync = d.updated_date;
      stats.set(d.family_id, s);
    }
    const families: AdminFamily[] = fams.map((f) => {
      const owners = (f.owners ?? []).map(norm);
      return {
        id: f.id,
        name: f.name,
        max_profiles: f.max_profiles ?? 4,
        active: f.active !== false,
        created_at: f.created_date ?? '',
        family_members: (f.members ?? []).map((e) => ({ email: norm(e), role: owners.includes(norm(e)) ? ('owner' as const) : ('member' as const) })),
        stats: stats.get(f.id)
      };
    });
    const requests = reqs.map((r) => ({ email: norm(r.email), name: r.name || null, created_at: r.created_date }));
    return { families, requests };
  } catch (e) {
    return { families: [], requests: [], error: errText(e) };
  }
}

export async function adminCreateFamily(name: string, ownerEmail: string, maxProfiles: number): Promise<string | undefined> {
  const b = await getClient();
  if (!b) return 'אין חיבור';
  const e = norm(ownerEmail);
  try {
    await b.entities.Family.create({ name: name.trim() || 'משפחה', max_profiles: maxProfiles, active: true, owners: [e], members: [e] });
    await b.entities.AccessRequest.deleteMany({ email: e }).catch(() => undefined);
  } catch (err) {
    return errText(err);
  }
  return undefined;
}
export async function adminUpdateFamily(id: string, patch: Partial<Pick<AdminFamily, 'name' | 'max_profiles' | 'active'>>): Promise<string | undefined> {
  const b = await getClient();
  if (!b) return 'אין חיבור';
  try {
    await b.entities.Family.update(id, patch);
  } catch (e) {
    return errText(e);
  }
  return undefined;
}
export async function adminDeleteFamily(id: string): Promise<string | undefined> {
  const b = await getClient();
  if (!b) return 'אין חיבור';
  try {
    await b.entities.FamilyDoc.deleteMany({ family_id: id });
    await b.entities.Family.delete(id);
  } catch (e) {
    return errText(e);
  }
  return undefined;
}
export async function adminDeleteRequest(email: string): Promise<string | undefined> {
  const b = await getClient();
  if (!b) return 'אין חיבור';
  try {
    await b.entities.AccessRequest.deleteMany({ email: norm(email) });
  } catch (e) {
    return errText(e);
  }
  return undefined;
}

/** רענון החשבון (למשל אחרי שהמנהל אישר) */
export const refreshAccount = () => loadAccount();
