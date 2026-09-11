# Supabase Integration — Plan 4: Hardening & polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the "important + medium" follow-ups deferred from Plans 1–3: shrink the browser bundle, protect the public estimate endpoint, make card ordering and content-reset atomic, retire the vestigial `localStorage` working store, and harden image upload + the dev API plugin.

**Architecture:** `@supabase/supabase-js` moves out of the entry chunk behind a dynamic `import()` in `src/content/remote.ts` (the only browser module that reaches it). `/api/estimate` gains a server-checked honeypot field and a best-effort in-memory rate limiter. Card `sort` becomes DB-assigned via a `BEFORE INSERT` trigger plus a `unique (list, sort)` constraint, with a one-shot retry in the handler. `resetContent` becomes a single Postgres function call (implicitly transactional). `SiteContentProvider` initialises from the `onvorx.content.cache.v2` cache only; the `onvorx.admin.v1` blob, its persist effect, and the cross-tab `storage` listener are removed. SVG is dropped from the upload allowlist; the dev plugin only buffers bodies for known routes and caps their size.

**Tech Stack:** Vite 8 + React 19, TypeScript (strict), Vitest + Testing Library, Playwright e2e, `@vercel/node` serverless functions (CJS via `api/package.json`), `@supabase/supabase-js` v2, Supabase (Postgres + Storage).

**Spec:** [docs/superpowers/specs/2026-09-09-supabase-integration-design.md](../specs/2026-09-09-supabase-integration-design.md) — this plan implements its "room for spam/rate-limit later" (§9.4) note and the review-deferred items; no new spec sections.

**Depends on:** Plans 1–3, merged to `main` at `5b5d6b8`. Supabase project `ovbcjgfvtetktwmtxarf`; `.env.local` + Vercel have `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. The `public-media` Storage bucket exists (public, 2 MB, `image/png,image/jpeg,image/webp,image/svg+xml` — **Task 5 removes svg from this list; the operator updates the bucket then**).

## Global Constraints

- Node `22.x` (`engines`), CI on `22.12`.
- Repo root is `"type": "module"`; `api/` is CJS via `api/package.json` — **do not touch that file**. Under `api/`: `import type` for type-only imports, no `.json` imports, no unused symbols (`verbatimModuleSyntax` + `erasableSyntaxOnly` + `noUnusedLocals/Parameters`). No `src/` imports from `api/`.
- `main` is the deploy branch (Vercel Production). Work on a feature branch; do not merge without the operator's say-so.
- **Do not change the `/admin` UI layout or the public site design.** The honeypot field (Task 2) is a visually-hidden, `aria-hidden`, non-tabbable input — invisible, not a design change.
- Two Postgres migrations (Tasks 3 & 4) ship as ONE file `supabase/migration-2026-09-10-plan4.sql` — the operator runs it once in the SQL Editor. Tasks that depend on it are green in unit tests (deps injected) before the operator runs it; the live run is Task 7.
- Existing helpers unchanged: `requireSession`, `getSupabaseAdmin`, `send`, `isSecure`, `rowsToSiteContent`, `fetchRemoteContent`, `buildDefaults`, the pure reducers in `src/admin/actions.ts`.
- `validateEstimate` currently returns `{ ok: true; row } | { ok: false; error: string }`; `handleEstimate(input, env, deps?)` order: 405 → 500 not_configured → 400 invalid_request → 500 insert_failed → 200 `{ ok: true }`.
- Tests live next to source as `*.test.ts(x)`; `npm test` (Vitest, `e2e/**` excluded), `npm run e2e` (Playwright), `npm run lint` (oxlint, **0 errors**), `npx tsc -p tsconfig.app.json --noEmit`, `npm run typecheck:api`, `npx tsc -b`, `npm run build` — **all green, and `npm run e2e` is part of every gate for tasks touching `src/` or `api/`.**
- `src/test/setup.ts` blanks `VITE_SUPABASE_URL`/`ANON_KEY` for all tests.
- Baseline before this plan: entry chunk `dist/assets/index-*.js` ≈ **500 KB** minified.

---

## File structure (this plan)

| File | Responsibility |
|---|---|
| `src/content/remote.ts` | `getSupabase` reached via `await import('./supabaseClient')` — moves `@supabase/supabase-js` to a lazy chunk |
| `api/_lib/estimate.ts` | `validateEstimate` also rejects a non-empty honeypot field → `{ ok: false; error: 'honeypot' }` |
| `api/_lib/estimateRateLimit.ts` | **new** — module-level sliding-window limiter `checkRateLimit(ip): boolean` |
| `api/_lib/estimateHandler.ts` | takes `ip`; `honeypot` → 200 silent-accept (no insert); over-limit → 429 |
| `api/estimate.ts`, `vite-plugins/admin-api-dev.ts` | pass the client IP into `handleEstimate` |
| `src/components/EstimateForm/EstimateForm.tsx` | visually-hidden honeypot `<input>`; value sent in the POST body |
| `supabase/migration-2026-09-10-plan4.sql` | **new** — `BEFORE INSERT` sort trigger + `unique (list, sort)` on `projects`/`services`; `public.reset_content(payload jsonb)` function |
| `api/_lib/adminCardsHandler.ts` | `create` dep: insert with `sort` omitted; retry once on `23505` |
| `api/_lib/adminReset.ts` | `resetContent(c, content)` → build snake_case row payload, single `c.rpc('reset_content', { payload })` |
| `src/content/SiteContentProvider.tsx` | init from `contentCache` only; drop persist effect, `storage` listener, `skipNextPersist`/`firstRun` refs; one-time `localStorage.removeItem('onvorx.admin.v1')` |
| `src/content/persistence.ts` | **deleted** — `seedAdminData` folded into `src/admin/actions.ts` (`resetAll` → `buildDefaults()`) |
| `src/admin/actions.ts` | `resetAll()` returns `buildDefaults()` directly |
| `src/admin/pages/DashboardPage.tsx` | remove the "Last change" stat (now permanently `—` after the reshape) |
| `api/_lib/adminUploadHandler.ts` | drop `image/svg+xml` from `MIME_EXT` |
| `supabase/STORAGE.md` | drop svg from the documented allowlist |
| `vite-plugins/admin-api-dev.ts` | buffer the body only for known `/api/` routes; cap at 2 MB |

**Not touched:** `src/content/{mappers,dbTypes,contentCache,supabaseClient,env}.ts`, `src/admin/api.ts`, `src/admin/hooks/**`, `src/sections/**`, `src/components/DocumentHead/**`, `api/admin/{login,session,logout,content,cards,requests,upload}.ts` (except the two estimate-IP edits), `api/_lib/{handlers,session,supabaseAdmin,vercel-adapter,adminRows,adminContentHandler,adminCardsHandler except create,adminRequestsHandler}.ts`, `supabase/schema.sql`, `supabase/seed.sql`, `vercel.json`, `api/package.json`.

### Interfaces produced by this plan

```ts
// api/_lib/estimateRateLimit.ts
export function checkRateLimit(ip: string, now?: number): boolean   // true = allowed, false = over limit
export function __resetRateLimitForTest(): void

// api/_lib/estimateHandler.ts
export function handleEstimate(
  input: { method: string; body: unknown; ip: string },
  env: SupabaseAdminEnv,
  deps?: EstimateDeps,
): Promise<HandlerResult>

// api/_lib/adminReset.ts  (unchanged signature, new impl)
export function resetContent(c: SupabaseClient, content: unknown): Promise<{ error: string | null }>

// src/admin/actions.ts
export function resetAll(): AdminData   // now returns buildDefaults() directly
```

---

## Task 1: Code-split `@supabase/supabase-js` out of the entry chunk

**Files:**
- Modify: `src/content/remote.ts`
- Test: `src/content/remote.test.ts` (adjust)

**Interfaces:**
- Consumes: `getSupabase` from `./supabaseClient` (now via dynamic import)
- Produces: nothing (same `fetchRemoteContent` signature)

- [ ] **Step 1: Record the baseline**

Run: `npm run build` then `ls -la dist/assets/*.js`. Note the `index-*.js` size (≈ 500 KB) in the task report.

- [ ] **Step 2: Change the import to dynamic**

In `src/content/remote.ts`, remove the top-level `import { getSupabase } from './supabaseClient'` and load it inside the function:
```ts
export async function fetchRemoteContent(): Promise<SiteContent | null> {
  let getSupabase: typeof import('./supabaseClient')['getSupabase']
  try {
    ;({ getSupabase } = await import('./supabaseClient'))
  } catch {
    return null
  }
  const client = getSupabase()
  if (!client) return null
  // ...rest unchanged
```
Keep the `type` imports (`SiteContent`, `Db*Row`) static — they erase.

- [ ] **Step 3: Fix the test**

`src/content/remote.test.ts` mocks `./supabaseClient` with `vi.mock`. Vitest intercepts dynamic `import()` of a mocked module, so the existing `vi.mock('./supabaseClient', () => ({ getSupabase: () => clientOrNull }))` still applies. Run `npm test -- src/content/remote.test.ts`:
- If all 4 cases still pass — no test change.
- If the "returns null when no client" or the mapping cases break because the mock factory shape differs from a namespace import, adjust the mock to `vi.mock('./supabaseClient', () => ({ getSupabase: vi.fn(() => clientOrNull) }))` and keep the assertions. Do the minimum.

- [ ] **Step 4: Verify the split**

Run: `npm run build` then `ls -la dist/assets/*.js`.
Expected: `index-*.js` drops by ~130–150 KB (to ≈ 360 KB); a new small chunk containing `@supabase/supabase-js` appears (name varies — grep the chunk list for one ~100–140 KB that wasn't there before). Note both numbers in the report. The "chunk > 500 kB" build warning should be gone.

- [ ] **Step 5: Full gate**

Run: `npm test`, `npm run lint`, `npx tsc -p tsconfig.app.json --noEmit`, `npm run build`, `npm run e2e`. All green. (The e2e content-read still works — `fetchRemoteContent` just awaits one more microtask.)

- [ ] **Step 6: Commit**

```bash
git add src/content/remote.ts src/content/remote.test.ts
git commit -m "perf(content): lazy-load @supabase/supabase-js out of the entry chunk"
```

---

## Task 2: Estimate endpoint abuse controls (honeypot + rate limit)

**Files:**
- Create: `api/_lib/estimateRateLimit.ts`, `api/_lib/estimateRateLimit.test.ts`
- Modify: `api/_lib/estimate.ts` (+ test), `api/_lib/estimateHandler.ts` (+ test)
- Modify: `api/estimate.ts`, `vite-plugins/admin-api-dev.ts` (+ its test)
- Modify: `src/components/EstimateForm/EstimateForm.tsx` (+ test)

**Interfaces:**
- Consumes: `validateEstimate` result shape, `HandlerResult`, `SupabaseAdminEnv`
- Produces: `checkRateLimit`, `__resetRateLimitForTest`; `handleEstimate` gains `ip: string` in its input

- [ ] **Step 1: Write the rate-limiter test**

Create `api/_lib/estimateRateLimit.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { checkRateLimit, __resetRateLimitForTest } from './estimateRateLimit'

beforeEach(() => __resetRateLimitForTest())

describe('checkRateLimit', () => {
  it('allows the first 5 requests from an IP within the window, blocks the 6th', () => {
    const t = 1_000_000
    for (let i = 0; i < 5; i++) expect(checkRateLimit('1.2.3.4', t + i * 1000)).toBe(true)
    expect(checkRateLimit('1.2.3.4', t + 6000)).toBe(false)
  })
  it('tracks IPs independently', () => {
    const t = 1_000_000
    for (let i = 0; i < 5; i++) checkRateLimit('1.1.1.1', t)
    expect(checkRateLimit('1.1.1.1', t)).toBe(false)
    expect(checkRateLimit('2.2.2.2', t)).toBe(true)
  })
  it('frees the slot after the 10-minute window passes', () => {
    const t = 1_000_000
    for (let i = 0; i < 5; i++) checkRateLimit('9.9.9.9', t)
    expect(checkRateLimit('9.9.9.9', t)).toBe(false)
    expect(checkRateLimit('9.9.9.9', t + 10 * 60 * 1000 + 1)).toBe(true)
  })
  it('an empty / unknown ip is allowed (never blocks on a missing IP)', () => {
    expect(checkRateLimit('', 1)).toBe(true)
  })
})
```

- [ ] **Step 2: Run → fail.** `npm test -- api/_lib/estimateRateLimit.test.ts`

- [ ] **Step 3: Implement `api/_lib/estimateRateLimit.ts`**

```ts
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 5

// Best-effort, per serverless-instance. Fluid Compute reuses instances so this
// catches naive floods; it is NOT an authoritative limiter. Vercel Firewall
// rate-limit rules on /api/estimate are the real defence — see docs/CMS-SETUP.md.
const hits = new Map<string, number[]>()

export function checkRateLimit(ip: string, now: number = Date.now()): boolean {
  if (!ip) return true
  const fresh = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (fresh.length >= MAX_PER_WINDOW) {
    hits.set(ip, fresh)
    return false
  }
  fresh.push(now)
  hits.set(ip, fresh)
  return true
}

export function __resetRateLimitForTest(): void {
  hits.clear()
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Honeypot in the validator — write the failing test**

Add to `api/_lib/estimate.test.ts`:
```ts
it('rejects a filled honeypot field with error "honeypot"', () => {
  const r = validateEstimate({ ...base, company_url: 'http://spam.example' })
  expect(r).toEqual({ ok: false, error: 'honeypot' })
})
it('ignores an empty-string honeypot', () => {
  expect(validateEstimate({ ...base, company_url: '' }).ok).toBe(true)
})
```
(`base` is the existing minimal-valid fixture in that file.)

- [ ] **Step 6: Run → fail, then implement**

In `api/_lib/estimate.ts` `validateEstimate`, as the **first** check after the object guard:
```ts
  if (typeof b.company_url === 'string' && b.company_url.trim() !== '') {
    return { ok: false, error: 'honeypot' }
  }
```

- [ ] **Step 7: Handler — write the failing tests**

Add to `api/_lib/estimateHandler.test.ts` (the fixture `goodBody` + `ENV` already exist there; add `ip` to every existing call — `{ method, body, ip: '1.2.3.4' }` — the old calls without `ip` will now be a type error, fix them all):
```ts
it('a filled honeypot → 200 { ok: true } WITHOUT calling insert', async () => {
  const insert = vi.fn()
  const r = await handleEstimate(
    { method: 'POST', body: { ...goodBody, company_url: 'x' }, ip: '1.2.3.4' },
    ENV, { insert },
  )
  expect(r.status).toBe(200)
  expect(r.body).toEqual({ ok: true })
  expect(insert).not.toHaveBeenCalled()
})
it('over the rate limit → 429', async () => {
  const insert = vi.fn().mockResolvedValue({ error: null })
  for (let i = 0; i < 5; i++) {
    await handleEstimate({ method: 'POST', body: goodBody, ip: '5.5.5.5' }, ENV, { insert })
  }
  const r = await handleEstimate({ method: 'POST', body: goodBody, ip: '5.5.5.5' }, ENV, { insert })
  expect(r.status).toBe(429)
  expect(r.body).toEqual({ error: 'rate_limited' })
})
```
Add `import { __resetRateLimitForTest } from './estimateRateLimit'` and `beforeEach(() => __resetRateLimitForTest())` to the file.

- [ ] **Step 8: Run → fail, then implement `api/_lib/estimateHandler.ts`**

```ts
import { checkRateLimit } from './estimateRateLimit'
// ...
export async function handleEstimate(
  input: { method: string; body: unknown; ip: string },
  env: SupabaseAdminEnv,
  deps: EstimateDeps = { insert: defaultInsert },
): Promise<HandlerResult> {
  if (input.method !== 'POST') return { status: 405, body: { error: 'method_not_allowed' } }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { status: 500, body: { error: 'not_configured' } }
  }
  const v = validateEstimate(input.body)
  if (!v.ok) {
    // honeypot: pretend success, do not insert, do not reveal the trap
    if (v.error === 'honeypot') return { status: 200, body: { ok: true } }
    return { status: 400, body: { error: 'invalid_request' } }
  }
  if (!checkRateLimit(input.ip)) return { status: 429, body: { error: 'rate_limited' } }

  const { error } = await deps.insert(v.row, env)
  if (error) return { status: 500, body: { error: 'insert_failed' } }
  return { status: 200, body: { ok: true } }
}
```
Note ordering: honeypot check is inside `!v.ok`; rate-limit is AFTER validation passes (so malformed spam doesn't consume a legit visitor's slot — it 400s first). Honeypot bots never reach the limiter.

- [ ] **Step 9: Wire the IP through the adapters**

`api/estimate.ts`:
```ts
const fwd = req.headers['x-forwarded-for']
const ip = (Array.isArray(fwd) ? fwd[0] : fwd ?? '').split(',')[0].trim()
const result = await handleEstimate(
  { method: req.method ?? 'GET', body: req.body ?? {}, ip },
  { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY },
)
```
`vite-plugins/admin-api-dev.ts` — in the `/api/estimate` case of `dispatchApi`, pass `ip: ''` (dev has no meaningful client IP; empty ip is never rate-limited). Update `vite-plugins/admin-api-dev.test.ts`'s estimate routing cases to add `ip: ''` if the type now requires it (it does — `dispatchApi` forwards the object).

- [ ] **Step 10: Honeypot field in the form — write the failing test**

Add to `src/components/EstimateForm/EstimateForm.test.tsx` (it already mocks `fetch`):
```ts
it('renders a hidden honeypot field and sends it empty', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('open form'))
  const hp = document.querySelector('input[name="company_url"]') as HTMLInputElement | null
  expect(hp).not.toBeNull()
  expect(hp).not.toBeVisible()  // jest-dom: off-screen / aria-hidden
  await user.type(screen.getByLabelText(/name/i), 'Jane')
  await user.type(screen.getByLabelText(/email/i), 'jane@roe.com')
  await user.type(screen.getByLabelText(/message/i), 'hi there')
  await user.click(screen.getByRole('button', { name: /send request/i }))
  const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
  expect(sent.company_url).toBe('')
})
```

- [ ] **Step 11: Run → fail, then implement in `EstimateForm.tsx`**

- Add state: `const [companyUrl, setCompanyUrl] = useState('')`; reset it in the `isOpen` effect with the others.
- In the `<form>`, right after the `<h2>`, add:
```tsx
<input
  type="text"
  name="company_url"
  tabIndex={-1}
  autoComplete="off"
  aria-hidden="true"
  value={companyUrl}
  onChange={(e) => setCompanyUrl(e.target.value)}
  style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
/>
```
- In the `submit` fetch body, add `company_url: companyUrl`.

- [ ] **Step 12: Doc note**

In `docs/CMS-SETUP.md`, under a new short "Estimate form spam" line: "The `/api/estimate` function checks a hidden honeypot field and applies a best-effort per-instance rate limit (5 / 10 min / IP). For authoritative rate limiting, add a Vercel Firewall rate-limit rule on `/api/estimate` in the Vercel dashboard."

- [ ] **Step 13: Full gate + commit**

`npm test`, `npm run lint`, `npm run typecheck:api`, `npx tsc -b`, `npm run build`, `npm run e2e` — all green.
```bash
git commit -m "feat(estimate): honeypot + best-effort rate limit"
```

---

## Task 3: Atomic card `sort` (DB trigger + unique constraint + handler retry)

**Files:**
- Create: `supabase/migration-2026-09-10-plan4.sql` (the sort half; Task 4 appends the reset function)
- Modify: `api/_lib/adminCardsHandler.ts` (`create` dep) + `api/_lib/adminCardsHandler.test.ts`

**Interfaces:**
- Consumes: `getSupabaseAdmin`
- Produces: nothing new

- [ ] **Step 1: Write `supabase/migration-2026-09-10-plan4.sql` (sort section)**

```sql
-- ============================================================================
--  ONVORX — Plan 4 migration. Run once in the Supabase SQL Editor, after
--  schema.sql + seed.sql. Safe to re-run.
-- ============================================================================

-- ---- 1. server-assigned card sort -----------------------------------------
-- one trigger fn per table so `max(sort)` targets the right relation
create or replace function public.assign_projects_sort() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if new.sort is null then
    select coalesce(max(sort), -1) + 1 into new.sort
    from public.projects where list = new.list;
  end if;
  return new;
end $$;

create or replace function public.assign_services_sort() returns trigger
  language plpgsql set search_path = '' as $$
begin
  if new.sort is null then
    select coalesce(max(sort), -1) + 1 into new.sort
    from public.services where list = new.list;
  end if;
  return new;
end $$;

drop trigger if exists trg_projects_sort on public.projects;
create trigger trg_projects_sort before insert on public.projects
  for each row execute function public.assign_projects_sort();

drop trigger if exists trg_services_sort on public.services;
create trigger trg_services_sort before insert on public.services
  for each row execute function public.assign_services_sort();

-- ---- 2. no two cards share a slot ---------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_list_sort_key') then
    alter table public.projects add constraint projects_list_sort_key unique (list, sort);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'services_list_sort_key') then
    alter table public.services add constraint services_list_sort_key unique (list, sort);
  end if;
end $$;
```
(If `seed.sql`'s existing rows already have a duplicate `(list, sort)` the `alter table` fails — they don't; the generated seed numbers each list `0..n`. Note this in the report.)

- [ ] **Step 2: Update `api/_lib/adminCardsHandler.ts` `create` dep — write the failing test**

In `api/_lib/adminCardsHandler.test.ts`, the create test currently asserts `deps.create` gets a row with no `sort`. Add a test for the retry behaviour against a **fake client** (the handler test injects `deps`, so to test the *default* dep's retry you need a small standalone test). Add:
```ts
import { describe, it, expect, vi } from 'vitest'
// ... existing imports

describe('defaultDeps.create retry on unique violation', () => {
  it('retries once when insert returns a 23505, then succeeds', async () => {
    // build a fake supabase-admin client
    let calls = 0
    const insert = vi.fn().mockImplementation(() => {
      calls++
      return Promise.resolve({ error: calls === 1 ? { code: '23505', message: 'dup' } : null })
    })
    const fake = { from: () => ({ insert }) }
    vi.doMock('./supabaseAdmin', () => ({ getSupabaseAdmin: () => fake }))
    const { handleAdminCards } = await import('./adminCardsHandler')
    // ... call create through the handler with a valid cookie; assert 200 and insert called twice
    vi.doUnmock('./supabaseAdmin')
  })
})
```
If wiring `vi.doMock` around the already-imported module is awkward, instead **export the default `create` fn** from `adminCardsHandler.ts` (`export const createCardDefault = ...`) and unit-test it directly with a hand-rolled fake client. Prefer that — cleaner.

- [ ] **Step 3: Implement**

`api/_lib/adminCardsHandler.ts` `defaultDeps.create` (export it as `createCardDefault` for the test):
```ts
export const createCardDefault: AdminCardsDeps['create'] = async (type, list, row, env) => {
  const c = getSupabaseAdmin(env)
  if (!c) return { error: 'not_configured' }
  // `sort` is DB-assigned by a BEFORE INSERT trigger; never send one.
  const { sort: _drop, ...clean } = row as Record<string, unknown>
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await c.from(table(type)).insert({ ...clean, list })
    if (!error) return { error: null }
    // 23505 = unique_violation on (list, sort) — a concurrent create raced us; retry
    if ((error as { code?: string }).code !== '23505') return { error: error.message }
  }
  return { error: 'sort_conflict' }
}
```
Wire `defaultDeps.create = createCardDefault`. The handler already strips client `sort` (Plan 3) — keep that; the `_drop` here is belt-and-braces.

- [ ] **Step 4: Run → pass.** `npm test -- api/_lib/adminCardsHandler.test.ts`

- [ ] **Step 5: `remote.ts` reads** — already have `.order('sort', { ascending: true })` on `projects`/`services` (Plan 3 fix wave). No change. Verify by reading the file.

- [ ] **Step 6: Full gate + commit**

```bash
git add supabase/migration-2026-09-10-plan4.sql api/_lib/adminCardsHandler.ts api/_lib/adminCardsHandler.test.ts
git commit -m "feat(cards): DB-assigned sort + unique(list,sort) + retry on race"
```

---

## Task 4: `resetContent` as a single Postgres function

**Files:**
- Modify: `supabase/migration-2026-09-10-plan4.sql` (append)
- Modify: `api/_lib/adminReset.ts` + `api/_lib/adminReset.test.ts`

**Interfaces:**
- Consumes: `projectRow`/`serviceRow`/`sectionRow`/`seoRow` from `adminRows.ts`
- Produces: `resetContent(c, content)` — same signature, one `.rpc()` call

- [ ] **Step 1: Append the function to `supabase/migration-2026-09-10-plan4.sql`**

```sql
-- ---- 3. atomic content reset -----------------------------------------
-- payload = { sections: [{key,eyebrow,title,body,cta_label}...],
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
  for s in select * from jsonb_array_elements(payload -> 'sections') loop
    update public.site_sections set
      eyebrow   = coalesce(s -> 'eyebrow',   eyebrow),
      title     = coalesce(s -> 'title',     title),
      body      = coalesce(s -> 'body',      body),
      cta_label = s -> 'cta_label'
    where key = s ->> 'key';
  end loop;

  for e in select * from jsonb_array_elements(payload -> 'seo') loop
    update public.seo_pages set
      title       = coalesce(e -> 'title',       title),
      description  = coalesce(e -> 'description', description)
    where page_key = e ->> 'page_key';
  end loop;

  delete from public.projects;
  delete from public.services;

  for card in select * from jsonb_array_elements(payload -> 'cards') loop
    if card ->> 'table' = 'projects' then
      insert into public.projects (list, id, sort, published, title, tags, description, image_url, image_path, image_alt)
      values (
        card ->> 'list', card ->> 'id', (card ->> 'sort')::int, (card ->> 'published')::boolean,
        card -> 'title', coalesce((select array_agg(x) from jsonb_array_elements_text(card -> 'tags') x), '{}'),
        card -> 'description', card ->> 'image_url', card ->> 'image_path', card -> 'image_alt'
      );
    else
      insert into public.services (list, id, sort, published, featured, title, text, icon_url, icon_path)
      values (
        card ->> 'list', card ->> 'id', (card ->> 'sort')::int, (card ->> 'published')::boolean,
        (card ->> 'featured')::boolean, card -> 'title', card -> 'text',
        card ->> 'icon_url', card ->> 'icon_path'
      );
  end loop;
end $$;
```
Note: the `projects`/`services` inserts here send an explicit `sort` (the trigger only fires when `sort is null`), so a full reset lays down a clean `0..n` per list. `image_url`/`image_path` may be SQL `null` when the jsonb value is absent — `card ->> 'image_url'` yields `null` then, which is correct.

- [ ] **Step 2: Rewrite `api/_lib/adminReset.ts` — write the failing test first**

Replace `api/_lib/adminReset.test.ts` with a test against a fake client whose `.rpc` records the call:
```ts
import { describe, it, expect, vi } from 'vitest'
import { resetContent } from './adminReset'

const L = (s: string) => ({ en: s, uk: s })
const content = {
  sections: [{ key: 'hero', title: L('T'), eyebrow: L('E'), body: L('B'), ctaLabel: L('Go') }],
  seo: [{ pageKey: 'home', title: L('HT'), description: L('HD') }],
  projectsHome: [{ id: 'p1', published: true, title: L('P'), tags: ['x'], description: L('d'),
    image: { kind: 'asset', src: '/a.png' }, imageAlt: L('a') }],
  projectsPage: [], servicesHome: [{ id: 's1', published: true, featured: true, title: L('S'), text: L('t'),
    icon: { kind: 'asset', src: '/i.png' } }],
  servicesPage: [],
}

describe('resetContent', () => {
  it('builds a snake_case payload and calls reset_content once', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })
    const r = await resetContent({ rpc } as never, content)
    expect(r).toEqual({ error: null })
    expect(rpc).toHaveBeenCalledTimes(1)
    const [fn, args] = rpc.mock.calls[0]
    expect(fn).toBe('reset_content')
    const p = args.payload
    expect(p.sections[0]).toMatchObject({ key: 'hero', title: L('T'), cta_label: L('Go') })
    expect(p.seo[0]).toMatchObject({ page_key: 'home', title: L('HT') })
    expect(p.cards).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'projects', list: 'home', id: 'p1', sort: 0, published: true, image_url: '/a.png' }),
      expect.objectContaining({ table: 'services', list: 'home', id: 's1', sort: 0, featured: true }),
    ]))
  })
  it('surfaces an rpc error', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
    expect(await resetContent({ rpc } as never, content)).toEqual({ error: 'boom' })
  })
  it('rejects a non-object payload', async () => {
    const rpc = vi.fn()
    expect((await resetContent({ rpc } as never, null)).error).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Implement `api/_lib/adminReset.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { projectRow, serviceRow, sectionRow, seoRow } from './adminRows'

const LISTS: [string, 'projects' | 'services', 'home' | 'page'][] = [
  ['projectsHome', 'projects', 'home'], ['projectsPage', 'projects', 'page'],
  ['servicesHome', 'services', 'home'], ['servicesPage', 'services', 'page'],
]

/** Replace all content rows with the supplied `SiteContent`-shaped payload, atomically. */
export async function resetContent(
  c: SupabaseClient,
  content: unknown,
): Promise<{ error: string | null }> {
  if (typeof content !== 'object' || content === null) return { error: 'invalid_payload' }
  const x = content as Record<string, unknown>

  const sections = (Array.isArray(x.sections) ? x.sections : []).map((s) => {
    const o = s as Record<string, unknown>
    return { key: String(o.key), ...sectionRow(String(o.key), o), cta_label: (sectionRow(String(o.key), o).cta_label ?? null) }
  })
  const seo = (Array.isArray(x.seo) ? x.seo : []).map((e) => {
    const o = e as Record<string, unknown>
    return { page_key: String(o.pageKey), ...seoRow(o) }
  })
  const cards: Record<string, unknown>[] = []
  for (const [key, table, list] of LISTS) {
    const arr = Array.isArray(x[key]) ? (x[key] as Record<string, unknown>[]) : []
    arr.forEach((card, i) => {
      const row = table === 'projects' ? projectRow({ ...card, order: i }) : serviceRow({ ...card, order: i })
      cards.push({ table, list, id: String(card.id), ...row })
    })
  }

  const { error } = await c.rpc('reset_content', { payload: { sections, seo, cards } })
  return { error: error ? error.message : null }
}
```

- [ ] **Step 4: Run → pass.** `npm test -- api/_lib/adminReset.test.ts`

- [ ] **Step 5: Confirm `adminContentHandler` still wires `resetContent`** — read `api/_lib/adminContentHandler.ts`; its `resetAll` default dep dynamic-imports `./adminReset` and calls `resetContent(c, content)`. Unchanged signature → no edit. Run its test.

- [ ] **Step 6: Full gate + commit**

```bash
git add supabase/migration-2026-09-10-plan4.sql api/_lib/adminReset.ts api/_lib/adminReset.test.ts
git commit -m "feat(admin): atomic content reset via a Postgres function"
```

---

## Task 5: Retire `onvorx.admin.v1` + drop the Dashboard "Last change" stat

**Files:**
- Modify: `src/content/SiteContentProvider.tsx` (+ test)
- Delete: `src/content/persistence.ts` (+ `src/content/persistence.test.ts`)
- Modify: `src/admin/actions.ts` (+ `src/admin/actions.test.ts`), `src/content/defaults/index.ts` (no change expected — verify)
- Modify: `src/admin/pages/DashboardPage.tsx` (+ test)
- Grep-and-fix: every test importing `STORAGE_KEY` / `loadAdminData` / `saveAdminData` / `seedAdminData` from `../content/persistence` or `./persistence`

**Interfaces:**
- Consumes: `loadContentCache`/`saveContentCache` (`contentCache.ts`), `buildDefaults`
- Produces: `resetAll(): AdminData` in `actions.ts` (returns `buildDefaults()`)

- [ ] **Step 1: Enumerate the blast radius**

Run: `grep -rn "persistence\|STORAGE_KEY\|loadAdminData\|saveAdminData\|seedAdminData\|isAdminData" src/ | grep -v node_modules` — paste into the report. Known: `persistence.ts` + `.test.ts`, `SiteContentProvider.tsx` + `.test.tsx`, `actions.ts` + `.test.ts`, and any page/section test that imports `STORAGE_KEY`.

- [ ] **Step 2: `src/admin/actions.ts`**

- `resetAll()` currently `return seedAdminData()`. Change to `return buildDefaults()` and add `import { buildDefaults } from '../content/defaults'`. Remove the `import { seedAdminData } from '../content/persistence'`.
- `actions.test.ts`: it imports `seedAdminData` from `'../content/persistence'` as `base`. Change to `import { buildDefaults } from '../content/defaults'` and `const base = () => buildDefaults()`. All existing card/section assertions still hold (`buildDefaults()` === what `seedAdminData()` returned).

- [ ] **Step 3: `src/content/SiteContentProvider.tsx`**

- Remove imports of `STORAGE_KEY`, `isAdminData`, `loadAdminData`, `saveAdminData` from `./persistence`.
- Initial state:
```ts
const [data, setData] = useState<AdminData>(() => {
  const base = buildDefaults()
  const cache = loadContentCache()
  return cache ? { ...base, ...cache } : base
})
```
  (add `import { buildDefaults } from './defaults'` if not present.)
- Delete the **persist effect** (the `useEffect(..., [data])` that calls `saveAdminData`).
- Delete the **cross-tab `storage` effect**.
- Delete the `skipNextPersist` and `firstRun` refs. In `refetch`, replace `skipNextPersist.current = true; setData(...)` with just `setData((d) => ({ ...d, ...remote }))` (nothing persists now) + `saveContentCache(remote)` (keep).
- Keep `mounted` ref, the debounced reconcile, the mount+focus refetch effect, `write()`, `actions`, `value`.
- Add a one-time cleanup at the top of the mount effect: `try { localStorage.removeItem('onvorx.admin.v1') } catch { /* */ }`.
- `SiteContentProvider.test.tsx`: it has tests titled "applies an edit and persists it to localStorage" and cross-tab ones that read `STORAGE_KEY`. **Rewrite** those:
  - "applies an edit" → assert the optimistic edit is visible AND `adminApi.updateSection` (mocked) was called; drop the `localStorage.getItem(STORAGE_KEY)` assertion.
  - Any cross-tab `storage`-event test → delete it (the behaviour is gone; focus-refetch replaces it and is covered elsewhere).
  - The overlay tests, error-revert test, the debounced-refetch test, and the per-action wiring tests — keep as-is.
  - Remove `import { STORAGE_KEY } from './persistence'`.

- [ ] **Step 4: Delete `src/content/persistence.ts` + `src/content/persistence.test.ts`**

```bash
git rm src/content/persistence.ts src/content/persistence.test.ts
```

- [ ] **Step 5: `src/admin/pages/DashboardPage.tsx`**

Remove the `<p className="admin-field__hint">Last change: …</p>` block and the `EPOCH` const + the `data.updatedAt` read. Keep the stats grid + recent requests. `DashboardPage.test.tsx`: drop any assertion on "Last change".

- [ ] **Step 6: Fix the remaining grep hits**

Section/admin-page tests that only imported `STORAGE_KEY` to `localStorage.clear()` in `beforeEach` — replace with a plain `localStorage.clear()` (no import). Run `npm test` and fix each failure until green.

- [ ] **Step 7: Full gate + commit**

`npm test`, `npm run lint`, `npx tsc -p tsconfig.app.json --noEmit`, `npm run typecheck:api`, `npm run build`, `npm run e2e`.
The e2e "owner edits a section title" test relies on the edit surviving a `page.goto('/')` reload — previously via `onvorx.admin.v1`. Now the provider re-inits from `contentCache` (which the optimistic write does NOT populate — only `refetch` does) then `refetch`s from Supabase (route-mocked to 200 in the e2e, so no real data) → the reload shows the **default** hero, not "E2E hero headline". **This test must change:** assert the edit is visible immediately after Save (before the reload), and drop the post-reload assertion — or route-mock `GET` on the Supabase REST URL for `site_sections` to return the edited value. Simplest: assert visible-after-save, remove the reload+re-assert. Update `e2e/admin.spec.ts` accordingly and keep it green.

```bash
git commit -m "refactor(content): drop the onvorx.admin.v1 store; cache-only init"
```

---

## Task 6: SVG upload hardening + dev-plugin body guard

**Files:**
- Modify: `api/_lib/adminUploadHandler.ts` (+ test), `supabase/STORAGE.md`
- Modify: `vite-plugins/admin-api-dev.ts` (+ test)

**Interfaces:**
- Consumes: nothing new
- Produces: nothing new

- [ ] **Step 1: Drop svg from the upload allowlist — write the failing test**

In `api/_lib/adminUploadHandler.test.ts`, change/add:
```ts
it('400 on an svg data URL (svg not allowed for uploads)', async () => {
  const svg = 'data:image/svg+xml;base64,' + Buffer.from('<svg/>').toString('base64')
  expect((await handleAdminUpload({ method: 'POST', cookieHeader: cookie,
    body: { dataUrl: svg, fileName: 'x.svg', folder: 'services' } }, ENV, deps())).status).toBe(400)
})
```

- [ ] **Step 2: Implement**

`api/_lib/adminUploadHandler.ts`: remove the `'image/svg+xml': 'svg'` entry from `MIME_EXT`. (A stored SVG on the public `*.supabase.co` origin can execute script on that origin; owner-only, but not worth it. Repo `/assets/*.svg` icons are unaffected — they're not uploaded.)

- [ ] **Step 3: `supabase/STORAGE.md`** — change the MIME line to `image/png, image/jpeg, image/webp`. Add: "SVG is intentionally excluded from uploads (inline-script risk on the Storage origin). The operator should also remove `image/svg+xml` from the bucket's Allowed MIME types."

- [ ] **Step 4: Dev-plugin body guard — write the failing test**

In `vite-plugins/admin-api-dev.test.ts`, add a test that `dispatchApi` returns `null` for a non-`/api/` path (already covered) and that the **middleware** does not buffer a body for an unknown `/api/whatever` route. Since the middleware is harder to unit-test, add a `KNOWN_API_PATHS` export and test it:
```ts
import { KNOWN_API_PATHS } from './admin-api-dev'
it('KNOWN_API_PATHS lists exactly the served routes', () => {
  expect([...KNOWN_API_PATHS].sort()).toEqual([
    '/api/admin/cards', '/api/admin/content', '/api/admin/login',
    '/api/admin/logout', '/api/admin/requests', '/api/admin/session',
    '/api/admin/upload', '/api/estimate',
  ])
})
```

- [ ] **Step 5: Implement in `vite-plugins/admin-api-dev.ts`**

- `export const KNOWN_API_PATHS = new Set([...])` — the 8 paths above.
- `readJsonBody`: cap the buffer — after each `data` chunk, if the accumulated length > `2_000_000`, `resolve(undefined)` and stop (drop the rest). Add a `req.destroy()` after resolving.
- In `configureServer`'s middleware: change the guard so the body is buffered only when `KNOWN_API_PATHS.has(url.split('?')[0])` AND `method` is not GET/HEAD. Unknown `/api/*` → `next()` without draining.

- [ ] **Step 6: Full gate + commit**

`npm test`, `npm run lint`, `npm run typecheck:api`, `npx tsc -b`, `npm run build`, `npm run e2e`.
```bash
git commit -m "hardening: drop svg uploads; dev plugin buffers known routes only, capped"
```

---

## Task 7: Migration run + live integration verification

**Files:** none (operator SQL + controller verification).

- [ ] **Step 1: Full local gate** — `npm test`, `npm run lint`, `npx tsc -p tsconfig.app.json --noEmit`, `npm run typecheck:api`, `npx tsc -b`, `npm run build`, `npm run e2e`. Record counts + the entry-chunk size.

- [ ] **Step 2: Operator runs the migration**

Supabase → SQL Editor → paste `supabase/migration-2026-09-10-plan4.sql` → Run. Expect "Success. No rows returned". Then:
```sql
select conname from pg_constraint where conname in ('projects_list_sort_key','services_list_sort_key');  -- 2 rows
select proname from pg_proc where proname in ('assign_projects_sort','assign_services_sort','reset_content');  -- 3 rows
```

- [ ] **Step 3: Operator updates the bucket** — Supabase → Storage → `public-media` → settings → Allowed MIME types → remove `image/svg+xml` (leave png/jpeg/webp).

- [ ] **Step 4: Live round-trip** (`npm run dev`, real `.env.local`, minted session cookie or the `/admin` UI):
  - **Sort:** add two project cards to `home` back-to-back, then delete the first one, then add a third → `select id, sort from projects where list='home' order by sort` shows contiguous `0..n` with no duplicates. Reload `/` twice → card order is stable.
  - **Reset:** Settings → Reset content → confirm → `select count(*)` back to 6/8/4/8; any test edits gone; the operation is all-or-nothing (no partial state visible mid-run).
  - **Honeypot:** `curl -X POST .../api/estimate -d '{"name":"x","email":"a@b.c","message":"y","locale":"en","company_url":"http://spam"}'` → `{"ok":true}` but `select count(*) from estimate_requests` unchanged.
  - **Rate limit:** 6 rapid valid `curl` POSTs from the same host → the 6th returns `429`. (Dev plugin passes `ip:''` so this only exercises on a real deploy; note it and verify on a preview instead if needed.)
  - **SVG upload:** `curl` an `image/svg+xml` data URL to `/api/admin/upload` → `400`.
  - **Bundle:** confirm the deployed/preview `index-*.js` is ~360 KB and a separate supabase chunk loads only when the site fetches content.

- [ ] **Step 5: Clean up** any test rows/objects. Re-run `seed.sql` only if the content DB is dirty.

- [ ] **Step 6: Record results in the ledger.** Any failure → stop and fix in the owning task.

---

## Self-review — coverage

| Deferred item (from Plan 3 review / memory) | Task |
|---|---|
| Code-split `@supabase/supabase-js` out of the entry chunk | 1 |
| `/api/estimate` abuse controls (honeypot + rate-limit) | 2 |
| Card `sort` race → DB constraint / atomic | 3 |
| Retire `onvorx.admin.v1` (dual-cache) | 5 |
| `resetContent` transaction | 4 |
| `DashboardPage` "Last change" misleading | 5 |
| SVG in a public bucket (inline-script risk) | 6 |
| dev `readJsonBody` unbounded on unknown `/api/*` | 6 |

**Explicitly out of scope (operator declined):** i18n the estimate error string; `aria-busy` / double-submit early-return / `405 Allow` headers; strengthen weak test assertions (`SiteContentProvider` unmount, RequestsPage error/loading, Seo/Services/Settings error paths); dead-code cleanup (`A.addCard`, `NewRequestInput`, the `_sort`/`_drop` bindings); `seed.sql` `on conflict`; `mockRequests` dev seed.

### Notes for the executor
- **Task order matters:** 1 → 2 → 3 → 4 → 5 → 6 → 7. Task 5 is the riskiest (touches the provider + ~6 test files + the e2e); do it after the server-side tasks so a revert is cheap.
- The `supabase/migration-2026-09-10-plan4.sql` file is written across Tasks 3 and 4 (sort section, then the reset function). It is NOT run against the DB until Task 7 — every task before it is green in unit tests with injected deps.
- `search_path = ''` on the Postgres functions is required (Supabase linter). Fully-qualify every object (`public.projects`, `pg_catalog` functions resolve implicitly).
- After Task 5, `buildDefaults()`'s `updatedAt` field (`EPOCH`) is still on `AdminData` but nothing reads it — leave the field (removing it is more churn than it's worth; a dead-code pass was declined).
- The e2e change in Task 5 is unavoidable — the old assertion depended on `onvorx.admin.v1` persistence which this task removes. Assert visible-after-Save instead.
- `checkRateLimit` state is per Node process; `npm test` runs suites in workers — `__resetRateLimitForTest()` in `beforeEach` keeps the estimate-handler + rate-limit tests isolated.
- After the plan: the operator adds a Vercel Firewall rate-limit rule on `/api/estimate` (dashboard, no code) for authoritative limiting — the in-memory limiter is only a naive-flood catch.
