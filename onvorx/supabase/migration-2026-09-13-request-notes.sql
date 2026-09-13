-- ============================================================================
--  ONVORX — Request Notes History migration. Run once in the Supabase SQL
--  Editor, after schema.sql + seed.sql. The table/index creation below IS
--  safely re-runnable (guarded by `if not exists`). The one-time data
--  migration insert in section 3 is NOT — it has no dedup marker, so
--  running it a second time after real notes have been added would
--  duplicate every migrated row. Run this file, in full, exactly once,
--  BEFORE deploying any app code that lets anyone add a note through
--  /admin or the bot.
-- ============================================================================

-- ---- 1. append-only comment log per request -------------------------------
create table if not exists public.estimate_request_notes (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.estimate_requests(id) on delete cascade,
  created_at  timestamptz not null default now(),
  author      text not null,
  body        text not null check (char_length(body) <= 500)
);

create index if not exists idx_estimate_request_notes_request_id
  on public.estimate_request_notes (request_id, created_at desc);

-- ---- 2. row-level security -------------------------------------------
-- no policies at all → only the service role can touch it, same treatment
-- as estimate_requests and every other admin-only table in this project.
alter table public.estimate_request_notes enable row level security;

-- ---- 3. one-time data migration: old single `note` field → first comment --
-- LOSSY STEP: any existing note longer than 500 chars is truncated with a
-- trailing ellipsis (the new per-comment cap is 500, the old field allowed
-- up to 5000). `created_at` uses the request's own received-at timestamp,
-- since the old field never tracked when it was last edited. Run this
-- exactly once, before any app code that writes to estimate_request_notes
-- is deployed — re-running it after that would duplicate every migrated
-- note (there is no "already migrated" marker on estimate_requests.note).
insert into public.estimate_request_notes (request_id, created_at, author, body)
select id, created_at, 'Admin (web)',
       case when char_length(note) > 500 then left(note, 499) || '…' else note end
from public.estimate_requests
where note is not null and note <> '';
