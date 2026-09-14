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
