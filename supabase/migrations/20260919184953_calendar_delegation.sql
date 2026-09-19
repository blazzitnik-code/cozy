-- Koledarko: delegation ("kdo prevzame" — e.g. who drives/picks up) on any
-- manual event, orthogonal to `assigned_to` (whose event it is). Additive
-- and nullable so existing rows/behaviour are unaffected.
--
-- delegation_requested = false, delegated_to = null  -> normal event, no UI
-- delegation_requested = true,  delegated_to = null  -> "kdo prevzame?" prompt
-- delegation_requested = true,  delegated_to = <uid> -> resolved, shows name
alter table public.calendar_events
  add column if not exists delegation_requested boolean not null default false;

alter table public.calendar_events
  add column if not exists delegated_to uuid references auth.users(id) on delete set null;

create index if not exists calendar_events_delegation_idx
  on public.calendar_events (household_id)
  where delegation_requested and delegated_to is null;
