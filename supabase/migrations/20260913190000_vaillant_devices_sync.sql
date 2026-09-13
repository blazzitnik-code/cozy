-- ═══════════════════════════════════════════════════════════════
-- Naprave / Vaillant myVAILLANT (second home-device provider, alongside
-- MELCloud Home): schedules the sync-vaillant-devices edge function on the
-- same cron shape as cozy-home-devices-sync (see
-- supabase/migrations/20260913120315_home_devices.sql). No schema change
-- needed — home_devices.provider and provider_connections.provider are
-- already free-text (see supabase/migrations/20260913125400_provider_connections.sql),
-- so 'vaillant' rows live in the same two tables as 'melcloud_home' rows.
--
-- No-ops until supabase/snippets/setup-vaillant-vault.sql has been run
-- (same WHERE EXISTS guard pattern as the MELCloud cron job).
-- ═══════════════════════════════════════════════════════════════

select cron.schedule('cozy-vaillant-devices-sync', '*/10 * * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'vaillant_fn_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'vaillant_fn_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'vaillant_fn_url')
$$);
