// סנכרון ענן (לא חובה) – Supabase. מאפשר לכל המשפחה לשחק ממכשירים שונים עם אותו מצב ואותה טבלת תחרות.
// כל "מסמך" (פרופיל / תיק / הגדרות) נשמר כשורה בטבלה game_docs, מוגן ב-RLS לפי המשתמש המחובר (חשבון המשפחה).
import { create } from 'zustand';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useGame } from './store';
import type { GameState } from './types';

export const CLOUD_SQL = `-- הריצו פעם אחת ב-Supabase: SQL Editor → New query → Run
create table if not exists public.game_docs (
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);
alter table public.game_docs enable row level security;
drop policy if exists "family owns its docs" on public.game_docs;
create policy "family owns its docs" on public.game_docs
  for all using (owner = auth.uid()) with check (owner = auth.uid());`;

interface CloudConfig {
  url: string;
  anonKey: string;
}

const CFG_KEY = 'bursa-bekef-cloud';
const META_KEY = 'bursa-bekef-cloud-meta';

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

interface Meta {
  pushed: Record<string, string>; // docId -> updatedAt שנשלח/התקבל
  lastPull?: string;
}
function loadMeta(): Meta {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) || '') as Meta;
  } catch {
    return { pushed: {} };
  }
}
function saveMeta(m: Meta) {
  localStorage.setItem(META_KEY, JSON.stringify(m));
}

interface CloudState {
  status: 'off' | 'signed-out' | 'syncing' | 'ok' | 'error';
  email?: string;
  error?: string;
  lastSync?: string;
  set: (p: Partial<CloudState>) => void;
}
export const useCloud = create<CloudState>((set) => ({ status: 'off', set: (p) => set(p) }));

let client: SupabaseClient | null = null;
let started = false;
let applying = false;
let timer: ReturnType<typeof setTimeout> | null = null;

async function getClient(): Promise<SupabaseClient | null> {
  const cfg = loadConfig();
  if (!cfg) return null;
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, storageKey: 'bursa-bekef-auth' } });
  }
  return client;
}

type Doc = { id: string; data: unknown; updatedAt: string };

function localDocs(s: GameState): Doc[] {
  const docs: Doc[] = [{ id: 'settings', data: s.settings, updatedAt: s.settings.updatedAt || '1970-01-01T00:00:00.000Z' }];
  for (const p of Object.values(s.profiles)) docs.push({ id: 'profile:' + p.id, data: p, updatedAt: p.updatedAt });
  for (const p of Object.values(s.portfolios)) docs.push({ id: 'portfolio:' + p.id, data: p, updatedAt: p.updatedAt });
  return docs;
}

const t = (s?: string) => (s ? Date.parse(s) || 0 : 0);

export async function syncNow(): Promise<void> {
  const sb = await getClient();
  if (!sb) return useCloud.getState().set({ status: 'off' });
  const { data: sess } = await sb.auth.getSession();
  if (!sess.session) return useCloud.getState().set({ status: 'signed-out' });
  const cloud = useCloud.getState();
  cloud.set({ status: 'syncing', email: sess.session.user.email ?? undefined });
  const meta = loadMeta();
  try {
    // 1) משיכה
    let q = sb.from('game_docs').select('id,data,deleted,updated_at');
    if (meta.lastPull) q = q.gt('updated_at', meta.lastPull);
    const { data: rows, error } = await q;
    if (error) throw error;
    let maxPulled = meta.lastPull;
    if (rows?.length) {
      const st = useGame.getState();
      const next: GameState = { profiles: { ...st.profiles }, portfolios: { ...st.portfolios }, settings: st.settings, deleted: { ...st.deleted } };
      let changed = false;
      for (const r of rows as { id: string; data: { updatedAt?: string } | null; deleted: boolean; updated_at: string }[]) {
        if (!maxPulled || t(r.updated_at) > t(maxPulled)) maxPulled = r.updated_at;
        const [kind, id] = r.id.includes(':') ? (r.id.split(/:(.*)/s) as [string, string]) : [r.id, ''];
        const local = kind === 'profile' ? next.profiles[id] : kind === 'portfolio' ? next.portfolios[id] : kind === 'settings' ? next.settings : undefined;
        const localTs = t(local?.updatedAt);
        if (r.deleted) {
          if (local && localTs <= t(r.updated_at)) {
            if (kind === 'profile') delete next.profiles[id];
            if (kind === 'portfolio') delete next.portfolios[id];
            changed = true;
          }
          meta.pushed[r.id] = r.updated_at;
          continue;
        }
        if (!r.data) continue;
        const remoteTs = t(r.data.updatedAt ?? r.updated_at);
        if (!local || remoteTs > localTs) {
          if (kind === 'profile') next.profiles[id] = r.data as never;
          else if (kind === 'portfolio') next.portfolios[id] = r.data as never;
          else if (kind === 'settings') next.settings = { ...(r.data as GameState['settings']) };
          meta.pushed[r.id] = (r.data.updatedAt as string) ?? r.updated_at;
          changed = true;
        }
      }
      if (changed) {
        applying = true;
        useGame.setState(next);
        applying = false;
      }
    }
    meta.lastPull = maxPulled;
    // 2) דחיפה
    const st = useGame.getState();
    const upserts: { id: string; data: unknown; deleted: boolean; updated_at: string }[] = [];
    for (const d of localDocs(st)) if (meta.pushed[d.id] !== d.updatedAt) upserts.push({ id: d.id, data: d.data, deleted: false, updated_at: d.updatedAt || new Date().toISOString() });
    for (const [id, ts] of Object.entries(st.deleted)) if (meta.pushed[id] !== ts) upserts.push({ id, data: null, deleted: true, updated_at: ts });
    if (upserts.length) {
      const { error: e2 } = await sb.from('game_docs').upsert(upserts, { onConflict: 'owner,id' });
      if (e2) throw e2;
      for (const u of upserts) meta.pushed[u.id] = u.deleted ? u.updated_at : ((u.data as { updatedAt?: string })?.updatedAt ?? u.updated_at);
    }
    saveMeta(meta);
    cloud.set({ status: 'ok', error: undefined, lastSync: new Date().toISOString() });
  } catch (e) {
    saveMeta(meta);
    cloud.set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
  }
}

export function startCloudSync() {
  if (started) return;
  if (!loadConfig()) return;
  started = true;
  syncNow();
  setInterval(syncNow, 30_000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && syncNow());
  useGame.subscribe(() => {
    if (applying) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(syncNow, 2500);
  });
}

export async function cloudSignIn(email: string, password: string, signUp = false): Promise<string | undefined> {
  const sb = await getClient();
  if (!sb) return 'לא הוגדר חיבור לענן';
  const res = signUp ? await sb.auth.signUp({ email, password }) : await sb.auth.signInWithPassword({ email, password });
  if (res.error) return res.error.message;
  if (signUp && !res.data.session) return 'נשלח מייל אימות – אשרו אותו ואז התחברו';
  saveMeta({ pushed: {} });
  if (!started) startCloudSync();
  else await syncNow();
  return undefined;
}

export async function cloudSignOut() {
  const sb = await getClient();
  await sb?.auth.signOut();
  saveMeta({ pushed: {} });
  useCloud.getState().set({ status: 'signed-out', email: undefined });
}

export function resetCloudClient() {
  client = null;
  started = false;
}
