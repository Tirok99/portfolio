# Supabase Integration — Plan 3: Admin write path

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every `/admin` edit persists to Supabase for all visitors: section texts, per-page SEO, project/service cards (with image upload to Storage), and estimate-request triage. The `/admin` UI and public site design do not change.

**Architecture:** New authenticated serverless functions under `api/admin/*` (session-cookie gate + service-role client) do the writes. `SiteContentProvider`'s `actions.*` become optimistic: they apply the existing pure reducer locally for an instant UI, then call the matching endpoint; on failure they refetch to revert and re-throw. Estimate requests leave the content store entirely — a dedicated `useRequests()` hook reads/writes them through `/api/admin/requests`. Images are uploaded as base64 JSON (no multipart), stored in the `public-media` bucket, and referenced by URL + object path on the card row. A `onvorx.content.cache.v2` localStorage cache gives instant repeat-visit paint; the provider also refetches on window focus and (debounced) after writes.

**Tech Stack:** Vite 8 + React 19, TypeScript (strict), Vitest + Testing Library, Playwright e2e, `@vercel/node` serverless functions (CJS-scoped via `api/package.json`), `@supabase/supabase-js` v2, Supabase (Postgres + Storage).

**Spec:** [docs/superpowers/specs/2026-09-09-supabase-integration-design.md](../specs/2026-09-09-supabase-integration-design.md) — §8, §9.3, §9.4.

**Depends on:** Plans 1 (`07e1035`) and 2 (`9f83f95`), merged on branch `feature/supabase-integration`. Supabase project `ovbcjgfvtetktwmtxarf` provisioned; `.env.local` has `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; the 4 vars are also set in Vercel (Production + Preview). The `public-media` Storage bucket **must be created before Task 6** (public bucket, 2 MB limit, MIME `image/png,image/jpeg,image/webp,image/svg+xml`) — see `supabase/STORAGE.md`.

## Global Constraints

- Node `22.x` (`engines`), CI on `22.12`. Local may be newer.
- Repo root is `"type": "module"`; `api/` is CJS via `api/package.json` — **do not touch that file**. Under `api/`: `import type` for type-only imports, no `.json` imports, no unused symbols (`verbatimModuleSyntax` + `erasableSyntaxOnly` + `noUnusedLocals/Parameters`).
- Existing helpers to reuse (do not reimplement): `requireSession(cookieHeader: string | undefined, env: AuthEnv): boolean` (`api/_lib/handlers.ts`); `getSupabaseAdmin(env: SupabaseAdminEnv): SupabaseClient | null` (`api/_lib/supabaseAdmin.ts`); `send(res, result: HandlerResult)` and `isSecure(req)` (`api/_lib/vercel-adapter.ts`); `rowsToSiteContent` and the `SiteContent` type (`src/content/mappers.ts`); `fetchRemoteContent()` (`src/content/remote.ts`); `newId(prefix)` (`src/admin/lib/id.ts`); `buildDefaults()` (`src/content/defaults/index.ts`); `blankProjectCard(order)` / `blankServiceCard(order)` and the pure reducers in `src/admin/actions.ts`.
- `HandlerResult` = `{ status: number; body: unknown; setCookie?: string }`.
- Auth: every `api/admin/*` mutation calls `requireSession(req.headers.cookie, env)` first; on `false` return `{ status: 401, body: { error: 'unauthorized' } }`. `env` for these needs `ADMIN_SESSION_SECRET` (auth) **and** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (writes). Pass a combined `AuthEnv & SupabaseAdminEnv`.
- DB column names & enums (verbatim from `supabase/schema.sql`):
  - `site_sections(key, eyebrow, title, body, cta_label)` — `key in ('hero','services','projects','howWork','about','cta')`; translatable cols are `jsonb {en,uk}`.
  - `seo_pages(page_key, path, title, description)` — `page_key in ('home','services','projects','about','web-development','support','business-analysis','google-ads')`.
  - `projects(list, id, sort, published, title, tags, description, image_url, image_path, image_alt)` — PK `(list, id)`; `list in ('home','page')`; `tags text[]`.
  - `services(list, id, sort, published, featured, title, text, icon_url, icon_path)` — PK `(list, id)`; `list in ('home','page')`.
  - `estimate_requests(id, created_at, status, name, email, company, budget, interested_in, message, locale, source_page, note, updated_at)` — `status in ('new','in_progress','done','archived')`.
- The admin list keys (`CardListKey`) are `projectsHome | projectsPage | servicesHome | servicesPage`; the DB `(type, list)` is `('project'|'service', 'home'|'page')`. Map: `projectsHome → (project, home)`, `servicesPage → (service, page)`, etc.
- **Do not change the `/admin` UI layout, component markup, or the public site design.** Behaviour changes only (async saves, a "Save failed" toast on error).
- **Do not add** rate-limiting/honeypot to `/api/estimate`, code-split `@supabase/supabase-js`, or touch i18n of the estimate error string — all **Plan 4**.
- Vercel Hobby: max 12 serverless functions. Currently 4 (`login`, `session`, `logout`, `estimate`); this plan adds 4 (`content`, `cards`, `requests`, `upload`) → 8.
- `src/test/setup.ts` blanks `VITE_SUPABASE_URL`/`ANON_KEY` for all tests. Tests here that need a configured browser client must `vi.stubEnv` them back in their own `beforeEach`, or (preferred) mock `../content/remote` / `./api` directly.
- Tests live next to source as `*.test.ts(x)`; `npm test` (Vitest, `e2e/**` excluded), `npm run e2e` (Playwright), `npm run lint` (oxlint, 0 errors), `npx tsc -p tsconfig.app.json --noEmit`, `npm run typecheck:api`, `npm run build` — **all must stay green, and `npm run e2e` is part of every task's gate that touches `src/` or `api/`.**

---

## File structure (this plan)

| File | Responsibility |
|---|---|
| `api/_lib/adminRows.ts` | pure row⇔domain mappers for writes: `sectionRow`, `seoRow`, `projectRow`, `serviceRow` (domain → DB row), `estimateFromRow` (DB row → `EstimateRequest`); + small field validators |
| `api/_lib/adminContentHandler.ts` | `handleAdminContent({ method, cookieHeader, body }, env)` — PUT one section, PUT one SEO entry, POST `reset` (upsert a whole `SiteContent` payload) |
| `api/_lib/adminCardsHandler.ts` | `handleAdminCards({ method, cookieHeader, query, body }, env)` — create / update / delete / reorder a project or service card; delete also removes its Storage object |
| `api/_lib/adminRequestsHandler.ts` | `handleAdminRequests({ method, cookieHeader, body }, env)` — GET list, PATCH `{ id, status? , note? }`, DELETE `{ id }` |
| `api/_lib/adminUploadHandler.ts` | `handleAdminUpload({ method, cookieHeader, body }, env)` — POST `{ dataUrl, fileName, folder }` → Storage upload → `{ url, path }`; DELETE `{ path }` |
| `api/admin/content.ts`, `api/admin/cards.ts`, `api/admin/requests.ts`, `api/admin/upload.ts` | thin Vercel adapters |
| `vite-plugins/admin-api-dev.ts` | route the 4 new `/api/admin/*` paths in `dispatchApi` |
| `src/admin/api.ts` | typed client wrappers over `/api/admin/*` (`credentials: 'same-origin'`); throws on non-2xx |
| `src/admin/hooks/useRequests.ts` | request inbox state: list + `setStatus` / `setNote` / `remove` / `reload`, optimistic with revert |
| `src/content/contentCache.ts` | `loadContentCache()` / `saveContentCache(c)` for `onvorx.content.cache.v2` |
| `src/content/SiteContentProvider.tsx` | `actions.*` → async optimistic + `src/admin/api` calls + revert-on-error; add `refetch()` to context; focus + debounced-post-write refetch; init from cache |
| `src/admin/types.ts` | `AdminData` loses `requests`; `ImageRef` gains `path?: string` |
| `src/content/defaults/index.ts` | `buildDefaults()` drops `requests` |
| `src/content/persistence.ts` | `seedAdminData` / `isAdminData` drop `requests` |
| `src/admin/actions.ts` | drop `addRequest` / `setRequestStatus` / `setRequestNote` / `removeRequest`; `resetAll` stops seeding requests |
| `src/admin/pages/{ContentPage,SeoPage,ProjectsPage,ServicesPage,SettingsPage}.tsx` | `await` the async actions; `.catch` → `toast('Save failed', 'error')`; Requests screens use `useRequests()` |
| `src/admin/pages/{RequestsPage,DashboardPage}.tsx` | read requests from `useRequests()` not `data.requests` |
| `src/admin/components/ImageUpload.tsx` | on file pick → upload via `src/admin/api` → `onChange({ kind:'upload', src:url, path })` |
| `e2e/admin.spec.ts` | restore the "estimate appears in the inbox" assertion via the real (route-mocked) flow; add a section-edit-persists check |

**Not touched:** `src/content/mappers.ts` (read direction), `src/content/remote.ts` (except a possible re-export), `src/sections/**`, `src/components/DocumentHead/**`, `src/components/EstimateForm/**` (Plan 2 done), `api/_lib/{handlers,session,estimate,estimateHandler,vercel-adapter}.ts`, `api/estimate.ts`, `api/admin/{login,session,logout}.ts`, `supabase/*.sql`, `vercel.json`, `api/package.json`.

### Interfaces produced by this plan

```ts
// api/_lib/adminRows.ts
import type { L } from '../../src/admin/types'  // NOTE: see "Notes for the executor" re: this import
export interface SectionWrite { key: string; eyebrow?: L; title?: L; body?: L; cta_label?: L }
export interface SeoWrite { page_key: string; title?: L; description?: L }
export interface CardWrite { /* project or service row minus updated_at; see task 3 */ }
export function estimateFromRow(row: Record<string, unknown>): EstimateRequestDTO
export interface EstimateRequestDTO {
  id: string; createdAt: string; status: string; name: string; email: string
  company?: string; budget?: string; interestedIn: string[]; message: string
  locale: string; sourcePage?: string; note?: string
}

// api/_lib/adminContentHandler.ts
export function handleAdminContent(
  input: { method: string; cookieHeader: string | undefined; body: unknown },
  env: AuthEnv & SupabaseAdminEnv,
  deps?: AdminContentDeps,
): Promise<HandlerResult>

// api/_lib/adminCardsHandler.ts
export function handleAdminCards(
  input: { method: string; cookieHeader: string | undefined; query: Record<string,string|undefined>; body: unknown },
  env: AuthEnv & SupabaseAdminEnv,
  deps?: AdminCardsDeps,
): Promise<HandlerResult>

// api/_lib/adminRequestsHandler.ts
export function handleAdminRequests(
  input: { method: string; cookieHeader: string | undefined; body: unknown },
  env: AuthEnv & SupabaseAdminEnv,
  deps?: AdminRequestsDeps,
): Promise<HandlerResult>

// api/_lib/adminUploadHandler.ts
export function handleAdminUpload(
  input: { method: string; cookieHeader: string | undefined; body: unknown },
  env: AuthEnv & SupabaseAdminEnv,
  deps?: AdminUploadDeps,
): Promise<HandlerResult>

// src/admin/api.ts
export const adminApi: {
  saveSection(key: SectionKey, patch: Partial<Pick<SectionText,'eyebrow'|'title'|'body'|'ctaLabel'>>): Promise<void>
  saveSeo(pageKey: SeoPageKey, patch: Partial<Pick<SeoEntry,'title'|'description'>>): Promise<void>
  resetContent(content: SiteContent): Promise<void>
  createCard(type: 'project'|'service', list: 'home'|'page', card: ProjectCard | ServiceCard): Promise<void>
  updateCard(type: 'project'|'service', list: 'home'|'page', id: string, patch: Record<string, unknown>): Promise<void>
  deleteCard(type: 'project'|'service', list: 'home'|'page', id: string): Promise<void>
  reorderCards(type: 'project'|'service', list: 'home'|'page', orderedIds: string[]): Promise<void>
  uploadImage(folder: 'projects'|'services', dataUrl: string, fileName: string): Promise<{ url: string; path: string }>
  deleteImage(path: string): Promise<void>
  listRequests(): Promise<EstimateRequest[]>
  setRequestStatus(id: string, status: RequestStatus): Promise<void>
  setRequestNote(id: string, note: string): Promise<void>
  deleteRequest(id: string): Promise<void>
}

// src/admin/hooks/useRequests.ts
export function useRequests(): {
  requests: EstimateRequest[] | null
  error: boolean
  reload: () => Promise<void>
  setStatus: (id: string, status: RequestStatus) => Promise<void>
  setNote: (id: string, note: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

// src/content/SiteContentProvider.tsx — SiteContentActions: all methods → Promise<void>,
// drop the 4 request methods, add: refetch: () => Promise<void>
```

---

## Task 1: Server row mappers + validators

**Files:**
- Create: `api/_lib/adminRows.ts`
- Test: `api/_lib/adminRows.test.ts`

**Interfaces:**
- Consumes: `L` type
- Produces: `sectionRow`, `seoRow`, `projectRow`, `serviceRow`, `estimateFromRow`, `EstimateRequestDTO`, `isL`, `isSectionKey`, `isSeoPageKey`, `isCardList`

- [ ] **Step 1: Write the failing test**

Create `api/_lib/adminRows.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  sectionRow, seoRow, projectRow, serviceRow, estimateFromRow,
  isL, isSectionKey, isSeoPageKey,
} from './adminRows'

const L = (en: string, uk = en) => ({ en, uk })

describe('validators', () => {
  it('isL accepts {en,uk} strings only', () => {
    expect(isL(L('a'))).toBe(true)
    expect(isL({ en: 'a' })).toBe(false)
    expect(isL({ en: 1, uk: 2 })).toBe(false)
    expect(isL(null)).toBe(false)
  })
  it('isSectionKey / isSeoPageKey gate the enums', () => {
    expect(isSectionKey('howWork')).toBe(true)
    expect(isSectionKey('nope')).toBe(false)
    expect(isSeoPageKey('business-analysis')).toBe(true)
    expect(isSeoPageKey('nope')).toBe(false)
  })
})

describe('sectionRow', () => {
  it('keeps only provided translatable fields, maps ctaLabel → cta_label', () => {
    expect(sectionRow('hero', { title: L('T'), ctaLabel: L('Go') })).toEqual({
      title: L('T'), cta_label: L('Go'),
    })
  })
  it('drops non-L values', () => {
    expect(sectionRow('hero', { title: 'bad' as never, body: L('B') })).toEqual({ body: L('B') })
  })
})

describe('seoRow', () => {
  it('maps title/description', () => {
    expect(seoRow({ title: L('T'), description: L('D') })).toEqual({ title: L('T'), description: L('D') })
  })
})

describe('projectRow', () => {
  it('maps a full ProjectCard-shaped patch to snake_case incl. image + tags', () => {
    expect(
      projectRow({
        title: L('P'), description: L('d'), imageAlt: L('a'), tags: ['x', 'y'],
        published: true, order: 3,
        image: { kind: 'upload', src: 'https://cdn/x.webp', path: 'projects/x.webp' },
      }),
    ).toEqual({
      title: L('P'), description: L('d'), image_alt: L('a'), tags: ['x', 'y'],
      published: true, sort: 3, image_url: 'https://cdn/x.webp', image_path: 'projects/x.webp',
    })
  })
  it('image with no path → image_path null', () => {
    expect(projectRow({ image: { kind: 'asset', src: '/assets/x.png' } })).toEqual({
      image_url: '/assets/x.png', image_path: null,
    })
  })
  it('ignores unknown keys', () => {
    expect(projectRow({ bogus: 1 } as never)).toEqual({})
  })
})

describe('serviceRow', () => {
  it('maps text/featured/icon', () => {
    expect(
      serviceRow({ text: L('t'), featured: true, published: false, order: 1,
        icon: { kind: 'upload', src: 'https://cdn/i.png', path: 'services/i.png' } }),
    ).toEqual({
      text: L('t'), featured: true, published: false, sort: 1,
      icon_url: 'https://cdn/i.png', icon_path: 'services/i.png',
    })
  })
})

describe('estimateFromRow', () => {
  it('maps a DB row to the camelCase DTO, dropping empty optionals', () => {
    expect(estimateFromRow({
      id: 'r1', created_at: '2026-01-01T00:00:00Z', status: 'new',
      name: 'A', email: 'a@b.c', company: null, budget: '1-3k',
      interested_in: ['web-development'], message: 'hi', locale: 'en',
      source_page: '/', note: null,
    })).toEqual({
      id: 'r1', createdAt: '2026-01-01T00:00:00Z', status: 'new',
      name: 'A', email: 'a@b.c', budget: '1-3k',
      interestedIn: ['web-development'], message: 'hi', locale: 'en', sourcePage: '/',
    })
  })
})
```

- [ ] **Step 2: Run → fail** — `npm test -- api/_lib/adminRows.test.ts` → `Cannot find module './adminRows'`.

- [ ] **Step 3: Implement `api/_lib/adminRows.ts`**

```ts
export interface L { en: string; uk: string }

const SECTION_KEYS = ['hero', 'services', 'projects', 'howWork', 'about', 'cta'] as const
const SEO_KEYS = [
  'home', 'services', 'projects', 'about',
  'web-development', 'support', 'business-analysis', 'google-ads',
] as const

export const isL = (v: unknown): v is L =>
  typeof v === 'object' && v !== null &&
  typeof (v as Record<string, unknown>).en === 'string' &&
  typeof (v as Record<string, unknown>).uk === 'string'

export const isSectionKey = (v: unknown): boolean =>
  typeof v === 'string' && (SECTION_KEYS as readonly string[]).includes(v)
export const isSeoPageKey = (v: unknown): boolean =>
  typeof v === 'string' && (SEO_KEYS as readonly string[]).includes(v)
export const isCardList = (v: unknown): v is 'home' | 'page' => v === 'home' || v === 'page'
export const isCardType = (v: unknown): v is 'project' | 'service' => v === 'project' || v === 'service'

type Patch = Record<string, unknown>

/** section patch → DB column subset. Only well-typed L fields survive. */
export function sectionRow(_key: string, patch: Patch): Patch {
  const out: Patch = {}
  if (isL(patch.eyebrow)) out.eyebrow = patch.eyebrow
  if (isL(patch.title)) out.title = patch.title
  if (isL(patch.body)) out.body = patch.body
  if (isL(patch.ctaLabel)) out.cta_label = patch.ctaLabel
  return out
}

export function seoRow(patch: Patch): Patch {
  const out: Patch = {}
  if (isL(patch.title)) out.title = patch.title
  if (isL(patch.description)) out.description = patch.description
  return out
}

interface ImageRefLike { kind?: string; src?: unknown; path?: unknown }
const imageCols = (img: ImageRefLike, urlCol: string, pathCol: string): Patch => {
  const out: Patch = {}
  if (typeof img.src === 'string') out[urlCol] = img.src || null
  out[pathCol] = typeof img.path === 'string' && img.path ? img.path : null
  return out
}

export function projectRow(patch: Patch): Patch {
  const out: Patch = {}
  if (isL(patch.title)) out.title = patch.title
  if (isL(patch.description)) out.description = patch.description
  if (isL(patch.imageAlt)) out.image_alt = patch.imageAlt
  if (Array.isArray(patch.tags) && patch.tags.every((t) => typeof t === 'string')) out.tags = patch.tags
  if (typeof patch.published === 'boolean') out.published = patch.published
  if (typeof patch.order === 'number') out.sort = patch.order
  if (patch.image && typeof patch.image === 'object') Object.assign(out, imageCols(patch.image as ImageRefLike, 'image_url', 'image_path'))
  return out
}

export function serviceRow(patch: Patch): Patch {
  const out: Patch = {}
  if (isL(patch.title)) out.title = patch.title
  if (isL(patch.text)) out.text = patch.text
  if (typeof patch.featured === 'boolean') out.featured = patch.featured
  if (typeof patch.published === 'boolean') out.published = patch.published
  if (typeof patch.order === 'number') out.sort = patch.order
  if (patch.icon && typeof patch.icon === 'object') Object.assign(out, imageCols(patch.icon as ImageRefLike, 'icon_url', 'icon_path'))
  return out
}

export interface EstimateRequestDTO {
  id: string; createdAt: string; status: string; name: string; email: string
  company?: string; budget?: string; interestedIn: string[]; message: string
  locale: string; sourcePage?: string; note?: string
}

export function estimateFromRow(row: Record<string, unknown>): EstimateRequestDTO {
  const s = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    status: String(row.status),
    name: String(row.name ?? ''),
    email: String(row.email ?? ''),
    company: s(row.company),
    budget: s(row.budget),
    interestedIn: Array.isArray(row.interested_in) ? (row.interested_in as string[]) : [],
    message: String(row.message ?? ''),
    locale: String(row.locale ?? 'en'),
    sourcePage: s(row.source_page),
    note: s(row.note),
  }
}
```

- [ ] **Step 4: Run → pass.** `npm test -- api/_lib/adminRows.test.ts`

- [ ] **Step 5:** `npm run lint` (0), `npm run typecheck:api` (clean).

- [ ] **Step 6: Commit** — `git commit -m "feat(admin-api): row mappers + validators for writes"`

---

## Task 2: `/api/admin/content` — section, SEO, reset

**Files:**
- Create: `api/_lib/adminContentHandler.ts`, `api/_lib/adminContentHandler.test.ts`
- Create: `api/admin/content.ts`
- Modify: `vite-plugins/admin-api-dev.ts`, `vite-plugins/admin-api-dev.test.ts`

**Interfaces:**
- Consumes: `requireSession`, `getSupabaseAdmin`, `sectionRow`/`seoRow`/`isSectionKey`/`isSeoPageKey` (Task 1), `send`
- Produces: `handleAdminContent`, `AdminContentDeps`

- [ ] **Step 1: Write the failing test**

Create `api/_lib/adminContentHandler.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { handleAdminContent } from './adminContentHandler'
import { signToken, SESSION_COOKIE } from './session'

const SECRET = 'secret-secret-secret-secret-secret-secret'
const ENV = { ADMIN_SESSION_SECRET: SECRET, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' }
const cookie = `${SESSION_COOKIE}=${signToken(SECRET)}`
const L = (s: string) => ({ en: s, uk: s })

const okDeps = () => ({
  updateSection: vi.fn().mockResolvedValue({ error: null }),
  updateSeo: vi.fn().mockResolvedValue({ error: null }),
  resetAll: vi.fn().mockResolvedValue({ error: null }),
})

describe('handleAdminContent', () => {
  it('401 without a valid session', async () => {
    const r = await handleAdminContent({ method: 'PUT', cookieHeader: undefined, body: {} }, ENV, okDeps())
    expect(r.status).toBe(401)
  })
  it('405 on an unsupported method', async () => {
    const r = await handleAdminContent({ method: 'GET', cookieHeader: cookie, body: {} }, ENV, okDeps())
    expect(r.status).toBe(405)
  })
  it('PUT a section: validates key + patch, calls updateSection with the row', async () => {
    const deps = okDeps()
    const r = await handleAdminContent(
      { method: 'PUT', cookieHeader: cookie, body: { kind: 'section', key: 'hero', patch: { title: L('New') } } },
      ENV, deps,
    )
    expect(r.status).toBe(200)
    expect(deps.updateSection).toHaveBeenCalledWith('hero', { title: L('New') }, ENV)
  })
  it('PUT a section with a bad key → 400', async () => {
    const r = await handleAdminContent(
      { method: 'PUT', cookieHeader: cookie, body: { kind: 'section', key: 'bogus', patch: { title: L('x') } } },
      ENV, okDeps(),
    )
    expect(r.status).toBe(400)
  })
  it('PUT a seo entry → updateSeo', async () => {
    const deps = okDeps()
    await handleAdminContent(
      { method: 'PUT', cookieHeader: cookie, body: { kind: 'seo', pageKey: 'home', patch: { description: L('D') } } },
      ENV, deps,
    )
    expect(deps.updateSeo).toHaveBeenCalledWith('home', { description: L('D') }, ENV)
  })
  it('POST reset → resetAll with the content payload', async () => {
    const deps = okDeps()
    const content = { sections: [], seo: [], projectsHome: [], projectsPage: [], servicesHome: [], servicesPage: [] }
    const r = await handleAdminContent({ method: 'POST', cookieHeader: cookie, body: { op: 'reset', content } }, ENV, deps)
    expect(r.status).toBe(200)
    expect(deps.resetAll).toHaveBeenCalledWith(content, ENV)
  })
  it('500 when a dep reports an error', async () => {
    const deps = okDeps()
    deps.updateSection.mockResolvedValue({ error: 'boom' })
    const r = await handleAdminContent(
      { method: 'PUT', cookieHeader: cookie, body: { kind: 'section', key: 'hero', patch: { title: L('x') } } },
      ENV, deps,
    )
    expect(r.status).toBe(500)
  })
  it('500 when SUPABASE env missing', async () => {
    const r = await handleAdminContent(
      { method: 'PUT', cookieHeader: cookie, body: { kind: 'section', key: 'hero', patch: { title: L('x') } } },
      { ADMIN_SESSION_SECRET: SECRET }, okDeps(),
    )
    expect(r.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `api/_lib/adminContentHandler.ts`**

```ts
import type { HandlerResult, AuthEnv, SupabaseAdminEnv } from './types'
import { requireSession } from './handlers'
import { getSupabaseAdmin } from './supabaseAdmin'
import { sectionRow, seoRow, isSectionKey, isSeoPageKey } from './adminRows'

type Env = AuthEnv & SupabaseAdminEnv
interface DepResult { error: string | null }
export interface AdminContentDeps {
  updateSection: (key: string, patch: Record<string, unknown>, env: Env) => Promise<DepResult>
  updateSeo: (pageKey: string, patch: Record<string, unknown>, env: Env) => Promise<DepResult>
  resetAll: (content: unknown, env: Env) => Promise<DepResult>
}

const defaultDeps: AdminContentDeps = {
  updateSection: async (key, patch, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { error: 'not_configured' }
    const { error } = await c.from('site_sections').update(patch).eq('key', key)
    return { error: error ? error.message : null }
  },
  updateSeo: async (pageKey, patch, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { error: 'not_configured' }
    const { error } = await c.from('seo_pages').update(patch).eq('page_key', pageKey)
    return { error: error ? error.message : null }
  },
  resetAll: async (content, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { error: 'not_configured' }
    // implemented in a follow-up step of this task — see Step 3b
    const { resetContent } = await import('./adminReset')
    return resetContent(c, content)
  },
}

const ok = (): HandlerResult => ({ status: 200, body: { ok: true } })
const bad = (): HandlerResult => ({ status: 400, body: { error: 'invalid_request' } })
const fail = (): HandlerResult => ({ status: 500, body: { error: 'write_failed' } })

export async function handleAdminContent(
  input: { method: string; cookieHeader: string | undefined; body: unknown },
  env: Env,
  deps: AdminContentDeps = defaultDeps,
): Promise<HandlerResult> {
  if (!requireSession(input.cookieHeader, env)) return { status: 401, body: { error: 'unauthorized' } }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { status: 500, body: { error: 'not_configured' } }

  const body = (input.body ?? {}) as Record<string, unknown>

  if (input.method === 'PUT' && body.kind === 'section') {
    if (!isSectionKey(body.key)) return bad()
    const row = sectionRow(body.key as string, (body.patch ?? {}) as Record<string, unknown>)
    if (Object.keys(row).length === 0) return bad()
    const { error } = await deps.updateSection(body.key as string, row, env)
    return error ? fail() : ok()
  }
  if (input.method === 'PUT' && body.kind === 'seo') {
    if (!isSeoPageKey(body.pageKey)) return bad()
    const row = seoRow((body.patch ?? {}) as Record<string, unknown>)
    if (Object.keys(row).length === 0) return bad()
    const { error } = await deps.updateSeo(body.pageKey as string, row, env)
    return error ? fail() : ok()
  }
  if (input.method === 'POST' && body.op === 'reset') {
    if (typeof body.content !== 'object' || body.content === null) return bad()
    const { error } = await deps.resetAll(body.content, env)
    return error ? fail() : ok()
  }
  return { status: 405, body: { error: 'method_not_allowed' } }
}
```

- [ ] **Step 3b: Implement `api/_lib/adminReset.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { projectRow, serviceRow, sectionRow, seoRow } from './adminRows'

/** Replace all content rows with the supplied `SiteContent`-shaped payload. */
export async function resetContent(
  c: SupabaseClient,
  content: unknown,
): Promise<{ error: string | null }> {
  const x = content as Record<string, unknown>
  const sections = Array.isArray(x.sections) ? x.sections : []
  const seo = Array.isArray(x.seo) ? x.seo : []
  const lists: [string, 'project' | 'service', 'home' | 'page'][] = [
    ['projectsHome', 'project', 'home'], ['projectsPage', 'project', 'page'],
    ['servicesHome', 'service', 'home'], ['servicesPage', 'service', 'page'],
  ]
  try {
    for (const s of sections as Record<string, unknown>[]) {
      const row = sectionRow(String(s.key), s)
      const { error } = await c.from('site_sections').update({ ...row, cta_label: row.cta_label ?? null }).eq('key', s.key)
      if (error) return { error: error.message }
    }
    for (const e of seo as Record<string, unknown>[]) {
      const { error } = await c.from('seo_pages').update(seoRow(e)).eq('page_key', e.pageKey)
      if (error) return { error: error.message }
    }
    for (const [key, type, list] of lists) {
      const cards = Array.isArray(x[key]) ? (x[key] as Record<string, unknown>[]) : []
      const table = type === 'project' ? 'projects' : 'services'
      const { error: delErr } = await c.from(table).delete().eq('list', list)
      if (delErr) return { error: delErr.message }
      if (cards.length === 0) continue
      const rows = cards.map((card, i) => ({
        list, id: String(card.id),
        ...(type === 'project' ? projectRow({ ...card, order: i }) : serviceRow({ ...card, order: i })),
      }))
      const { error: insErr } = await c.from(table).insert(rows)
      if (insErr) return { error: insErr.message }
    }
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'reset_failed' }
  }
}
```

- [ ] **Step 4: Run → pass.** `npm test -- api/_lib/adminContentHandler.test.ts`

- [ ] **Step 5: Implement `api/admin/content.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleAdminContent } from '../_lib/adminContentHandler'
import { send } from '../_lib/vercel-adapter'

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const result = await handleAdminContent(
    { method: req.method ?? 'GET', cookieHeader: req.headers.cookie, body: req.body ?? {} },
    {
      ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  )
  send(res, result)
}
```

- [ ] **Step 6: Route it in the dev plugin**

In `vite-plugins/admin-api-dev.ts` `dispatchApi`, add:
```ts
case '/api/admin/content':
  return handleAdminContent(
    { method: input.method, cookieHeader: input.cookieHeader, body: input.jsonBody ?? {} },
    env,
  )
```
(import `handleAdminContent` at the top.) Add a routing test in `vite-plugins/admin-api-dev.test.ts` mirroring the existing pattern: a `PUT /api/admin/content` with no cookie → `r?.status` `401`.

- [ ] **Step 7: Gate + commit**

`npm test`, `npm run lint`, `npm run typecheck:api`, `npx tsc -b`, `npm run build`, `npm run e2e` — all green.
```bash
git commit -m "feat(admin-api): PUT /api/admin/content (section, seo, reset)"
```

---

## Task 3: `/api/admin/cards` — create / update / delete / reorder

**Files:**
- Create: `api/_lib/adminCardsHandler.ts`, `api/_lib/adminCardsHandler.test.ts`
- Create: `api/admin/cards.ts`
- Modify: `vite-plugins/admin-api-dev.ts`, `vite-plugins/admin-api-dev.test.ts`

**Interfaces:**
- Consumes: `requireSession`, `getSupabaseAdmin`, `projectRow`/`serviceRow`/`isCardType`/`isCardList` (Task 1)
- Produces: `handleAdminCards`, `AdminCardsDeps`

- [ ] **Step 1: Write the failing test**

Create `api/_lib/adminCardsHandler.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { handleAdminCards } from './adminCardsHandler'
import { signToken, SESSION_COOKIE } from './session'

const SECRET = 'secret-secret-secret-secret-secret-secret'
const ENV = { ADMIN_SESSION_SECRET: SECRET, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' }
const cookie = `${SESSION_COOKIE}=${signToken(SECRET)}`
const q = (type = 'project') => ({ type })

const deps = () => ({
  create: vi.fn().mockResolvedValue({ error: null }),
  update: vi.fn().mockResolvedValue({ error: null }),
  remove: vi.fn().mockResolvedValue({ error: null }),
  reorder: vi.fn().mockResolvedValue({ error: null }),
})

describe('handleAdminCards', () => {
  it('401 without a session', async () => {
    expect((await handleAdminCards({ method: 'POST', cookieHeader: undefined, query: q(), body: {} }, ENV, deps())).status).toBe(401)
  })
  it('400 on a bad ?type', async () => {
    expect((await handleAdminCards({ method: 'POST', cookieHeader: cookie, query: { type: 'x' }, body: {} }, ENV, deps())).status).toBe(400)
  })
  it('POST create → deps.create(type,list,row)', async () => {
    const d = deps()
    const body = { list: 'home', card: { id: 'proj_1', order: 2, published: false, title: { en: 'N', uk: 'N' } } }
    const r = await handleAdminCards({ method: 'POST', cookieHeader: cookie, query: q('project'), body }, ENV, d)
    expect(r.status).toBe(200)
    expect(d.create).toHaveBeenCalledWith('project', 'home',
      expect.objectContaining({ list: 'home', id: 'proj_1', sort: 2, published: false, title: { en: 'N', uk: 'N' } }), ENV)
  })
  it('PUT update → deps.update(type,list,id,row)', async () => {
    const d = deps()
    await handleAdminCards({ method: 'PUT', cookieHeader: cookie, query: q('service'),
      body: { list: 'page', id: 's1', patch: { published: true } } }, ENV, d)
    expect(d.update).toHaveBeenCalledWith('service', 'page', 's1', { published: true }, ENV)
  })
  it('DELETE → deps.remove(type,list,id)', async () => {
    const d = deps()
    await handleAdminCards({ method: 'DELETE', cookieHeader: cookie, query: q('project'),
      body: { list: 'home', id: 'p1' } }, ENV, d)
    expect(d.remove).toHaveBeenCalledWith('project', 'home', 'p1', ENV)
  })
  it('POST reorder → deps.reorder(type,list,orderedIds)', async () => {
    const d = deps()
    await handleAdminCards({ method: 'POST', cookieHeader: cookie, query: q('project'),
      body: { op: 'reorder', list: 'home', orderedIds: ['a', 'b', 'c'] } }, ENV, d)
    expect(d.reorder).toHaveBeenCalledWith('project', 'home', ['a', 'b', 'c'], ENV)
  })
  it('400 when create body has no id', async () => {
    expect((await handleAdminCards({ method: 'POST', cookieHeader: cookie, query: q(),
      body: { list: 'home', card: { title: { en: 'x', uk: 'x' } } } }, ENV, deps())).status).toBe(400)
  })
  it('500 on a dep error', async () => {
    const d = deps(); d.update.mockResolvedValue({ error: 'boom' })
    expect((await handleAdminCards({ method: 'PUT', cookieHeader: cookie, query: q(),
      body: { list: 'home', id: 'p1', patch: { published: true } } }, ENV, d)).status).toBe(500)
  })
})
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `api/_lib/adminCardsHandler.ts`**

```ts
import type { HandlerResult, AuthEnv, SupabaseAdminEnv } from './types'
import { requireSession } from './handlers'
import { getSupabaseAdmin } from './supabaseAdmin'
import { projectRow, serviceRow, isCardType, isCardList } from './adminRows'

type Env = AuthEnv & SupabaseAdminEnv
type Kind = 'project' | 'service'
type List = 'home' | 'page'
interface DepResult { error: string | null }
export interface AdminCardsDeps {
  create: (type: Kind, list: List, row: Record<string, unknown>, env: Env) => Promise<DepResult>
  update: (type: Kind, list: List, id: string, row: Record<string, unknown>, env: Env) => Promise<DepResult>
  remove: (type: Kind, list: List, id: string, env: Env) => Promise<DepResult>
  reorder: (type: Kind, list: List, orderedIds: string[], env: Env) => Promise<DepResult>
}

const table = (t: Kind) => (t === 'project' ? 'projects' : 'services')
const rowFor = (t: Kind, patch: Record<string, unknown>) => (t === 'project' ? projectRow(patch) : serviceRow(patch))

const defaultDeps: AdminCardsDeps = {
  create: async (type, list, row, env) => {
    const c = getSupabaseAdmin(env); if (!c) return { error: 'not_configured' }
    const { error } = await c.from(table(type)).insert({ ...row, list })
    return { error: error ? error.message : null }
  },
  update: async (type, list, id, row, env) => {
    const c = getSupabaseAdmin(env); if (!c) return { error: 'not_configured' }
    const { error } = await c.from(table(type)).update(row).eq('list', list).eq('id', id)
    return { error: error ? error.message : null }
  },
  remove: async (type, list, id, env) => {
    const c = getSupabaseAdmin(env); if (!c) return { error: 'not_configured' }
    // read image_path/icon_path first so we can clean Storage
    const pathCol = type === 'project' ? 'image_path' : 'icon_path'
    const { data } = await c.from(table(type)).select(pathCol).eq('list', list).eq('id', id).maybeSingle()
    const objectPath = (data as Record<string, unknown> | null)?.[pathCol]
    const { error } = await c.from(table(type)).delete().eq('list', list).eq('id', id)
    if (error) return { error: error.message }
    if (typeof objectPath === 'string' && objectPath) {
      await c.storage.from(env.SUPABASE_MEDIA_BUCKET ?? 'public-media').remove([objectPath])
    }
    return { error: null }
  },
  reorder: async (type, list, orderedIds, env) => {
    const c = getSupabaseAdmin(env); if (!c) return { error: 'not_configured' }
    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await c.from(table(type)).update({ sort: i }).eq('list', list).eq('id', orderedIds[i])
      if (error) return { error: error.message }
    }
    return { error: null }
  },
}

const bad = (): HandlerResult => ({ status: 400, body: { error: 'invalid_request' } })
const fail = (): HandlerResult => ({ status: 500, body: { error: 'write_failed' } })
const ok = (): HandlerResult => ({ status: 200, body: { ok: true } })

export async function handleAdminCards(
  input: { method: string; cookieHeader: string | undefined; query: Record<string, string | undefined>; body: unknown },
  env: Env,
  deps: AdminCardsDeps = defaultDeps,
): Promise<HandlerResult> {
  if (!requireSession(input.cookieHeader, env)) return { status: 401, body: { error: 'unauthorized' } }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { status: 500, body: { error: 'not_configured' } }
  const type = input.query.type
  if (!isCardType(type)) return bad()
  const body = (input.body ?? {}) as Record<string, unknown>
  if (!isCardList(body.list)) return bad()
  const list = body.list

  if (input.method === 'POST' && body.op === 'reorder') {
    if (!Array.isArray(body.orderedIds) || !body.orderedIds.every((x) => typeof x === 'string')) return bad()
    const { error } = await deps.reorder(type, list, body.orderedIds as string[], env)
    return error ? fail() : ok()
  }
  if (input.method === 'POST') {
    const card = (body.card ?? {}) as Record<string, unknown>
    if (typeof card.id !== 'string' || !card.id) return bad()
    const row = { ...rowFor(type, card), id: card.id }
    const { error } = await deps.create(type, list, row, env)
    return error ? fail() : ok()
  }
  if (input.method === 'PUT') {
    if (typeof body.id !== 'string' || !body.id) return bad()
    const row = rowFor(type, (body.patch ?? {}) as Record<string, unknown>)
    if (Object.keys(row).length === 0) return bad()
    const { error } = await deps.update(type, list, body.id, row, env)
    return error ? fail() : ok()
  }
  if (input.method === 'DELETE') {
    if (typeof body.id !== 'string' || !body.id) return bad()
    const { error } = await deps.remove(type, list, body.id, env)
    return error ? fail() : ok()
  }
  return { status: 405, body: { error: 'method_not_allowed' } }
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: `api/admin/cards.ts`** — same adapter shape as `content.ts`, but also pass the query:
```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleAdminCards } from '../_lib/adminCardsHandler'
import { send } from '../_lib/vercel-adapter'

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const query = req.query as Record<string, string | undefined>
  const result = await handleAdminCards(
    { method: req.method ?? 'GET', cookieHeader: req.headers.cookie, query, body: req.body ?? {} },
    {
      ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_MEDIA_BUCKET: process.env.SUPABASE_MEDIA_BUCKET,
    },
  )
  send(res, result)
}
```

- [ ] **Step 6: Dev plugin route.** In `dispatchApi`, `case '/api/admin/cards':` — parse the query string off `input.url` (`new URLSearchParams(input.url.split('?')[1] ?? '')`) into `{ type }`, call `handleAdminCards`. Add a no-cookie 401 routing test.

- [ ] **Step 7: Gate + commit** — `git commit -m "feat(admin-api): /api/admin/cards CRUD + reorder"`

---

## Task 4: `/api/admin/requests` — list / triage / delete

**Files:**
- Create: `api/_lib/adminRequestsHandler.ts`, `api/_lib/adminRequestsHandler.test.ts`
- Create: `api/admin/requests.ts`
- Modify: `vite-plugins/admin-api-dev.ts`, `vite-plugins/admin-api-dev.test.ts`

**Interfaces:**
- Consumes: `requireSession`, `getSupabaseAdmin`, `estimateFromRow` (Task 1)
- Produces: `handleAdminRequests`, `AdminRequestsDeps`

- [ ] **Step 1: Write the failing test**

Create `api/_lib/adminRequestsHandler.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { handleAdminRequests } from './adminRequestsHandler'
import { signToken, SESSION_COOKIE } from './session'

const SECRET = 'secret-secret-secret-secret-secret-secret'
const ENV = { ADMIN_SESSION_SECRET: SECRET, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' }
const cookie = `${SESSION_COOKIE}=${signToken(SECRET)}`
const ROW = {
  id: 'r1', created_at: '2026-01-01T00:00:00Z', status: 'new', name: 'A', email: 'a@b.c',
  company: null, budget: null, interested_in: [], message: 'hi', locale: 'en', source_page: null, note: null,
}
const deps = () => ({
  list: vi.fn().mockResolvedValue({ rows: [ROW], error: null }),
  patch: vi.fn().mockResolvedValue({ error: null }),
  remove: vi.fn().mockResolvedValue({ error: null }),
})

describe('handleAdminRequests', () => {
  it('401 without a session', async () => {
    expect((await handleAdminRequests({ method: 'GET', cookieHeader: undefined, body: {} }, ENV, deps())).status).toBe(401)
  })
  it('GET → 200 with camelCase DTOs', async () => {
    const r = await handleAdminRequests({ method: 'GET', cookieHeader: cookie, body: {} }, ENV, deps())
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ requests: [expect.objectContaining({ id: 'r1', createdAt: '2026-01-01T00:00:00Z', interestedIn: [] })] })
  })
  it('PATCH status → deps.patch(id, {status})', async () => {
    const d = deps()
    await handleAdminRequests({ method: 'PATCH', cookieHeader: cookie, body: { id: 'r1', status: 'done' } }, ENV, d)
    expect(d.patch).toHaveBeenCalledWith('r1', { status: 'done' }, ENV)
  })
  it('PATCH bad status → 400', async () => {
    expect((await handleAdminRequests({ method: 'PATCH', cookieHeader: cookie, body: { id: 'r1', status: 'nope' } }, ENV, deps())).status).toBe(400)
  })
  it('PATCH note → deps.patch(id, {note})', async () => {
    const d = deps()
    await handleAdminRequests({ method: 'PATCH', cookieHeader: cookie, body: { id: 'r1', note: 'called' } }, ENV, d)
    expect(d.patch).toHaveBeenCalledWith('r1', { note: 'called' }, ENV)
  })
  it('DELETE → deps.remove(id)', async () => {
    const d = deps()
    await handleAdminRequests({ method: 'DELETE', cookieHeader: cookie, body: { id: 'r1' } }, ENV, d)
    expect(d.remove).toHaveBeenCalledWith('r1', ENV)
  })
  it('500 on a list error', async () => {
    const d = deps(); d.list.mockResolvedValue({ rows: [], error: 'boom' })
    expect((await handleAdminRequests({ method: 'GET', cookieHeader: cookie, body: {} }, ENV, d)).status).toBe(500)
  })
})
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `api/_lib/adminRequestsHandler.ts`**

```ts
import type { HandlerResult, AuthEnv, SupabaseAdminEnv } from './types'
import { requireSession } from './handlers'
import { getSupabaseAdmin } from './supabaseAdmin'
import { estimateFromRow } from './adminRows'

type Env = AuthEnv & SupabaseAdminEnv
const STATUSES = ['new', 'in_progress', 'done', 'archived']
interface DepResult { error: string | null }
export interface AdminRequestsDeps {
  list: (env: Env) => Promise<{ rows: Record<string, unknown>[]; error: string | null }>
  patch: (id: string, fields: Record<string, unknown>, env: Env) => Promise<DepResult>
  remove: (id: string, env: Env) => Promise<DepResult>
}

const defaultDeps: AdminRequestsDeps = {
  list: async (env) => {
    const c = getSupabaseAdmin(env); if (!c) return { rows: [], error: 'not_configured' }
    const { data, error } = await c.from('estimate_requests').select('*').order('created_at', { ascending: false })
    return { rows: (data ?? []) as Record<string, unknown>[], error: error ? error.message : null }
  },
  patch: async (id, fields, env) => {
    const c = getSupabaseAdmin(env); if (!c) return { error: 'not_configured' }
    const { error } = await c.from('estimate_requests').update(fields).eq('id', id)
    return { error: error ? error.message : null }
  },
  remove: async (id, env) => {
    const c = getSupabaseAdmin(env); if (!c) return { error: 'not_configured' }
    const { error } = await c.from('estimate_requests').delete().eq('id', id)
    return { error: error ? error.message : null }
  },
}

const bad = (): HandlerResult => ({ status: 400, body: { error: 'invalid_request' } })
const fail = (): HandlerResult => ({ status: 500, body: { error: 'write_failed' } })
const ok = (): HandlerResult => ({ status: 200, body: { ok: true } })

export async function handleAdminRequests(
  input: { method: string; cookieHeader: string | undefined; body: unknown },
  env: Env,
  deps: AdminRequestsDeps = defaultDeps,
): Promise<HandlerResult> {
  if (!requireSession(input.cookieHeader, env)) return { status: 401, body: { error: 'unauthorized' } }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { status: 500, body: { error: 'not_configured' } }
  const body = (input.body ?? {}) as Record<string, unknown>

  if (input.method === 'GET') {
    const { rows, error } = await deps.list(env)
    if (error) return fail()
    return { status: 200, body: { requests: rows.map(estimateFromRow) } }
  }
  if (input.method === 'PATCH') {
    if (typeof body.id !== 'string' || !body.id) return bad()
    const fields: Record<string, unknown> = {}
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status as string)) return bad()
      fields.status = body.status
    }
    if (body.note !== undefined) {
      if (typeof body.note !== 'string' || body.note.length > 5000) return bad()
      fields.note = body.note
    }
    if (Object.keys(fields).length === 0) return bad()
    const { error } = await deps.patch(body.id, fields, env)
    return error ? fail() : ok()
  }
  if (input.method === 'DELETE') {
    if (typeof body.id !== 'string' || !body.id) return bad()
    const { error } = await deps.remove(body.id, env)
    return error ? fail() : ok()
  }
  return { status: 405, body: { error: 'method_not_allowed' } }
}
```

- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: `api/admin/requests.ts`** — adapter, same shape as `content.ts` (no query needed).
- [ ] **Step 6: Dev plugin route** `case '/api/admin/requests':` + a no-cookie 401 test.
- [ ] **Step 7: Gate + commit** — `git commit -m "feat(admin-api): /api/admin/requests list/triage/delete"`

---

## Task 5: `/api/admin/upload` — image → Storage

**Files:**
- Create: `api/_lib/adminUploadHandler.ts`, `api/_lib/adminUploadHandler.test.ts`
- Create: `api/admin/upload.ts`
- Modify: `vite-plugins/admin-api-dev.ts`, `vite-plugins/admin-api-dev.test.ts`

**Precondition:** the `public-media` bucket exists (see `supabase/STORAGE.md`).

**Interfaces:**
- Consumes: `requireSession`, `getSupabaseAdmin`
- Produces: `handleAdminUpload`, `AdminUploadDeps`

- [ ] **Step 1: Write the failing test**

Create `api/_lib/adminUploadHandler.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { handleAdminUpload } from './adminUploadHandler'
import { signToken, SESSION_COOKIE } from './session'

const SECRET = 'secret-secret-secret-secret-secret-secret'
const ENV = { ADMIN_SESSION_SECRET: SECRET, SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' }
const cookie = `${SESSION_COOKIE}=${signToken(SECRET)}`
// 1x1 png
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const deps = () => ({
  put: vi.fn().mockResolvedValue({ url: 'https://cdn/public-media/projects/x-ab12cd34.png', path: 'projects/x-ab12cd34.png', error: null }),
  del: vi.fn().mockResolvedValue({ error: null }),
})

describe('handleAdminUpload', () => {
  it('401 without a session', async () => {
    expect((await handleAdminUpload({ method: 'POST', cookieHeader: undefined, body: {} }, ENV, deps())).status).toBe(401)
  })
  it('400 on a non-image data URL', async () => {
    expect((await handleAdminUpload({ method: 'POST', cookieHeader: cookie,
      body: { dataUrl: 'data:text/plain;base64,aGk=', fileName: 'x.txt', folder: 'projects' } }, ENV, deps())).status).toBe(400)
  })
  it('400 on an unknown folder', async () => {
    expect((await handleAdminUpload({ method: 'POST', cookieHeader: cookie,
      body: { dataUrl: PNG, fileName: 'x.png', folder: 'evil' } }, ENV, deps())).status).toBe(400)
  })
  it('400 when the decoded image exceeds 2 MB', async () => {
    const big = 'data:image/png;base64,' + 'A'.repeat(3_000_000)
    expect((await handleAdminUpload({ method: 'POST', cookieHeader: cookie,
      body: { dataUrl: big, fileName: 'x.png', folder: 'projects' } }, ENV, deps())).status).toBe(400)
  })
  it('POST a valid png → deps.put with a projects/<slug>-<hex>.png key, returns {url,path}', async () => {
    const d = deps()
    const r = await handleAdminUpload({ method: 'POST', cookieHeader: cookie,
      body: { dataUrl: PNG, fileName: 'My Photo.PNG', folder: 'projects' } }, ENV, d)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ url: expect.any(String), path: expect.stringMatching(/^projects\/my-photo-[0-9a-f]{8}\.png$/) })
    expect(d.put).toHaveBeenCalledWith(
      'projects', expect.stringMatching(/^projects\/my-photo-[0-9a-f]{8}\.png$/),
      expect.any(Buffer), 'image/png', ENV,
    )
  })
  it('DELETE { path } → deps.del', async () => {
    const d = deps()
    const r = await handleAdminUpload({ method: 'DELETE', cookieHeader: cookie, body: { path: 'projects/x.png' } }, ENV, d)
    expect(r.status).toBe(200)
    expect(d.del).toHaveBeenCalledWith('projects/x.png', ENV)
  })
  it('DELETE rejects a path outside the two folders', async () => {
    expect((await handleAdminUpload({ method: 'DELETE', cookieHeader: cookie, body: { path: '../secrets' } }, ENV, deps())).status).toBe(400)
  })
})
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `api/_lib/adminUploadHandler.ts`**

```ts
import { randomBytes } from 'node:crypto'
import type { HandlerResult, AuthEnv, SupabaseAdminEnv } from './types'
import { requireSession } from './handlers'
import { getSupabaseAdmin } from './supabaseAdmin'

type Env = AuthEnv & SupabaseAdminEnv
const FOLDERS = ['projects', 'services'] as const
const MIME_EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg',
}
const MAX_BYTES = 2_000_000

export interface AdminUploadDeps {
  put: (folder: string, key: string, bytes: Buffer, contentType: string, env: Env)
    => Promise<{ url: string; path: string; error: string | null }>
  del: (path: string, env: Env) => Promise<{ error: string | null }>
}

const bucket = (env: Env) => env.SUPABASE_MEDIA_BUCKET ?? 'public-media'

const defaultDeps: AdminUploadDeps = {
  put: async (folder, key, bytes, contentType, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { url: '', path: '', error: 'not_configured' }
    const { error } = await c.storage.from(bucket(env)).upload(key, bytes, { contentType, upsert: false })
    if (error) return { url: '', path: '', error: error.message }
    const { data } = c.storage.from(bucket(env)).getPublicUrl(key)
    return { url: data.publicUrl, path: key, error: null }
  },
  del: async (path, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return { error: 'not_configured' }
    const { error } = await c.storage.from(bucket(env)).remove([path])
    return { error: error ? error.message : null }
  },
}

const bad = (): HandlerResult => ({ status: 400, body: { error: 'invalid_request' } })
const slugify = (name: string) =>
  name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'image'

export async function handleAdminUpload(
  input: { method: string; cookieHeader: string | undefined; body: unknown },
  env: Env,
  deps: AdminUploadDeps = defaultDeps,
): Promise<HandlerResult> {
  if (!requireSession(input.cookieHeader, env)) return { status: 401, body: { error: 'unauthorized' } }
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { status: 500, body: { error: 'not_configured' } }
  const body = (input.body ?? {}) as Record<string, unknown>

  if (input.method === 'DELETE') {
    const path = body.path
    if (typeof path !== 'string' || !FOLDERS.some((f) => path.startsWith(`${f}/`)) || path.includes('..')) return bad()
    const { error } = await deps.del(path, env)
    return error ? { status: 500, body: { error: 'delete_failed' } } : { status: 200, body: { ok: true } }
  }
  if (input.method === 'POST') {
    const { dataUrl, fileName, folder } = body as { dataUrl?: unknown; fileName?: unknown; folder?: unknown }
    if (typeof dataUrl !== 'string' || typeof fileName !== 'string') return bad()
    if (!(FOLDERS as readonly string[]).includes(folder as string)) return bad()
    const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl)
    if (!m) return bad()
    const mime = m[1]
    const ext = MIME_EXT[mime]
    if (!ext) return bad()
    let bytes: Buffer
    try { bytes = Buffer.from(m[2], 'base64') } catch { return bad() }
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return bad()
    const key = `${folder}/${slugify(fileName)}-${randomBytes(4).toString('hex')}.${ext}`
    const { url, path, error } = await deps.put(folder as string, key, bytes, mime, env)
    if (error) return { status: 500, body: { error: 'upload_failed' } }
    return { status: 200, body: { url, path } }
  }
  return { status: 405, body: { error: 'method_not_allowed' } }
}
```

- [ ] **Step 4: Run → pass.**
- [ ] **Step 5: `api/admin/upload.ts`** — adapter, pass `SUPABASE_MEDIA_BUCKET` too.
- [ ] **Step 6: Dev plugin route** `case '/api/admin/upload':` + a no-cookie 401 test. NOTE: the dev plugin's `readJsonBody` handles POST but not DELETE — extend the middleware to also read the body for `DELETE` when the path is `/api/admin/upload` (or, simpler, read the JSON body for any method that is not GET/HEAD). Keep the change minimal and covered by a routing test.
- [ ] **Step 7: Gate + commit** — `git commit -m "feat(admin-api): /api/admin/upload base64 → Storage"`

---

## Task 6: `src/admin/api.ts` — client wrappers

**Files:**
- Create: `src/admin/api.ts`
- Test: `src/admin/api.test.ts`

**Interfaces:**
- Consumes: the 4 endpoints (Tasks 2–5); domain types from `src/admin/types.ts` and `src/content/mappers.ts`
- Produces: `adminApi` (see header)

- [ ] **Step 1: Write the failing test**

Create `src/admin/api.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { adminApi } from './api'

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('adminApi', () => {
  it('saveSection PUTs {kind:section,key,patch} with credentials', async () => {
    await adminApi.saveSection('hero', { title: { en: 'N', uk: 'N' } })
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/content', expect.objectContaining({
      method: 'PUT', credentials: 'same-origin',
    }))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      kind: 'section', key: 'hero', patch: { title: { en: 'N', uk: 'N' } },
    })
  })
  it('createCard POSTs to /api/admin/cards?type=project', async () => {
    await adminApi.createCard('project', 'home', { id: 'p1' } as never)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/cards?type=project')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ list: 'home', card: { id: 'p1' } })
  })
  it('reorderCards POSTs {op:reorder,list,orderedIds}', async () => {
    await adminApi.reorderCards('service', 'page', ['a', 'b'])
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/admin/cards?type=service')
    expect(JSON.parse(opts.body)).toEqual({ op: 'reorder', list: 'page', orderedIds: ['a', 'b'] })
  })
  it('uploadImage returns {url,path} from the response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ url: 'U', path: 'P' }) })
    const r = await adminApi.uploadImage('projects', 'data:image/png;base64,AA', 'x.png')
    expect(r).toEqual({ url: 'U', path: 'P' })
  })
  it('listRequests returns the requests array', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ requests: [{ id: 'r1' }] }) })
    expect(await adminApi.listRequests()).toEqual([{ id: 'r1' }])
  })
  it('throws on a non-2xx response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'x' }) })
    await expect(adminApi.saveSeo('home', { title: { en: 'x', uk: 'x' } })).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `src/admin/api.ts`**

```ts
import type {
  SectionKey, SeoPageKey, SectionText, SeoEntry, ProjectCard, ServiceCard,
  RequestStatus, EstimateRequest,
} from './types'
import type { SiteContent } from '../content/mappers'

async function call<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
  return data
}

type CardKind = 'project' | 'service'
const cardsUrl = (type: CardKind) => `/api/admin/cards?type=${type}`

export const adminApi = {
  saveSection: (key: SectionKey, patch: Partial<Pick<SectionText, 'eyebrow' | 'title' | 'body' | 'ctaLabel'>>) =>
    call<void>('/api/admin/content', 'PUT', { kind: 'section', key, patch }),
  saveSeo: (pageKey: SeoPageKey, patch: Partial<Pick<SeoEntry, 'title' | 'description'>>) =>
    call<void>('/api/admin/content', 'PUT', { kind: 'seo', pageKey, patch }),
  resetContent: (content: SiteContent) =>
    call<void>('/api/admin/content', 'POST', { op: 'reset', content }),

  createCard: (type: CardKind, list: 'home' | 'page', card: ProjectCard | ServiceCard) =>
    call<void>(cardsUrl(type), 'POST', { list, card }),
  updateCard: (type: CardKind, list: 'home' | 'page', id: string, patch: Record<string, unknown>) =>
    call<void>(cardsUrl(type), 'PUT', { list, id, patch }),
  deleteCard: (type: CardKind, list: 'home' | 'page', id: string) =>
    call<void>(cardsUrl(type), 'DELETE', { list, id }),
  reorderCards: (type: CardKind, list: 'home' | 'page', orderedIds: string[]) =>
    call<void>(cardsUrl(type), 'POST', { op: 'reorder', list, orderedIds }),

  uploadImage: (folder: 'projects' | 'services', dataUrl: string, fileName: string) =>
    call<{ url: string; path: string }>('/api/admin/upload', 'POST', { dataUrl, fileName, folder }),
  deleteImage: (path: string) => call<void>('/api/admin/upload', 'DELETE', { path }),

  listRequests: () => call<{ requests: EstimateRequest[] }>('/api/admin/requests', 'GET').then((r) => r.requests),
  setRequestStatus: (id: string, status: RequestStatus) =>
    call<void>('/api/admin/requests', 'PATCH', { id, status }),
  setRequestNote: (id: string, note: string) =>
    call<void>('/api/admin/requests', 'PATCH', { id, note }),
  deleteRequest: (id: string) => call<void>('/api/admin/requests', 'DELETE', { id }),
}
```

- [ ] **Step 4: Run → pass. Step 5:** lint + `tsc -p tsconfig.app.json`. **Step 6: Commit** — `git commit -m "feat(admin): typed client for /api/admin/*"`

---

## Task 7: `AdminData` reshape — drop `requests`

**Files:**
- Modify: `src/admin/types.ts` (remove `requests` from `AdminData`; add `path?: string` to `ImageRef`; `RequestStatus`/`EstimateRequest`/`NewRequestInput` stay), `src/content/defaults/index.ts`, `src/content/persistence.ts`, `src/admin/actions.ts`, `src/content/SiteContentProvider.tsx` (interface + `actions` object only — the async change is Task 9)
- Modify tests: `src/content/defaults/index.test.ts`, `src/content/persistence.test.ts`, `src/admin/actions.test.ts`, `src/content/SiteContentProvider.test.tsx`, and any other test referencing `data.requests` or the removed reducers

**Interfaces:**
- Consumes: nothing new
- Produces: `AdminData` without `requests`; `ImageRef` with `path?`

- [ ] **Step 1: Enumerate the blast radius**

Run: `grep -rn "\.requests\|addRequest\|setRequestStatus\|setRequestNote\|removeRequest\|NewRequestInput" src/ | grep -v node_modules`
Write the list into the task report. Expected touch set: `types.ts`, `defaults/index.ts`, `persistence.ts`, `actions.ts`, `actions.test.ts`, `SiteContentProvider.tsx` + `.test.tsx`, `RequestsPage.tsx` + `.test.tsx`, `DashboardPage.tsx` + `.test.tsx`, `defaults/index.test.ts`, `persistence.test.ts`. `RequestsPage`/`DashboardPage` are rewired in **Task 8** — for this task, leave them compiling by keeping `useRequests` out and temporarily reading `[]`; OR do Task 7 and 8 as one commit. **Recommended: do Task 7 then Task 8 back-to-back before running the full gate; commit once at the end of Task 8** if splitting causes an un-compilable intermediate. The task reviewer will see both.

- [ ] **Step 2: `src/admin/types.ts`**
- `ImageRef`: add `path?: string` with a doc comment (`Supabase Storage object key for kind:'upload'; used to delete/replace the object`).
- `AdminData`: delete the `requests: EstimateRequest[]` line.
- Keep `EstimateRequest`, `RequestStatus`, `BudgetRange`, `NewRequestInput` (used by `useRequests` + `mockRequests` + tests).

- [ ] **Step 3: `src/content/defaults/index.ts`** — remove `requests: []` from `buildDefaults()`.

- [ ] **Step 4: `src/content/persistence.ts`**
- `seedAdminData()`: return `buildDefaults()` directly (drop the `requests` spread + the `mockRequests` import).
- `isAdminData()`: remove the `Array.isArray(d.requests)` check.

- [ ] **Step 5: `src/admin/actions.ts`**
- Delete `addRequest`, `setRequestStatus`, `setRequestNote`, `removeRequest` and the now-unused imports (`NewRequestInput`, `RequestStatus` if unused, `newId` stays for cards).
- `resetAll()`: `return seedAdminData()` unchanged (it no longer carries requests).

- [ ] **Step 6: `src/content/SiteContentProvider.tsx`** (interface + actions object only)
- `SiteContentActions`: remove `addRequest`, `setRequestStatus`, `setRequestNote`, `removeRequest`.
- `actions` object: remove those 4 entries + the `A.addRequest` etc. imports usage.
- Leave everything else for Task 9.

- [ ] **Step 7: Fix the tests**
- `defaults/index.test.ts`: remove `expect(d.requests).toEqual([])`.
- `persistence.test.ts`: remove `expect(data.requests.length).toBeGreaterThan(0)` and any `requests` assertions; keep the seed/round-trip/reseed cases.
- `actions.test.ts`: delete the `addRequest`/`setRequestStatus`/`setRequestNote`/`removeRequest` describe blocks and their imports.
- `SiteContentProvider.test.tsx`: remove any `data.requests` reference.

- [ ] **Step 8: Gate** (after Task 8) — `npm test`, lint, `tsc -p tsconfig.app.json`, `npm run typecheck:api`, `npm run build`, `npm run e2e`.

- [ ] **Step 9: Commit** — `git commit -m "refactor(admin): drop requests from AdminData; add ImageRef.path"`

---

## Task 8: `useRequests()` + rewire Requests/Dashboard/Settings

**Files:**
- Create: `src/admin/hooks/useRequests.ts`, `src/admin/hooks/useRequests.test.tsx`
- Modify: `src/admin/pages/RequestsPage.tsx` (+ `.test.tsx`), `src/admin/pages/DashboardPage.tsx` (+ `.test.tsx`), `src/admin/pages/SettingsPage.tsx` (+ `.test.tsx`)

**Interfaces:**
- Consumes: `adminApi` (Task 6); `EstimateRequest`, `RequestStatus` types
- Produces: `useRequests` (see header)

- [ ] **Step 1: Write the failing hook test**

Create `src/admin/hooks/useRequests.test.tsx`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useRequests } from './useRequests'

vi.mock('../api', () => ({
  adminApi: {
    listRequests: vi.fn(),
    setRequestStatus: vi.fn().mockResolvedValue(undefined),
    setRequestNote: vi.fn().mockResolvedValue(undefined),
    deleteRequest: vi.fn().mockResolvedValue(undefined),
  },
}))
import { adminApi } from '../api'

const R = (over = {}) => ({
  id: 'r1', createdAt: '2026-01-01T00:00:00Z', status: 'new', name: 'A', email: 'a@b.c',
  interestedIn: [], message: 'hi', locale: 'en', ...over,
})

beforeEach(() => {
  vi.mocked(adminApi.listRequests).mockResolvedValue([R()])
})

describe('useRequests', () => {
  it('loads on mount', async () => {
    const { result } = renderHook(() => useRequests())
    expect(result.current.requests).toBeNull()
    await waitFor(() => expect(result.current.requests).toHaveLength(1))
  })
  it('setStatus is optimistic and calls the api', async () => {
    const { result } = renderHook(() => useRequests())
    await waitFor(() => expect(result.current.requests).toHaveLength(1))
    await act(() => result.current.setStatus('r1', 'done'))
    expect(result.current.requests![0].status).toBe('done')
    expect(adminApi.setRequestStatus).toHaveBeenCalledWith('r1', 'done')
  })
  it('reloads to revert when the api rejects', async () => {
    vi.mocked(adminApi.setRequestStatus).mockRejectedValueOnce(new Error('x'))
    vi.mocked(adminApi.listRequests).mockResolvedValueOnce([R()]).mockResolvedValueOnce([R({ status: 'new' })])
    const { result } = renderHook(() => useRequests())
    await waitFor(() => expect(result.current.requests).toHaveLength(1))
    await act(() => result.current.setStatus('r1', 'done').catch(() => {}))
    await waitFor(() => expect(result.current.requests![0].status).toBe('new'))
  })
  it('sets error:true when the initial load fails', async () => {
    vi.mocked(adminApi.listRequests).mockRejectedValueOnce(new Error('x'))
    const { result } = renderHook(() => useRequests())
    await waitFor(() => expect(result.current.error).toBe(true))
  })
})
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement `src/admin/hooks/useRequests.ts`**

```ts
import { useCallback, useEffect, useState } from 'react'
import type { EstimateRequest, RequestStatus } from '../types'
import { adminApi } from '../api'

export function useRequests() {
  const [requests, setRequests] = useState<EstimateRequest[] | null>(null)
  const [error, setError] = useState(false)

  const reload = useCallback(async () => {
    try {
      setRequests(await adminApi.listRequests())
      setError(false)
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const optimistic = useCallback(
    async (apply: (r: EstimateRequest) => EstimateRequest, id: string, call: () => Promise<void>) => {
      setRequests((rs) => rs?.map((r) => (r.id === id ? apply(r) : r)) ?? rs)
      try {
        await call()
      } catch (e) {
        await reload()
        throw e
      }
    },
    [reload],
  )

  const setStatus = useCallback(
    (id: string, status: RequestStatus) =>
      optimistic((r) => ({ ...r, status }), id, () => adminApi.setRequestStatus(id, status)),
    [optimistic],
  )
  const setNote = useCallback(
    (id: string, note: string) =>
      optimistic((r) => ({ ...r, note }), id, () => adminApi.setRequestNote(id, note)),
    [optimistic],
  )
  const remove = useCallback(
    async (id: string) => {
      setRequests((rs) => rs?.filter((r) => r.id !== id) ?? rs)
      try {
        await adminApi.deleteRequest(id)
      } catch (e) {
        await reload()
        throw e
      }
    },
    [reload],
  )

  return { requests, error, reload, setStatus, setNote, remove }
}
```

- [ ] **Step 4: Run → pass.**

- [ ] **Step 5: Rewire `RequestsPage.tsx`**
- Replace `const { data } = useSiteContentRaw()` with `const { requests, error, setStatus, setNote, remove } = useRequests()`.
- `rows` memo: guard `requests` being `null` (show a "Loading…" / `EmptyState`), and `error` (show "Couldn't load requests").
- `Detail`: `actions.setRequestStatus(req.id, …)` → `setStatus(req.id, …).catch(() => toast('Save failed', 'error'))`; same for note + delete.
- Keep all markup, filters, `StatusBadge`, the table, `Detail` layout **unchanged**.
- Update `RequestsPage.test.tsx`: mock `../hooks/useRequests` (or `../api`), assert the list renders + status change calls through.

- [ ] **Step 6: Rewire `DashboardPage.tsx`**
- `const { requests } = useRequests()`; `const list = requests ?? []`.
- `newCount` / `recent` off `list`. "No requests yet." also covers the loading state (or add a subtle "Loading…").
- The `data.updatedAt` "Last change" line: `useSiteContentRaw().data.updatedAt` still exists — keep it, but note it's now the *local* store's stamp, not the server's. Acceptable; or drop the line. **Keep it** (least change).
- Update `DashboardPage.test.tsx` similarly.

- [ ] **Step 7: `SettingsPage.tsx`**
- The "Reset content" confirm copy mentions "resets the requests list to the sample data" — remove that clause (reset no longer touches requests).
- `reset` handler: `await actions.resetAll()` in try/catch → `toast('Content reset', 'ok')` / `toast('Reset failed', 'error')` (Task 9 makes `resetAll` async; until then it's sync — wrap defensively with `await Promise.resolve(actions.resetAll())`). Simplest: leave the call, adjust only the copy in this task; Task 9 makes it async.
- Update `SettingsPage.test.tsx` copy assertion if it checks the old string.

- [ ] **Step 8: Gate + commit**

`npm test`, lint, `tsc -p tsconfig.app.json`, `npm run typecheck:api`, `npm run build`, `npm run e2e` — all green.
```bash
git commit -m "feat(admin): useRequests() hook; Requests/Dashboard read from the server"
```

---

## Task 9: Provider actions become optimistic-async + refetch

**Files:**
- Modify: `src/content/SiteContentProvider.tsx`, `src/content/SiteContentProvider.test.tsx`
- Create: `src/content/contentCache.ts`, `src/content/contentCache.test.ts`
- Modify: `src/admin/pages/{ContentPage,SeoPage,ProjectsPage,ServicesPage,SettingsPage}.tsx` + their tests

**Interfaces:**
- Consumes: `adminApi` (Task 6), `fetchRemoteContent` (Plan 2), the pure reducers in `src/admin/actions.ts`
- Produces: `SiteContentActions` (all → `Promise<void>`), `refetch` in the context value; `loadContentCache`/`saveContentCache`

- [ ] **Step 1: `src/content/contentCache.ts` + test (TDD)**

```ts
import type { SiteContent } from './mappers'
export const CONTENT_CACHE_KEY = 'onvorx.content.cache.v2'

export function loadContentCache(): SiteContent | null {
  try {
    const raw = localStorage.getItem(CONTENT_CACHE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<SiteContent>
    if (!Array.isArray(p.sections) || !Array.isArray(p.seo)) return null
    return p as SiteContent
  } catch {
    return null
  }
}

export function saveContentCache(c: SiteContent): void {
  try {
    localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(c))
  } catch {
    /* private mode / quota — ignore */
  }
}
```
Test: round-trips; returns `null` on missing / malformed / non-array `sections`; `save` swallows a throwing `setItem`.

- [ ] **Step 2: Provider — write the failing tests**

Add to `SiteContentProvider.test.tsx` (mock `../admin/api` as `adminApi` and keep the `../content/remote` mock):
```ts
vi.mock('../admin/api', () => ({
  adminApi: {
    saveSection: vi.fn().mockResolvedValue(undefined),
    updateCard: vi.fn().mockResolvedValue(undefined),
    // ...the rest, all mockResolvedValue(undefined)
  },
}))
```
New tests:
- `updateSection` applies optimistically (text visible immediately) AND calls `adminApi.saveSection('hero', patch)`.
- when `adminApi.saveSection` rejects, the provider calls `fetchRemoteContent` again (revert) and the returned promise rejects.
- `refetch()` is exposed on the context and re-pulls remote content.
- after a successful write, a debounced `fetchRemoteContent` fires (advance fake timers).

- [ ] **Step 3: Rewrite the `actions` object in `SiteContentProvider.tsx`**

```ts
import { adminApi } from '../admin/api'
import { loadContentCache, saveContentCache } from './contentCache'
// ...

// initial state: defaults overlaid with the cache
const [data, setData] = useState<AdminData>(() => {
  const base = loadAdminData()
  const cache = loadContentCache()
  return cache ? { ...base, ...cache } : base
})

const refetch = useCallback(async () => {
  const remote = await fetchRemoteContent()
  if (!remote) return
  skipNextPersist.current = true
  setData((d) => ({ ...d, ...remote }))
  saveContentCache(remote)
}, [])

// debounced reconcile after writes
const reconcileTimer = useRef<number | undefined>(undefined)
const scheduleReconcile = useCallback(() => {
  window.clearTimeout(reconcileTimer.current)
  reconcileTimer.current = window.setTimeout(() => void refetch(), 800)
}, [refetch])

// one helper: optimistic reducer + server call + revert-on-error
const write = useCallback(
  async (reducer: (d: AdminData) => AdminData, call: () => Promise<void>) => {
    setData(reducer)
    try {
      await call()
      scheduleReconcile()
    } catch (e) {
      await refetch()
      throw e
    }
  },
  [refetch, scheduleReconcile],
)

const actions = useMemo<SiteContentActions>(() => ({
  updateSection: (key, patch) =>
    write((d) => A.updateSection(d, key, patch), () => adminApi.saveSection(key, patch)),
  updateSeo: (pageKey, patch) =>
    write((d) => A.updateSeo(d, pageKey, patch), () => adminApi.saveSeo(pageKey, patch)),
  addCard: (list) => {
    const card = /* compute the blank card via the reducer's own logic — see note */ null as never
    return write((d) => A.addCard(d, list), () => adminApi.createCard(cardKindOf(list), cardListOf(list), /* card */))
  },
  updateCard: (list, id, patch) =>
    write((d) => A.updateCard(d, list, id, patch), () => adminApi.updateCard(cardKindOf(list), cardListOf(list), id, patch)),
  removeCard: (list, id) =>
    write((d) => A.removeCard(d, list, id), () => adminApi.deleteCard(cardKindOf(list), cardListOf(list), id)),
  moveCard: (list, id, dir) =>
    write(
      (d) => A.moveCard(d, list, id, dir),
      () => {
        const ids = orderedIdsAfterMove(data, list, id, dir)
        return adminApi.reorderCards(cardKindOf(list), cardListOf(list), ids)
      },
    ),
  setCardImage: (list, id, image) =>
    write((d) => A.setCardImage(d, list, id, image), () =>
      adminApi.updateCard(cardKindOf(list), cardListOf(list), id, { image })),
  resetAll: () =>
    write(() => A.resetAll(), () => adminApi.resetContent(toSiteContent(buildDefaults()))),
  refetch,
}), [write, refetch, data])
```

Helpers to add in the file (or a small `src/content/cardList.ts`):
```ts
const cardKindOf = (l: CardListKey) => (l.startsWith('projects') ? 'project' : 'service') as 'project' | 'service'
const cardListOf = (l: CardListKey) => (l.endsWith('Home') ? 'home' : 'page') as 'home' | 'page'
```

**`addCard` note:** the pure `A.addCard` reducer builds the blank card internally and returns the new `AdminData`. To send the *same* card to the server, compute it first: `const card = cardKindOf(list) === 'project' ? blankProjectCard(d[list].length) : blankServiceCard(...)`, then `setData((d) => ({ ...d, [list]: [...d[list], card] }))` (or add an `A.addCardWithId(d, list, card)` variant). Pick whichever keeps `actions.ts` clean — a `A.appendCard(d, list, card)` helper is the tidiest; add it + a test in `actions.ts`.

**`moveCard` note:** `A.moveCard` renumbers `sort`. Derive `orderedIds` from the *post-move* list order and send those to `reorderCards`. A pure `orderedIdsAfterMove(data, list, id, dir)` helper (tested) is clearest.

**`toSiteContent(adminData)`**: a 6-field pick (`sections, seo, projectsHome, projectsPage, servicesHome, servicesPage`). Add to `src/content/mappers.ts` or inline.

- [ ] **Step 4: Focus refetch**

Add an effect: `window.addEventListener('focus', onFocus)` where `onFocus = () => void refetch()`; clean up on unmount. Keep the existing mount-overlay effect (Plan 2) — or replace it with a single `void refetch()` on mount (same behavior, less code). Keep the `cancelled` guard.

- [ ] **Step 5: Update the admin pages**

For `ContentPage`, `SeoPage`: `save` → `async`; `try { await actions.updateSection(...); toast('Saved') } catch { toast('Save failed', 'error') }`.
For `ProjectsPage`, `ServicesPage`: same for the Save button; `del` → `await actions.removeCard(...).catch(() => toast('Delete failed', 'error'))`; the inline `onMove`/`onAdd` handlers → `.catch(() => toast('Save failed', 'error'))`; the `ImageUpload` `onChange`/`onClear` → wrap similarly (the upload itself is Task 10).
For `SettingsPage`: `reset` → `await actions.resetAll()` in try/catch with toasts.
Keep every page's markup, drafts, `dirty` logic, `SaveBar` wiring **unchanged** — only the save/delete/move handlers gain `async`/`await`/`.catch`.

- [ ] **Step 6: Update the page tests** — each page test that asserts a save now needs `../../content/SiteContentProvider`'s actions to be awaitable; the simplest is to render with the real provider and mock `../../admin/api`. Assert the api wrapper was called and (on rejection) a "Save failed" toast appears.

- [ ] **Step 7: Gate + commit**

`npm test`, lint, `tsc -p tsconfig.app.json`, `npm run typecheck:api`, `npm run build`, `npm run e2e` — all green.
```bash
git commit -m "feat(admin): optimistic async saves through /api/admin/* + refetch + content cache"
```

---

## Task 10: Image upload wiring

**Files:**
- Modify: `src/admin/components/ImageUpload.tsx`, `src/admin/components/ImageUpload.test.tsx`
- Modify: `src/admin/pages/ProjectsPage.tsx`, `src/admin/pages/ServicesPage.tsx` (pass the folder), + tests

**Interfaces:**
- Consumes: `adminApi.uploadImage` / `adminApi.deleteImage` (Task 6); `fileToImageRef` (`src/admin/lib/image.ts`, unchanged — still downscales to a data URL)
- Produces: nothing

- [ ] **Step 1: Failing test** — `ImageUpload.test.tsx`: on file select, it calls `adminApi.uploadImage(folder, dataUrl, fileName)` and then `onChange({ kind: 'upload', src: <url>, path: <path> })`; on upload failure it shows the existing error slot text and does NOT call `onChange`; `onClear` calls `onChange({ kind: 'asset', src: '' })` and, when the previous value had a `path`, also `adminApi.deleteImage(path)`.

- [ ] **Step 2: Update `ImageUpload.tsx`**
- New required prop `folder: 'projects' | 'services'`.
- `onFile`: `const ref = await fileToImageRef(file)` (data URL as today) → `const { url, path } = await adminApi.uploadImage(folder, ref.src, file.name)` → `onChange({ kind: 'upload', src: url, path })`. Keep the `busy`/`error` UI; add an `'upload-failed'` message to the `MESSAGES` map.
- `onClear`: call `onChange({ kind: 'asset', src: '' })`; if `value.path`, fire `void adminApi.deleteImage(value.path)` (best-effort, ignore failure).
- No markup/style change beyond the (already-present) error span.

- [ ] **Step 3: `ProjectsPage` / `ServicesPage`** — pass `folder="projects"` / `folder="services"` to `<ImageUpload>`.

- [ ] **Step 4: Gate + commit** — `git commit -m "feat(admin): upload card images to Supabase Storage"`

---

## Task 11: Integration verification (dev + live Supabase)

**Files:** none (verification only).

- [ ] **Step 1: Full gate** — `npm test`, `npm run lint`, `npx tsc -p tsconfig.app.json --noEmit`, `npm run typecheck:api`, `npm run build`, `npm run e2e`. Record counts.

- [ ] **Step 2: Round-trip every write through the dev server** (`npm run dev`, real `.env.local`, log in at `/admin`):
  - **Section:** edit the Hero title, Save → reload `/` → new title shows. `select title from site_sections where key='hero'` reflects it.
  - **SEO:** edit `/services` meta description, Save → `select description from seo_pages where page_key='services'`.
  - **Project card:** add a card, fill it, publish, upload an image, Save → it appears on `/` → `select id,image_url,image_path from projects where list='home'` shows the Storage URL + `projects/…` path; the object exists in the bucket. Reorder two cards → `select id,sort from projects where list='home' order by sort`. Delete the test card → row gone AND the Storage object gone (`select` on `storage.objects` or the bucket UI).
  - **Service card:** icon upload + featured toggle + Save.
  - **Requests:** submit the public form → it appears on `/admin/requests` → change status, add a note, delete → verify each in `select * from estimate_requests`.
  - **Reset content:** Settings → Reset → confirm → all content returns to defaults in the DB (`select count(*)` back to 6/8/4/8; any test edits gone).
  - **Optimistic + failure:** stop the dev server mid-session, make an edit → the UI updates then a "Save failed" toast appears and the value reverts on the next refetch. Restart.

- [ ] **Step 3: Cross-visitor check** — with an edit saved, open `/` in a private window (no admin session, cleared localStorage) → the edit is visible (proves it's server-side, not local).

- [ ] **Step 4: Clean up** any test rows / Storage objects created during verification. Re-run `supabase/seed.sql` only if the content DB is dirty (it truncates — safe here since the owner has no real edits yet).

- [ ] **Step 5: Record results** in the ledger. Any failure → stop and fix in the owning task.

---

## Self-review — spec coverage

| Spec section | Covered by |
|---|---|
| §8.1 login unchanged | not touched |
| §8.2 optimistic reducer + endpoint call | Task 9 (`write` helper) |
| §8.3 function: `requireSession` → validate → service-role write → return row | Tasks 2–5 |
| §8.4 error → toast + refetch to revert | Task 9 (`write` re-throws; pages `.catch(toast)`) + Task 8 (`useRequests`) |
| §8.5 images: client downscale → upload endpoint → Storage → URL+path on the row; delete old on replace/clear | Tasks 5, 10; delete-on-card-delete in Task 3 (replace-cleanup + confirmed-write ordering added in the final fix wave) |
| §8.6 reorder = batch `sort` update | Task 3 `reorder` + Task 9 `moveCard` |
| §8.7 delete card also deletes its Storage object | Task 3 `remove` |
| §8.8 requests triage via `/api/admin/requests` | Tasks 4, 8 |
| §9.3 `src/admin/api.ts` | Task 6 |
| §9.3 `useRequests()` hook; Requests/Dashboard rewire | Task 8 |
| §9.3 `AdminData` reshape (drop `requests`); `ImageRef.path` | Task 7 |
| §9.3 `SiteContentProvider` optimistic + refetch + cache | Task 9 |
| §9.4 4 functions + dev routing | Tasks 2–5 |
| §7.4 focus refetch + refetch-after-save | Task 9 |
| §7 `onvorx.content.cache.v2` | Task 9 (`contentCache.ts`) |
| Carried (Plan 1): `image_path` from the real Storage key, not derived from `src` | Task 7 (`ImageRef.path`) + Task 3/5 (`*_path` columns set from the upload response) |
| Carried (Plan 2): dev middleware body-drain path-aware | Task 5 Step 6 (read body for non-GET; upload DELETE has a body) |

### Deferred to Plan 4 (polish)
- Code-split `@supabase/supabase-js` out of the entry chunk (`await import('./supabaseClient')` in `remote.ts` **and** wherever `adminApi` pulls it — re-measure).
- `/api/estimate` abuse controls (honeypot field + Vercel Firewall rate-limit).
- i18n the `EstimateForm` error string; `aria-busy`; double-submit early-return; `405 Allow` headers.
- Strengthen the weak assertions flagged in Plans 2 (`SiteContentProvider` unmount test) & 3.
- `mockRequests` → optionally a `--with-samples` dev seed.
- Consider `insert ... on conflict` for `seed.sql` instead of `truncate`.

### Notes for the executor
- **`api/_lib/adminRows.ts` importing `L` from `src/`:** don't. `api/` must not reach into `src/` (tsconfig scope + JSON). Define a local `interface L { en: string; uk: string }` in `adminRows.ts` (shown in Task 1 Step 3). The client (`src/admin/api.ts`) uses the real `L` from `src/admin/types.ts`; they are structurally identical.
- **`req.query` on Vercel:** available as `Record<string, string | string[]>`. The dev plugin must parse the query string off the URL itself. Normalize `string[]` → first element.
- **`req.body` parsing:** Vercel auto-parses `application/json` (confirmed in Plan 2). The dev plugin's `readJsonBody` must now run for `DELETE` too (upload delete carries a body) — widen the `method === 'POST'` check to `method !== 'GET' && method !== 'HEAD'`.
- **Storage `getPublicUrl`** never errors and works offline (pure string build) — safe in the handler.
- **RLS:** all writes use the service-role client which bypasses RLS; no policy changes. `estimate_requests` still has zero policies — only these functions touch it.
- **`resetContent` is destructive** (truncates card lists per `list`). It's gated by the existing confirm dialog in `SettingsPage`. Fine for launch (owner has no real edits yet); note in the verification step.
- Keep each task's commit green; `npm run e2e` is slow (~15 s + build) but non-negotiable for tasks touching `src/` or `api/` — Plan 2's final review caught a broken e2e that the unit gate missed.
- When wiring `moveCard`, remember the admin calls it per single up/down step; sending the full `orderedIds` each time is correct and idempotent.
