-- Weather: multiple locations per user (was a single hardcoded Ljubljana
-- card). Stored as JSONB on home_settings alongside the other per-user home
-- widgets (destinations/shortcuts/bus_stops/bike_stations follow the same
-- pattern). Array order = priority; index 0 is the "main" location shown on
-- the home card. Empty by default — the client falls back to a Ljubljana
-- default (see lib/utils.js weatherLocationsOf) until the user adds one.
do $ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'home_settings' and column_name = 'weather_locations'
  ) then
    alter table public.home_settings add column weather_locations jsonb not null default '[]'::jsonb;
  end if;
end $;
