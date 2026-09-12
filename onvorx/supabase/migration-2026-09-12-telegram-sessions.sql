-- ============================================================================
--  ONVORX — Telegram bot admin migration. Run once in the Supabase SQL Editor,
--  after schema.sql + seed.sql (+ any earlier migration-*.sql files).
--  Safe to re-run.
-- ============================================================================

-- ---- 1. dialog state, one row per Telegram chat ---------------------------
create table if not exists public.telegram_sessions (
  chat_id    bigint primary key,
  state      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ---- 2. keep updated_at fresh (reuses the function schema.sql already
--         defined for site_sections/seo_pages/projects/services/estimate_requests) --
drop trigger if exists trg_touch_telegram_sessions on public.telegram_sessions;
create trigger trg_touch_telegram_sessions before update on public.telegram_sessions
  for each row execute function public.touch_updated_at();

-- ---- 3. row-level security -------------------------------------------
-- no policies at all → only the service role (the bot's serverless function)
-- can read or write dialog state, same treatment as estimate_requests.
alter table public.telegram_sessions enable row level security;
