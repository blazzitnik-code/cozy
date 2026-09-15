-- ═══════════════════════════════════════════════════════════════
-- Naprave / Netatmo (fourth home-device provider, alongside MELCloud Home,
-- Vaillant and Shelly): no new tables/columns needed — home_devices and
-- provider_connections are already generic, and provider_connections'
-- access_token/refresh_token/token_expires_at columns (already nullable
-- since the Shelly migration) fit Netatmo's real OAuth2 token pair
-- perfectly, no schema change required.
--
-- Read-only sensor provider — indoor (temperature/humidity/CO2/noise/
-- pressure) and outdoor (temperature/humidity/battery) Weather Station
-- modules, no control commands.
-- ═══════════════════════════════════════════════════════════════

-- ─── SYNC SCHEDULE (pg_cron) ────────────────────────────────────
-- Same shape as cozy-home-devices-sync / cozy-vaillant-devices-sync /
-- cozy-shelly-devices-sync. No-ops until
-- supabase/snippets/setup-netatmo-vault.sql has been run.

select cron.schedule('cozy-netatmo-devices-sync', '*/10 * * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'netatmo_fn_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'netatmo_fn_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'netatmo_fn_url')
$$);
