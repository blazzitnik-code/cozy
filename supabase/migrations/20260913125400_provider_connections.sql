-- ═══════════════════════════════════════════════════════════════
-- Provider connections: generic "we have linked this household to an
-- external account" layer, first consumer is MELCloud Home (Naprave/
-- Devices). Split into two tables on purpose:
--
--   provider_connections         — display-safe status. Household members
--                                   can read it (so Settings can show
--                                   "Connected as x@y.com" / a red error
--                                   banner) but never write it directly.
--   provider_connection_secrets  — the actual bearer tokens. No RLS policy
--                                   grants `authenticated` ANY access at
--                                   all (not even select) — only
--                                   service_role can touch this table, from
--                                   trusted server code (the connect/
--                                   disconnect API routes and the
--                                   sync-home-devices edge function).
--
-- This replaces the "store the refresh token in Vault" idea floated in
-- setup-melcloud-vault.sql: Vault here is for static, manually-configured
-- secrets (one `vault.create_secret` SQL snippet per environment), not
-- tokens obtained dynamically per household from a live OAuth login. A
-- service-role-only table gets the same "zero client access" property
-- without needing new Vault-write RPC plumbing. Same household-shared, no
-- owner/member split as home_devices — the connection belongs to the
-- household, not whoever ran the login form.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.provider_connections (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  provider      text not null,
  status        text not null default 'connected' check (status in ('connected', 'error', 'disconnected')),
  account_email text,
  connected_at  timestamptz not null default now(),
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (household_id, provider)
);

alter table public.provider_connections enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'provider_connections' and policyname = 'Household members read provider_connections') then
    create policy "Household members read provider_connections" on public.provider_connections
      for select to authenticated
      using (public.is_household_member(household_id));
  end if;
end $$;

grant select on public.provider_connections to authenticated;
grant all on public.provider_connections to service_role;

create index if not exists provider_connections_household_idx on public.provider_connections (household_id);

-- Realtime so the Settings badge / Devices reconnect-banner update live
-- once the connect API route finishes, without a manual refresh.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'provider_connections'
  ) then
    alter publication supabase_realtime add table public.provider_connections;
  end if;
end $$;

-- ─── Secrets table — service_role only, no exceptions ──────────
create table if not exists public.provider_connection_secrets (
  connection_id    uuid primary key references public.provider_connections(id) on delete cascade,
  access_token     text not null,
  refresh_token    text not null,
  token_expires_at timestamptz not null,
  updated_at       timestamptz not null default now()
);

alter table public.provider_connection_secrets enable row level security;

-- Deliberately no `create policy` for `authenticated` here — RLS with zero
-- policies means zero access, which is the point. Do not add one.

grant all on public.provider_connection_secrets to service_role;
