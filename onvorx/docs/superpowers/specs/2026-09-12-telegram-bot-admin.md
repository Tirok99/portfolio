# ONVORX — Telegram bot admin — design

**Date:** 2026-09-12
**Status:** Approved direction, spec under review
**Phase:** Alternative management channel for the existing `/admin` panel. No new
data model beyond one dialog-state table; every read/write goes through the
Supabase-backed logic that `/admin` already uses.

---

## 1. Goal

Let the site owner manage ONVORX content from Telegram, as a second front-end
to the same backend the web `/admin` panel already uses — full parity:

1. Edit block texts (Content screen equivalent).
2. Manage project cards (Projects) — text fields **and** image upload via
   Telegram photo messages.
3. Manage service cards (Services) — text fields **and** icon upload via
   Telegram photo messages.
4. Edit per-page SEO title + description.
5. View and triage "Request an Estimate" submissions (status, note).
6. Trigger "Reset content" (Settings equivalent).

### Non-goals

- No new business logic. Every mutation goes through the existing
  `handleAdminContent` / `handleAdminCards` / `handleAdminRequests` /
  `handleAdminUpload` functions in `api/_lib/*Handler.ts` — the bot is a new
  **transport**, not a new **backend**.
- No multi-tenant bot / no per-user permission tiers. A flat whitelist
  (`TELEGRAM_ADMIN_IDS`) — everyone on it has full access, matching the single
  shared `ADMIN_PASSWORD` model the web admin already uses.
- No offline queue / retry — if Supabase or Telegram is down, the bot replies
  with an error, same as the web admin's toast-on-failure.

---

## 2. Confirmed decisions

- **Bot library: [grammY](https://grammy.dev/).** Lightweight, first-class
  serverless/webhook support (`webhookCallback`), no long-polling process to
  keep alive — fits the existing Vercel Functions model with no new
  infrastructure.
- **Auth reuse, not reimplementation.** `api/_lib/handlers.ts`'s
  `requireSession(cookieHeader, env)` verifies a signed `admin_session` cookie
  produced by `signToken(ADMIN_SESSION_SECRET)`. The bot's webhook handler
  mints that same token internally (it already has `ADMIN_SESSION_SECRET` in
  its env) and calls the existing `handleAdminX` functions with a synthesized
  `cookieHeader: "admin_session=<token>"`. Zero duplicated auth or business
  logic — the exact code path `/admin` uses today, verified by the exact same
  test suite.
- **Access control is two-layered:**
  1. `X-Telegram-Bot-Api-Secret-Token` header, set via `setWebhook`'s `secret_token`
     and checked against `TELEGRAM_WEBHOOK_SECRET` — rejects anything that
     isn't really Telegram calling the endpoint.
  2. The message's `from.id` checked against `TELEGRAM_ADMIN_IDS` — rejects
     anyone real users didn't explicitly allow-list, even if they somehow
     find the bot's username.
- **Dialog state lives in Supabase**, not in-memory — Vercel Functions are
  stateless/ephemeral between invocations, so "what menu is this chat
  currently in / which card are they editing" must persist server-side.
- **Image upload has real parity**, not a stub: a Telegram photo message is
  downloaded via the Bot API's `getFile`, then piped through the same
  `deps.put` upload path `adminUploadHandler.ts` already uses (same bucket,
  same `projects/`/`services/` folder split, same 2 MB cap and MIME allowlist
  enforcement — re-encode/validate before upload since Telegram recompresses
  photos as JPEG).

---

## 3. Architecture overview

```
Telegram servers
      │  HTTPS POST (Update JSON) + X-Telegram-Bot-Api-Secret-Token
      ▼
api/telegram/webhook.ts  (Vercel function, same shape as api/admin/*.ts)
      │  thin adapter: verify secret header → call handler
      ▼
api/_lib/telegramHandler.ts
      │  1. verify from.id ∈ TELEGRAM_ADMIN_IDS
      │  2. load/advance dialog state from `telegram_sessions` (Supabase)
      │  3. mint admin_session cookie via signToken(ADMIN_SESSION_SECRET)
      │  4. call handleAdminContent / handleAdminCards / handleAdminRequests /
      │     handleAdminUpload with that cookie — SAME functions /admin calls
      │  5. reply via grammY (menu / confirmation / error text)
      ▼
Supabase (content tables + telegram_sessions + Storage)
```

grammY's `Bot` instance is constructed once per cold start (module scope, like
`getSupabaseAdmin`'s cached client) and driven via `webhookCallback(bot, ...)`
adapted to the Vercel request/response shape, following the same
`vercel-adapter.ts` pattern already used for the admin/estimate functions.

---

## 4. Data model — new table

```sql
create table public.telegram_sessions (
  chat_id     bigint primary key,
  state       jsonb not null default '{}',  -- { screen, list?, cardId?, draft? }
  updated_at  timestamptz not null default now()
);
alter table public.telegram_sessions enable row level security;
-- no policies: service-role only, same treatment as estimate_requests
```

One row per Telegram chat. `state` holds exactly enough to resume a
multi-step flow (e.g. "editing service card X, waiting for the next photo")
across separate webhook invocations. Ships as
`supabase/migration-2026-09-12-telegram-sessions.sql`, following this repo's
existing convention: a single flat, idempotent, "safe to re-run" file the
operator pastes into the Supabase SQL Editor — **not** a `supabase/migrations/`
CLI-driven folder (this repo has never used that workflow).

---

## 5. Menu structure (mirrors `/admin` nav)

```
/start → main menu (inline keyboard)
  ├─ Content        → list of 6 sections → pick → edit eyebrow/title/body/cta (EN/UA)
  ├─ Projects       → Home | Page tabs → card list → edit fields, replace image, reorder, delete, add
  ├─ Services       → Home | Page tabs → card list → edit fields, replace icon, reorder, delete, add
  ├─ SEO            → list of 8 pages → edit title/description (EN/UA)
  ├─ Requests       → filterable list → view detail → set status / note
  └─ Settings       → Reset content (with a confirm step — same danger as the web button)
```

Every text edit is a short conversational step ("send the new EN title") since
Telegram has no form widgets; every destructive action (delete card, reset
content) requires an inline-keyboard confirm button, mirroring the web
admin's `ConfirmDialog`.

---

## 6. Environment variables

```
TELEGRAM_BOT_TOKEN       # from @BotFather
TELEGRAM_ADMIN_IDS       # comma-separated numeric Telegram user ids
TELEGRAM_WEBHOOK_SECRET  # random string, verified via X-Telegram-Bot-Api-Secret-Token
```

Server-only (never `VITE_`-prefixed). Same as `ADMIN_PASSWORD`/`SUPABASE_SERVICE_ROLE_KEY`,
set in `.env.local` for dev and in Vercel Production (+ Preview, if testing
against a second bot on preview deploys).

---

## 7. Rollout

1. Operator: create the bot, collect admin Telegram ids, set the 3 env vars
   locally and in Vercel.
2. Operator: run the `telegram_sessions` migration in the Supabase SQL Editor.
3. Implementation (this repo, via subagent-driven-development, same as the
   Supabase plans): grammY dependency, `telegram_sessions` migration file,
   `api/_lib/telegramHandler.ts` (+ tests, injectable deps matching every
   other `_lib/*Handler.ts`), `api/telegram/webhook.ts`, menu/state machine,
   photo-upload bridge into `adminUploadHandler`'s upload path.
4. One `setWebhook` call against the live Vercel domain
   (`portfolio-three-rho-45ofj86fdk.vercel.app` today — no custom domain yet)
   with `secret_token` set to `TELEGRAM_WEBHOOK_SECRET`.
5. Live verification: every menu path exercised for real in Telegram, cross-checked
   against `/admin` and the public site — same bar Plan 4 used before merging.

---

## 8. Open items for the implementation plan

- Exact grammY session-storage adapter for `telegram_sessions` (grammY ships a
  generic `session()` middleware with a pluggable storage adapter — write a
  thin Supabase-backed one rather than pulling in a second storage dependency).
- Photo re-validation before re-upload (Telegram recompresses to JPEG
  regardless of source format — decide whether to accept JPEG-only from the
  bot or convert, matching `adminUploadHandler.ts`'s existing PNG/JPEG/WebP
  allowlist).
- Command/menu copy (Russian vs English chat UI) — the web admin is
  English-only by design; confirm whether the bot's own chrome (button
  labels, prompts) should match that or default to Russian for the operator.
