-- ============================================================================
--  ONVORX — CMS schema
--  Run in Supabase → SQL Editor. Edit content afterwards in Table Editor.
--  Bilingual: every translatable field has _en and _uk columns.
-- ============================================================================

-- ---- 1. singleton: section headings, hero / CTA copy, contacts --------------
create table if not exists public.site_content (
  id int primary key default 1,

  hero_eyebrow_en      text,  hero_eyebrow_uk      text,
  hero_title_en        text,  hero_title_uk        text,
  hero_description_en   text,  hero_description_uk  text,
  hero_cta_en          text,  hero_cta_uk          text,

  services_eyebrow_en      text, services_eyebrow_uk      text,
  services_title_en        text, services_title_uk        text,
  services_description_en   text, services_description_uk  text,

  projects_eyebrow_en  text, projects_eyebrow_uk text,
  projects_title_en    text, projects_title_uk   text,
  projects_lede_en     text, projects_lede_uk    text,

  howwork_eyebrow_en      text, howwork_eyebrow_uk      text,
  howwork_title_en        text, howwork_title_uk        text,
  howwork_description_en   text, howwork_description_uk  text,

  about_eyebrow_en      text, about_eyebrow_uk      text,
  about_title_en        text, about_title_uk        text,
  about_description_en   text, about_description_uk  text,

  cta_eyebrow_en      text, cta_eyebrow_uk      text,
  cta_title_en        text, cta_title_uk        text,
  cta_description_en   text, cta_description_uk  text,
  cta_button_en       text, cta_button_uk       text,

  footer_tagline_en    text, footer_tagline_uk  text,
  contact_email        text,
  contact_telegram     text,
  contact_telegram_href text,
  footer_copyright     text,

  updated_at timestamptz not null default now(),
  constraint site_content_singleton check (id = 1)
);

-- ---- 2. services list ------------------------------------------------------
create table if not exists public.services (
  slug        text primary key,
  sort        int  not null default 0,
  published   boolean not null default true,
  featured    boolean not null default false,
  title_en    text, title_uk text,
  text_en     text, text_uk  text,
  icon_url    text,   -- optional override; otherwise resolved from slug
  preview_url text,   -- optional override
  updated_at  timestamptz not null default now()
);

-- ---- 3. projects list ----------------------------------------------------
create table if not exists public.projects (
  slug         text primary key,
  sort         int not null default 0,
  published    boolean not null default true,
  index_label  text,               -- "01", "02", ...
  title_en     text, title_uk text,
  tags         text[] not null default '{}',
  text_en      text, text_uk  text,
  image_url    text,               -- Supabase Storage public URL
  image_alt_en text, image_alt_uk text,
  updated_at   timestamptz not null default now()
);

-- ---- 4. keep updated_at fresh -------------------------------------------
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['site_content','services','projects'] loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger trg_touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---- 5. row-level security: public read only --------------------------
alter table public.site_content enable row level security;
alter table public.services     enable row level security;
alter table public.projects     enable row level security;

drop policy if exists "public read site_content" on public.site_content;
drop policy if exists "public read services"     on public.services;
drop policy if exists "public read projects"     on public.projects;

create policy "public read site_content" on public.site_content for select using (true);
create policy "public read services"     on public.services     for select using (true);
create policy "public read projects"     on public.projects     for select using (true);
-- writes go through the Table Editor (service role) and bypass RLS.
