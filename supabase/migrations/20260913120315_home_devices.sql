-- ═══════════════════════════════════════════════════════════════
-- Naprave / Devices: generic home-device layer, first provider Mitsubishi
-- Electric AC via MELCloud Home. See NAPRAVKO_MELCLOUD_IMPLEMENTATION.md.
--
-- Household-shared, no owner/member split — the physical device belongs to
-- the household the same way a freezer or shopping list does, not to
-- whichever member happened to connect it. Unlike calendar_freebusy_sources
-- (deliberately per-user/private), there is no privacy boundary here.
--
-- Clients are read-only (RLS: select only). All writes come from trusted
-- server code — the sync-home-devices edge function (polling) and the
-- /api/home-devices/[id]/command route (user-triggered commands) — both
-- using the service role, same split as calendar_busy_blocks.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.home_devices (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  provider       text not null default 'melcloud_home',
  device_type    text not null default 'air_conditioner',
  external_id    text not null,
  name           text not null,
  room           text,
  state          jsonb not null default '{}'::jsonb,
  capabilities   jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_error     text,
  created_at     timestamptz not null default now(),
  unique (household_id, provider, external_id)
);

alter table public.home_devices enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'home_devices' and policyname = 'Household members read home_devices') then
    create policy "Household members read home_devices" on public.home_devices
      for select to authenticated
      using (public.is_household_member(household_id));
  end if;
end $$;

grant select on public.home_devices to authenticated;
grant all on public.home_devices to service_role;

create index if not exists home_devices_household_idx on public.home_devices (household_id);

-- Realtime so the AC card updates live after a poll or a command, without
-- a manual refresh (the "Osveži" pill is for on-demand freshness, not for
-- getting updates to render in the first place).
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'home_devices'
  ) then
    alter publication supabase_realtime add table public.home_devices;
  end if;
end $$;

-- ─── SYNC SCHEDULE (pg_cron) ────────────────────────────────────
-- Every 10 min — deliberately slower than the 30-min freebusy sync's
-- interval unit but still a single named job so the cadence is a one-line
-- change later (see cozy-freebusy-sync for the same shape). No-ops until
-- supabase/snippets/setup-melcloud-vault.sql has been run.

select cron.schedule('cozy-home-devices-sync', '*/10 * * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'melcloud_fn_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'melcloud_fn_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'melcloud_fn_url')
$$);
