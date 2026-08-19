-- ═══════════════════════════════════════════════════════════════
-- Koledarko phase 2, part 1: freebusy via ICS subscription
--
-- Two tables, deliberately split for privacy (unlike calendar_connections,
-- where any household member can read the token owner's raw access_token —
-- documented tech debt we do NOT repeat here):
--   - calendar_freebusy_sources: each member's private "secret" ICS URL.
--     Only the owner can ever SELECT it, never the partner.
--   - calendar_busy_blocks: computed start/end times only (no titles, no
--     descriptions — those are discarded server-side in the sync-freebusy
--     edge function before anything is written here). Household-readable.
--
-- Sync is a pg_cron job → sync-freebusy edge function via pg_net, same
-- shape as the push_notifications digest job. NO-OPs when Vault secrets
-- are unset, so a fresh environment works without any freebusy setup.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ─── PRIVATE: ICS SOURCES ──────────────────────────────────────
create table public.calendar_freebusy_sources (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  label          text,
  ics_url        text not null,
  last_synced_at timestamptz,
  last_error     text,
  created_at     timestamptz not null default now(),
  unique (user_id, ics_url)
);

alter table public.calendar_freebusy_sources enable row level security;

-- Strictly owner-only, both directions — this is the privacy boundary for
-- the URL itself. `with check` additionally confirms household membership
-- so you can't attach a source to a household you don't belong to.
create policy "Owner manages own freebusy sources" on public.calendar_freebusy_sources
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_household_member(household_id));

grant select, insert, update, delete on public.calendar_freebusy_sources to authenticated;
grant all on public.calendar_freebusy_sources to service_role;

create index calendar_freebusy_sources_household_idx on public.calendar_freebusy_sources (household_id);

-- Intentionally NOT added to supabase_realtime — the source list is
-- single-user UI (settings), no live cross-member view depends on it.

-- ─── SHARED: COMPUTED BUSY BLOCKS ──────────────────────────────
create table public.calendar_busy_blocks (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  source_id    uuid references public.calendar_freebusy_sources(id) on delete cascade,
  created_at   timestamptz not null default now()
);

alter table public.calendar_busy_blocks enable row level security;

-- Read-only for household members; only service_role (the edge function)
-- ever writes here — no client-side insert/update/delete policy at all.
create policy "Household members read busy blocks" on public.calendar_busy_blocks
  for select to authenticated
  using (public.is_household_member(household_id));

grant select on public.calendar_busy_blocks to authenticated;
grant all on public.calendar_busy_blocks to service_role;

create index calendar_busy_blocks_household_range_idx
  on public.calendar_busy_blocks (household_id, starts_at, ends_at);

-- Realtime so blocks appear without a manual refresh after a sync.
alter publication supabase_realtime add table public.calendar_busy_blocks;

-- ─── SYNC SCHEDULE (pg_cron) ────────────────────────────────────
-- Every 30 min; ICS sources at most providers refresh less often than
-- that anyway. No-ops (via the WHERE EXISTS guard) until
-- supabase/snippets/setup-freebusy-vault.sql has been run.

select cron.schedule('cozy-freebusy-sync', '*/30 * * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'freebusy_fn_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'freebusy_fn_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'freebusy_fn_url')
$$);
