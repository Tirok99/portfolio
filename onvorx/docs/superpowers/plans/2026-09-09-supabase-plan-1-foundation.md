# Supabase Integration — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Supabase data layer — schema, seed, typed clients, and pure row↔model mappers — with zero change to how the app currently behaves.

**Architecture:** Add `@supabase/supabase-js`. A browser client (anon key, read-only) and a server client (service-role, used only by serverless functions) are each built by a small env-guarded factory. Pure mapper functions convert Postgres rows to the existing `AdminData`-shaped structures and back. The SQL schema (5 tables, `jsonb {en,uk}` translatable fields, RLS public-read on the 4 content tables) and a generated seed are produced and run manually in the Supabase SQL Editor. The dead build-time content pipeline is deleted.

**Tech Stack:** Vite 8 + React 19, TypeScript (strict), Vitest, `@supabase/supabase-js` v2, `@vercel/node` serverless functions (CJS-scoped via `api/package.json`), Supabase (Postgres + Storage).

**Spec:** [docs/superpowers/specs/2026-09-09-supabase-integration-design.md](../specs/2026-09-09-supabase-integration-design.md)

## Global Constraints

- Node `22.x` (`engines`), CI on Node `22.12` (`.nvmrc`). Local may be newer.
- Repo root is `"type": "module"`; `api/` is scoped back to `"type": "commonjs"` by `api/package.json` — do not remove that file.
- `api/` typecheck (`tsc -p tsconfig.api.json`) has `verbatimModuleSyntax: true`, `erasableSyntaxOnly: true`, `noUnusedLocals/Parameters: true`, and **no `resolveJsonModule`**. Anything under `api/` must use `import type` for type-only imports and must not import `.json`.
- Translatable DB columns are `jsonb` shaped exactly `{ "en": string, "uk": string }` (matches the `L` type in `src/admin/types.ts`).
- Bilingual UI convention elsewhere in the repo: locale keys are `en` and `uk` (the UK site is labelled "UA" but the key is `uk`).
- Do not change the `/admin` UI or the public site design in this plan.
- Vercel Hobby plan: max 12 serverless functions (currently 3; this plan adds 0).
- Tests live next to source as `*.test.ts(x)`; `npm test` runs Vitest, `e2e/**` excluded.
- Lint: `npm run lint` (oxlint) must stay at 0 errors.

---

## File structure (this plan)

| File | Responsibility |
|---|---|
| `package.json` | + `@supabase/supabase-js` (dep), + `tsx` (devDep), + `seed:gen` script; − `prebuild`/`postbuild`/`content:pull`/`content:restore` |
| `.env.example` | Documents the 4 Supabase env vars (2 browser, 2 server) + the existing admin vars |
| `src/content/env.ts` | Reads + validates `VITE_SUPABASE_*` from an injectable source; returns `{url, anonKey}` or `null` |
| `src/content/dbTypes.ts` | `Db*Row` interfaces — the shape of each Postgres table row (types only, no imports with runtime cost) |
| `src/content/mappers.ts` | Pure `rowsToSiteContent()` (read) — Postgres rows → `SiteContent` (the `AdminData` content slice); owns the `SiteContent` type |
| `src/content/supabaseClient.ts` | Lazy singleton `getSupabase()` — browser anon client or `null` |
| `api/_lib/types.ts` | + `SupabaseAdminEnv` interface |
| `api/_lib/supabaseAdmin.ts` | `getSupabaseAdmin(env)` — service-role client or `null` |
| `supabase/schema.sql` | Replaces the old CMS schema: 5 tables + `touch_updated_at` trigger + RLS |
| `scripts/gen-seed.ts` | Reads `src/content/defaults/*`, writes `supabase/seed.sql` |
| `supabase/seed.sql` | Generated INSERTs for the 6+8+4+8 content rows |
| `scripts/build-content.mjs`, `scripts/restore-content.mjs` | **Deleted** |
| `docs/CMS-SETUP.md` | Replaced with a short "content lives in Supabase, edited via /admin" note |

**Not touched in Plan 1:** `SiteContentProvider`, `persistence.ts`, `useSiteContent.ts`, any section component, any `src/admin/**` file, `EstimateForm`, `vite-plugins/**`. Those are Plan 2 (public read) and Plan 3 (admin write).

### Interfaces produced by this plan (consumed by Plans 2 & 3)

```ts
// src/content/env.ts
export interface SupabaseBrowserEnv { url: string; anonKey: string }
export function readSupabaseEnv(source?: Record<string, unknown>): SupabaseBrowserEnv | null

// src/content/dbTypes.ts
export interface DbSectionRow { key: string; eyebrow: L; title: L; body: L; cta_label: L | null }
export interface DbSeoRow { page_key: string; path: string; title: L; description: L }
export interface DbProjectRow {
  list: 'home' | 'page'; id: string; sort: number; published: boolean
  title: L; tags: string[]; description: L
  image_url: string | null; image_path: string | null; image_alt: L
}
export interface DbServiceRow {
  list: 'home' | 'page'; id: string; sort: number; published: boolean; featured: boolean
  title: L; text: L; icon_url: string | null; icon_path: string | null
}
export interface DbContentRows {
  sections: DbSectionRow[]; seo: DbSeoRow[]; projects: DbProjectRow[]; services: DbServiceRow[]
}

// src/content/mappers.ts
export interface SiteContent {
  sections: SectionText[]; seo: SeoEntry[]
  projectsHome: ProjectCard[]; projectsPage: ProjectCard[]
  servicesHome: ServiceCard[]; servicesPage: ServiceCard[]
}
export function rowsToSiteContent(rows: DbContentRows): SiteContent

// src/content/supabaseClient.ts
export function getSupabase(): SupabaseClient | null
export function __resetSupabaseForTest(): void

// api/_lib/types.ts
export interface SupabaseAdminEnv {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  SUPABASE_MEDIA_BUCKET?: string
}

// api/_lib/supabaseAdmin.ts
export function getSupabaseAdmin(env: SupabaseAdminEnv): SupabaseClient | null
```

---

## Task 1: Dependencies & env contract

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Create: `src/content/env.ts`
- Test: `src/content/env.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `readSupabaseEnv`, `SupabaseBrowserEnv` (see header)

- [ ] **Step 1: Install packages**

Run:
```bash
npm install @supabase/supabase-js@^2
npm install -D tsx@^4
```
Expected: `package.json` gains `"@supabase/supabase-js"` in `dependencies` and `"tsx"` in `devDependencies`; `package-lock.json` updates.

- [ ] **Step 2: Edit `package.json` scripts**

Remove these four scripts entirely:
```
"prebuild": "node scripts/build-content.mjs",
"postbuild": "node scripts/restore-content.mjs",
"content:pull": "node scripts/build-content.mjs",
"content:restore": "node scripts/restore-content.mjs",
```
Add:
```
"seed:gen": "tsx scripts/gen-seed.ts",
```
Leave `"build": "tsc -b && tsc -p tsconfig.api.json && vite build"` unchanged.

- [ ] **Step 3: Rewrite `.env.example`**

Replace the whole file with:
```dotenv
# ── Supabase: browser (anon) — embedded in the client bundle, read-only via RLS ──
# Vite only exposes vars prefixed with VITE_.
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY

# ── Supabase: server — used only by api/ serverless functions, never shipped ──
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
# Optional; defaults to "public-media"
# SUPABASE_MEDIA_BUCKET=public-media

# ── Admin panel — server-only, used by api/admin/* ──
# ADMIN_PASSWORD       — the single shared password for /admin
# ADMIN_SESSION_SECRET — long random string, signs the session cookie (HMAC-SHA256)
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
```

- [ ] **Step 4: Write the failing test**

Create `src/content/env.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readSupabaseEnv } from './env'

describe('readSupabaseEnv', () => {
  it('returns null when either var is missing', () => {
    expect(readSupabaseEnv({})).toBeNull()
    expect(readSupabaseEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull()
    expect(readSupabaseEnv({ VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull()
  })

  it('returns null when a var is present but blank', () => {
    expect(
      readSupabaseEnv({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: 'k' }),
    ).toBeNull()
  })

  it('returns the trimmed pair when both are set', () => {
    expect(
      readSupabaseEnv({
        VITE_SUPABASE_URL: ' https://x.supabase.co ',
        VITE_SUPABASE_ANON_KEY: ' anon-key ',
      }),
    ).toEqual({ url: 'https://x.supabase.co', anonKey: 'anon-key' })
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm test -- src/content/env.test.ts`
Expected: FAIL — `Cannot find module './env'`.

- [ ] **Step 6: Implement `src/content/env.ts`**

```ts
export interface SupabaseBrowserEnv {
  url: string
  anonKey: string
}

/**
 * Reads the browser Supabase config. `source` is injectable for tests; in the
 * app it defaults to Vite's `import.meta.env`. Returns `null` (not a throw) when
 * unconfigured so the app can fall back to bundled defaults.
 */
export function readSupabaseEnv(
  source: Record<string, unknown> = import.meta.env as unknown as Record<string, unknown>,
): SupabaseBrowserEnv | null {
  const url = typeof source.VITE_SUPABASE_URL === 'string' ? source.VITE_SUPABASE_URL.trim() : ''
  const anonKey =
    typeof source.VITE_SUPABASE_ANON_KEY === 'string' ? source.VITE_SUPABASE_ANON_KEY.trim() : ''
  if (!url || !anonKey) return null
  return { url, anonKey }
}
```

- [ ] **Step 7: Run tests + lint + typecheck**

Run:
```bash
npm test -- src/content/env.test.ts
npm run lint
npx tsc -p tsconfig.app.json --noEmit
```
Expected: test PASS, lint 0 errors, typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json .env.example src/content/env.ts src/content/env.test.ts
git commit -m "feat(supabase): add client dep + browser env contract"
```

---

## Task 2: Browser Supabase client

**Files:**
- Create: `src/content/supabaseClient.ts`
- Test: `src/content/supabaseClient.test.ts`

**Interfaces:**
- Consumes: `readSupabaseEnv` (Task 1)
- Produces: `getSupabase(): SupabaseClient | null`, `__resetSupabaseForTest(): void`

- [ ] **Step 1: Write the failing test**

Create `src/content/supabaseClient.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const createClient = vi.fn(() => ({ mock: true }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

import { getSupabase, __resetSupabaseForTest } from './supabaseClient'
import * as env from './env'

beforeEach(() => {
  __resetSupabaseForTest()
  createClient.mockClear()
})

describe('getSupabase', () => {
  it('returns null and does not construct a client when env is absent', () => {
    vi.spyOn(env, 'readSupabaseEnv').mockReturnValue(null)
    expect(getSupabase()).toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('constructs once and caches', () => {
    vi.spyOn(env, 'readSupabaseEnv').mockReturnValue({ url: 'u', anonKey: 'k' })
    const a = getSupabase()
    const b = getSupabase()
    expect(a).toBe(b)
    expect(createClient).toHaveBeenCalledTimes(1)
    expect(createClient).toHaveBeenCalledWith('u', 'k', expect.objectContaining({
      auth: expect.objectContaining({ persistSession: false }),
    }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/content/supabaseClient.test.ts`
Expected: FAIL — `Cannot find module './supabaseClient'`.

- [ ] **Step 3: Implement `src/content/supabaseClient.ts`**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readSupabaseEnv } from './env'

let cached: SupabaseClient | null | undefined

/** The browser anon client, or `null` when Supabase env is not configured. */
export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached
  const env = readSupabaseEnv()
  cached = env
    ? createClient(env.url, env.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null
  return cached
}

/** Test-only: drops the memoised instance. */
export function __resetSupabaseForTest(): void {
  cached = undefined
}
```

- [ ] **Step 4: Run test + lint + typecheck**

Run:
```bash
npm test -- src/content/supabaseClient.test.ts
npm run lint
npx tsc -p tsconfig.app.json --noEmit
```
Expected: PASS, 0 lint errors, clean typecheck.

- [ ] **Step 5: Commit**

```bash
git add src/content/supabaseClient.ts src/content/supabaseClient.test.ts
git commit -m "feat(supabase): lazy browser client factory"
```

---

## Task 3: Service-role client (server)

**Files:**
- Modify: `api/_lib/types.ts`
- Create: `api/_lib/supabaseAdmin.ts`
- Test: `api/_lib/supabaseAdmin.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `SupabaseAdminEnv`, `getSupabaseAdmin(env): SupabaseClient | null`

- [ ] **Step 1: Extend `api/_lib/types.ts`**

Append:
```ts
export interface SupabaseAdminEnv {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  SUPABASE_MEDIA_BUCKET?: string
}
```

- [ ] **Step 2: Write the failing test**

Create `api/_lib/supabaseAdmin.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const createClient = vi.fn(() => ({ mock: true }))
vi.mock('@supabase/supabase-js', () => ({ createClient }))

import { getSupabaseAdmin } from './supabaseAdmin'

beforeEach(() => createClient.mockClear())

describe('getSupabaseAdmin', () => {
  it('returns null when url or key is missing', () => {
    expect(getSupabaseAdmin({})).toBeNull()
    expect(getSupabaseAdmin({ SUPABASE_URL: 'u' })).toBeNull()
    expect(getSupabaseAdmin({ SUPABASE_SERVICE_ROLE_KEY: 'k' })).toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('builds a non-persistent client when both are present', () => {
    getSupabaseAdmin({ SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k' })
    expect(createClient).toHaveBeenCalledWith('u', 'k', expect.objectContaining({
      auth: expect.objectContaining({ persistSession: false, autoRefreshToken: false }),
    }))
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- api/_lib/supabaseAdmin.test.ts`
Expected: FAIL — `Cannot find module './supabaseAdmin'`.

- [ ] **Step 4: Implement `api/_lib/supabaseAdmin.ts`**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SupabaseAdminEnv } from './types'

/**
 * The service-role client. Bypasses RLS — only ever call this from serverless
 * functions after an auth check. Returns `null` when env is not configured so
 * callers can answer 500 "not configured" instead of throwing at import time.
 */
export function getSupabaseAdmin(env: SupabaseAdminEnv): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

- [ ] **Step 5: Run test + lint + api typecheck**

Run:
```bash
npm test -- api/_lib/supabaseAdmin.test.ts
npm run lint
npm run typecheck:api
```
Expected: PASS, 0 lint errors, clean typecheck.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/types.ts api/_lib/supabaseAdmin.ts api/_lib/supabaseAdmin.test.ts
git commit -m "feat(supabase): service-role client factory for api/"
```

---

## Task 4: Row types & read mapper

**Files:**
- Create: `src/content/dbTypes.ts`
- Create: `src/content/mappers.ts`
- Test: `src/content/mappers.test.ts`

**Interfaces:**
- Consumes: `L`, `SectionText`, `SeoEntry`, `ProjectCard`, `ServiceCard`, `SectionKey`, `SeoPageKey` from `src/admin/types.ts`; `defaultSections` from `src/content/defaults/sections.ts`; `defaultSeo` from `src/content/defaults/seo.ts`
- Produces: `DbSectionRow`, `DbSeoRow`, `DbProjectRow`, `DbServiceRow`, `DbContentRows`, `SiteContent`, `rowsToSiteContent` (see header)

- [ ] **Step 1: Create `src/content/dbTypes.ts`**

```ts
import type { L } from '../admin/types'

export interface DbSectionRow {
  key: string
  eyebrow: L
  title: L
  body: L
  cta_label: L | null
}

export interface DbSeoRow {
  page_key: string
  path: string
  title: L
  description: L
}

export interface DbProjectRow {
  list: 'home' | 'page'
  id: string
  sort: number
  published: boolean
  title: L
  tags: string[]
  description: L
  image_url: string | null
  image_path: string | null
  image_alt: L
}

export interface DbServiceRow {
  list: 'home' | 'page'
  id: string
  sort: number
  published: boolean
  featured: boolean
  title: L
  text: L
  icon_url: string | null
  icon_path: string | null
}

export interface DbContentRows {
  sections: DbSectionRow[]
  seo: DbSeoRow[]
  projects: DbProjectRow[]
  services: DbServiceRow[]
}
```

- [ ] **Step 2: Write the failing test**

Create `src/content/mappers.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { rowsToSiteContent } from './mappers'
import type { DbContentRows } from './dbTypes'
import { defaultSections } from './defaults/sections'

const L = (en: string, uk = en) => ({ en, uk })

const rows: DbContentRows = {
  sections: [
    { key: 'hero', eyebrow: L('E'), title: L('T'), body: L('B'), cta_label: L('Go') },
    { key: 'about', eyebrow: L('AE'), title: L('AT'), body: L('AB'), cta_label: null },
  ],
  seo: [{ page_key: 'home', path: '/', title: L('HT'), description: L('HD') }],
  projects: [
    { list: 'home', id: 'p2', sort: 1, published: true, title: L('P2'), tags: ['x'],
      description: L('d2'), image_url: 'https://cdn/x.webp', image_path: 'projects/x.webp', image_alt: L('a2') },
    { list: 'home', id: 'p1', sort: 0, published: false, title: L('P1'), tags: [],
      description: L('d1'), image_url: '/assets/projects/p1.png', image_path: null, image_alt: L('a1') },
    { list: 'page', id: 'p1', sort: 0, published: true, title: L('P1p'), tags: [],
      description: L('d1p'), image_url: null, image_path: null, image_alt: L('') },
  ],
  services: [
    { list: 'home', id: 's1', sort: 0, published: true, featured: true, title: L('S1'),
      text: L('t1'), icon_url: '/assets/services/icon-web.png', icon_path: null },
  ],
}

describe('rowsToSiteContent', () => {
  it('maps sections, attaching the code-owned label and ctaLabel only when present', () => {
    const c = rowsToSiteContent(rows)
    const hero = c.sections.find((s) => s.key === 'hero')!
    expect(hero.title).toEqual(L('T'))
    expect(hero.label).toBe(defaultSections.find((s) => s.key === 'hero')!.label)
    expect(hero.ctaLabel).toEqual(L('Go'))
    expect(c.sections.find((s) => s.key === 'about')!.ctaLabel).toBeUndefined()
  })

  it('maps seo entries with path from defaults', () => {
    const c = rowsToSiteContent(rows)
    expect(c.seo[0]).toMatchObject({ pageKey: 'home', path: '/', title: L('HT') })
  })

  it('splits project cards by list and sorts by sort → order', () => {
    const c = rowsToSiteContent(rows)
    expect(c.projectsHome.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(c.projectsHome.map((p) => p.order)).toEqual([0, 1])
    expect(c.projectsPage.map((p) => p.id)).toEqual(['p1'])
  })

  it('derives ImageRef.kind from image_path and src from image_url (null → "")', () => {
    const c = rowsToSiteContent(rows)
    const p2 = c.projectsHome.find((p) => p.id === 'p2')!
    const p1p = c.projectsPage[0]
    expect(p2.image).toEqual({ kind: 'upload', src: 'https://cdn/x.webp' })
    expect(p1p.image).toEqual({ kind: 'asset', src: '' })
  })

  it('maps service cards including featured + icon', () => {
    const c = rowsToSiteContent(rows)
    expect(c.servicesHome[0]).toMatchObject({
      id: 's1', featured: true, order: 0, published: true,
      icon: { kind: 'asset', src: '/assets/services/icon-web.png' },
    })
    expect(c.servicesPage).toEqual([])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/content/mappers.test.ts`
Expected: FAIL — `Cannot find module './mappers'`.

- [ ] **Step 4: Implement `src/content/mappers.ts`**

```ts
import type {
  L,
  ProjectCard,
  SectionKey,
  SectionText,
  SeoEntry,
  SeoPageKey,
  ServiceCard,
} from '../admin/types'
import type {
  DbContentRows,
  DbProjectRow,
  DbSectionRow,
  DbSeoRow,
  DbServiceRow,
} from './dbTypes'
import { defaultSections } from './defaults/sections'
import { defaultSeo } from './defaults/seo'

export interface SiteContent {
  sections: SectionText[]
  seo: SeoEntry[]
  projectsHome: ProjectCard[]
  projectsPage: ProjectCard[]
  servicesHome: ServiceCard[]
  servicesPage: ServiceCard[]
}

const SECTION_ORDER = defaultSections.map((s) => s.key)
const SECTION_LABEL = new Map(defaultSections.map((s) => [s.key, s.label]))
const SEO_ORDER = defaultSeo.map((s) => s.pageKey)
const SEO_META = new Map(defaultSeo.map((s) => [s.pageKey, { label: s.label, path: s.path }]))

const asL = (v: L): L => ({ en: v?.en ?? '', uk: v?.uk ?? '' })

function rowToSection(row: DbSectionRow): SectionText {
  const s: SectionText = {
    key: row.key as SectionKey,
    label: SECTION_LABEL.get(row.key as SectionKey) ?? row.key,
    eyebrow: asL(row.eyebrow),
    title: asL(row.title),
    body: asL(row.body),
  }
  if (row.cta_label) s.ctaLabel = asL(row.cta_label)
  return s
}

function rowToSeo(row: DbSeoRow): SeoEntry {
  const meta = SEO_META.get(row.page_key as SeoPageKey)
  return {
    pageKey: row.page_key as SeoPageKey,
    label: meta?.label ?? row.page_key,
    path: row.path || meta?.path || '/',
    title: asL(row.title),
    description: asL(row.description),
  }
}

function rowToProjectCard(row: DbProjectRow, order: number): ProjectCard {
  return {
    id: row.id,
    order,
    published: row.published,
    title: asL(row.title),
    tags: [...(row.tags ?? [])],
    description: asL(row.description),
    image: { kind: row.image_path ? 'upload' : 'asset', src: row.image_url ?? '' },
    imageAlt: asL(row.image_alt),
  }
}

function rowToServiceCard(row: DbServiceRow, order: number): ServiceCard {
  return {
    id: row.id,
    order,
    published: row.published,
    featured: row.featured,
    title: asL(row.title),
    text: asL(row.text),
    icon: { kind: row.icon_path ? 'upload' : 'asset', src: row.icon_url ?? '' },
  }
}

const bySort = <T extends { sort: number }>(a: T, b: T) => a.sort - b.sort

/** Postgres rows → the content slice of `AdminData` (no `requests`, no `version`). */
export function rowsToSiteContent(rows: DbContentRows): SiteContent {
  const sections = [...rows.sections]
    .sort((a, b) => SECTION_ORDER.indexOf(a.key as SectionKey) - SECTION_ORDER.indexOf(b.key as SectionKey))
    .map(rowToSection)

  const seo = [...rows.seo]
    .sort((a, b) => SEO_ORDER.indexOf(a.page_key as SeoPageKey) - SEO_ORDER.indexOf(b.page_key as SeoPageKey))
    .map(rowToSeo)

  const projectsFor = (list: 'home' | 'page') =>
    rows.projects.filter((r) => r.list === list).sort(bySort).map((r, i) => rowToProjectCard(r, i))
  const servicesFor = (list: 'home' | 'page') =>
    rows.services.filter((r) => r.list === list).sort(bySort).map((r, i) => rowToServiceCard(r, i))

  return {
    sections,
    seo,
    projectsHome: projectsFor('home'),
    projectsPage: projectsFor('page'),
    servicesHome: servicesFor('home'),
    servicesPage: servicesFor('page'),
  }
}
```

- [ ] **Step 5: Run test + lint + typecheck**

Run:
```bash
npm test -- src/content/mappers.test.ts
npm run lint
npx tsc -p tsconfig.app.json --noEmit
```
Expected: all 6 assertions PASS, lint 0, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/content/dbTypes.ts src/content/mappers.ts src/content/mappers.test.ts
git commit -m "feat(supabase): row types + rowsToSiteContent read mapper"
```

---

## Task 5: SQL schema

**Files:**
- Modify (replace contents): `supabase/schema.sql`

**Interfaces:**
- Consumes: nothing
- Produces: the live tables the mappers and (Plans 2–3) the clients read/write

- [ ] **Step 1: Replace `supabase/schema.sql`**

```sql
-- ============================================================================
--  ONVORX — content schema (Supabase). Run in SQL Editor, then run seed.sql.
--  Translatable fields are jsonb: {"en": "...", "uk": "..."}.
-- ============================================================================

-- ---- 1. section texts ------------------------------------------------------
create table if not exists public.site_sections (
  key        text primary key
             check (key in ('hero','services','projects','howWork','about','cta')),
  eyebrow    jsonb not null default '{"en":"","uk":""}',
  title      jsonb not null default '{"en":"","uk":""}',
  body       jsonb not null default '{"en":"","uk":""}',
  cta_label  jsonb,
  updated_at timestamptz not null default now()
);

-- ---- 2. per-page SEO -----------------------------------------------------
create table if not exists public.seo_pages (
  page_key    text primary key,
  path        text not null,
  title       jsonb not null default '{"en":"","uk":""}',
  description jsonb not null default '{"en":"","uk":""}',
  updated_at  timestamptz not null default now()
);

-- ---- 3. project cards --------------------------------------------------
create table if not exists public.projects (
  list        text not null check (list in ('home','page')),
  id          text not null,
  sort        int  not null default 0,
  published   boolean not null default false,
  title       jsonb not null default '{"en":"","uk":""}',
  tags        text[] not null default '{}',
  description jsonb not null default '{"en":"","uk":""}',
  image_url   text,
  image_path  text,
  image_alt   jsonb not null default '{"en":"","uk":""}',
  updated_at  timestamptz not null default now(),
  primary key (list, id)
);

-- ---- 4. service cards -------------------------------------------------
create table if not exists public.services (
  list       text not null check (list in ('home','page')),
  id         text not null,
  sort       int  not null default 0,
  published  boolean not null default false,
  featured   boolean not null default false,
  title      jsonb not null default '{"en":"","uk":""}',
  text       jsonb not null default '{"en":"","uk":""}',
  icon_url   text,
  icon_path  text,
  updated_at timestamptz not null default now(),
  primary key (list, id)
);

-- ---- 5. estimate requests -------------------------------------------
create table if not exists public.estimate_requests (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  status        text not null default 'new'
                check (status in ('new','in_progress','done','archived')),
  name          text not null,
  email         text not null,
  company       text,
  budget        text check (budget in ('<1k','1-3k','3-10k','10k+','not_sure')),
  interested_in text[] not null default '{}',
  message       text not null,
  locale        text not null check (locale in ('en','uk')),
  source_page   text,
  note          text,
  updated_at    timestamptz not null default now()
);

-- ---- 6. keep updated_at fresh -------------------------------------
create or replace function public.touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['site_sections','seo_pages','projects','services','estimate_requests'] loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger trg_touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---- 7. row-level security ------------------------------------------
alter table public.site_sections     enable row level security;
alter table public.seo_pages         enable row level security;
alter table public.projects          enable row level security;
alter table public.services          enable row level security;
alter table public.estimate_requests enable row level security;

drop policy if exists "public read" on public.site_sections;
drop policy if exists "public read" on public.seo_pages;
drop policy if exists "public read" on public.projects;
drop policy if exists "public read" on public.services;

create policy "public read" on public.site_sections for select using (true);
create policy "public read" on public.seo_pages     for select using (true);
create policy "public read" on public.projects      for select using (true);
create policy "public read" on public.services      for select using (true);

-- estimate_requests: no policies at all → only the service role can touch it.
-- All writes to every table go through serverless functions (service role).
```

- [ ] **Step 2: Provision + run**

1. Create a Supabase project at supabase.com (region close to Vercel's; note the project ref).
2. SQL Editor → paste the file → Run. Expect "Success. No rows returned".
3. SQL Editor → run each check, expect 0 rows but no error:
```sql
select * from site_sections;
select * from projects;
select * from estimate_requests;
```

- [ ] **Step 3: Verify RLS shape**

Run in SQL Editor:
```sql
select tablename, policyname, cmd
from pg_policies where schemaname = 'public' order by tablename;
```
Expected: exactly 4 rows, all `cmd = SELECT`, one per content table; **no** row for `estimate_requests`.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(supabase): content schema — 5 tables, jsonb i18n, RLS public-read"
```

---

## Task 6: Seed generator

**Files:**
- Create: `scripts/gen-seed.ts`
- Create (generated, committed): `supabase/seed.sql`
- Delete: `supabase/seed.sql` old contents are overwritten by the generator

**Interfaces:**
- Consumes: `buildDefaults` from `src/content/defaults/index.ts`
- Produces: `supabase/seed.sql`

- [ ] **Step 1: Write the failing test**

Create `scripts/gen-seed.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildSeedSql } from './gen-seed'

describe('buildSeedSql', () => {
  const sql = buildSeedSql()

  it('is idempotent-friendly: truncates before inserting', () => {
    expect(sql).toMatch(/truncate table public\.site_sections/i)
  })

  it('inserts 6 sections, 8 seo pages', () => {
    expect(sql.match(/insert into public\.site_sections/gi) ?? []).toHaveLength(6)
    expect(sql.match(/insert into public\.seo_pages/gi) ?? []).toHaveLength(8)
  })

  it('inserts each project/service card twice — once per list', () => {
    // 2 projects × 2 lists, 4 services × 2 lists
    expect(sql.match(/insert into public\.projects/gi) ?? []).toHaveLength(4)
    expect(sql.match(/insert into public\.services/gi) ?? []).toHaveLength(8)
  })

  it("escapes single quotes in text and emits jsonb with both locales", () => {
    expect(sql).not.toMatch(/''\s*'',/) // no broken escapes
    expect(sql).toMatch(/'\{"en":/) // jsonb literal present
  })

  it('does NOT insert any estimate_requests', () => {
    expect(sql).not.toMatch(/insert into public\.estimate_requests/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- scripts/gen-seed.test.ts`
Expected: FAIL — `Cannot find module './gen-seed'`.

- [ ] **Step 3: Implement `scripts/gen-seed.ts`**

```ts
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildDefaults } from '../src/content/defaults/index'
import type { L, ProjectCard, ServiceCard } from '../src/admin/types'

const q = (s: string) => `'${s.replace(/'/g, "''")}'`
const jsonb = (v: L) => q(JSON.stringify({ en: v.en ?? '', uk: v.uk ?? '' }))
const textArr = (a: string[]) => `array[${a.map(q).join(',')}]::text[]`
const bool = (b: boolean) => (b ? 'true' : 'false')
const nullable = (s: string | null | undefined) => (s ? q(s) : 'null')

function projectRows(list: 'home' | 'page', cards: ProjectCard[]): string[] {
  return cards.map((c, i) => {
    const path = c.image.kind === 'upload' ? c.image.src.split('/').slice(-2).join('/') : null
    return (
      `insert into public.projects (list,id,sort,published,title,tags,description,image_url,image_path,image_alt) values (` +
      `${q(list)},${q(c.id)},${i},${bool(c.published)},${jsonb(c.title)},${textArr(c.tags)},` +
      `${jsonb(c.description)},${nullable(c.image.src || null)},${nullable(path)},${jsonb(c.imageAlt)});`
    )
  })
}

function serviceRows(list: 'home' | 'page', cards: ServiceCard[]): string[] {
  return cards.map((c, i) =>
    `insert into public.services (list,id,sort,published,featured,title,text,icon_url,icon_path) values (` +
    `${q(list)},${q(c.id)},${i},${bool(c.published)},${bool(c.featured)},${jsonb(c.title)},` +
    `${jsonb(c.text)},${nullable(c.icon.src || null)},null);`,
  )
}

export function buildSeedSql(): string {
  const d = buildDefaults()
  const lines: string[] = [
    '-- GENERATED by scripts/gen-seed.ts — do not edit by hand. Run: npm run seed:gen',
    'begin;',
    'truncate table public.site_sections, public.seo_pages, public.projects, public.services;',
    '',
  ]

  for (const s of d.sections) {
    lines.push(
      `insert into public.site_sections (key,eyebrow,title,body,cta_label) values (` +
      `${q(s.key)},${jsonb(s.eyebrow)},${jsonb(s.title)},${jsonb(s.body)},` +
      `${s.ctaLabel ? jsonb(s.ctaLabel) : 'null'});`,
    )
  }
  lines.push('')
  for (const e of d.seo) {
    lines.push(
      `insert into public.seo_pages (page_key,path,title,description) values (` +
      `${q(e.pageKey)},${q(e.path)},${jsonb(e.title)},${jsonb(e.description)});`,
    )
  }
  lines.push('')
  lines.push(...projectRows('home', d.projectsHome))
  lines.push(...projectRows('page', d.projectsPage))
  lines.push('')
  lines.push(...serviceRows('home', d.servicesHome))
  lines.push(...serviceRows('page', d.servicesPage))
  lines.push('', 'commit;', '')
  return lines.join('\n')
}

// Executed only when run directly (`npm run seed:gen`), not when imported by the test.
const isMain = process.argv[1] === fileURLToPath(import.meta.url)
if (isMain) {
  const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'seed.sql')
  writeFileSync(out, buildSeedSql())
  console.log(`[seed] wrote ${out}`)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- scripts/gen-seed.test.ts`
Expected: all 5 assertions PASS.

- [ ] **Step 5: Generate the seed and run it**

Run:
```bash
npm run seed:gen
```
Expected: `supabase/seed.sql` is (over)written. Open it, sanity-check that `relax-ahill` and `web-development` appear and quotes look balanced.

Then: Supabase SQL Editor → paste `supabase/seed.sql` → Run. Then verify:
```sql
select count(*) from site_sections;   -- 6
select count(*) from seo_pages;       -- 8
select count(*) from projects;        -- 4
select count(*) from services;        -- 8
select list, id, sort from projects order by list, sort;
```

- [ ] **Step 6: Lint + typecheck + commit**

Run:
```bash
npm run lint
npx tsc -p tsconfig.app.json --noEmit
```
(`scripts/gen-seed.ts` imports from `src/` so it is covered by the app tsconfig include only if under `src`; if `tsc` complains that `scripts/` is not included, that is expected — the file is exercised by its Vitest test and `tsx` at runtime. Do not add `scripts/` to `tsconfig.app.json`.)

```bash
git add scripts/gen-seed.ts scripts/gen-seed.test.ts supabase/seed.sql
git commit -m "feat(supabase): seed generator + generated seed.sql"
```

---

## Task 7: Remove the dead build-time content pipeline

**Files:**
- Delete: `scripts/build-content.mjs`
- Delete: `scripts/restore-content.mjs`
- Delete (if present): `src/i18n/.base/` directory
- Modify: `docs/CMS-SETUP.md`
- Check: `.gitignore` for a `.base` entry to remove

**Interfaces:**
- Consumes: nothing
- Produces: nothing (cleanup)

- [ ] **Step 1: Confirm nothing else references the scripts**

Run:
```bash
grep -rn "build-content\|restore-content\|content:pull\|content:restore\|i18n/.base\|\.base/" --include=*.ts --include=*.tsx --include=*.mjs --include=*.json --include=*.yml . || echo "no refs"
```
Expected: only hits are inside the files this task deletes/edits (and possibly a stale `.gitignore` line). The `package.json` scripts were already removed in Task 1.

- [ ] **Step 2: Delete the files**

```bash
git rm scripts/build-content.mjs scripts/restore-content.mjs
rm -rf src/i18n/.base
```
If `.gitignore` has a line for `src/i18n/.base` or `**/.base`, remove that line.

- [ ] **Step 3: Replace `docs/CMS-SETUP.md`**

```markdown
# Content & CMS

Editable site content (section texts, project & service cards, per-page SEO) and
"Request an Estimate" submissions live in **Supabase** and are edited through the
password-gated **`/admin`** panel. The public site reads them at runtime via the
Supabase anon key (RLS: public read on content tables only).

- Schema: `supabase/schema.sql` — run once in the Supabase SQL Editor.
- Seed: `supabase/seed.sql` — generated from `src/content/defaults/*` by
  `npm run seed:gen`; run once after the schema.
- Images: Supabase Storage bucket `public-media` (`projects/`, `services/`).
- Env vars: see `.env.example`.

Design docs: `docs/superpowers/specs/2026-09-09-supabase-integration-design.md`.

There is **no** build-time content step — the old `scripts/build-content.mjs`
pipeline was removed on the Supabase migration.
```

- [ ] **Step 4: Verify the build is unaffected**

Run:
```bash
npm run build
```
Expected: `tsc -b` clean, `tsc -p tsconfig.api.json` clean, `vite build` succeeds, `dist/` produced. No "prebuild"/"postbuild" output. (The pre-existing `--omit=dev` caveat from the admin-panel notes still applies and is unrelated.)

- [ ] **Step 5: Full test + lint sweep**

Run:
```bash
npm test
npm run lint
```
Expected: all suites green (including the pre-existing 153 + the new tests from Tasks 1–6), lint 0 errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(supabase): remove dead build-time content pipeline"
```

---

## Task 8: Wire env vars & document Storage bucket

**Files:**
- Create: `supabase/STORAGE.md`
- (No code — provisioning + docs)

**Interfaces:**
- Consumes: nothing
- Produces: the `public-media` bucket + env vars that Plans 2 & 3 rely on

- [ ] **Step 1: Create the Storage bucket**

Supabase dashboard → Storage → New bucket:
- Name: `public-media`
- Public bucket: **on**
- File size limit: `2 MB`
- Allowed MIME types: `image/png, image/jpeg, image/webp, image/svg+xml`

- [ ] **Step 2: Document it — create `supabase/STORAGE.md`**

```markdown
# Supabase Storage — `public-media`

Public bucket. Read: anyone, by public URL. Write: only the serverless
functions (`api/admin/upload`) using the service-role key.

```
public-media/
  projects/   project card images   projects/<id>-<8hex>.<ext>
  services/   service card icons    services/<id>-<8hex>.<ext>
```

- Size limit 2 MB; MIME `image/png,image/jpeg,image/webp,image/svg+xml`.
- Repo assets under `public/assets/**` are NOT stored here; seeded rows point at
  `/assets/...` paths and are served by the app itself.
- Object names carry a random 8-hex suffix so replacing an image busts caches.
```

- [ ] **Step 3: Set env vars in Vercel**

Vercel → project `portfolio` → Settings → Environment Variables. Add for
**Production** and **Preview**:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → `anon` `public` |
| `SUPABASE_URL` | same as `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` (secret) |

- [ ] **Step 4: Set env vars locally**

Append to `.env.local` (gitignored) the same 4 vars with the real values.
Keep the existing `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` lines.

- [ ] **Step 5: Smoke-test the browser client against the live project**

Create a throwaway check and run it with tsx:
```bash
cat > /tmp/sb-check.ts <<'EOF'
import { createClient } from '@supabase/supabase-js'
const c = createClient(process.env.SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)
const { data, error } = await c.from('site_sections').select('key')
console.log({ error, keys: data?.map((r) => r.key) })
const w = await c.from('estimate_requests').select('id')
console.log('estimate_requests read (should error/empty):', w.error?.code ?? w.data)
EOF
node --env-file=.env.local --experimental-strip-types /tmp/sb-check.ts
```
Expected: `keys` lists the 6 section keys; the `estimate_requests` read returns
an empty array or a permission error (never real rows). Delete `/tmp/sb-check.ts`.

- [ ] **Step 6: Commit**

```bash
git add supabase/STORAGE.md
git commit -m "docs(supabase): storage bucket + env var setup"
```

---

## Self-review — spec coverage

| Spec section | Covered by |
|---|---|
| §4.1–4.5 schema | Task 5 |
| §4.6 relations (no FKs, composite PK) | Task 5 (`primary key (list, id)`, no FKs) |
| §4.7 RLS | Task 5 steps 1 & 3 |
| §5 Storage bucket + folders + limits | Task 8 |
| §6 seed / migration of mock data | Task 6 |
| §6 `estimate_requests` starts empty | Task 6 (test asserts no insert) |
| §9.1 dependency | Task 1 |
| §9.2 `supabaseClient.ts` | Task 2 |
| §9.2 `mappers.ts` (read direction) | Task 4 |
| §9.2 `dbTypes` | Task 4 |
| §9.4 `_lib/supabaseAdmin.ts`, `_lib/types.ts` | Task 3 |
| §9.5 remove `build-content.mjs`/`restore-content.mjs`, package scripts | Tasks 1 & 7 |
| §9.5 replace `supabase/schema.sql` / `seed.sql` | Tasks 5 & 6 |
| §9.5 rewrite `docs/CMS-SETUP.md` | Task 7 |
| §10 env vars | Tasks 1 (`.env.example`) & 8 (Vercel + local) |

**Deferred to Plan 2 (public read):** `persistence.ts` rewrite, `SiteContentProvider` async load + cache + focus refetch, `EstimateForm` → `POST /api/estimate` + `api/estimate.ts` + dev-plugin route, `AdminData` type reshape (drop `requests`), `SiteContent` wired into the provider.

**Deferred to Plan 3 (admin write):** `_lib/contentHandlers.ts`, `api/admin/{content,cards,upload,requests}.ts`, write-direction mappers, `src/admin/api.ts`, optimistic async `actions.*`, `useRequests()` hook, `RequestsPage`/`DashboardPage`/`ProjectsPage`/`ServicesPage`/`ImageUpload` wiring, e2e strategy.

## Notes for the executor

- If `tsc -p tsconfig.api.json` ever tries to compile `src/content/dbTypes.ts` and fails on `verbatimModuleSyntax`, confirm every import there is `import type`. It is, as written. Plan 3 handlers import `dbTypes` as `import type` only.
- `import.meta.env` in `src/content/env.ts` is fine under Vitest (jsdom + Vite transform). The test never touches the default arg — it always injects `source`.
- Do not "fix" the `api/package.json` `{"type":"commonjs"}` file — it is load-bearing (see the admin-panel notes / commit `9572ad9`).
- Keep commits small and green; `npm test` + `npm run lint` must pass at every commit boundary.
