-- ============================================================================
--  ONVORX — content schema (Supabase). Run in SQL Editor, then run seed.sql.
--  Translatable fields are jsonb: {"en": "...", "uk": "..."}.
-- ============================================================================

-- ---- 1. section texts ------------------------------------------------------
create table if not exists public.site_sections (
  key        text primary key
             check (key in ('hero','services','projects','howWork','about','cta')),
  eyebrow    jsonb not null default '{"en":"","uk":""}',
  title      jsonb not null default '{"en":"","uk":""}',
  body       jsonb not null default '{"en":"","uk":""}',
  cta_label  jsonb,
  updated_at timestamptz not null default now()
);

-- ---- 2. per-page SEO -----------------------------------------------------
create table if not exists public.seo_pages (
  page_key    text primary key,
  path        text not null,
  title       jsonb not null default '{"en":"","uk":""}',
  description jsonb not null default '{"en":"","uk":""}',
  updated_at  timestamptz not null default now()
);

-- ---- 3. project cards --------------------------------------------------
create table if not exists public.projects (
  list        text not null check (list in ('home','page')),
  id          text not null,
  sort        int  not null default 0,
  published   boolean not null default false,
  title       jsonb not null default '{"en":"","uk":""}',
  tags        text[] not null default '{}',
  description jsonb not null default '{"en":"","uk":""}',
  image_url   text,
  image_path  text,
  image_alt   jsonb not null default '{"en":"","uk":""}',
  updated_at  timestamptz not null default now(),
  primary key (list, id)
);

-- ---- 4. service cards -------------------------------------------------
create table if not exists public.services (
  list       text not null check (list in ('home','page')),
  id         text not null,
  sort       int  not null default 0,
  published  boolean not null default false,
  featured   boolean not null default false,
  title      jsonb not null default '{"en":"","uk":""}',
  text       jsonb not null default '{"en":"","uk":""}',
  icon_url   text,
  icon_path  text,
  updated_at timestamptz not null default now(),
  primary key (list, id)
);

-- ---- 5. estimate requests -------------------------------------------
create table if not exists public.estimate_requests (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  status        text not null default 'new'
                check (status in ('new','in_progress','done','archived')),
  name          text not null,
  email         text not null,
  company       text,
  budget        text check (budget in ('<1k','1-3k','3-10k','10k+','not_sure')),
  interested_in text[] not null default '{}',
  message       text not null,
  locale        text not null check (locale in ('en','uk')),
  source_page   text,
  note          text,
  updated_at    timestamptz not null default now()
);

-- ---- 6. keep updated_at fresh -------------------------------------
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['site_sections','seo_pages','projects','services','estimate_requests'] loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger trg_touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---- 7. row-level security ------------------------------------------
alter table public.site_sections     enable row level security;
alter table public.seo_pages         enable row level security;
alter table public.projects          enable row level security;
alter table public.services          enable row level security;
alter table public.estimate_requests enable row level security;

drop policy if exists "public read" on public.site_sections;
drop policy if exists "public read" on public.seo_pages;
drop policy if exists "public read" on public.projects;
drop policy if exists "public read" on public.services;

create policy "public read" on public.site_sections for select using (true);
create policy "public read" on public.seo_pages     for select using (true);
create policy "public read" on public.projects      for select using (true);
create policy "public read" on public.services      for select using (true);

-- estimate_requests: no policies at all → only the service role can touch it.
-- All writes to every table go through serverless functions (service role).
