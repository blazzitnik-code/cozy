-- Extends trigger_freebusy_sync() to optionally target a single source, so
-- we can bisect which ICS source is causing sync-freebusy's "CPU Time
-- exceeded" crash (see the accompanying edge function change) without
-- needing FREEBUSY_FN_SECRET by hand — this still goes through Vault the
-- same way the zero-arg version does, just from the SQL Editor:
--   select trigger_freebusy_sync('<source-id>');   -- one source only
--   select trigger_freebusy_sync();                -- all sources, as before
--
-- Postgres treats a different argument list as a different function
-- signature, so the old zero-arg version needs dropping first rather than
-- replaced in place — otherwise both would coexist as overloads.
drop function if exists public.trigger_freebusy_sync();

create or replace function public.trigger_freebusy_sync(p_source_id uuid default null)
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
    body    := case
      when p_source_id is null then '{}'::jsonb
      else jsonb_build_object('sourceId', p_source_id)
    end,
    timeout_milliseconds := 25000
  ) into req_id;
  return req_id;
end;
$$;

revoke all on function public.trigger_freebusy_sync(uuid) from public;
revoke all on function public.trigger_freebusy_sync(uuid) from authenticated;
grant execute on function public.trigger_freebusy_sync(uuid) to service_role;
