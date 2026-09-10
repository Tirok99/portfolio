-- ============================================================================
--  ONVORX — Plan 4 migration. Run once in the Supabase SQL Editor, after
--  schema.sql + seed.sql. Safe to re-run.
-- ============================================================================

-- ---- 1. server-assigned card sort -----------------------------------------
-- schema.sql declares `sort int not null default 0`; drop that so an omitted
-- `sort` arrives as NULL and the trigger below assigns it. seed.sql and
-- reset_content always send an explicit sort, so this is safe for them.
alter table public.projects alter column sort drop default;
alter table public.projects alter column sort drop not null;
alter table public.services alter column sort drop default;
alter table public.services alter column sort drop not null;

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

-- ---- 3. atomic content reset -----------------------------------------
-- payload = { sections: [{key,eyebrow,title,body,cta_label}...],
--             seo: [{page_key,title,description}...],
--             cards: [{table:'projects'|'services', list, id, ...row}...] }
-- All snake_case, already row-shaped by the caller. Runs in one transaction.
create or replace function public.reset_content(payload jsonb) returns void
  language plpgsql
  set search_path = ''
as $$
declare
  s jsonb;
  e jsonb;
  card jsonb;
begin
  -- Guard: the two `delete from` below run before the insert loop, so a null or
  -- malformed payload would wipe the card tables and re-insert nothing.
  if payload is null
     or jsonb_typeof(payload -> 'cards') <> 'array'
     or jsonb_typeof(payload -> 'sections') <> 'array'
     or jsonb_typeof(payload -> 'seo') <> 'array' then
    raise exception 'reset_content: payload must have array keys sections, seo, cards';
  end if;

  for s in select * from jsonb_array_elements(payload -> 'sections') loop
    update public.site_sections set
      eyebrow   = coalesce(s -> 'eyebrow',   eyebrow),
      title     = coalesce(s -> 'title',     title),
      body      = coalesce(s -> 'body',      body),
      cta_label = case when s -> 'cta_label' = 'null'::jsonb or s -> 'cta_label' is null then null else s -> 'cta_label' end
    where key = s ->> 'key';
  end loop;

  for e in select * from jsonb_array_elements(payload -> 'seo') loop
    update public.seo_pages set
      title       = coalesce(e -> 'title',       title),
      description  = coalesce(e -> 'description', description)
    where page_key = e ->> 'page_key';
  end loop;

  delete from public.projects;
  delete from public.services;

  for card in select * from jsonb_array_elements(payload -> 'cards') loop
    if card ->> 'table' = 'projects' then
      insert into public.projects (list, id, sort, published, title, tags, description, image_url, image_path, image_alt)
      values (
        card ->> 'list', card ->> 'id', (card ->> 'sort')::int,
        coalesce((card ->> 'published')::boolean, false),
        coalesce(card -> 'title', '{"en":"","uk":""}'::jsonb),
        coalesce((select array_agg(x) from jsonb_array_elements_text(card -> 'tags') x), '{}'),
        coalesce(card -> 'description', '{"en":"","uk":""}'::jsonb),
        card ->> 'image_url', card ->> 'image_path',
        coalesce(card -> 'image_alt', '{"en":"","uk":""}'::jsonb)
      );
    else
      insert into public.services (list, id, sort, published, featured, title, text, icon_url, icon_path)
      values (
        card ->> 'list', card ->> 'id', (card ->> 'sort')::int,
        coalesce((card ->> 'published')::boolean, false),
        coalesce((card ->> 'featured')::boolean, false),
        coalesce(card -> 'title', '{"en":"","uk":""}'::jsonb),
        coalesce(card -> 'text', '{"en":"","uk":""}'::jsonb),
        card ->> 'icon_url', card ->> 'icon_path'
      );
    end if;
  end loop;
end $$;

-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, which would make
-- POST /rest/v1/rpc/reset_content callable with the anon key (browser bundle).
-- service_role — which getSupabaseAdmin uses — keeps its grant via Supabase defaults.
revoke execute on function public.reset_content(jsonb) from anon, authenticated;
