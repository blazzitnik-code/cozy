-- ═══════════════════════════════════════════════════════════════
-- One-time push setup per environment — run MANUALLY, this is NOT a
-- migration (the values differ between local and prod, and secrets are
-- data, not schema).
--
-- Without these two Vault secrets the push triggers silently no-op:
-- inserts keep working, no notifications are sent.
--
-- The secret value of `push_fn_secret` must match the PUSH_FN_SECRET env
-- of the send-push edge function (supabase/functions/.env locally,
-- `npx supabase secrets set` in prod).
-- ═══════════════════════════════════════════════════════════════

-- LOCAL (SQL editor on http://127.0.0.1:55323 or `psql`):
-- pg_net runs inside the Postgres container, so it reaches the host's Kong
-- gateway (port 55321) via host.docker.internal (macOS/Windows Docker).
select vault.create_secret(
  'http://host.docker.internal:55321/functions/v1/send-push',
  'push_fn_url'
);

-- PROD (SQL editor in the Supabase dashboard) — use this url instead:
-- select vault.create_secret(
--   'https://<project-ref>.supabase.co/functions/v1/send-push',
--   'push_fn_url'
-- );

-- BOTH environments — generate a random shared secret (32+ chars), e.g.
-- `openssl rand -hex 32`, and use the SAME value for PUSH_FN_SECRET:
select vault.create_secret('<random-32+-chars>', 'push_fn_secret');

-- To change a value later: update via vault.update_secret(id, new_secret)
-- (find the id with: select id, name from vault.secrets;)
