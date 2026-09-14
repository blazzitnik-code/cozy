-- ═══════════════════════════════════════════════════════════════
-- Naprave / Devices: "Bližnjice" (favorites) — household-level choice of
-- up to 3 devices to show as shortcuts at the top of Naprave, editable via
-- "Uredi" (see components/DevicesModule.js). Same shape/rationale as
-- shopping_sections (a sparse household preference table, full CRUD from
-- the client — this is UI state, not device control, so it doesn't need
-- to go through the service-role command route like home_devices itself).
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.naprave_favorites (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  device_id    uuid not null references public.home_devices(id) on delete cascade,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  unique (household_id, device_id)
);

alter table public.naprave_favorites enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'naprave_favorites' and policyname = 'Household members manage naprave_favorites') then
    create policy "Household members manage naprave_favorites" on public.naprave_favorites
      for all to authenticated
      using (public.is_household_member(household_id))
      with check (public.is_household_member(household_id));
  end if;
end $$;

grant select, insert, update, delete on public.naprave_favorites to authenticated;
grant all on public.naprave_favorites to service_role;

create index if not exists naprave_favorites_household_idx on public.naprave_favorites (household_id);

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'naprave_favorites'
  ) then
    alter publication supabase_realtime add table public.naprave_favorites;
  end if;
end $$;

-- ─── ROOM BACKFILL ──────────────────────────────────────────────
-- Shelly devices have always been created with room = null (see
-- providers/shelly/index.js — the connect form never captured a room), so
-- the new "grouped by room" Naprave layout has nothing to group by yet.
-- Backfill from each device's own name (set by B at connect time, e.g.
-- "Žaluzije spalnica", "Luč terasa") — safe to re-run, and any device
-- whose name doesn't match one of these patterns is simply left null and
-- falls into the "Druge naprave" bucket in the UI rather than being hidden.
update public.home_devices set room = 'Spalnica'
  where provider = 'shelly' and room is null and name ilike '%spalnica%';
update public.home_devices set room = 'Dnevna soba'
  where provider = 'shelly' and room is null and name ilike '%dnevna%';
update public.home_devices set room = 'Galerija'
  where provider = 'shelly' and room is null and name ilike '%galerija%';
update public.home_devices set room = 'Terasa'
  where provider = 'shelly' and room is null and name ilike '%terasa%';
