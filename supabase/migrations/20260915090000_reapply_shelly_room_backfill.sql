-- ═══════════════════════════════════════════════════════════════
-- Re-apply the Shelly room backfill from 20260914220000_naprave_favorites.sql.
--
-- That migration's UPDATEs worked, but sync-shelly-devices' 10-minute
-- pg_cron upsert unconditionally wrote `room: null` on every run (Shelly's
-- API never reports a room — it's purely an app-assigned value), which
-- silently reverted every backfilled room back to null within ~10 minutes.
-- Fixed in supabase/functions/sync-shelly-devices/index.ts and
-- sync-vaillant-devices/index.ts (2026-09-15) by dropping `room` from the
-- upsert payload entirely, so it's no longer clobbered on conflict. This
-- re-runs the same name-matching backfill now that it will actually stick.
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

update public.home_devices set room = 'Spalnica'
  where provider = 'shelly' and room is null and name ilike '%spalnica%';
update public.home_devices set room = 'Dnevna soba'
  where provider = 'shelly' and room is null and name ilike '%dnevna%';
update public.home_devices set room = 'Galerija'
  where provider = 'shelly' and room is null and name ilike '%galerija%';
update public.home_devices set room = 'Terasa'
  where provider = 'shelly' and room is null and name ilike '%terasa%';
