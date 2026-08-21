-- Listko: per-item due date + priority flag. Lists already have due_date;
-- items only had list-level due dates until now, which is too coarse once a
-- list has more than a couple of tasks. important is a plain boolean star
-- flag (mirrors the shopping_items.favourite pattern), not a full
-- priority-levels model — keep it simple until there's a real need for more.
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'todo_items' and column_name = 'due_date'
  ) then
    alter table public.todo_items add column due_date date;
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'todo_items' and column_name = 'important'
  ) then
    alter table public.todo_items add column important boolean not null default false;
  end if;
end $$;
