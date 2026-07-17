-- ═══════════════════════════════════════════════════════════════
-- Web push notifications
-- Subscriptions table + DB triggers that POST to the `send-push` edge
-- function via pg_net, plus a pg_cron daily digest job.
--
-- The trigger reads the function URL + shared secret from Vault
-- (`push_fn_url`, `push_fn_secret` — see supabase/snippets/setup-push-vault.sql)
-- and NO-OPS when they are missing, so a fresh local stack works without
-- any push setup.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ─── AUTHOR COLUMNS ──────────────────────────────────────────────
-- Durable fallback for identifying the acting user in triggers
-- (primary source is auth.uid(), available because all client writes go
-- through PostgREST with the user's JWT). default auth.uid() means no
-- client code change is needed; nullable because RPC/seed inserts run
-- without a user context.

alter table public.shopping_items
  add column created_by uuid references auth.users(id) on delete set null default auth.uid();
alter table public.todo_items
  add column created_by uuid references auth.users(id) on delete set null default auth.uid();

-- ─── PUSH SUBSCRIPTIONS ──────────────────────────────────────────
-- One row per browser push endpoint. `locale` is captured client-side at
-- subscribe time (the UI language lives in localStorage, invisible to the
-- server) so the edge function can render notification text per subscriber.

create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  locale       text not null default 'sl' check (locale in ('sl', 'en')),
  created_at   timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "Users manage own subscriptions" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid() and public.is_household_member(household_id))
  with check (user_id = auth.uid() and public.is_household_member(household_id));

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

-- Intentionally NOT added to the supabase_realtime publication — no live UI
-- depends on this table.

-- ─── TRIGGER → EDGE FUNCTION ─────────────────────────────────────
-- Fire-and-forget POST to `send-push` via pg_net (async: a failing or slow
-- webhook can never break the user's insert; failures are visible in
-- net._http_response). tg_argv[0] is the notification type.

create or replace function public.notify_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'push_fn_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_fn_secret';
  if v_url is null or v_secret is null then
    return new; -- push not configured in this environment
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    body    := jsonb_build_object(
      'type', tg_argv[0],
      'household_id', new.household_id,
      'actor', coalesce(auth.uid(), new.created_by),
      'record', to_jsonb(new)
    ),
    timeout_milliseconds := 3000
  );
  return new;
end;
$$;

create trigger shopping_item_added_push
  after insert on public.shopping_items
  for each row
  execute function public.notify_push('shopping_added');

-- Two triggers because OLD is not available in an INSERT WHEN clause.
create trigger todo_assigned_insert_push
  after insert on public.todo_items
  for each row
  when (new.assigned_to is not null)
  execute function public.notify_push('todo_assigned');

create trigger todo_assigned_update_push
  after update of assigned_to on public.todo_items
  for each row
  when (new.assigned_to is not null and new.assigned_to is distinct from old.assigned_to)
  execute function public.notify_push('todo_assigned');

-- ─── DAILY DIGEST (pg_cron) ──────────────────────────────────────
-- Freezer expiry + todos due today, summarized per household.
-- pg_cron runs in UTC: 07:00 UTC = 09:00 CEST (summer) / 08:00 CET (winter).
-- Accepted DST drift; if it ever bothers, switch to an hourly schedule and
-- let the edge function check the Europe/Ljubljana local hour instead.

select cron.schedule('cozy-daily-digest', '0 7 * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'push_fn_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_fn_secret')
    ),
    body    := jsonb_build_object('type', 'daily_digest')
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'push_fn_url')
$$);
