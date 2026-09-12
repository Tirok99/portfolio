-- ============================================================================
--  ONVORX — Telegram bot admin: managers migration. Run once in the Supabase
--  SQL Editor, after schema.sql + seed.sql + migration-2026-09-12-telegram-sessions.sql.
--  Safe to re-run.
-- ============================================================================

-- ---- 1. dynamically-managed staff, added/removed from inside the bot -----
-- Owners are NOT rows here — they live only in the TELEGRAM_ADMIN_IDS env
-- var, so a bug in the manager-management code can never demote or delete
-- the site owner.
create table if not exists public.telegram_admins (
  telegram_id bigint primary key,
  role        text not null check (role in ('content_manager', 'sales_manager')),
  label       text,
  added_by    bigint not null,
  created_at  timestamptz not null default now()
);

-- ---- 2. row-level security -------------------------------------------
-- no policies at all → only the service role (the bot's serverless function)
-- can read or write this table, same treatment as telegram_sessions.
alter table public.telegram_admins enable row level security;
