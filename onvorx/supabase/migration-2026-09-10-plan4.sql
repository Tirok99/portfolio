-- ============================================================================
--  ONVORX — Plan 4 migration. Run once in the Supabase SQL Editor, after
--  schema.sql + seed.sql. Safe to re-run.
-- ============================================================================

-- ---- 1. server-assigned card sort -----------------------------------------
-- one trigger fn per table so `max(sort)` targets the right relation
create or replace function public.assign_projects_sort() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if new.sort is null then
    select coalesce(max(sort), -1) + 1 into new.sort
    from public.projects where list = new.list;
  end if;
  return new;
end $$;

create or replace function public.assign_services_sort() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if new.sort is null then
    select coalesce(max(sort), -1) + 1 into new.sort
    from public.services where list = new.list;
  end if;
  return new;
end $$;

drop trigger if exists trg_projects_sort on public.projects;
create trigger trg_projects_sort before insert on public.projects
  for each row execute function public.assign_projects_sort();

drop trigger if exists trg_services_sort on public.services;
create trigger trg_services_sort before insert on public.services
  for each row execute function public.assign_services_sort();

-- ---- 2. no two cards share a slot ---------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_list_sort_key') then
    alter table public.projects add constraint projects_list_sort_key unique (list, sort);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'services_list_sort_key') then
    alter table public.services add constraint services_list_sort_key unique (list, sort);
  end if;
end $$;
