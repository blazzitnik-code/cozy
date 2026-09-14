-- ═══════════════════════════════════════════════════════════════
-- One-off rename: "Luč galerija" → "Bulb galerija" (B's call — it's
-- actually a Shelly bulb, not a plain light switch).
--
-- Two places need updating, or the name reverts within 10 minutes:
--  1. home_devices.name — what the UI actually displays.
--  2. provider_connections.config.devices[].name — the roster
--     providers/shelly/index.js polls every sync and stamps back onto
--     home_devices.name each time (see toSwitchDevice/toDimmerDevice/
--     toCoverDevice), so renaming only #1 would get silently reverted
--     at the very next cron run.
--
-- Both updates are no-ops (WHERE clause matches nothing) once already
-- applied, so this migration is safe to leave in the history / re-run.
-- ═══════════════════════════════════════════════════════════════

update public.home_devices
  set name = 'Bulb galerija'
  where provider = 'shelly' and name = 'Luč galerija';

update public.provider_connections
  set config = jsonb_set(
    config,
    '{devices}',
    (
      select jsonb_agg(
        case when d->>'name' = 'Luč galerija' then jsonb_set(d, '{name}', '"Bulb galerija"')
             else d end
      )
      from jsonb_array_elements(config->'devices') d
    )
  )
  where provider = 'shelly'
    and config->'devices' @> '[{"name":"Luč galerija"}]'::jsonb;
