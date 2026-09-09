# Supabase Integration — Plan 2: Public read + estimate form

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The public site serves its managed content from Supabase at runtime (with the bundled defaults + a localStorage cache for instant first paint), and "Request an Estimate" submissions are written to Supabase through a public serverless function.

**Architecture:** `SiteContentProvider` keeps its existing synchronous localStorage-backed `AdminData` working store unchanged; a new `useEffect` fetches the 4 content tables via the anon browser client (Plan 1's `getSupabase()` + `rowsToSiteContent`) and overlays the content fields on top. `EstimateForm` stops writing to the local store and `POST`s to a new `/api/estimate` function that validates and inserts via the service-role client. The dev-only Vite API plugin is generalised to serve `/api/estimate` alongside `/api/admin/*`.

**Tech Stack:** Vite 8 + React 19, TypeScript (strict), Vitest + Testing Library, `@vercel/node` serverless functions (CJS-scoped via `api/package.json`), `@supabase/supabase-js` v2, Supabase (Postgres, RLS public-read).

**Spec:** [docs/superpowers/specs/2026-09-09-supabase-integration-design.md](../specs/2026-09-09-supabase-integration-design.md) — §7 (public read), §9.2/§9.4/§9.5.

**Depends on:** Plan 1 (`docs/superpowers/plans/2026-09-09-supabase-plan-1-foundation.md`) — merged on branch `feature/supabase-integration` at `07e1035`. Supabase project `ovbcjgfvtetktwmtxarf` is provisioned (schema + seed applied, RLS verified, 6/8/4/8 content rows); `.env.local` has `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## Global Constraints

- Node `22.x` (`engines`), CI on `22.12`. Local may be newer.
- Repo root is `"type": "module"`; `api/` is CJS via `api/package.json` — **do not touch that file**. Anything under `api/` uses `import type` for type-only imports, no `.json` imports, no unused symbols (`verbatimModuleSyntax` + `erasableSyntaxOnly` + `noUnusedLocals/Parameters`).
- `@supabase/supabase-js` is already a dependency. `getSupabase()` (`src/content/supabaseClient.ts`) returns the anon client or `null`; `getSupabaseAdmin(env)` (`api/_lib/supabaseAdmin.ts`) returns the service-role client or `null`. Neither throws at import.
- `rowsToSiteContent(rows: DbContentRows): SiteContent` (`src/content/mappers.ts`) is the row→model mapper. `SiteContent` = `{ sections, seo, projectsHome, projectsPage, servicesHome, servicesPage }` — exactly the content fields of `AdminData` minus `version`/`updatedAt`/`requests`.
- `DbContentRows` = `{ sections: DbSectionRow[]; seo: DbSeoRow[]; projects: DbProjectRow[]; services: DbServiceRow[] }` (`src/content/dbTypes.ts`).
- **Do NOT change the `/admin` UI or the public site design.** No new managed fields. No `AdminData` reshape (that is Plan 3).
- **Do NOT change the admin write path** — `actions.*` still write to `localStorage` via the provider. Plan 3 replaces that. Between Plan 2 and Plan 3, admin content edits are session-only (overlaid by the remote fetch on reload); this is acceptable because the branch ships as Plans 1+2+3 together.
- Table/enum values (verbatim from the schema): `estimate_requests` columns `name, email, company, budget, interested_in (text[]), message, locale, source_page`; `status` defaults to `'new'` server-side (do not send it); `budget in ('<1k','1-3k','3-10k','10k+','not_sure')`; `locale in ('en','uk')`.
- Vercel Hobby: max 12 serverless functions. Currently 3 (`api/admin/{login,session,logout}.ts`); this plan adds 1 (`api/estimate.ts`) → 4.
- Tests live next to source as `*.test.ts(x)`; `npm test` runs Vitest, `e2e/**` excluded. `npm run lint` (oxlint) must stay at 0 errors. `npm run typecheck:api` and `tsc -p tsconfig.app.json` must stay clean.
- The client-side email check in `EstimateForm.tsx` is `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Reuse that exact regex server-side for parity.

---

## File structure (this plan)

| File | Responsibility |
|---|---|
| `api/_lib/estimate.ts` | **new** — `validateEstimate(body: unknown)` pure validator → `{ ok: true; row: EstimateInsert } \| { ok: false; error: string }`; owns `EstimateInsert` + the allowed-value constants |
| `api/_lib/estimate.test.ts` | **new** — validator unit tests |
| `api/_lib/estimateHandler.ts` | **new** — `async handleEstimate(body, env, deps?)` → `HandlerResult`; validates then inserts via `getSupabaseAdmin` |
| `api/_lib/estimateHandler.test.ts` | **new** — handler tests with an injected fake Supabase client |
| `api/estimate.ts` | **new** — Vercel function adapter: method guard, body parse, `handleEstimate`, `send` |
| `vite-plugins/admin-api-dev.ts` | generalise `dispatchAdminApi` → `dispatchApi` (async); route `POST /api/estimate`; load `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |
| `vite-plugins/admin-api-dev.test.ts` | update for the rename + the new route |
| `src/content/remote.ts` | **new** — `fetchRemoteContent(): Promise<SiteContent \| null>` (4 anon selects → `rowsToSiteContent`) |
| `src/content/remote.test.ts` | **new** — with a mocked `supabaseClient` |
| `src/content/SiteContentProvider.tsx` | add the remote-overlay `useEffect`; nothing else changes |
| `src/content/SiteContentProvider.test.tsx` | add remote-overlay tests (mock `./remote`) |
| `src/components/EstimateForm/EstimateForm.tsx` | `submit` → `POST /api/estimate`; add submitting + error states; keep the "Thank you" panel and all markup/classes |
| `src/components/EstimateForm/EstimateForm.test.tsx` | rewrite the submit tests to mock `fetch` |

**Not touched:** `src/content/persistence.ts` (+ its test), `src/content/mappers.ts`, `src/content/useSiteContent.ts`, `src/content/defaults/**`, `src/admin/**`, all `src/sections/**`, `src/components/DocumentHead/**`, `api/admin/**`, `api/_lib/{handlers,session,vercel-adapter,types}.ts`, `src/admin/types.ts`, `vercel.json`, `.env.example`.

### Interfaces produced by this plan

```ts
// api/_lib/estimate.ts
export const BUDGETS = ['<1k','1-3k','3-10k','10k+','not_sure'] as const
export const LOCALES = ['en','uk'] as const
export interface EstimateInsert {
  name: string
  email: string
  company: string | null
  budget: (typeof BUDGETS)[number] | null
  interested_in: string[]
  message: string
  locale: (typeof LOCALES)[number]
  source_page: string | null
}
export function validateEstimate(
  body: unknown,
): { ok: true; row: EstimateInsert } | { ok: false; error: string }

// api/_lib/estimateHandler.ts
import type { SupabaseAdminEnv } from './types'
import type { HandlerResult } from './types'
export interface EstimateDeps {
  insert: (row: EstimateInsert, env: SupabaseAdminEnv) => Promise<{ error: string | null }>
}
export function handleEstimate(
  input: { method: string; body: unknown },
  env: SupabaseAdminEnv,
  deps?: EstimateDeps,
): Promise<HandlerResult>

// vite-plugins/admin-api-dev.ts
export function dispatchApi(
  input: { url: string; method: string; cookieHeader?: string; jsonBody?: unknown; secure: boolean },
  env: AuthEnv & SupabaseAdminEnv,
): Promise<HandlerResult | null>

// src/content/remote.ts
import type { SiteContent } from './mappers'
export function fetchRemoteContent(): Promise<SiteContent | null>
```

---

## Task 1: Estimate request validator

**Files:**
- Create: `api/_lib/estimate.ts`
- Test: `api/_lib/estimate.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `BUDGETS`, `LOCALES`, `EstimateInsert`, `validateEstimate` (see header)

- [ ] **Step 1: Write the failing test**

Create `api/_lib/estimate.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { validateEstimate } from './estimate'

const base = {
  name: 'Jane Roe',
  email: 'jane@roe.com',
  message: 'We need a new site.',
  locale: 'en',
}

describe('validateEstimate', () => {
  it('accepts a minimal valid body and normalizes optionals to null/[]', () => {
    const r = validateEstimate(base)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.row).toEqual({
        name: 'Jane Roe',
        email: 'jane@roe.com',
        company: null,
        budget: null,
        interested_in: [],
        message: 'We need a new site.',
        locale: 'en',
        source_page: null,
      })
    }
  })

  it('trims strings and keeps provided optionals', () => {
    const r = validateEstimate({
      ...base,
      name: '  Jane  ',
      company: '  Acme  ',
      budget: '3-10k',
      interestedIn: ['web-development', 'google-ads'],
      sourcePage: '/services',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.row.name).toBe('Jane')
      expect(r.row.company).toBe('Acme')
      expect(r.row.budget).toBe('3-10k')
      expect(r.row.interested_in).toEqual(['web-development', 'google-ads'])
      expect(r.row.source_page).toBe('/services')
    }
  })

  it('rejects a non-object body', () => {
    expect(validateEstimate(null).ok).toBe(false)
    expect(validateEstimate('x').ok).toBe(false)
  })

  it('rejects missing or blank required fields', () => {
    expect(validateEstimate({ ...base, name: '   ' }).ok).toBe(false)
    expect(validateEstimate({ ...base, email: '' }).ok).toBe(false)
    expect(validateEstimate({ ...base, message: undefined }).ok).toBe(false)
  })

  it('rejects an invalid email (same regex as the client)', () => {
    expect(validateEstimate({ ...base, email: 'not-an-email' }).ok).toBe(false)
  })

  it('rejects an unknown locale or budget', () => {
    expect(validateEstimate({ ...base, locale: 'de' }).ok).toBe(false)
    expect(validateEstimate({ ...base, budget: 'huge' }).ok).toBe(false)
  })

  it('drops non-string entries from interestedIn and caps the array', () => {
    const r = validateEstimate({ ...base, interestedIn: ['a', 2, null, 'b'] })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.row.interested_in).toEqual(['a', 'b'])
    const many = validateEstimate({ ...base, interestedIn: Array(50).fill('x') })
    expect(many.ok).toBe(false)
  })

  it('rejects over-long fields', () => {
    expect(validateEstimate({ ...base, message: 'x'.repeat(5001) }).ok).toBe(false)
    expect(validateEstimate({ ...base, name: 'x'.repeat(201) }).ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api/_lib/estimate.test.ts`
Expected: FAIL — `Cannot find module './estimate'`.

- [ ] **Step 3: Implement `api/_lib/estimate.ts`**

```ts
export const BUDGETS = ['<1k', '1-3k', '3-10k', '10k+', 'not_sure'] as const
export const LOCALES = ['en', 'uk'] as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const MAX = { name: 200, email: 200, company: 200, message: 5000, sourcePage: 200, tag: 100 }
const MAX_INTERESTS = 20

export interface EstimateInsert {
  name: string
  email: string
  company: string | null
  budget: (typeof BUDGETS)[number] | null
  interested_in: string[]
  message: string
  locale: (typeof LOCALES)[number]
  source_page: string | null
}

type Result =
  | { ok: true; row: EstimateInsert }
  | { ok: false; error: string }

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

export function validateEstimate(body: unknown): Result {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'body' }
  const b = body as Record<string, unknown>

  const name = str(b.name)
  const email = str(b.email)
  const message = str(b.message)
  const locale = str(b.locale)

  if (!name || name.length > MAX.name) return { ok: false, error: 'name' }
  if (!email || email.length > MAX.email || !EMAIL_RE.test(email)) return { ok: false, error: 'email' }
  if (!message || message.length > MAX.message) return { ok: false, error: 'message' }
  if (!(LOCALES as readonly string[]).includes(locale)) return { ok: false, error: 'locale' }

  const company = str(b.company) || null
  if (company && company.length > MAX.company) return { ok: false, error: 'company' }

  const sourcePage = str(b.sourcePage) || null
  if (sourcePage && sourcePage.length > MAX.sourcePage) return { ok: false, error: 'sourcePage' }

  const budgetRaw = str(b.budget)
  let budget: EstimateInsert['budget'] = null
  if (budgetRaw) {
    if (!(BUDGETS as readonly string[]).includes(budgetRaw)) return { ok: false, error: 'budget' }
    budget = budgetRaw as EstimateInsert['budget']
  }

  const interested = Array.isArray(b.interestedIn) ? b.interestedIn : []
  const interested_in = interested
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0 && x.length <= MAX.tag)
    .map((x) => x.trim())
  if (interested_in.length > MAX_INTERESTS) return { ok: false, error: 'interestedIn' }

  return {
    ok: true,
    row: {
      name,
      email,
      company,
      budget,
      interested_in,
      message,
      locale: locale as EstimateInsert['locale'],
      source_page: sourcePage,
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- api/_lib/estimate.test.ts`
Expected: all PASS.

- [ ] **Step 5: Lint + api typecheck**

Run:
```bash
npm run lint
npm run typecheck:api
```
Expected: 0 lint errors, clean typecheck.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/estimate.ts api/_lib/estimate.test.ts
git commit -m "feat(estimate): request body validator"
```

---

## Task 2: Estimate handler + Vercel function

**Files:**
- Create: `api/_lib/estimateHandler.ts`
- Test: `api/_lib/estimateHandler.test.ts`
- Create: `api/estimate.ts`

**Interfaces:**
- Consumes: `validateEstimate`, `EstimateInsert` (Task 1); `getSupabaseAdmin` (`api/_lib/supabaseAdmin.ts`); `SupabaseAdminEnv`, `HandlerResult` (`api/_lib/types.ts`); `send` (`api/_lib/vercel-adapter.ts`)
- Produces: `handleEstimate`, `EstimateDeps` (see header)

- [ ] **Step 1: Write the failing test**

Create `api/_lib/estimateHandler.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { handleEstimate } from './estimateHandler'

const ENV = { SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' }
const goodBody = { name: 'Jane', email: 'jane@roe.com', message: 'Hi', locale: 'en' }

describe('handleEstimate', () => {
  it('405 on non-POST', async () => {
    const r = await handleEstimate({ method: 'GET', body: goodBody }, ENV)
    expect(r.status).toBe(405)
  })

  it('400 on an invalid body, without calling insert', async () => {
    const insert = vi.fn()
    const r = await handleEstimate({ method: 'POST', body: { name: '' } }, ENV, { insert })
    expect(r.status).toBe(400)
    expect(r.body).toEqual({ error: 'invalid_request' })
    expect(insert).not.toHaveBeenCalled()
  })

  it('500 when Supabase env is not configured', async () => {
    const r = await handleEstimate({ method: 'POST', body: goodBody }, {})
    expect(r.status).toBe(500)
    expect(r.body).toEqual({ error: 'not_configured' })
  })

  it('inserts the validated row and returns 200 { ok: true }', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const r = await handleEstimate(
      { method: 'POST', body: { ...goodBody, company: 'Acme', interestedIn: ['x'] } },
      ENV,
      { insert },
    )
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ ok: true })
    const [row, passedEnv] = insert.mock.calls[0]
    expect(row).toEqual({
      name: 'Jane', email: 'jane@roe.com', company: 'Acme', budget: null,
      interested_in: ['x'], message: 'Hi', locale: 'en', source_page: null,
    })
    expect(row).not.toHaveProperty('status') // DB default applies
    expect(passedEnv).toBe(ENV)
  })

  it('500 { error: insert_failed } when the insert errors', async () => {
    const insert = vi.fn().mockResolvedValue({ error: 'boom' })
    const r = await handleEstimate({ method: 'POST', body: goodBody }, ENV, { insert })
    expect(r.status).toBe(500)
    expect(r.body).toEqual({ error: 'insert_failed' })
  })
})
```

Note: the handler must **not** send a `status` field — the DB column defaults to `'new'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api/_lib/estimateHandler.test.ts`
Expected: FAIL — `Cannot find module './estimateHandler'`.

- [ ] **Step 3: Implement `api/_lib/estimateHandler.ts`**

```ts
import type { HandlerResult, SupabaseAdminEnv } from './types'
import { validateEstimate, type EstimateInsert } from './estimate'
import { getSupabaseAdmin } from './supabaseAdmin'

export interface EstimateDeps {
  insert: (row: EstimateInsert, env: SupabaseAdminEnv) => Promise<{ error: string | null }>
}

const defaultInsert: EstimateDeps['insert'] = async (row, env) => {
  const client = getSupabaseAdmin(env)
  if (!client) return { error: 'not_configured' }
  const { error } = await client.from('estimate_requests').insert(row)
  return { error: error ? error.message : null }
}

export async function handleEstimate(
  input: { method: string; body: unknown },
  env: SupabaseAdminEnv,
  deps: EstimateDeps = { insert: defaultInsert },
): Promise<HandlerResult> {
  if (input.method !== 'POST') return { status: 405, body: { error: 'method_not_allowed' } }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { status: 500, body: { error: 'not_configured' } }
  }
  const v = validateEstimate(input.body)
  if (!v.ok) return { status: 400, body: { error: 'invalid_request' } }

  const { error } = await deps.insert(v.row, env)
  if (error) return { status: 500, body: { error: 'insert_failed' } }
  return { status: 200, body: { ok: true } }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- api/_lib/estimateHandler.test.ts`
Expected: all PASS.

- [ ] **Step 5: Implement `api/estimate.ts` (Vercel function adapter)**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleEstimate } from './_lib/estimateHandler'
import { send } from './_lib/vercel-adapter'

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const result = await handleEstimate(
    { method: req.method ?? 'GET', body: req.body ?? {} },
    {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  )
  send(res, result)
}
```

Check `api/_lib/vercel-adapter.ts`: `send(res, result)` sets `Cache-Control: no-store` and `res.status(result.status).json(result.body)`. That is fine for this endpoint (no caching of a POST response).

- [ ] **Step 6: Run tests + lint + api typecheck**

Run:
```bash
npm test -- api/_lib/estimate.test.ts api/_lib/estimateHandler.test.ts
npm run lint
npm run typecheck:api
```
Expected: all PASS, 0 lint errors, clean typecheck.

- [ ] **Step 7: Commit**

```bash
git add api/_lib/estimateHandler.ts api/_lib/estimateHandler.test.ts api/estimate.ts
git commit -m "feat(estimate): POST /api/estimate handler + function"
```

---

## Task 3: Serve `/api/estimate` in `npm run dev`

**Files:**
- Modify: `vite-plugins/admin-api-dev.ts`
- Modify: `vite-plugins/admin-api-dev.test.ts`

**Interfaces:**
- Consumes: `handleEstimate` (Task 2); existing `handleLogin/handleSession/handleLogout`; `AuthEnv`, `HandlerResult` (`api/_lib/types.ts`), `SupabaseAdminEnv`
- Produces: `dispatchApi` (async; replaces `dispatchAdminApi`)

- [ ] **Step 1: Read the current file**

Read `vite-plugins/admin-api-dev.ts` and `vite-plugins/admin-api-dev.test.ts` fully. Current shape: `dispatchAdminApi(input, env: AuthEnv): HandlerResult | null` (sync, `switch` on `path`); the `configureServer` middleware gates on `url.startsWith('/api/admin/')`.

- [ ] **Step 2: Update the test first**

In `vite-plugins/admin-api-dev.test.ts`:
- Rename every `dispatchAdminApi` reference to `dispatchApi` and `await` each call (it becomes async).
- Keep the existing cases for `/api/admin/login|session|logout` and the "returns null for an unknown path" case.
- Add:
```ts
it('routes POST /api/estimate through handleEstimate', async () => {
  const r = await dispatchApi(
    { url: '/api/estimate', method: 'POST', jsonBody: { name: '' }, secure: false },
    { ...ENV, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' },
  )
  expect(r?.status).toBe(400) // invalid body, but it was routed
})

it('405s a GET /api/estimate', async () => {
  const r = await dispatchApi(
    { url: '/api/estimate', method: 'GET', secure: false },
    { ...ENV, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' },
  )
  expect(r?.status).toBe(405)
})
```
(Use whatever `ENV` constant the existing test defines for the admin vars; extend it or spread the Supabase keys inline as shown.)

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- vite-plugins/admin-api-dev.test.ts`
Expected: FAIL — `dispatchApi` is not exported / not a function.

- [ ] **Step 4: Update `vite-plugins/admin-api-dev.ts`**

- Add imports:
```ts
import type { AuthEnv, HandlerResult, SupabaseAdminEnv } from '../api/_lib/types'
import { handleEstimate } from '../api/_lib/estimateHandler'
```
- Replace `dispatchAdminApi` with an async `dispatchApi`:
```ts
export async function dispatchApi(
  input: {
    url: string
    method: string
    cookieHeader?: string
    jsonBody?: unknown
    secure: boolean
  },
  env: AuthEnv & SupabaseAdminEnv,
): Promise<HandlerResult | null> {
  const path = input.url.split('?')[0]
  switch (path) {
    case '/api/admin/login': {
      const body = (input.jsonBody ?? {}) as { password?: unknown }
      return handleLogin(
        { method: input.method, password: body.password, secure: input.secure },
        env,
      )
    }
    case '/api/admin/session':
      return handleSession({ method: input.method, cookieHeader: input.cookieHeader }, env)
    case '/api/admin/logout':
      return handleLogout({ method: input.method, secure: input.secure })
    case '/api/estimate':
      return handleEstimate({ method: input.method, body: input.jsonBody ?? {} }, env)
    default:
      return null
  }
}
```
- In `adminApiDev()`'s `config()` hook, extend the `env` object:
```ts
env = {
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? fileEnv.ADMIN_PASSWORD,
  ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET ?? fileEnv.ADMIN_SESSION_SECRET,
  SUPABASE_URL: process.env.SUPABASE_URL ?? fileEnv.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? fileEnv.SUPABASE_SERVICE_ROLE_KEY,
}
```
  and widen the module-level `let env` type to `AuthEnv & SupabaseAdminEnv`.
- In `configureServer`, change the guard from `url.startsWith('/api/admin/')` to `url.startsWith('/api/')`, and `await` the dispatch:
```ts
server.middlewares.use((req, res, next) => {
  const url = req.url ?? ''
  if (!url.startsWith('/api/')) return next()
  const run = async () => {
    const method = req.method ?? 'GET'
    const jsonBody = method === 'POST' ? await readJsonBody(req) : undefined
    const result = await dispatchApi(
      { url, method, cookieHeader: req.headers.cookie, jsonBody, secure: false },
      env,
    )
    if (!result) return next()
    res.setHeader('Cache-Control', 'no-store')
    if (result.setCookie) res.setHeader('Set-Cookie', result.setCookie)
    res.statusCode = result.status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result.body))
  }
  run().catch(() => next())
})
```

- [ ] **Step 5: Run test + lint + api typecheck**

Run:
```bash
npm test -- vite-plugins/admin-api-dev.test.ts
npm run lint
npm run typecheck:api
```
Expected: all PASS, 0 lint errors, clean typecheck. (`vite-plugins/` is covered by `tsconfig.node.json`; if the plugin's `import` of `../api/_lib/estimateHandler` trips a project-reference boundary in `tsc -b`, run `npx tsc -b` to confirm it still exits 0 — the plugin already imports `../api/_lib/handlers`, so the path is established.)

- [ ] **Step 6: Commit**

```bash
git add vite-plugins/admin-api-dev.ts vite-plugins/admin-api-dev.test.ts
git commit -m "feat(dev): serve /api/estimate from the dev server"
```

---

## Task 4: `EstimateForm` submits to `/api/estimate`

**Files:**
- Modify: `src/components/EstimateForm/EstimateForm.tsx`
- Modify: `src/components/EstimateForm/EstimateForm.test.tsx`
- Test (check, likely unchanged): `src/components/EstimateForm/triggers.test.tsx`

**Interfaces:**
- Consumes: nothing new (drops the `actions.addRequest` call)
- Produces: nothing

- [ ] **Step 1: Rewrite the submit tests**

In `src/components/EstimateForm/EstimateForm.test.tsx`:
- Remove the `RequestCount` helper and the two assertions that read `data.requests.length` (the "blocks submit… when required fields are empty" test can keep its structure but drop the count check — assert the error text still appears and no `fetch` happened).
- Add a `fetch` mock in `beforeEach`:
```ts
let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  localStorage.clear()
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())
```
- Replace the "submits a valid form and records a request" test with:
```ts
it('POSTs the form to /api/estimate and shows the thank-you panel', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('open form'))
  await user.type(screen.getByLabelText(/name/i), 'Jane Roe')
  await user.type(screen.getByLabelText(/email/i), 'jane@roe.com')
  await user.type(screen.getByLabelText(/message/i), 'We need a new site.')
  await user.click(screen.getByRole('button', { name: /send request/i }))

  expect(fetchMock).toHaveBeenCalledWith('/api/estimate', expect.objectContaining({
    method: 'POST',
    headers: expect.objectContaining({ 'content-type': 'application/json' }),
  }))
  const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
  expect(sent).toMatchObject({ name: 'Jane Roe', email: 'jane@roe.com', message: 'We need a new site.', locale: 'en' })
  expect(await screen.findByText(/thank you/i)).toBeInTheDocument()
})

it('shows an error and keeps the form when the request fails', async () => {
  const user = userEvent.setup()
  fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'insert_failed' }) })
  setup()
  await user.click(screen.getByText('open form'))
  await user.type(screen.getByLabelText(/name/i), 'Jane Roe')
  await user.type(screen.getByLabelText(/email/i), 'jane@roe.com')
  await user.type(screen.getByLabelText(/message/i), 'Hello there.')
  await user.click(screen.getByRole('button', { name: /send request/i }))

  expect(await screen.findByText(/something went wrong|could not send|try again/i)).toBeInTheDocument()
  expect(screen.queryByText(/thank you/i)).not.toBeInTheDocument()
})

it('does not call fetch when client validation fails', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByText('open form'))
  await user.click(screen.getByRole('button', { name: /send request/i }))
  expect(fetchMock).not.toHaveBeenCalled()
  expect(screen.getAllByText(/required/i).length).toBeGreaterThan(0)
})
```
- Keep all the a11y / focus / Escape tests unchanged.
- Update the `setup()` helper to drop `<RequestCount />` and the unused `useSiteContentRaw` import.

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test -- src/components/EstimateForm/EstimateForm.test.tsx`
Expected: the 3 new/changed tests FAIL (form still calls `actions.addRequest`, no `fetch`).

- [ ] **Step 3: Update `src/components/EstimateForm/EstimateForm.tsx`**

- Drop `actions` from the `useSiteContent()` destructure (keep `servicesHome`).
- Add state: `const [submitting, setSubmitting] = useState(false)` and `const [submitError, setSubmitError] = useState(false)`.
- Reset both in the `isOpen` effect alongside the other resets.
- Replace the body of `submit` after the validation block:
```ts
    setSubmitError(false)
    setSubmitting(true)
    try {
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim() || undefined,
          budget: budget || undefined,
          interestedIn: interested,
          message: message.trim(),
          locale: lang,
          sourcePage,
        }),
      })
      if (!res.ok) throw new Error('request_failed')
      setSent(true)
    } catch {
      setSubmitError(true)
    } finally {
      setSubmitting(false)
    }
```
  Make `submit` `async` and keep `e.preventDefault()` first.
- In the form JSX: disable the submit button while `submitting` (`disabled={submitting}`), and render an error line when `submitError` is true — reuse the existing `estimate-form__error` class, placed just above or below the submit button, e.g.:
```tsx
{submitError && (
  <p className="estimate-form__error" role="alert">
    Something went wrong — please try again.
  </p>
)}
```
  Keep the button label as "Send request" (optionally "Sending…" while `submitting` — match the pattern already used elsewhere in the codebase, e.g. `ImageUpload`'s "Reading…"). Do not restyle anything.

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm test -- src/components/EstimateForm/EstimateForm.test.tsx src/components/EstimateForm/triggers.test.tsx
```
Expected: all PASS. `triggers.test.tsx` should need no change (it only opens the modal); if it references `data.requests`, it does not — leave it alone.

- [ ] **Step 5: Lint + app typecheck**

Run:
```bash
npm run lint
npx tsc -p tsconfig.app.json --noEmit
```
Expected: 0 lint errors, clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/EstimateForm/EstimateForm.tsx src/components/EstimateForm/EstimateForm.test.tsx
git commit -m "feat(estimate): submit the form to /api/estimate"
```

---

## Task 5: Remote content fetch

**Files:**
- Create: `src/content/remote.ts`
- Test: `src/content/remote.test.ts`

**Interfaces:**
- Consumes: `getSupabase` (`src/content/supabaseClient.ts`); `rowsToSiteContent`, `SiteContent` (`src/content/mappers.ts`); `DbContentRows` (`src/content/dbTypes.ts`)
- Produces: `fetchRemoteContent(): Promise<SiteContent | null>`

- [ ] **Step 1: Write the failing test**

Create `src/content/remote.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const from = vi.fn()
const client = { from }
vi.mock('./supabaseClient', () => ({ getSupabase: () => clientOrNull }))

let clientOrNull: typeof client | null

import { fetchRemoteContent } from './remote'

const L = (s: string) => ({ en: s, uk: s })
const rowsByTable: Record<string, unknown[]> = {
  site_sections: [{ key: 'hero', eyebrow: L('E'), title: L('T'), body: L('B'), cta_label: null }],
  seo_pages: [{ page_key: 'home', path: '/', title: L('HT'), description: L('HD') }],
  projects: [
    { list: 'home', id: 'p1', sort: 0, published: true, title: L('P'), tags: [], description: L('d'),
      image_url: null, image_path: null, image_alt: L('a') },
  ],
  services: [
    { list: 'home', id: 's1', sort: 0, published: true, featured: false, title: L('S'), text: L('t'),
      icon_url: null, icon_path: null },
  ],
}

beforeEach(() => {
  clientOrNull = client
  from.mockReset()
  from.mockImplementation((table: string) => ({
    select: vi.fn().mockResolvedValue({ data: rowsByTable[table] ?? [], error: null }),
  }))
})

describe('fetchRemoteContent', () => {
  it('returns null when there is no client (unconfigured)', async () => {
    clientOrNull = null
    expect(await fetchRemoteContent()).toBeNull()
  })

  it('queries the 4 content tables and maps them to SiteContent', async () => {
    const c = await fetchRemoteContent()
    expect(from.mock.calls.map((a) => a[0]).sort()).toEqual(
      ['projects', 'seo_pages', 'services', 'site_sections'],
    )
    expect(c).not.toBeNull()
    expect(c!.sections[0].title).toEqual(L('T'))
    expect(c!.projectsHome).toHaveLength(1)
    expect(c!.servicesHome[0].id).toBe('s1')
  })

  it('returns null if any table query errors', async () => {
    from.mockImplementation((table: string) => ({
      select: vi.fn().mockResolvedValue(
        table === 'services' ? { data: null, error: { message: 'boom' } } : { data: [], error: null },
      ),
    }))
    expect(await fetchRemoteContent()).toBeNull()
  })

  it('returns null if the client throws', async () => {
    from.mockImplementation(() => { throw new Error('network') })
    expect(await fetchRemoteContent()).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/content/remote.test.ts`
Expected: FAIL — `Cannot find module './remote'`.

- [ ] **Step 3: Implement `src/content/remote.ts`**

```ts
import { getSupabase } from './supabaseClient'
import { rowsToSiteContent, type SiteContent } from './mappers'
import type {
  DbProjectRow,
  DbSeoRow,
  DbSectionRow,
  DbServiceRow,
} from './dbTypes'

/**
 * Reads the 4 public content tables via the anon client and maps them to the
 * `SiteContent` shape. Returns `null` on any failure (no client configured, a
 * query error, a thrown client) so the caller keeps the bundled defaults.
 */
export async function fetchRemoteContent(): Promise<SiteContent | null> {
  const client = getSupabase()
  if (!client) return null
  try {
    const [sections, seo, projects, services] = await Promise.all([
      client.from('site_sections').select('*'),
      client.from('seo_pages').select('*'),
      client.from('projects').select('*'),
      client.from('services').select('*'),
    ])
    if (sections.error || seo.error || projects.error || services.error) return null
    return rowsToSiteContent({
      sections: (sections.data ?? []) as DbSectionRow[],
      seo: (seo.data ?? []) as DbSeoRow[],
      projects: (projects.data ?? []) as DbProjectRow[],
      services: (services.data ?? []) as DbServiceRow[],
    })
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/content/remote.test.ts`
Expected: all PASS.

- [ ] **Step 5: Lint + app typecheck**

Run:
```bash
npm run lint
npx tsc -p tsconfig.app.json --noEmit
```
Expected: 0 lint errors, clean.

- [ ] **Step 6: Commit**

```bash
git add src/content/remote.ts src/content/remote.test.ts
git commit -m "feat(content): fetchRemoteContent — anon read of the 4 content tables"
```

---

## Task 6: `SiteContentProvider` overlays remote content on mount

**Files:**
- Modify: `src/content/SiteContentProvider.tsx`
- Modify: `src/content/SiteContentProvider.test.tsx`

**Interfaces:**
- Consumes: `fetchRemoteContent` (Task 5)
- Produces: nothing new (behavioural change only)

- [ ] **Step 1: Add the failing tests**

In `src/content/SiteContentProvider.test.tsx`:
- Add a mock for `./remote` at the top:
```ts
import { vi } from 'vitest'
const fetchRemoteContent = vi.fn()
vi.mock('./remote', () => ({ fetchRemoteContent: () => fetchRemoteContent() }))
```
- In `beforeEach`, `fetchRemoteContent.mockResolvedValue(null)` (default: no remote → behaves exactly as today, so the existing 4 tests keep passing).
- Add:
```ts
it('overlays remote content over the seeded defaults once it resolves', async () => {
  fetchRemoteContent.mockResolvedValue({
    sections: [
      { key: 'hero', label: 'Hero', eyebrow: { en: '', uk: '' },
        title: { en: 'From Supabase', uk: 'From Supabase' }, body: { en: '', uk: '' } },
    ],
    seo: [], projectsHome: [], projectsPage: [], servicesHome: [], servicesPage: [],
  })
  wrap()
  expect(await screen.findByText('From Supabase')).toBeInTheDocument()
})

it('keeps the seeded content when the remote fetch returns null', async () => {
  fetchRemoteContent.mockResolvedValue(null)
  wrap()
  // let the effect settle
  await act(async () => {})
  expect(screen.getByTestId('hero-title').textContent).toBeTruthy()
  expect(screen.queryByText('From Supabase')).not.toBeInTheDocument()
})

it('does not overlay after unmount', async () => {
  let resolve!: (v: unknown) => void
  fetchRemoteContent.mockReturnValue(new Promise((r) => { resolve = r }))
  const { unmount } = wrap()
  unmount()
  resolve({ sections: [], seo: [], projectsHome: [], projectsPage: [], servicesHome: [], servicesPage: [] })
  await act(async () => {})
  // no throw / no "state update on unmounted component" warning
})
```
- The existing test "applies an edit and persists it to localStorage" must still pass — the overlay only runs once on mount with the mocked `null`, so local edits + persistence are untouched.

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test -- src/content/SiteContentProvider.test.tsx`
Expected: the 3 new tests FAIL (no overlay effect yet); the 4 original tests PASS.

- [ ] **Step 3: Update `src/content/SiteContentProvider.tsx`**

Add an import and one effect. Do **not** change `useState(loadAdminData)`, the persist effect, the cross-tab `storage` effect, `actions`, or the context value.

```ts
import { fetchRemoteContent } from './remote'
```

Inside `SiteContentProvider`, after the existing effects:
```ts
  // On mount, pull the managed content from Supabase and overlay it on top of
  // the seeded/persisted defaults. Failure (no env, offline, query error) is a
  // no-op — the bundled content stays. Admin write-through is Plan 3.
  useEffect(() => {
    let cancelled = false
    void fetchRemoteContent().then((remote) => {
      if (cancelled || !remote) return
      skipNextPersist.current = true
      setData((d) => ({ ...d, ...remote }))
    })
    return () => {
      cancelled = true
    }
  }, [])
```

Notes:
- `skipNextPersist.current = true` before the overlay `setData` so the remote content is not written straight back into the `onvorx.admin.v1` localStorage blob (it is not a user edit). This reuses the existing ref the cross-tab handler uses.
- `{ ...d, ...remote }` overlays exactly the 6 `SiteContent` keys (`sections`, `seo`, `projectsHome`, `projectsPage`, `servicesHome`, `servicesPage`) and leaves `version`, `updatedAt`, `requests` from `d`.

- [ ] **Step 4: Run the full provider + content suite**

Run:
```bash
npm test -- src/content/
```
Expected: all PASS (the 4 original provider tests, the 3 new ones, remote, mappers, persistence, useSiteContent).

- [ ] **Step 5: Lint + app typecheck + build**

Run:
```bash
npm run lint
npx tsc -p tsconfig.app.json --noEmit
npm run build
```
Expected: 0 lint errors, clean typecheck, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/content/SiteContentProvider.tsx src/content/SiteContentProvider.test.tsx
git commit -m "feat(content): overlay Supabase content on mount"
```

---

## Task 7: Integration verification (dev server + live Supabase)

**Files:** none (verification only). No commit unless a fix is needed.

This task needs `.env.local` with the real Supabase values (already present) and the dev server running.

- [ ] **Step 1: Full local gate**

Run:
```bash
npm test
npm run lint
npx tsc -p tsconfig.app.json --noEmit
npm run typecheck:api
npm run build
```
Expected: all green. Record the test count.

- [ ] **Step 2: Content reads from Supabase**

- `npm run dev`, open `http://localhost:5173/`.
- In the Supabase SQL Editor, edit one visible value, e.g.:
  ```sql
  update site_sections
  set title = '{"en":"PLAN 2 LIVE CHECK","uk":"PLAN 2 LIVE CHECK"}'
  where key = 'hero';
  ```
- Reload the page. The hero heading shows **PLAN 2 LIVE CHECK** (defaults show for a frame, then the overlay swaps it in).
- Revert:
  ```sql
  update site_sections
  set title = '{"en":"Web solutions built around your business requirements","uk":"Web solutions built around your business requirements"}'
  where key = 'hero';
  ```
  (Or re-run `supabase/seed.sql` — it is safe here since no `/admin` edits exist yet.)

- [ ] **Step 3: Estimate form writes to Supabase**

- With `npm run dev` running, submit the "Request an Estimate" form on the site (fill name/email/message).
- Expect the "Thank you" panel.
- Verify the row landed:
  ```sql
  select id, created_at, status, name, email, locale, source_page, interested_in
  from estimate_requests order by created_at desc limit 3;
  ```
  One new row, `status = 'new'`.
- Direct API check:
  ```bash
  curl -sS -X POST http://localhost:5173/api/estimate \
    -H 'content-type: application/json' \
    -d '{"name":"Curl Test","email":"curl@test.dev","message":"hello from curl","locale":"en"}'
  # → {"ok":true}
  curl -sS -X POST http://localhost:5173/api/estimate \
    -H 'content-type: application/json' -d '{"name":""}'
  # → {"error":"invalid_request"}  (HTTP 400)
  curl -sS http://localhost:5173/api/estimate
  # → {"error":"method_not_allowed"}  (HTTP 405)
  ```
- Clean up the test rows:
  ```sql
  delete from estimate_requests where email in ('curl@test.dev') or name = 'Curl Test';
  ```
  (Leave a genuine form-submitted row if you want it for the Plan 3 Requests screen; otherwise delete it too.)

- [ ] **Step 4: Offline / unconfigured degradation**

- Temporarily rename `.env.local` → `.env.local.bak`, restart `npm run dev`, reload `/`. The site still renders (bundled defaults); the form submit shows the error line (no `/api/estimate` env). Restore `.env.local`.

- [ ] **Step 5: Record results in the plan / ledger**

Note the test count, the three curl results, and confirmation that the hero text round-tripped. If anything failed, stop and fix it in the relevant task before marking Plan 2 done.

---

## Self-review — spec coverage

| Spec section | Covered by |
|---|---|
| §7.1 provider inits with defaults, instant paint | Existing `useState(loadAdminData)` — unchanged; Task 6 overlays after |
| §7.2 `useEffect` → anon client selects 4 tables → `AdminData` shape | Task 5 (`fetchRemoteContent`) + Task 6 (overlay) |
| §7.3 success → `setData`; failure → keep defaults | Task 5 returns `null` on any error; Task 6 no-ops on `null` |
| §7.4 revalidate on focus / after admin save | **Deferred to Plan 3** — pairs with the write path; Plan 2 does mount-only load (see Global Constraints) |
| §7.5 sections + `DocumentHead` consume `useSiteContent()` unchanged | Not touched — verified in Task 7 step 2 |
| §7.6 `estimate_requests` never read by the browser | `fetchRemoteContent` only selects the 4 content tables |
| §7 cache key `onvorx.content.cache.v2` | **Deferred to Plan 3** — Plan 2 keeps the existing `onvorx.admin.v1` working store; a dedicated remote-content cache is added when the write path lands and the `AdminData` reshape happens |
| §9.4 `api/estimate.ts` public POST, validate + insert via service role | Tasks 1–2 |
| §9.5 `EstimateForm` → `POST /api/estimate` | Task 4 |
| §9.5 `vite-plugins/admin-api-dev.ts` routes the new endpoint | Task 3 |
| §9.1 `@supabase/supabase-js` dependency | Already added in Plan 1 |

### Deliberately deferred to Plan 3
- `SiteContentProvider` focus-refetch + refetch-after-save (needs the write path).
- The `onvorx.content.cache.v2` localStorage cache + the `AdminData` reshape (drop `requests`).
- `useRequests()` hook; `RequestsPage` / `DashboardPage` / `SettingsPage` rewire (they still read `data.requests`, which is now always empty on the public site and stale-from-seed in `/admin` — harmless until Plan 3).
- `actions.*` write-through to Supabase; optimistic + error refetch.
- Image upload (`/api/admin/upload`), `/api/admin/{content,cards,requests}`.
- Carried from Plan 1: `scripts/gen-seed.ts` `'upload'`-branch `image_path` derivation.

### Notes for the executor
- The provider overlay uses `{ ...d, ...remote }`. `SiteContent` and `AdminData` share exact key names for the 6 content fields — confirm against `src/admin/types.ts` (`AdminData`) and `src/content/mappers.ts` (`SiteContent`) before implementing Task 6; if a key ever diverges, map explicitly.
- `api/_lib/estimateHandler.ts` imports `./supabaseAdmin` which imports `@supabase/supabase-js`. The dev plugin imports the handler, so `npm run dev` now pulls `@supabase/supabase-js` into the dev server process — expected, no action.
- After Task 4, `@supabase/supabase-js` enters the **browser bundle** (via `SiteContentProvider` → `remote.ts` → `supabaseClient.ts`). That is intentional (runtime read). If `npm run build` reports a large-chunk warning, note it — do not code-split in this plan.
- The client sends `interestedIn`, `sourcePage`, `budget` as `undefined` when unset (JSON drops them); `validateEstimate` treats missing as empty. Keep that contract.
- `EstimateForm`'s existing client-side validation (name/email/message required, email regex) stays as the first gate — `fetch` only fires when it passes.
