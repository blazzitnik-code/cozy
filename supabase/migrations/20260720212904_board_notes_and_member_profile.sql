-- ─── DESKA (family board) ───────────────────────────────────────
-- Household-scoped sticky notes for the home screen. `done_at IS NULL`
-- is the active set; marking done keeps the row but hides it everywhere.
create table if not exists public.board_notes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  text         text not null,
  created_by   uuid references auth.users(id) on delete set null default auth.uid(),
  author_name  text,
  done_at      timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.board_notes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'board_notes' and policyname = 'Household members manage notes') then
    create policy "Household members manage notes" on public.board_notes
      for all to authenticated
      using (public.is_household_member(household_id))
      with check (public.is_household_member(household_id));
  end if;
end $$;

grant select, insert, update, delete on public.board_notes to authenticated;
grant all on public.board_notes to service_role;

create index if not exists board_notes_household_idx on public.board_notes (household_id);

-- Realtime so both members see notes appear/complete live.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'board_notes'
  ) then
    alter publication supabase_realtime add table public.board_notes;
  end if;
end $$;

-- ─── MEMBER PROFILE (birthday + colour) ──────────────────────────
-- Optional per-member fields for the "by person" calendar view + home.
alter table public.household_members add column if not exists birthday date;
alter table public.household_members add column if not exists color text;
