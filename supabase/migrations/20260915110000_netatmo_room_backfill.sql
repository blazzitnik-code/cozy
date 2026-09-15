-- ═══════════════════════════════════════════════════════════════
-- Backfill room (physical location) for the 2 Netatmo Weather Stations —
-- same shape as 20260915090000_reapply_shelly_room_backfill.sql, but
-- matched by external_id (device MAC) rather than name, since Netatmo's
-- own module names ("Notri"/"Zunaj" vs "Weather Station"/"Outdoor Module")
-- don't reflect the physical location. sync-netatmo-devices/index.ts
-- already omits `room` from its upsert (same fix applied to Shelly/
-- Vaillant on 2026-09-15), so this backfill sticks instead of getting
-- clobbered on the next 10-minute sync.
--
-- Station pairing confirmed by B: "Notri"/"Zunaj" = Orlova (primary home),
-- "Weather Station"/"Outdoor Module" = Golte (colder, higher-altitude
-- second location) — corroborated independently by both temperature
-- (Golte consistently colder) and atmospheric pressure (Golte ~890mbar vs
-- Orlova ~1023mbar, consistent with Golte's higher altitude).
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

update public.home_devices set room = 'Orlova'
  where provider = 'netatmo'
  and external_id in ('70:ee:50:28:85:b6', '02:00:00:63:23:c6');

update public.home_devices set room = 'Golte'
  where provider = 'netatmo'
  and external_id in ('70:ee:50:83:a2:c2', '02:00:00:83:c5:10');
