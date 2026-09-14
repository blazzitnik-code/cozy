-- ═══════════════════════════════════════════════════════════════
-- Naprave / Shelly (third home-device provider, alongside MELCloud Home
-- and Vaillant): no new tables needed — home_devices.provider and
-- provider_connections.provider are already free-text — but Shelly's
-- auth model doesn't fit the OAuth-shaped columns provider_connections*
-- were built for:
--
--   - Shelly has no refresh flow. The household gets one long-lived
--     "Authorization cloud key" from the Shelly Cloud app (regenerated
--     only if they change their Shelly account password), not a
--     short-lived access_token + refresh_token pair. Stored in
--     provider_connection_secrets.access_token; refresh_token/
--     token_expires_at are meaningless for this provider, so both become
--     nullable rather than forcing a fake value into a NOT NULL column.
--   - Shelly's Cloud API has no "list all devices on this account"
--     endpoint (unlike MELCloud/Vaillant, where discovery IS the sync) —
--     each Shelly device's id/name/type is entered once by the household
--     when connecting and needs somewhere non-secret to live alongside
--     the connection. provider_connections.config (jsonb) is that generic
--     slot: `{ "server": "shelly-N-eu.shelly.cloud", "devices": [{ "id",
--     "name", "type" }, ...] }` for Shelly, null/unused for the other two
--     providers.
-- ═══════════════════════════════════════════════════════════════

alter table public.provider_connections
  add column if not exists config jsonb;

alter table public.provider_connection_secrets
  alter column refresh_token drop not null,
  alter column token_expires_at drop not null;

-- ─── SYNC SCHEDULE (pg_cron) ────────────────────────────────────
-- Same shape as cozy-home-devices-sync / cozy-vaillant-devices-sync.
-- No-ops until supabase/snippets/setup-shelly-vault.sql has been run.

select cron.schedule('cozy-shelly-devices-sync', '*/10 * * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'shelly_fn_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'shelly_fn_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'shelly_fn_url')
$$);
