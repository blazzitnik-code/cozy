-- Fixes the "CPU Time exceeded" crash that took down sync-freebusy for
-- every source, every time (confirmed live 2026-09-13): each ICS source
-- syncs fine completely on its own (Work: 1277 VEVENTs/682ms, Osebno: 2855
-- VEVENTs/1349ms, Home similar) — but the cron job's single request tried
-- to parse ALL of a household's calendars in one edge function invocation
-- via Promise.all, and the combined synchronous CPU cost of that (ICAL.parse
-- + recurrence expansion is all synchronous work, so Promise.all doesn't
-- actually overlap it) was enough to blow the invocation's CPU budget even
-- though no single source came close alone.
--
-- Fix: fan out to one HTTP call — and so one edge function invocation,
-- each with its own separate CPU budget — per source, instead of one call
-- covering all of them. The edge function already supports this (an
-- optional {sourceId} body, added for bisecting this very issue); this
-- migration is what makes both the cron job and a manual "Sync now" go
-- through that same one-call-per-source path by default.
create or replace function public.trigger_freebusy_sync(p_source_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  dispatched integer := 0;
  src record;
  fn_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'freebusy_fn_url');
  fn_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'freebusy_fn_secret');
begin
  if fn_url is null then
    return 0; -- no-ops until supabase/snippets/setup-freebusy-vault.sql has been run
  end if;

  if p_source_id is not null then
    perform net.http_post(
      url     := fn_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', fn_secret),
      body    := jsonb_build_object('sourceId', p_source_id),
      timeout_milliseconds := 25000
    );
    return 1;
  end if;

  for src in select id from calendar_freebusy_sources loop
    perform net.http_post(
      url     := fn_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', fn_secret),
      body    := jsonb_build_object('sourceId', src.id),
      timeout_milliseconds := 25000
    );
    dispatched := dispatched + 1;
  end loop;

  return dispatched;
end;
$$;

revoke all on function public.trigger_freebusy_sync(uuid) from public;
revoke all on function public.trigger_freebusy_sync(uuid) from authenticated;
grant execute on function public.trigger_freebusy_sync(uuid) to service_role;

-- Point the existing cron job at this function instead of its own inline
-- single-call net.http_post, so there's one fan-out implementation instead
-- of two copies to keep in sync. alter_job (not unschedule+schedule) keeps
-- the job's id and run history intact. Guarded so replaying this migration
-- (db reset, or a fresh environment where the job was never scheduled)
-- doesn't error on a null jobid.
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'cozy-freebusy-sync';
  if v_jobid is not null then
    perform cron.alter_job(v_jobid, command := 'select public.trigger_freebusy_sync();');
  end if;
end $$;
