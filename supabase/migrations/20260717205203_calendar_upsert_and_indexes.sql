-- ─── CALENDAR EVENTS: upsert-friendly unique key ─────────────────
-- saveEvents used to delete+reinsert a user's rows for the synced date, which
-- wiped label/is_important annotations on every sync. It now upserts on
-- (user_id, event_date, google_event_id) with a payload that omits the
-- annotation columns, so they survive re-syncs.

-- Deduplicate legacy rows first (delete+insert kept at most one row per key
-- in practice, but be safe) — keep the newest per key.
delete from public.calendar_events a
using public.calendar_events b
where a.google_event_id is not null
  and a.user_id = b.user_id
  and a.event_date = b.event_date
  and a.google_event_id = b.google_event_id
  and (a.created_at, a.id) < (b.created_at, b.id);

create unique index calendar_events_user_date_gid_idx
  on public.calendar_events (user_id, event_date, google_event_id);

-- ─── MISSING household_id INDEXES ────────────────────────────────
-- Every household-scoped hook filters by household_id; only calendar_events
-- had a covering index. freezers / shopping_stores / home_settings /
-- household_members are already covered by PKs/uniques leading with
-- household_id.
create index items_household_idx                on public.items (household_id);
create index archived_household_idx             on public.archived (household_id);
create index shopping_items_household_idx       on public.shopping_items (household_id);
create index shopping_archived_household_idx    on public.shopping_archived (household_id);
create index shopping_favourites_household_idx  on public.shopping_favourites (household_id);
create index calendar_connections_household_idx on public.calendar_connections (household_id);
create index todo_lists_household_idx           on public.todo_lists (household_id);
create index todo_items_household_idx           on public.todo_items (household_id);
-- todo_items are grouped per list client-side and cascade-deleted by list.
create index todo_items_list_idx                on public.todo_items (list_id);
-- The send-push edge function selects subscriptions by user_id.
create index push_subscriptions_user_idx        on public.push_subscriptions (user_id);
