-- ============================================================================
--  ONVORX — Admin-editable Hero/HowWork/About cards + Footer tagline
--  migration. Run once in the Supabase SQL Editor, after schema.sql +
--  seed.sql + every prior migration-*.sql file. The schema changes (new
--  columns, widened constraint, the `footer` row insert) ARE safely
--  re-runnable (guarded by `if not exists` / `on conflict do nothing`).
--  The data-seed UPDATEs at the bottom are NOT idempotent in the sense
--  that re-running them after an admin has since edited these cards
--  through /admin would silently overwrite those edits back to the
--  original static content — run this file, in full, exactly once,
--  before anyone edits these four pieces of content through /admin.
--  Section 4 at the bottom re-creates `reset_content` (first defined in
--  migration-2026-09-10-plan4.sql) so the "Reset to defaults" RPC also
--  restores the new `cards`/`launch` columns; that part is idempotent.
-- ============================================================================

-- ---- 1. schema: two new nullable JSONB columns ----------------------------
alter table public.site_sections
  add column if not exists cards  jsonb,
  add column if not exists launch jsonb;

-- ---- 2. widen the key constraint to allow a 'footer' row -----------------
alter table public.site_sections drop constraint if exists site_sections_key_check;
alter table public.site_sections add constraint site_sections_key_check
  check (key in ('hero','services','projects','howWork','about','cta','footer'));

insert into public.site_sections (key, eyebrow, title, body, cta_label)
values ('footer', '{"en":"","uk":""}', '{"en":"","uk":""}', '{"en":"","uk":""}', null)
on conflict (key) do nothing;

-- ---- 3. one-time data seed ------------------------------------------------
-- Icons point at the new static SVG files this plan's Task 3 creates under
-- /public/assets/icons/ (kind:'asset' — not a real Storage upload, so there
-- is nothing to clean up if this step is ever re-run before those files
-- exist; the site will just show a broken image until Task 3 lands, which
-- is why Task 3 must be merged before this migration is run live).
update public.site_sections set cards = '[
  { "icon": {"kind":"asset","src":"/assets/icons/hero-target-red.svg","path":null},
    "title": {"en":"Business Goals","uk":"Business Goals"},
    "text":  {"en":"Define outcomes","uk":"Define outcomes"} },
  { "icon": {"kind":"asset","src":"/assets/icons/hero-users-white.svg","path":null},
    "title": {"en":"User Needs","uk":"User Needs"},
    "text":  {"en":"Understand users","uk":"Understand users"} },
  { "icon": {"kind":"asset","src":"/assets/icons/hero-document-white.svg","path":null},
    "title": {"en":"Requirements","uk":"Requirements"},
    "text":  {"en":"Scope & prioritize","uk":"Scope & prioritize"} },
  { "icon": {"kind":"asset","src":"/assets/icons/hero-sitemap-white.svg","path":null},
    "title": {"en":"Strategy","uk":"Strategy"},
    "text":  {"en":"Plan & align","uk":"Plan & align"} }
]'::jsonb,
launch = '{ "icon": {"kind":"asset","src":"/assets/icons/hero-launch-check-circle-red.svg","path":null},
  "title": {"en":"Launch","uk":"Launch"},
  "text":  {"en":"Test, deploy & evolve","uk":"Test, deploy & evolve"} }'::jsonb
where key = 'hero';

update public.site_sections set cards = '[
  { "icon": {"kind":"asset","src":"/assets/icons/howwork-doc-search-white.svg","path":null},
    "title": {"en":"Define","uk":"Define"},
    "sub":   {"en":"Understand the task and requirements","uk":"Understand the task and requirements"},
    "text":  {"en":"We review the business context, available designs, current solution and requirements to define what needs to be implemented.","uk":"We review the business context, available designs, current solution and requirements to define what needs to be implemented."} },
  { "icon": {"kind":"asset","src":"/assets/icons/howwork-checklist-white.svg","path":null},
    "title": {"en":"Estimate","uk":"Estimate"},
    "sub":   {"en":"Clarify scope and approach","uk":"Clarify scope and approach"},
    "text":  {"en":"We define the implementation scope, dependencies and approach needed to prepare a project estimate.","uk":"We define the implementation scope, dependencies and approach needed to prepare a project estimate."} },
  { "icon": {"kind":"asset","src":"/assets/icons/howwork-code-window-white.svg","path":null},
    "title": {"en":"Implement","uk":"Implement"},
    "sub":   {"en":"Build, integrate and test","uk":"Build, integrate and test"},
    "text":  {"en":"We develop the agreed solution, handle required integrations and test the implementation before launch.","uk":"We develop the agreed solution, handle required integrations and test the implementation before launch."} },
  { "icon": {"kind":"asset","src":"/assets/icons/howwork-headset-white.svg","path":null},
    "title": {"en":"Support & Develop","uk":"Support & Develop"},
    "sub":   {"en":"Continue after launch when needed","uk":"Continue after launch when needed"},
    "text":  {"en":"ONVORX can support the solution after launch, implement improvements and continue its further development.","uk":"ONVORX can support the solution after launch, implement improvements and continue its further development."} }
]'::jsonb
where key = 'howWork';

update public.site_sections set cards = '[
  { "icon": {"kind":"asset","src":"/assets/icons/about-calendar-red.svg","path":null},
    "title": {"en":"Since 2023","uk":"Since 2023"},
    "text":  {"en":"Hands-on web development experience.","uk":"Hands-on web development experience."} },
  { "icon": {"kind":"asset","src":"/assets/icons/about-folder-red.svg","path":null},
    "title": {"en":"Real project work","uk":"Real project work"},
    "text":  {"en":"Experience across WordPress, WooCommerce extensions and front-end implementation.","uk":"Experience across WordPress, WooCommerce extensions and front-end implementation."} },
  { "icon": {"kind":"asset","src":"/assets/icons/about-doc-search-red.svg","path":null},
    "title": {"en":"Beyond implementation","uk":"Beyond implementation"},
    "text":  {"en":"Requirements and business processes are the foundation before development begins.","uk":"Requirements and business processes are the foundation before development begins."} }
]'::jsonb
where key = 'about';

update public.site_sections
set body = '{"en":"Web solutions built around your business requirements. From idea to implementation and beyond.","uk":"Web solutions built around your business requirements. From idea to implementation and beyond."}'::jsonb
where key = 'footer';

-- ---- 4. teach reset_content about the two new columns ---------------------
-- Unchanged from migration-2026-09-10-plan4.sql apart from the two new
-- `cards`/`launch` assignments in the sections loop. Without this, clicking
-- "Reset to defaults" in /admin would restore section text but silently drop
-- the cards/launch half of the payload `sectionRow()` now sends, so the
-- optimistic UI would show defaults and then snap back to the stale DB rows
-- on the next background refetch.
--
-- payload = { sections: [{key,eyebrow,title,body,cta_label,cards?,launch?}...],
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
      cta_label = case when s -> 'cta_label' = 'null'::jsonb or s -> 'cta_label' is null then null else s -> 'cta_label' end,
      -- key absent (e.g. the `services` section) → leave the column as-is;
      -- key present → write it, mapping an explicit JSON null to SQL NULL.
      cards     = case when s ? 'cards'  then nullif(s -> 'cards',  'null'::jsonb) else cards  end,
      launch    = case when s ? 'launch' then nullif(s -> 'launch', 'null'::jsonb) else launch end
    where key = s ->> 'key';
  end loop;

  for e in select * from jsonb_array_elements(payload -> 'seo') loop
    update public.seo_pages set
      title       = coalesce(e -> 'title',       title),
      description  = coalesce(e -> 'description', description)
    where page_key = e ->> 'page_key';
  end loop;

  -- `where true`: Supabase's pg-safeupdate guard rejects a bare DELETE
  -- (no WHERE clause) even inside a function body.
  delete from public.projects where true;
  delete from public.services where true;

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
