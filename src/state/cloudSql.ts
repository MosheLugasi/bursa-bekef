// קוד ה-SQL להקמת מסד הנתונים ב-Supabase (חשבונות משפחה, הרשאות ומסמכי משחק).
// מריצים פעם אחת: Supabase → SQL Editor → New query → Run. בטוח להריץ שוב (לעדכון).

export function cloudSql(adminEmail: string): string {
  const email = (adminEmail || 'YOUR_EMAIL@gmail.com').trim().toLowerCase().replace(/'/g, '');
  return `-- בורסה בכיף: חשבונות משפחה עם התחברות Google + הרשאות מנהל
-- מנהלי האפליקציה (מי שמאשר משפחות חדשות)
create table if not exists public.app_admins (email text primary key);
insert into public.app_admins(email) values ('${email}') on conflict do nothing;

-- משפחה = חשבון. max_profiles = כמה שחקנים מותר לפתוח בה
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'משפחה',
  max_profiles int not null default 4 check (max_profiles between 1 and 50),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- חשבונות Google שמותר להם להיכנס למשפחה
create table if not exists public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (family_id, email)
);
create index if not exists family_members_email on public.family_members(email);

-- בקשות גישה שממתינות לאישור המנהל
create table if not exists public.access_requests (
  email text primary key check (email = lower(email)),
  name text,
  created_at timestamptz not null default now()
);

-- נתוני המשחק: כל שחקן / תיק / הגדרות = שורה
create table if not exists public.family_docs (
  family_id uuid not null references public.families(id) on delete cascade,
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  updated_by text,
  primary key (family_id, id)
);
create index if not exists family_docs_sync on public.family_docs(family_id, synced_at);

-- מי מחובר (רק חשבונות Google נחשבים)
create or replace function public.my_email() returns text language sql stable as $$
  select case when coalesce(auth.jwt() -> 'app_metadata' -> 'providers', '[]'::jsonb) ? 'google'
    then lower(auth.jwt() ->> 'email') end
$$;
create or replace function public.is_app_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_admins where email = my_email())
$$;
create or replace function public.is_member(f uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from family_members m join families x on x.id = m.family_id
    where m.family_id = f and m.email = my_email() and x.active)
$$;
create or replace function public.is_owner(f uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from family_members m join families x on x.id = m.family_id
    where m.family_id = f and m.email = my_email() and m.role = 'owner' and x.active)
$$;

-- חותמת זמן של השרת + מגבלת מספר השחקנים במשפחה
create or replace function public.family_docs_before() returns trigger language plpgsql security definer set search_path = public as $$
declare mx int; cnt int;
begin
  new.synced_at := clock_timestamp();
  new.updated_by := my_email();
  if new.id like 'profile:%' and not new.deleted
     and not exists (select 1 from family_docs d where d.family_id = new.family_id and d.id = new.id and not d.deleted) then
    select max_profiles into mx from families where id = new.family_id;
    select count(*) into cnt from family_docs d where d.family_id = new.family_id and d.id like 'profile:%' and not d.deleted;
    if cnt >= mx then raise exception 'PROFILE_QUOTA %', mx; end if;
  end if;
  return new;
end $$;
drop trigger if exists family_docs_before on public.family_docs;
create trigger family_docs_before before insert or update on public.family_docs
  for each row execute function public.family_docs_before();

-- סטטיסטיקה למנהל
create or replace function public.admin_family_stats()
returns table (family_id uuid, profiles bigint, portfolios bigint, last_sync timestamptz)
language sql stable security definer set search_path = public as $$
  select d.family_id,
    count(*) filter (where d.id like 'profile:%' and not d.deleted),
    count(*) filter (where d.id like 'portfolio:%' and not d.deleted),
    max(d.synced_at)
  from family_docs d where is_app_admin() group by d.family_id
$$;

-- הרשאות (Row Level Security)
alter table public.app_admins enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.access_requests enable row level security;
alter table public.family_docs enable row level security;

drop policy if exists admins_read on public.app_admins;
create policy admins_read on public.app_admins for select using (email = my_email() or is_app_admin());
drop policy if exists admins_write on public.app_admins;
create policy admins_write on public.app_admins for all using (is_app_admin()) with check (is_app_admin());

drop policy if exists families_read on public.families;
create policy families_read on public.families for select using (is_app_admin() or is_member(id));
drop policy if exists families_admin on public.families;
create policy families_admin on public.families for all using (is_app_admin()) with check (is_app_admin());

drop policy if exists members_read on public.family_members;
create policy members_read on public.family_members for select using (email = my_email() or is_app_admin() or is_member(family_id));
drop policy if exists members_admin on public.family_members;
create policy members_admin on public.family_members for all using (is_app_admin()) with check (is_app_admin());
drop policy if exists members_owner_add on public.family_members;
create policy members_owner_add on public.family_members for insert with check (is_owner(family_id) and role = 'member');
drop policy if exists members_owner_remove on public.family_members;
create policy members_owner_remove on public.family_members for delete using (is_owner(family_id) and role = 'member');

drop policy if exists requests_read on public.access_requests;
create policy requests_read on public.access_requests for select using (email = my_email() or is_app_admin());
drop policy if exists requests_insert on public.access_requests;
create policy requests_insert on public.access_requests for insert with check (email = my_email());
drop policy if exists requests_delete on public.access_requests;
create policy requests_delete on public.access_requests for delete using (email = my_email() or is_app_admin());

drop policy if exists docs_read on public.family_docs;
create policy docs_read on public.family_docs for select using (is_member(family_id) or is_app_admin());
drop policy if exists docs_insert on public.family_docs;
create policy docs_insert on public.family_docs for insert with check (is_member(family_id));
drop policy if exists docs_update on public.family_docs;
create policy docs_update on public.family_docs for update using (is_member(family_id)) with check (is_member(family_id));

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.app_admins, public.families, public.family_members,
  public.access_requests, public.family_docs to authenticated;
grant execute on function public.my_email(), public.is_app_admin(), public.is_member(uuid), public.is_owner(uuid),
  public.admin_family_stats() to authenticated;
`;
}
