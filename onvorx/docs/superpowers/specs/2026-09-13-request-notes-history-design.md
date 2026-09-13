# Request Notes History — Design Spec

**Status:** Approved by user, ready for implementation planning.

## 1. Problem

`estimate_requests` currently has a single overwritable `note` text column
(cap: 5000 chars), editable from both `/admin` (`RequestsPage.tsx`'s
"Internal note" textarea) and the Telegram bot (`requests:note` flow,
`api/_lib/telegramRequestsDispatch.ts`). Every save replaces the previous
text outright. With multiple people (owner, sales_manager) working a lead
over time, there is no way to see who did what and when — only the latest
overwrite survives. This is the first feature request added to the
Telegram bot admin project beyond its original spec
(`docs/superpowers/specs/2026-09-12-telegram-bot-admin.md`), whose v1 scope
is otherwise complete (Plans 1-4, merged to `main`).

## 2. Goal

Replace the single `note` field with an append-only comment log per
request, visible and addable from both `/admin` and the bot, showing who
added each entry and when.

## 3. Non-goals (explicitly out of scope)

- Editing or deleting an individual comment once posted (append-only —
  mistakes get corrected with a follow-up comment, like a CRM activity
  log, not by rewriting history).
- Per-user login on the `/admin` web panel. It stays a single shared
  password; web-authored comments are attributed generically to
  `"Admin (web)"`. Real per-admin identity on the web side is a separate,
  much larger feature (real accounts) that is not being pulled in here.
- Dropping the old `estimate_requests.note` column. It stops being read or
  written after this feature ships, but column removal on a live table is
  a separate, higher-risk operation not needed to satisfy this feature.
- Real-time updates (e.g. live-refreshing the comment list while two
  admins have the same request open). Out of scope, matches the rest of
  `/admin`'s existing non-realtime request-driven UI.
- Pagination beyond what's described in §6 (Bot UX) — the "full history"
  screen uses a length-based safety clip, not true cursor pagination. This
  is a deliberate YAGNI call for an internal admin tool; revisit only if a
  request accumulates enough comments to make the clip bite in practice.

## 4. Data model

New table, migration file
`supabase/migration-2026-09-13-request-notes.sql` (following this repo's
existing dated-migration convention: `migration-2026-09-10-plan4.sql`,
`migration-2026-09-12-telegram-admins.sql`, etc. — run once in the
Supabase SQL Editor):

```sql
create table if not exists public.estimate_request_notes (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.estimate_requests(id) on delete cascade,
  created_at  timestamptz not null default now(),
  author      text not null,
  body        text not null check (char_length(body) <= 500)
);
create index if not exists idx_estimate_request_notes_request_id
  on public.estimate_request_notes (request_id, created_at desc);
alter table public.estimate_request_notes enable row level security;
-- no policies at all → only the service role can touch it, same treatment
-- as estimate_requests and every other admin-only table in this project.
```

- **500-char cap per comment** (not the old field's 5000) — the explicit
  design principle here is short, frequent log entries, not long-form
  notes. Enforced both by the DB check constraint and by the API handler
  (defense in depth, matching how every other admin write path in this
  project validates server-side regardless of what the UI already
  prevents).
- **`on delete cascade`**: deleting a request (via `/admin`'s Delete button
  or the bot's `requests:delete:confirm`) automatically removes its notes
  — no separate cleanup code needed in either delete path.
- **`author` is a free-text label, not a foreign key** — deliberately, since
  the two calling surfaces have incompatible identity models (see §5). It
  holds one of: `"Admin (web)"` (every web-authored comment, always the
  same literal string — there is no per-user web login), `"Owner"` (a bot
  admin whose Telegram ID is in `TELEGRAM_ADMIN_IDS`, which carries no
  `label` field at all today), or `` `${label} (sales_manager)` `` (a bot
  admin resolved from `telegram_admins`, using its existing `label`
  column — `content_manager` never reaches this code path since Requests
  access is `['owner', 'sales_manager']` only, unchanged by this feature).
- **`estimate_requests.note` stays in the schema, unused going forward.**
  A one-time data-migration step (part of the same migration file, run
  once) copies each non-empty `note` into a new row of
  `estimate_request_notes`:
  ```sql
  insert into public.estimate_request_notes (request_id, created_at, author, body)
  select id, created_at, 'Admin (web)',
         case when char_length(note) > 500 then left(note, 499) || '…' else note end
  from public.estimate_requests
  where note is not null and note <> '';
  ```
  `created_at` uses the request's own received-at timestamp, since the
  exact time the old single-field note was last edited was never tracked.
  Notes over 500 chars are truncated with a trailing ellipsis at migration
  time (flagged here explicitly, and as a SQL comment in the migration
  file itself, so this lossy step is never silent) — this is a one-time,
  one-directional cutover, not a reversible operation.

## 5. Backend / API

New handler module `api/_lib/adminRequestNotesHandler.ts`, following this
project's established one-file-per-domain convention (mirrors
`adminContentHandler.ts`, `adminCardsHandler.ts`, `adminUploadHandler.ts`,
`adminRequestsHandler.ts` — each a separate file, each exporting its own
`Deps` interface and a `defaultXDeps` implementation so the bot can reuse
the exact same orchestration function the web `/admin` panel uses, per
this project's "zero duplicated business logic" rule):

```ts
export interface RequestNoteDTO { id: string; createdAt: string; author: string; body: string }

export interface AdminRequestNotesDeps {
  list: (requestId: string, env: Env) => Promise<{ rows: Record<string, unknown>[]; error: string | null }>
  add: (requestId: string, author: string, body: string, env: Env) => Promise<{ error: string | null }>
}
export const defaultAdminRequestNotesDeps: AdminRequestNotesDeps = { /* getSupabaseAdmin(env)-backed */ }

// handleAdminRequestNotes(input, env, deps = defaultAdminRequestNotesDeps)
// GET  ?requestId=<uuid>          -> { notes: RequestNoteDTO[] }  (newest first)
// POST { requestId, author, body } -> 200 {ok:true} / 400 (body empty, body>500, or
//                                      requestId missing/not a string) / 500 (write_failed)
```

**`author` is supplied by the caller, not computed by the handler** — this
is the one deliberate asymmetry in an otherwise fully shared code path.
Only the caller knows which surface it is:
- `api/admin/request-notes.ts` (the new thin Vercel-function wrapper, same
  shape as `api/admin/requests.ts`) always sends
  `author: 'Admin (web)'` from the client side
  (`src/admin/api.ts`'s `addRequestNote`).
- `telegramRequestsDispatch.ts` computes `author` itself from the already-
  resolved `role`/`ManagerRecord` (the same resolution `telegramDispatch.ts`
  already does for every other role-gated action) before calling
  `handleAdminRequestNotes` — exactly the same pattern as every other bot
  write in this project, which signs its own `admin_session` cookie via
  `adminCookieHeader(env)` and calls the shared handler function.

The old `PATCH { note }` branch in `adminRequestsHandler.ts`
(`api/_lib/adminRequestsHandler.ts:61-64`) is **removed outright**, not
deprecated — after the data migration, nothing should read or write
`estimate_requests.note` through any code path, and keeping a second
write path alive would let it silently drift out of sync with the new
table.

**Routing registration** (both needed, matching how every prior endpoint
in this project was wired):
- `api/admin/request-notes.ts` — new Vercel serverless function, thin
  wrapper delegating to `handleAdminRequestNotes`, same shape as
  `api/admin/requests.ts`.
- `vite-plugins/admin-api-dev.ts` — add `/api/admin/request-notes` to
  `KNOWN_API_PATHS` and a matching `case` in `dispatchApi()`'s switch
  (parses `requestId` from the query string on GET, same as the existing
  `/api/admin/cards` case parses `type`).

## 6. `/admin` web UI

`src/admin/pages/RequestsPage.tsx`'s `Detail` component: the single
"Internal note" textarea + "Save note" button is replaced with:
- A read-only list of existing comments, newest first: date, author, body.
  No edit/delete affordance (append-only, per §3).
- A compact "Add a note" textarea (500-char limit enforced client-side as
  a courtesy, same as every other admin form field in this project) plus
  an "Add note" button. Posting inserts a new comment at the top of the
  list — it never touches or replaces existing entries.

New hook `src/admin/hooks/useRequestNotes.ts` — `(requestId) => { notes, error, addNote }`
— fetches lazily when a request's detail view opens (not bundled into the
existing `useRequests()` list fetch, since most requests in a long list
will never be opened, and their comment histories shouldn't be paid for
up front). New `src/admin/api.ts` methods: `listRequestNotes(requestId)`,
`addRequestNote(requestId, body)` (the call site hardcodes
`author: 'Admin (web)'`). New type `RequestNote` in `src/admin/types.ts`,
matching `RequestNoteDTO`.

## 7. Telegram bot UX

`buildRequestDetail` (`api/_lib/telegramMenu.ts`): the current single
`Note: ${req.note || '(none)'}` line is replaced with an inline preview of
the **3 most recent** comments (newest first), each clipped to ~150 chars
for compactness, e.g.:

```
Notes (showing 3 of 7):
• 2026-09-13 10:07 UTC — Owner: send a letter with estimate
• 2026-09-11 14:20 UTC — Sam (sales_manager): called, no answer
• 2026-09-10 09:00 UTC — Admin (web): initial review done
```

Keyboard changes:
- `✏️ Edit note` (`requests:note`) is renamed `➕ Add note` — same
  callback, but the flow now appends rather than overwrites.
- `📝 Full history` (`requests:notes:<id>`, new) appears **only when there
  are more than 3 comments** — opens a dedicated screen listing every
  comment (each clipped to ~300 chars, plus an overall-text safety clip
  identical in spirit to the one added to `buildRequestDetail` in Plan 4's
  final fix wave, so a pathological number of comments can never exceed
  Telegram's 4096-char `sendMessage` limit; if the assembled text would
  overflow, trim from the oldest end and append
  `"… showing N most recent of M total"`). Back button returns to
  `requests:card:<id>`.

**Adding a note** (`requests:note` → session screen `requests_note_value`,
reusing the existing screen key — nothing outside this one flow depends on
its literal string): the prompt changes from "current note / send the new
one" to showing the single most recent comment as context (`"Last note:
..."`, or `"(no notes yet)"`) and asking for new text, no keyboard — same
shape as the existing prompt, different copy. The submitted text is
POSTed as a new row via `handleAdminRequestNotes`, with `author` computed
by `telegramRequestsDispatch.ts` from the resolved role
(`` `${label} (sales_manager)` `` or `'Owner'`), not overwriting anything.
A body over 500 chars is rejected server-side; the bot replies asking the
admin to shorten it (mirrors the plan's existing “Could not save — please
try again.” failure-reply pattern, but here it should say why, not just
that it failed to save — a genuinely new failure mode among this
project's bot writes, so it needs its own error copy rather than reusing
`buildCardSaveFailed` verbatim).

## 8. Testing approach (consistent with this project's established convention)

- All pure logic (menu builders, clipping, author-string formatting,
  handler validation, dispatch flow) gets unit tests with fakes, matching
  every prior plan.
- Real Supabase round-trips are verified live by the human operator on a
  deployed preview, not mocked in CI — same convention as
  `telegramContent.ts`/`telegramCards.ts` before it: only the "not
  configured" branch of any new Supabase-backed dep gets a unit test.
- Migration SQL is exercised manually against the Supabase SQL editor
  during live verification, not via an automated test — same as every
  prior `migration-*.sql` file in this project.

## 9. Open questions / deferred (none blocking)

- Whether the "Full history" bot screen should ever grow real cursor
  pagination instead of a length-based clip — deferred per §3 until it's
  shown to matter in practice.
- Whether `/admin`'s comment list should also get a length cap on how many
  are rendered at once (e.g. for a request with hundreds of comments) —
  not addressed here; the web UI has no message-length constraint like
  Telegram's, so this is lower priority and can be revisited if it ever
  becomes a real problem.
