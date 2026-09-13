-- Lets the Next.js server trigger an immediate freebusy resync (the "Sync
-- now" button in Settings → Povezave) without ever handing the Next.js app
-- FREEBUSY_FN_SECRET itself. The secret stays exactly where it already
-- lived (Supabase Vault, read only by this function's owner) — the app
-- only needs permission to call this RPC, not to read the secret.
--
-- Body is the same net.http_post() call the cozy-freebusy-sync cron job
-- already runs every 30 min (see 20260819155526_calendar_freebusy.sql) —
-- this just lets it be fired on demand too. security definer so it runs
-- with the function owner's privileges (able to read vault.decrypted_secrets)
-- regardless of the caller's own grants; access is restricted below to
-- service_role only, since only the server (never the browser) should be
-- able to call it.
create or replace function public.trigger_freebusy_sync()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  req_id bigint;
begin
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'freebusy_fn_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'freebusy_fn_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 25000
  ) into req_id;
  return req_id;
end;
$$;

revoke all on function public.trigger_freebusy_sync() from public;
revoke all on function public.trigger_freebusy_sync() from authenticated;
grant execute on function public.trigger_freebusy_sync() to service_role;
