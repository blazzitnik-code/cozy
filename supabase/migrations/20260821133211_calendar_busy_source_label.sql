-- Denormalize the freebusy source's label onto each busy block so household
-- members can tell calendars apart (e.g. "Work" vs "Home") in Koledarko,
-- without being able to read the source's ics_url — calendar_freebusy_sources
-- itself stays strictly owner-only (see 20260819155526_calendar_freebusy.sql).
-- Populated by the sync-freebusy edge function at insert time.
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'calendar_busy_blocks' and column_name = 'source_label'
  ) then
    alter table public.calendar_busy_blocks add column source_label text;
  end if;
end $$;
