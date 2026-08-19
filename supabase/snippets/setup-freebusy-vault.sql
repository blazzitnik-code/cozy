-- ═══════════════════════════════════════════════════════════════
-- One-time freebusy sync setup per environment — run MANUALLY, this is NOT
-- a migration (the values differ between local and prod, and secrets are
-- data, not schema).
--
-- Without these two Vault secrets the cozy-freebusy-sync cron job silently
-- no-ops (see the WHERE EXISTS guard in
-- supabase/migrations/20260819155526_calendar_freebusy.sql) — members can
-- still add ICS sources in Settings, they just never sync until this is run.
--
-- The secret value of `freebusy_fn_secret` must match the
-- FREEBUSY_FN_SECRET env of the sync-freebusy edge function
-- (supabase/functions/.env locally, `npx supabase secrets set` in prod).
-- ═══════════════════════════════════════════════════════════════

-- LOCAL (SQL editor on http://127.0.0.1:55323 or `psql`):
-- pg_net runs inside the Postgres container, so it reaches the host's Kong
-- gateway (port 55321) via host.docker.internal (macOS/Windows Docker).
select vault.create_secret(
  'http://host.docker.internal:55321/functions/v1/sync-freebusy',
  'freebusy_fn_url'
);

-- PROD (SQL editor in the Supabase dashboard) — use this url instead:
-- select vault.create_secret(
--   'https://<project-ref>.supabase.co/functions/v1/sync-freebusy',
--   'freebusy_fn_url'
-- );

-- BOTH environments — generate a random shared secret (32+ chars), e.g.
-- `openssl rand -hex 32`, and use the SAME value for FREEBUSY_FN_SECRET.
-- Can reuse a different value than push_fn_secret — no need to share it.
select vault.create_secret('<random-32+-chars>', 'freebusy_fn_secret');

-- To change a value later: update via vault.update_secret(id, new_secret)
-- (find the id with: select id, name from vault.secrets;)

-- To sync immediately instead of waiting up to 30 min, call the function
-- directly (replace url/secret with your values):
-- select net.http_post(
--   url := 'http://host.docker.internal:55321/functions/v1/sync-freebusy',
--   headers := jsonb_build_object('x-sync-secret', '<your freebusy_fn_secret>'),
--   body := '{}'::jsonb
-- );
