-- ═══════════════════════════════════════════════════════════════
-- One-time Vaillant sync setup per environment — run MANUALLY, this is NOT
-- a migration (the values differ between local and prod, and secrets are
-- data, not schema). Same shape as setup-melcloud-vault.sql.
--
-- Without these two Vault secrets the cozy-vaillant-devices-sync cron job
-- silently no-ops (see the WHERE EXISTS guard in
-- supabase/migrations/20260913190000_vaillant_devices_sync.sql).
--
-- The secret value of `vaillant_fn_secret` must match the
-- VAILLANT_FN_SECRET env of the sync-vaillant-devices edge function
-- (supabase/functions/.env locally, `npx supabase secrets set` in prod).
-- ═══════════════════════════════════════════════════════════════

-- LOCAL (SQL editor on http://127.0.0.1:55323 or `psql`):
select vault.create_secret(
  'http://host.docker.internal:55321/functions/v1/sync-vaillant-devices',
  'vaillant_fn_url'
);

-- PROD (SQL editor in the Supabase dashboard) — use this url instead:
-- select vault.create_secret(
--   'https://<project-ref>.supabase.co/functions/v1/sync-vaillant-devices',
--   'vaillant_fn_url'
-- );

-- BOTH environments — generate a random shared secret (32+ chars), e.g.
-- `openssl rand -hex 32`, and use the SAME value for VAILLANT_FN_SECRET.
-- Can reuse a different value than melcloud_fn_secret/freebusy_fn_secret —
-- no need to share it.
select vault.create_secret('<random-32+-chars>', 'vaillant_fn_secret');

-- To change a value later: update via vault.update_secret(id, new_secret)
-- (find the id with: select id, name from vault.secrets;)

-- To sync immediately instead of waiting up to 10 min, call the function
-- directly (replace url/secret with your values):
-- select net.http_post(
--   url := 'http://host.docker.internal:55321/functions/v1/sync-vaillant-devices',
--   headers := jsonb_build_object('x-sync-secret', '<your vaillant_fn_secret>'),
--   body := '{}'::jsonb
-- );
