-- All-day (VALUE=DATE) ICS events have no real time component — ical.js
-- anchors them to UTC midnight, which after timezone conversion on the
-- client shows up as e.g. "02:00-02:00" instead of a real span. Track them
-- explicitly so the client can render "All day" (like Cožy's own all_day
-- events) instead of a misleading time range. Populated by sync-freebusy.
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'calendar_busy_blocks' and column_name = 'all_day'
  ) then
    alter table public.calendar_busy_blocks add column all_day boolean not null default false;
  end if;
end $$;
