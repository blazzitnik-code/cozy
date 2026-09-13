-- ═══════════════════════════════════════════════════════════════
-- Shopping section order: lets a household drag the "grouped by category"
-- sections (Sadje, Zelenjava, ...) in Trgovko into their own preferred
-- order (e.g. produce first) instead of the fixed order baked into
-- detectCategory() in components/ShoppingModule.js.
--
-- Deliberately NOT a rework of categorization itself (that stays the
-- regex-based detectCategory() for now, per backlog) - this table only
-- carries an override for section ORDER, keyed by the same category keys
-- detectCategory() already produces (sadje, zelenjava, meso, ...). "drugo"
-- (the catch-all) is intentionally never in this table - it always renders
-- last, un-reorderable, since it's a miscellaneous bucket rather than a
-- real category.
--
-- Same shape as shopping_stores: household-shared (no owner/member split -
-- one household, one shopping list, one section order), text id, composite
-- PK, sort_order. Household members can read AND write directly (no server
-- route needed - this is just a preference, not sensitive data), same as
-- shopping_stores.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.shopping_sections (
  id           text not null,
  household_id uuid not null references public.households(id) on delete cascade,
  sort_order   integer not null default 0,
  primary key (household_id, id)
);

alter table public.shopping_sections enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'shopping_sections' and policyname = 'Household members manage shopping_sections') then
    create policy "Household members manage shopping_sections" on public.shopping_sections
      for all to authenticated
      using (public.is_household_member(household_id))
      with check (public.is_household_member(household_id));
  end if;
end $$;

grant select, insert, update, delete on public.shopping_sections to authenticated;
grant all on public.shopping_sections to service_role;

create index if not exists shopping_sections_household_idx on public.shopping_sections (household_id);

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shopping_sections'
  ) then
    alter publication supabase_realtime add table public.shopping_sections;
  end if;
end $$;
