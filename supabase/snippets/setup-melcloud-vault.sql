-- ═══════════════════════════════════════════════════════════════
-- One-time home-devices sync setup per environment — run MANUALLY, this is
-- NOT a migration (the values differ between local and prod, and secrets
-- are data, not schema). Same shape as setup-freebusy-vault.sql.
--
-- Without these two Vault secrets the cozy-home-devices-sync cron job
-- silently no-ops (see the WHERE EXISTS guard in
-- supabase/migrations/20260913120315_home_devices.sql).
--
-- The secret value of `melcloud_fn_secret` must match the
-- MELCLOUD_FN_SECRET env of the sync-home-devices edge function
-- (supabase/functions/.env locally, `npx supabase secrets set` in prod).
--
-- NOTE: this snippet only wires up the sync *invocation* secret, not the
-- actual MELCloud Home account credentials — those aren't needed until the
-- mocked provider (providers/melcloud-home/index.js) is swapped for the
-- real OAuth 2.0 + PKCE implementation. When that happens, the refresh
-- token also belongs in Vault (e.g. `melcloud_refresh_token`), read by the
-- edge function via the same `vault.decrypted_secrets` pattern — never as
-- a plain table column.
-- ═══════════════════════════════════════════════════════════════

-- LOCAL (SQL editor on http://127.0.0.1:55323 or `psql`):
-- pg_net runs inside the Postgres container, so it reaches the host's Kong
-- gateway (port 55321) via host.docker.internal (macOS/Windows Docker).
select vault.create_secret(
  'http://host.docker.internal:55321/functions/v1/sync-home-devices',
  'melcloud_fn_url'
);

-- PROD (SQL editor in the Supabase dashboard) — use this url instead:
-- select vault.create_secret(
--   'https://<project-ref>.supabase.co/functions/v1/sync-home-devices',
--   'melcloud_fn_url'
-- );

-- BOTH environments — generate a random shared secret (32+ chars), e.g.
-- `openssl rand -hex 32`, and use the SAME value for MELCLOUD_FN_SECRET.
-- Can reuse a different value than freebusy_fn_secret/push_fn_secret — no
-- need to share it.
select vault.create_secret('<random-32+-chars>', 'melcloud_fn_secret');

-- To change a value later: update via vault.update_secret(id, new_secret)
-- (find the id with: select id, name from vault.secrets;)

-- To sync immediately instead of waiting up to 10 min, call the function
-- directly (replace url/secret with your values):
-- select net.http_post(
--   url := 'http://host.docker.internal:55321/functions/v1/sync-home-devices',
--   headers := jsonb_build_object('x-sync-secret', '<your melcloud_fn_secret>'),
--   body := '{}'::jsonb
-- );
