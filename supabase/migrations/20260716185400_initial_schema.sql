-- ═══════════════════════════════════════════════════════════════
-- Cožy — initial schema
-- Reconstructed from lib/hooks.js (the cloud schema was never in the repo).
-- All tables are household-scoped with a "user is a household member" RLS policy.
-- ═══════════════════════════════════════════════════════════════

-- ─── HOUSEHOLDS ──────────────────────────────────────────────────

create table public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  join_code  text not null unique,
  created_at timestamptz not null default now()
);

create table public.household_members (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  display_name text,
  created_at   timestamptz not null default now(),
  unique (household_id, user_id)
);

-- RLS helper: security definer so policies on household_members don't recurse.
create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household_id and user_id = auth.uid()
  );
$$;

-- ─── FREEZER ─────────────────────────────────────────────────────

create table public.items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  cat          text,
  qty          text,
  packets      integer not null default 1,
  label        text,
  frozen       date,
  expiry       date,
  freezer      text,
  sticky       boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.archived (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  cat          text,
  qty          text,
  packets      integer not null default 1,
  label        text,
  frozen       date,
  expiry       date,
  freezer      text,
  wasted       boolean not null default false,
  archived_at  timestamptz not null default now()
);

-- id is text (the app generates "name_timestamp"; the default is "home");
-- composite pk so every household can have its own "home".
create table public.freezers (
  id           text not null,
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  icon         text,
  sort_order   integer not null default 0,
  primary key (household_id, id)
);

-- Global default categories have household_id = null (see seed.sql).
create table public.categories (
  id           text primary key,
  household_id uuid references public.households(id) on delete cascade,
  label        text not null,
  icon         text,
  color        text,
  months       integer not null default 6
);

-- ─── SHOPPING LIST ───────────────────────────────────────────────

create table public.shopping_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  qty          text,
  checked      boolean not null default false,
  store        text,
  favourite    boolean not null default false,
  category     text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

create table public.shopping_archived (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  qty          text,
  category     text,
  store        text,
  completed_at timestamptz not null default now()
);

create table public.shopping_favourites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  use_count    integer not null default 1,
  last_used    timestamptz not null default now()
);

create table public.shopping_stores (
  id           text not null,
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  icon         text,
  sort_order   integer not null default 0,
  primary key (household_id, id)
);

-- ─── CALENDAR ────────────────────────────────────────────────────

create table public.calendar_connections (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  access_token text not null,
  expires_at   timestamptz not null,
  google_email text,
  created_at   timestamptz not null default now()
);

create table public.calendar_events (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  google_event_id text,
  title           text not null,
  start_time      timestamptz,
  end_time        timestamptz,
  is_all_day      boolean not null default false,
  location        text,
  event_date      date not null,
  label           text,
  is_important    boolean not null default false,
  created_at      timestamptz not null default now()
);

create index calendar_events_household_date_idx
  on public.calendar_events (household_id, event_date);

-- ─── TODOS ───────────────────────────────────────────────────────

create table public.todo_lists (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title        text not null,
  emoji        text default '📋',
  due_date     date,
  created_by   uuid references auth.users(id) on delete set null,
  archived_at  timestamptz,
  created_at   timestamptz not null default now()
);

create table public.todo_items (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references public.todo_lists(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  title        text not null,
  checked      boolean not null default false,
  sort_order   integer not null default 0,
  assigned_to  uuid references auth.users(id) on delete set null,
  notes        text,
  created_at   timestamptz not null default now()
);

-- ─── HOME SCREEN ─────────────────────────────────────────────────

create table public.home_settings (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  home_address  text,
  destinations  jsonb not null default '[]'::jsonb,
  shortcuts     jsonb not null default '[]'::jsonb,
  bus_stops     jsonb not null default '[]'::jsonb,
  bike_stations jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now(),
  unique (household_id, user_id)
);

-- ─── RPC FUNCTIONS ───────────────────────────────────────────────
-- NOTE: exception messages are in Slovenian on purpose — the app shows
-- e.message directly to the user (setError in app/page.js).

-- Creates a household + owner + default freezer and stores
-- (the app expects freezer id "home" and store id "mercator").
create or replace function public.create_household(p_name text, p_user_id uuid, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_code text;
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'Ne moreš ustvariti gospodinjstva za drugega uporabnika';
  end if;

  loop
    v_code := upper(substr(md5(random()::text), 1, 6));
    begin
      insert into public.households (name, join_code)
      values (p_name, v_code)
      returning id into v_household_id;
      exit;
    exception when unique_violation then
      -- join code already taken, try another one
    end;
  end loop;

  insert into public.household_members (household_id, user_id, role, display_name)
  values (v_household_id, p_user_id, 'owner', p_display_name);

  insert into public.freezers (household_id, id, name, icon, sort_order)
  values (v_household_id, 'home', 'Doma', '🏠', 0);

  insert into public.shopping_stores (household_id, id, name, icon, sort_order)
  values
    (v_household_id, 'mercator', 'Mercator', '🔴', 0),
    (v_household_id, 'spar',     'Spar',     '🟢', 1),
    (v_household_id, 'hofer',    'Hofer',    '🔵', 2),
    (v_household_id, 'lidl',     'Lidl',     '🟡', 3);

  return v_household_id;
end;
$$;

create or replace function public.join_household(p_code text, p_user_id uuid, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'Ne moreš pridružiti drugega uporabnika';
  end if;

  select id into v_household_id
  from public.households
  where join_code = upper(p_code);

  if v_household_id is null then
    raise exception 'Neveljavna koda';
  end if;

  insert into public.household_members (household_id, user_id, role, display_name)
  values (v_household_id, p_user_id, 'member', p_display_name)
  on conflict (household_id, user_id) do nothing;

  return v_household_id;
end;
$$;

-- Owner removes a member (cannot remove the owner themselves).
create or replace function public.remove_household_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member record;
begin
  select * into v_member from public.household_members where id = p_member_id;

  if v_member is null then
    raise exception 'Član ne obstaja';
  end if;

  if not exists (
    select 1 from public.household_members
    where household_id = v_member.household_id
      and user_id = auth.uid()
      and role = 'owner'
  ) then
    raise exception 'Samo lastnik lahko odstrani člane';
  end if;

  if v_member.role = 'owner' then
    raise exception 'Lastnika ni mogoče odstraniti';
  end if;

  delete from public.household_members where id = p_member_id;
end;
$$;

-- ─── RLS ─────────────────────────────────────────────────────────

alter table public.households           enable row level security;
alter table public.household_members    enable row level security;
alter table public.items                enable row level security;
alter table public.archived             enable row level security;
alter table public.freezers             enable row level security;
alter table public.categories           enable row level security;
alter table public.shopping_items       enable row level security;
alter table public.shopping_archived    enable row level security;
alter table public.shopping_favourites  enable row level security;
alter table public.shopping_stores      enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.calendar_events      enable row level security;
alter table public.todo_lists           enable row level security;
alter table public.todo_items           enable row level security;
alter table public.home_settings        enable row level security;

create policy "Members can view their household"
  on public.households for select to authenticated
  using (public.is_household_member(id));

create policy "Members can view household members"
  on public.household_members for select to authenticated
  using (public.is_household_member(household_id));

-- Household-scoped tables: members can do everything
-- (the hooks update/delete by id only, so RLS must do the scoping).
create policy "Members full access" on public.items for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Members full access" on public.archived for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Members full access" on public.freezers for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- Categories: global ones (household_id null) are readable by any signed-in
-- user; household-owned ones are writable by members only.
create policy "Read global and own categories"
  on public.categories for select to authenticated
  using (household_id is null or public.is_household_member(household_id));

create policy "Members write own categories"
  on public.categories for insert to authenticated
  with check (household_id is not null and public.is_household_member(household_id));

create policy "Members update own categories"
  on public.categories for update to authenticated
  using (household_id is not null and public.is_household_member(household_id))
  with check (household_id is not null and public.is_household_member(household_id));

create policy "Members delete own categories"
  on public.categories for delete to authenticated
  using (household_id is not null and public.is_household_member(household_id));

create policy "Members full access" on public.shopping_items for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Members full access" on public.shopping_archived for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Members full access" on public.shopping_favourites for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Members full access" on public.shopping_stores for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- Calendar connections: all members can read (the app shows the partner's
-- email); only the owner of a connection can write/delete it.
create policy "Members read connections"
  on public.calendar_connections for select to authenticated
  using (public.is_household_member(household_id));

create policy "Users write own connection"
  on public.calendar_connections for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));

create policy "Users update own connection"
  on public.calendar_connections for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users delete own connection"
  on public.calendar_connections for delete to authenticated
  using (user_id = auth.uid());

-- Events: members can view and edit (label/star also on partner's events).
create policy "Members full access" on public.calendar_events for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Members full access" on public.todo_lists for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Members full access" on public.todo_items for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- Home screen settings are personal (per user).
create policy "Users manage own settings" on public.home_settings for all to authenticated
  using (user_id = auth.uid() and public.is_household_member(household_id))
  with check (user_id = auth.uid() and public.is_household_member(household_id));

-- ─── GRANTS (newer CLI versions no longer auto-expose tables) ────

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.create_household(text, uuid, text) to authenticated;
grant execute on function public.join_household(text, uuid, text) to authenticated;
grant execute on function public.remove_household_member(uuid) to authenticated;

-- ─── REALTIME (hooks subscribe to postgres_changes) ──────────────

alter publication supabase_realtime add table
  public.items,
  public.archived,
  public.freezers,
  public.categories,
  public.shopping_items,
  public.shopping_archived,
  public.shopping_favourites,
  public.shopping_stores,
  public.calendar_connections,
  public.todo_lists,
  public.todo_items;
