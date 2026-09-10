# ONVORX — Supabase integration — design

**Date:** 2026-09-09
**Status:** Approved direction, spec under review
**Depends on:** [2026-09-08-admin-panel-design.md](./2026-09-08-admin-panel-design.md)
(the `/admin` panel and its mock content store shipped on `main` in merge `5b927b1`).

---

## 1. Goal

Replace the per-browser `localStorage` content store ("Approach B") behind the
existing `/admin` panel with a real backend on **Supabase**, so that:

- admin edits are visible to **every visitor**, not just the editor's browser;
- images are stored in **Supabase Storage**, not as base64 in `localStorage`;
- "Request an Estimate" submissions are collected in a **shared inbox**.

### In scope (moves to Supabase)

1. Project cards — Projects block on Home, with **file upload** for the image.
2. Project cards — Projects page (separate list).
3. Service cards — Services block on Home — icon, title, text.
4. Service cards — Services page (separate list).
5. Block texts across all Home sections — eyebrow, title, body, and the CTA
   button label where present (Hero, CTA).
6. SEO Title + Meta Description for the 8 known pages.
7. "Request an Estimate" form submissions.
8. Uploaded images → Supabase Storage.

### Non-goals

- **No redesign of the `/admin` UI and no change to the public site design.**
  Component markup, screens, and the "explicit Save" editing model stay as they are.
- No new managed fields beyond what the admin panel already exposes.
- No migration to Supabase Auth — the existing password gate stays.
- No SSR / prerender. SEO tags remain client-set by `<DocumentHead>` (unchanged).
- No build of the public `/projects` and `/services` pages (still a later phase;
  their card lists keep being stored).
- No email/delivery for estimate submissions (inbox only, as today).
- No migration of the repo's existing static assets (`public/assets/**`) into
  Storage — seeded rows keep referencing them by path.

---

## 2. Confirmed decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Public read strategy | **Runtime fetch (live)** — SPA reads Supabase directly via `@supabase/supabase-js` + anon key, RLS public-read. No redeploy on edit. |
| 2 | Supabase provisioning | **Manual** — project created in the Supabase dashboard; SQL migration + seed run in the SQL Editor; env vars pasted into Vercel + `.env.local`. |
| 3 | Admin write authorization | **Keep the custom password + HMAC session.** Writes go through new `/api/admin/*` serverless functions that check `requireSession()` then use the **service-role** key. RLS stays public-read-only. |
| 4 | Estimate form transport | **Public serverless function** `POST /api/estimate` — validates, inserts via service role. Anon key gets no write grants. |
| 5 | Bilingual storage | **`jsonb` `{ "en": …, "uk": … }`** columns (1:1 with the `L` type). |
| 6 | Estimate requests in state | **Moved out** of the shared `AdminData` store into a dedicated `useRequests()` hook backed by `/api/admin/requests`. |
| 7 | Legacy build-time CMS pipeline | **Removed.** Rationale: it is already unwired, its `site_content` singleton schema conflicts with the new schema, and leaving `prebuild`/`postbuild` running dead scripts is a maintenance hazard. Old files stay recoverable in git history. |
| 8 | `src/admin/mock/requests.ts` | Kept for unit/e2e tests only; not seeded to production. |

---

## 3. Architecture overview

```
                       ┌─────────────────────────────┐
   Public visitor ───► │  SPA (Vite/React)           │
                       │                             │
                       │  SiteContentProvider        │
                       │   • init = buildDefaults()  │  ← instant paint, no empty frame
                       │   • useEffect → fetch ──────┼──►  anon client, SELECT only
                       │   • localStorage cache      │        site_sections
                       │  useSiteContent() (unchanged)│       seo_pages
                       │  <DocumentHead> (unchanged) │        projects
                       │  <EstimateForm> ────────────┼──►  POST /api/estimate ──► service role ──► estimate_requests
                       └─────────────────────────────┘
                                    ▲
   Owner (/admin) ──────────────────┤
                       ┌────────────┴────────────────┐
                       │  Admin screens (unchanged)  │
                       │   • optimistic reducer      │
                       │   • actions.* → fetch ──────┼──►  /api/admin/{content,cards,upload,requests}
                       │  useRequests() ─────────────┼──►         │  requireSession() (HMAC cookie)
                       └─────────────────────────────┘            │  service-role client
                                                                  ▼
                                              Supabase Postgres + Storage (public-media)
```

The seam is unchanged: `AdminData` shape (minus `requests`) and the
`SiteContentActions` interface. Everything above the seam
(`useSiteContent`, sections, `DocumentHead`, admin screens) keeps working; the
persistence layer below it is swapped.

---

## 4. Database schema

All translatable fields are `jsonb` shaped `{ "en": string, "uk": string }`.
Every table gets a `before update` trigger calling `public.touch_updated_at()`.

### 4.1 `site_sections` — block texts

| column | type | notes |
|---|---|---|
| `key` | `text` primary key | `hero` \| `services` \| `projects` \| `howWork` \| `about` \| `cta` |
| `eyebrow` | `jsonb` not null | `{en,uk}` |
| `title` | `jsonb` not null | `{en,uk}` |
| `body` | `jsonb` not null | section description / lede |
| `cta_label` | `jsonb` null | `hero` + `cta` only |
| `updated_at` | `timestamptz` not null default `now()` | |

`label` (admin-only UI caption) stays in `src/content/defaults/sections.ts`.

### 4.2 `seo_pages` — SEO title + meta description

| column | type | notes |
|---|---|---|
| `page_key` | `text` primary key | `home`, `services`, `projects`, `about`, `web-development`, `support`, `business-analysis`, `google-ads` |
| `path` | `text` not null | `/`, `/services`, … |
| `title` | `jsonb` not null | `{en,uk}` |
| `description` | `jsonb` not null | `{en,uk}` |
| `updated_at` | `timestamptz` not null default `now()` | |

`label` stays in `src/content/defaults/seo.ts`.

### 4.3 `projects` — project cards

| column | type | notes |
|---|---|---|
| `list` | `text` not null | `home` \| `page` — `check (list in ('home','page'))` |
| `id` | `text` not null | slug-style app id (`relax-ahill`, `proj_ab12cd`) |
| `sort` | `int` not null default `0` | display order within `(list)` |
| `published` | `boolean` not null default `false` | |
| `title` | `jsonb` not null | `{en,uk}` |
| `tags` | `text[]` not null default `'{}'` | language-independent |
| `description` | `jsonb` not null | `{en,uk}` |
| `image_url` | `text` null | Storage public URL **or** repo path `/assets/projects/x.png` |
| `image_path` | `text` null | object key inside `public-media` — set only for uploaded files (needed to delete on replace/clear) |
| `image_alt` | `jsonb` not null | `{en,uk}` |
| `updated_at` | `timestamptz` not null default `now()` | |
| | **primary key `(list, id)`** | one logical project lives independently in each list |

### 4.4 `services` — service cards

| column | type | notes |
|---|---|---|
| `list` | `text` not null | `home` \| `page` — `check (list in ('home','page'))` |
| `id` | `text` not null | slug (`web-development`, …) |
| `sort` | `int` not null default `0` | |
| `published` | `boolean` not null default `false` | |
| `featured` | `boolean` not null default `false` | enlarged card, Home list only |
| `title` | `jsonb` not null | `{en,uk}` |
| `text` | `jsonb` not null | `{en,uk}` |
| `icon_url` | `text` null | Storage URL **or** `/assets/services/icon-*.png` |
| `icon_path` | `text` null | object key for uploaded icons |
| `updated_at` | `timestamptz` not null default `now()` | |
| | **primary key `(list, id)`** | |

### 4.5 `estimate_requests` — form submissions

| column | type | notes |
|---|---|---|
| `id` | `uuid` primary key default `gen_random_uuid()` | |
| `created_at` | `timestamptz` not null default `now()` | |
| `status` | `text` not null default `'new'` | `check (status in ('new','in_progress','done','archived'))` |
| `name` | `text` not null | |
| `email` | `text` not null | |
| `company` | `text` null | |
| `budget` | `text` null | `check (budget in ('<1k','1-3k','3-10k','10k+','not_sure'))` |
| `interested_in` | `text[]` not null default `'{}'` | soft ref → `services.id` |
| `message` | `text` not null | |
| `locale` | `text` not null | `check (locale in ('en','uk'))` |
| `source_page` | `text` null | |
| `note` | `text` null | internal admin note |
| `updated_at` | `timestamptz` not null default `now()` | |

### 4.6 Relations

No hard foreign keys. The model is 5 flat tables:

- `projects.list` / `services.list` — list discriminator, part of the PK.
- `estimate_requests.interested_in` — soft `text[]` reference to `services.id`;
  intentionally not an FK so a renamed/removed service does not rewrite history.
- `site_sections.key`, `seo_pages.page_key` — fixed enums owned by code
  (`SectionKey`, `SeoPageKey`); seed inserts the rows, admin only `update`s.
- List integrity (contiguous `sort`, etc.) is enforced by the server layer on write.

### 4.7 Row-level security

```sql
alter table site_sections    enable row level security;
alter table seo_pages        enable row level security;
alter table projects         enable row level security;
alter table services         enable row level security;
alter table estimate_requests enable row level security;

-- public read for the 4 content tables
create policy "public read" on site_sections for select using (true);
create policy "public read" on seo_pages     for select using (true);
create policy "public read" on projects      for select using (true);
create policy "public read" on services      for select using (true);

-- estimate_requests: NO policies → anon/authenticated cannot read or write.
```

All writes (and every read of `estimate_requests`) go through serverless
functions using the **service-role** key, which bypasses RLS.

---

## 5. Supabase Storage

One **public** bucket `public-media`:

```
public-media/
  projects/    project card images     projects/<id>-<8hex>.<ext>
  services/    service card icons       services/<id>-<8hex>.<ext>
```

- Public bucket → direct public URLs, no keys, no RLS needed for read.
- Bucket config: `file_size_limit` ≈ 2 MB; `allowed_mime_types`
  `image/png, image/jpeg, image/webp` (+ `image/svg+xml` for `services/`).
- Uploads only via `/api/admin/upload` (service role). The same limits are
  re-checked in the function.
- Random 8-hex suffix in the object name → no collisions, clean cache-busting on
  replace.
- Repo assets under `public/assets/**` are **not** moved into Storage; seeded
  rows store the `/assets/...` path in `image_url` / `icon_url` with a null
  `*_path`.

---

## 6. Data migration (seed)

A generator script reads the existing `src/content/defaults/*` (which already
derive from `src/i18n/{en,uk}.json`) and emits `supabase/seed.sql`. Defaults stay
the single source of truth; the seed is regenerated, never hand-edited.

| Source | Table | Rows |
|---|---|---|
| `defaults/sections.ts` | `site_sections` | 6 (hero, services, projects, howWork, about, cta) |
| `defaults/seo.ts` | `seo_pages` | 8 (home from `en.meta`; others `uk == en`) |
| `defaults/projects.ts` | `projects` | 2 cards × 2 lists = 4; `image_url = /assets/projects/<id>.png`, `image_path = null` |
| `defaults/services.ts` | `services` | 4 cards × 2 lists = 8 (web-development `featured`); `icon_url = /assets/services/icon-*.png` |
| `src/admin/mock/requests.ts` | `estimate_requests` | **0** — table starts empty in production |

---

## 7. Public read flow

1. `SiteContentProvider` mounts with `buildDefaults()` (or the last
   `localStorage` cache under `onvorx.content.cache.v2`) → the site renders
   immediately with current content, no empty frame.
2. `useEffect` runs `fetchSiteContent()`: the anon client issues 4 `select`s
   (`site_sections`, `seo_pages`, `projects`, `services`), mapped by
   `src/content/mappers.ts` into the `AdminData` shape (`requests` omitted).
3. On success → `setData(remote)` + write the cache. On failure → keep
   defaults/cache, set `error`, log once.
4. Revalidation triggers: window `focus`, and immediately after any admin save
   (admin + site share the provider in one SPA).
5. `<DocumentHead>` and all sections consume `useSiteContent()` unchanged; the
   first frame is always defaults so nothing renders blank.
6. `estimate_requests` is never touched by the browser client.

### Cross-tab sync

The old `storage`-event listener in `SiteContentProvider` is replaced by
focus-triggered refetch. (Two admin tabs are an edge case; last write wins,
reconciled on the next focus/refetch.)

---

## 8. Admin write flow

1. Login is unchanged (`/api/admin/login` → HMAC cookie `admin_session`, 8h).
2. Each `actions.*` call:
   a. applies the existing pure reducer locally (optimistic — UI reacts
      instantly, exactly as today);
   b. `fetch`es the matching `/api/admin/*` endpoint.
3. The function: `requireSession(cookieHeader, env)` → `401` on failure →
   validate payload → `supabaseAdmin.from(...).upsert()/delete()` → return the
   saved row(s).
4. On HTTP error → toast "Save failed" + `fetchSiteContent()` to revert the
   optimistic change.
5. **Images** (`ImageUpload` component, markup unchanged): file → optional
   client downscale (`src/admin/lib/image.ts`, kept) → `POST /api/admin/upload`
   (multipart) → function validates, uploads to `public-media/<folder>/…` via
   service role, deletes the previous object if the card had an `image_path`,
   returns `{ url, path }` → client calls `actions.setCardImage(list, id, …)`
   and the row save persists `image_url` + `image_path`.
6. **Reorder** (`moveCard`): optimistic local swap → `POST /api/admin/cards`
   `{ op: 'reorder', type, list, orderedIds }` → function rewrites `sort` for the
   list in one batch.
7. **Delete card**: also deletes its Storage object when `image_path` is set.
8. **Requests triage**: `RequestsPage` + `DashboardPage` use `useRequests()`
   (fetch from `/api/admin/requests` on mount; `mutate` after PATCH/DELETE).

---

## 9. Code changes

### 9.1 Dependencies
- add `@supabase/supabase-js`

### 9.2 `src/content/`
| file | change |
|---|---|
| `supabaseClient.ts` | **new** — browser client from `VITE_SUPABASE_*` |
| `mappers.ts` | **new** — pure row ↔ `AdminData` mappers (+ unit tests); reverse direction for optimistic writes |
| `persistence.ts` | rewrite — `fetchSiteContent()` (async remote load), `buildDefaults()` as sync initial + fallback, `localStorage` demoted to a cache |
| `SiteContentProvider.tsx` | init from defaults/cache; `useEffect` remote load; add `loading` / `error`; `actions.*` = optimistic reducer + API call + error refetch; drop `requests` + `storage` listener; focus-refetch |
| `useSiteContent.ts` | unchanged (still derives resolved views); `requests` removed from `raw` consumers |
| `defaults/` | unchanged; `buildDefaults()` drops the `requests: []` field (or keeps it empty — see §10) |

### 9.3 `src/admin/`
| file | change |
|---|---|
| `api.ts` | **new** — typed `fetch` wrappers for `/api/admin/*` |
| `hooks/useRequests.ts` | **new** — list + `setStatus` / `setNote` / `remove` / `mutate` against `/api/admin/requests` |
| `pages/RequestsPage.tsx` | read from `useRequests()` instead of `useSiteContentRaw().data.requests` |
| `pages/DashboardPage.tsx` | request counts from `useRequests()` |
| `pages/ProjectsPage.tsx`, `pages/ServicesPage.tsx` | image handlers call the upload endpoint via `api.ts`; markup unchanged |
| `components/ImageUpload.tsx` | `onChange` receives the uploaded `{url}`; busy state during upload; markup unchanged |
| `actions.ts` | unchanged (reused for optimistic updates) |
| `types.ts` | `AdminData` loses `requests`; `EstimateRequest` etc. stay (used by `useRequests`) |
| `mock/requests.ts` | unchanged; referenced only by tests |

### 9.4 `api/`
| file | change |
|---|---|
| `_lib/supabaseAdmin.ts` | **new** — service-role client factory |
| `_lib/contentHandlers.ts` | **new** — pure-ish handlers + payload validation (+ tests, mock supabase) |
| `admin/content.ts` | **new** — `GET` full `AdminData` (content tables); `PUT` a section or a SEO entry |
| `admin/cards.ts` | **new** — create / update / delete / reorder for `?type=project\|service` |
| `admin/upload.ts` | **new** — multipart image upload → Storage; old-object cleanup |
| `admin/requests.ts` | **new** — `GET` list; `PATCH` status/note; `DELETE` |
| `estimate.ts` | **new** — public `POST`; validate + insert via service role |
| `_lib/types.ts` | extend `AuthEnv` → add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_MEDIA_BUCKET?` |

Function count: 3 existing + 5 new = **8** (Vercel Hobby limit 12).

### 9.5 Dev + build
| file | change |
|---|---|
| `vite-plugins/admin-api-dev.ts` | extend `dispatchAdminApi` to route the 5 new endpoints in `npm run dev`, reusing the same handlers |
| `src/components/EstimateForm/EstimateForm.tsx` | `submit` → `POST /api/estimate` (loading/success/error states; keep the existing "Thank you" panel) |
| `package.json` | `+ @supabase/supabase-js`; remove `prebuild` / `postbuild` / `content:pull` / `content:restore`; add `db:seed` helper (generates `supabase/seed.sql`) |
| `scripts/build-content.mjs`, `scripts/restore-content.mjs` | **delete** |
| `supabase/schema.sql` | replace with the new migration |
| `supabase/seed.sql` | replace with the generated seed |
| `src/i18n/.base/` | remove if present (artifact of the old pipeline) |
| `docs/CMS-SETUP.md` | rewrite for the runtime-fetch + service-role model |

### 9.6 Tests
- `mappers.test.ts` — row ↔ `AdminData` round-trip.
- `contentHandlers.test.ts` — validation + auth gating (mock supabase client).
- `SiteContentProvider.test.tsx` — async load, defaults-first, error fallback,
  optimistic + revert (mock `supabaseClient` + `fetch`).
- `useRequests.test.tsx` — list / mutate (mock `fetch`).
- `EstimateForm.test.tsx` — posts to `/api/estimate`; success + error panels.
- update existing tests that assumed the `localStorage` seed / `data.requests`.
- `vite-plugins/admin-api-dev.test.ts` — new routes.
- `e2e/admin.spec.ts` — run against a dedicated test Supabase project via env,
  or intercept `/api/**` with Playwright route mocking (decide in the plan).

---

## 10. Environment variables

### Browser (Vite — must be `VITE_`-prefixed, embedded in the bundle)
| name | value |
|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon public key (read-only via RLS) |

### Server (functions + dev plugin — never exposed)
| name | value |
|---|---|
| `SUPABASE_URL` | same URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** — full DB + Storage access |
| `SUPABASE_MEDIA_BUCKET` | optional, default `public-media` |
| `ADMIN_PASSWORD` | existing — unchanged |
| `ADMIN_SESSION_SECRET` | existing — unchanged |

- Set in Vercel for **Production + Preview**; mirror into local `.env.local`;
  document (no values) in `.env.example`.
- No build-time Supabase env (the build-time pipeline is removed).
- The SQL migration + seed are run manually in the Supabase SQL Editor.

---

## 11. Rollout

1. Create the Supabase project; run `supabase/schema.sql` then `supabase/seed.sql`
   in the SQL Editor; create the `public-media` bucket (public) with limits.
2. Set the 4 new env vars in Vercel (Production + Preview) and `.env.local`.
3. Ship the code. On first load the SPA fetches live content; `/admin` writes
   through the functions.
4. `localStorage` key `onvorx.admin.v1` becomes irrelevant; the new cache key
   `onvorx.content.cache.v2` is used. No user action needed (old key can be
   left to expire or cleared opportunistically).

### Risks / mitigations
- **Anon key in the bundle** — expected for Supabase; RLS restricts it to
  `select` on 4 tables. No write grants anywhere.
- **First-paint flash if remote content diverges from defaults** — mitigated by
  the `localStorage` cache; divergence is only the delta the owner edited.
- **Service-role key** — only in serverless env, never shipped to the browser,
  never logged.
- **Vercel Hobby function cap (12)** — at 8; consolidate further only if needed.
- **e2e against a live DB** — use a throwaway test project or route-mock; never
  the production project.

---

## 12. Open items for the implementation plan

- `buildDefaults()` — drop `requests` entirely from `AdminData`, or keep it as an
  always-empty field for one release to reduce churn? (Lean: drop it.)
- `/api/admin/cards` — one endpoint with an `op` discriminator vs. REST verbs on
  one resource file. (Lean: single file, `op` in body, to stay well under the
  function cap.)
- e2e strategy: dedicated test Supabase project vs. Playwright route mocking.
- Whether `/api/admin/content` `GET` should also power the public provider later
  (hybrid) — out of scope now, but keep the handler shape compatible.
