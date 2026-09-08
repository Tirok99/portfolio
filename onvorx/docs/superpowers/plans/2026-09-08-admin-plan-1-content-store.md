# Admin Plan 1 — Content Store + Public-Site Wiring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the ONVORX marketing site's managed content behind a shared, localStorage-backed store so a future `/admin` panel can edit it and changes render on the live site immediately.

**Architecture:** A `SiteContentProvider` holds an `AdminData` object seeded from the current site content (i18n JSON) and persisted to `localStorage`. Pure reducer functions in `actions.ts` produce new `AdminData`. The six Home sections read their managed fields from `useSiteContent()` (keeping `useI18n()` for unmanaged strings). Per-page SEO becomes real via a `<DocumentHead>` driven by a route→page map. A public `<EstimateForm>` writes submissions into the same store.

**Tech Stack:** Vite 8, React 19, React Router 7, TypeScript (bundler mode, `verbatimModuleSyntax`), plain CSS with design tokens. Tests: Vitest + @testing-library/react + jsdom. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-08-admin-panel-design.md`

## Global Constraints

- **No database, no Supabase/Firebase, no external services.** Persistence is `localStorage` only (key `onvorx.admin.v1`).
- **No new runtime dependencies.** New dev dependencies allowed: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`.
- **TypeScript:** `verbatimModuleSyntax` is on — every type-only import MUST use `import type`. `erasableSyntaxOnly` is on — no `enum`, no constructor parameter properties, no namespaces. `noUnusedLocals` / `noUnusedParameters` are on.
- **Bilingual:** every user-facing text value is `L = { en: string; uk: string }`. `uk.json` currently mirrors `en.json` (English text) — seed both from their files as-is.
- **Managed content only** (NOT a universal CMS): section header texts (eyebrow / title / body, plus Hero & CTA button labels), the Home Projects cards, the Home Services cards, separate Projects-page and Services-page card lists (no public consumer yet), SEO title + meta description for 8 pages, and the estimate-request inbox. Do not add editing for Hero feature cards, How-we-work steps, About stats, nav, or footer.
- **Approach B:** admin edits reflect on the live site through the shared provider. Seed data equals current content, so nothing changes visually until edited.
- **Lint/build gates:** `npm run lint` (oxlint) clean; `npm run build` (`tsc -b && vite build`) passes.
- **Commit style:** end every commit message with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Work happens on branch `feature/admin-panel`.

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `vitest` setup: `src/test/setup.ts` | jest-dom matchers |
| `src/admin/types.ts` | All shared TypeScript types for admin data |
| `src/admin/lib/id.ts` | `newId()` — stable unique id helper |
| `src/admin/lib/image.ts` | `fileToImageRef()` — File → downscaled data-URL `ImageRef` |
| `src/content/defaults/sections.ts` | Default `SectionText[]` from i18n |
| `src/content/defaults/projects.ts` | Default `projectsHome` / `projectsPage` cards |
| `src/content/defaults/services.ts` | Default `servicesHome` / `servicesPage` cards |
| `src/content/defaults/seo.ts` | Default 8 `SeoEntry` |
| `src/content/defaults/index.ts` | `buildDefaults(): AdminData` |
| `src/admin/mock/requests.ts` | `mockRequests: EstimateRequest[]` seed |
| `src/content/persistence.ts` | `loadAdminData()`, `saveAdminData()`, `STORAGE_KEY`, `DATA_VERSION` |
| `src/admin/actions.ts` | Pure reducers over `AdminData` |
| `src/content/SiteContentProvider.tsx` | React context: state + persistence + bound actions |
| `src/content/useSiteContent.ts` | Hook: language-resolved reads + `raw` + `actions` |
| `src/data/routeSeo.ts` | `ROUTE_SEO` map + `seoKeyForPath()` |
| `src/components/DocumentHead/DocumentHead.tsx` | Applies SEO title/meta for the current route |
| `src/components/EstimateForm/useEstimateForm.tsx` | Open/close context for the estimate modal |
| `src/components/EstimateForm/EstimateForm.tsx` | The modal form component |
| `src/components/EstimateForm/EstimateForm.css` | Modal styles |

**Modify:**

| File | Change |
|---|---|
| `package.json` | dev deps + `test` / `test:watch` scripts |
| `vite.config.ts` | Vitest `test` config block |
| `tsconfig.app.json` | exclude test files from the app build |
| `src/App.tsx` | wrap routes in `<SiteContentProvider>` |
| `src/components/Layout/Layout.tsx` | mount `<DocumentHead>`, `<EstimateFormProvider>` + `<EstimateForm>` |
| `src/sections/Hero/Hero.tsx` | header + CTA text from store; CTA opens form |
| `src/sections/Services/Services.tsx` | header + cards from store |
| `src/sections/Projects/Projects.tsx` | header + cards from store |
| `src/sections/HowWork/HowWork.tsx` | header text from store |
| `src/sections/About/About.tsx` | header text from store |
| `src/sections/Cta/Cta.tsx` | text from store; button opens form |
| `src/components/SiteHeader/SiteHeader.tsx` | CTA buttons open form |
| `Readme.md` | short "Admin panel (in progress)" note |

---

## Task 1: Test tooling

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `tsconfig.app.json`
- Create: `src/test/setup.ts`
- Test: `src/test/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm test` (Vitest, jsdom env, jest-dom matchers). All later tasks rely on `vitest` globals (`describe`, `it`, `expect`, `vi`) and `@testing-library/react`.

- [ ] **Step 1: Install dev dependencies**

Run:
```bash
npm install -D vitest@^3 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14 jsdom@^25
```

- [ ] **Step 2: Add test scripts to `package.json`**

In the `"scripts"` block add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Configure Vitest in `vite.config.ts`**

Replace the file with:
```ts
/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
```

- [ ] **Step 4: Create `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 5: Exclude test files from the app build**

In `tsconfig.app.json`, add a top-level key after `"include"`:
```json
"exclude": ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test"]
```

- [ ] **Step 6: Write the smoke test**

`src/test/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('test tooling', () => {
  it('runs vitest with jsdom', () => {
    const el = document.createElement('div')
    el.textContent = 'ok'
    expect(el).toHaveTextContent('ok')
  })
})
```

- [ ] **Step 7: Run the smoke test**

Run: `npm test`
Expected: PASS, 1 test file, 1 test.

- [ ] **Step 8: Verify lint + build still pass**

Run: `npm run lint && npm run build`
Expected: both succeed.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.app.json src/test
git commit -m "chore: add vitest + testing-library test tooling

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/admin/types.ts`
- Test: `src/admin/types.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (every later task imports these):
  - `type Locale = 'en' | 'uk'`
  - `type L = Record<Locale, string>`
  - `interface ImageRef { kind: 'asset' | 'upload'; src: string; fileName?: string }`
  - `type SectionKey = 'hero' | 'services' | 'projects' | 'howWork' | 'about' | 'cta'`
  - `interface SectionText { key: SectionKey; label: string; eyebrow: L; title: L; body: L; ctaLabel?: L }`
  - `interface ProjectCard { id: string; order: number; published: boolean; title: L; tags: string[]; description: L; image: ImageRef; imageAlt: L }`
  - `interface ServiceCard { id: string; order: number; published: boolean; featured: boolean; title: L; text: L; icon: ImageRef }`
  - `type CardListKey = 'projectsHome' | 'projectsPage' | 'servicesHome' | 'servicesPage'`
  - `type SeoPageKey = 'home' | 'services' | 'projects' | 'about' | 'web-development' | 'support' | 'business-analysis' | 'google-ads'`
  - `interface SeoEntry { pageKey: SeoPageKey; label: string; path: string; title: L; description: L }`
  - `type RequestStatus = 'new' | 'in_progress' | 'done' | 'archived'`
  - `type BudgetRange = '<1k' | '1-3k' | '3-10k' | '10k+' | 'not_sure'`
  - `interface EstimateRequest { id: string; createdAt: string; status: RequestStatus; name: string; email: string; company?: string; budget?: BudgetRange; interestedIn: string[]; message: string; locale: Locale; sourcePage?: string; note?: string }`
  - `type NewRequestInput = Omit<EstimateRequest, 'id' | 'createdAt' | 'status' | 'note'>`
  - `interface AdminData { version: number; updatedAt: string; sections: SectionText[]; projectsHome: ProjectCard[]; projectsPage: ProjectCard[]; servicesHome: ServiceCard[]; servicesPage: ServiceCard[]; seo: SeoEntry[]; requests: EstimateRequest[] }`

- [ ] **Step 1: Write `src/admin/types.ts`**

```ts
export type Locale = 'en' | 'uk'
export type L = Record<Locale, string>

export interface ImageRef {
  kind: 'asset' | 'upload'
  /** asset path ('/assets/...') or a data: URL for uploads */
  src: string
  fileName?: string
}

export type SectionKey =
  | 'hero'
  | 'services'
  | 'projects'
  | 'howWork'
  | 'about'
  | 'cta'

export interface SectionText {
  key: SectionKey
  /** English label shown in the admin UI */
  label: string
  eyebrow: L
  title: L
  /** maps to the section's description / lede */
  body: L
  /** Hero + CTA only — the button text */
  ctaLabel?: L
}

export interface ProjectCard {
  id: string
  order: number
  published: boolean
  title: L
  /** language-independent (e.g. "WordPress") */
  tags: string[]
  description: L
  image: ImageRef
  imageAlt: L
}

export interface ServiceCard {
  id: string
  order: number
  published: boolean
  /** enlarged 'featured' card style — Home list only */
  featured: boolean
  title: L
  text: L
  icon: ImageRef
}

export type CardListKey =
  | 'projectsHome'
  | 'projectsPage'
  | 'servicesHome'
  | 'servicesPage'

export type SeoPageKey =
  | 'home'
  | 'services'
  | 'projects'
  | 'about'
  | 'web-development'
  | 'support'
  | 'business-analysis'
  | 'google-ads'

export interface SeoEntry {
  pageKey: SeoPageKey
  label: string
  path: string
  title: L
  description: L
}

export type RequestStatus = 'new' | 'in_progress' | 'done' | 'archived'
export type BudgetRange = '<1k' | '1-3k' | '3-10k' | '10k+' | 'not_sure'

export interface EstimateRequest {
  id: string
  createdAt: string
  status: RequestStatus
  name: string
  email: string
  company?: string
  budget?: BudgetRange
  interestedIn: string[]
  message: string
  locale: Locale
  sourcePage?: string
  note?: string
}

export type NewRequestInput = Omit<
  EstimateRequest,
  'id' | 'createdAt' | 'status' | 'note'
>

export interface AdminData {
  version: number
  updatedAt: string
  sections: SectionText[]
  projectsHome: ProjectCard[]
  projectsPage: ProjectCard[]
  servicesHome: ServiceCard[]
  servicesPage: ServiceCard[]
  seo: SeoEntry[]
  requests: EstimateRequest[]
}
```

- [ ] **Step 2: Write a compile-time check test**

`src/admin/types.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import type { AdminData, L, ProjectCard } from './types'

describe('types', () => {
  it('shapes an AdminData literal without type errors', () => {
    const l: L = { en: 'a', uk: 'b' }
    const card: ProjectCard = {
      id: '1',
      order: 0,
      published: true,
      title: l,
      tags: ['WordPress'],
      description: l,
      image: { kind: 'asset', src: '/assets/x.png' },
      imageAlt: l,
    }
    const data: AdminData = {
      version: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      sections: [],
      projectsHome: [card],
      projectsPage: [],
      servicesHome: [],
      servicesPage: [],
      seo: [],
      requests: [],
    }
    expect(data.projectsHome[0].tags[0]).toBe('WordPress')
  })
})
```

- [ ] **Step 3: Run it**

Run: `npm test -- src/admin/types.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/admin/types.ts src/admin/types.test.ts
git commit -m "feat: admin data types

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: id + image helpers

**Files:**
- Create: `src/admin/lib/id.ts`
- Create: `src/admin/lib/image.ts`
- Test: `src/admin/lib/id.test.ts`
- Test: `src/admin/lib/image.test.ts`

**Interfaces:**
- Consumes: `ImageRef` from `../types`.
- Produces:
  - `newId(prefix?: string): string`
  - `MAX_IMAGE_BYTES = 1_500_000`
  - `fileToImageRef(file: File, opts?: { maxDimension?: number }): Promise<ImageRef>` — resolves `{ kind: 'upload', src: <dataURL>, fileName }`; rejects `Error('unsupported-type')` for non-images and `Error('too-large')` if the encoded result still exceeds `MAX_IMAGE_BYTES`.

- [ ] **Step 1: Write `src/admin/lib/id.ts`**

```ts
export function newId(prefix = 'id'): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  return `${prefix}_${rnd}`
}
```

- [ ] **Step 2: Test `id.ts`**

`src/admin/lib/id.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { newId } from './id'

describe('newId', () => {
  it('applies the prefix and is unique across calls', () => {
    const a = newId('proj')
    const b = newId('proj')
    expect(a.startsWith('proj_')).toBe(true)
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 3: Run it**

Run: `npm test -- src/admin/lib/id.test.ts`
Expected: PASS.

- [ ] **Step 4: Write `src/admin/lib/image.ts`**

```ts
import type { ImageRef } from '../types'

export const MAX_IMAGE_BYTES = 1_500_000

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(new Error('read-failed'))
    fr.readAsDataURL(file)
  })

/** approximate decoded byte size of a base64 data URL */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor((b64.length * 3) / 4) - padding
}

async function downscale(
  dataUrl: string,
  maxDimension: number,
): Promise<string> {
  if (typeof document === 'undefined') return dataUrl
  const img = document.createElement('img')
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('decode-failed'))
    img.src = dataUrl
  })
  const { width, height } = img
  const scale = Math.min(1, maxDimension / Math.max(width, height || 1))
  if (scale >= 1) return dataUrl
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}

export async function fileToImageRef(
  file: File,
  opts: { maxDimension?: number } = {},
): Promise<ImageRef> {
  if (!file.type.startsWith('image/')) throw new Error('unsupported-type')
  const raw = await readAsDataUrl(file)
  let out = raw
  try {
    out = await downscale(raw, opts.maxDimension ?? 1600)
  } catch {
    out = raw
  }
  if (dataUrlBytes(out) > MAX_IMAGE_BYTES) throw new Error('too-large')
  return { kind: 'upload', src: out, fileName: file.name }
}
```

- [ ] **Step 5: Test `image.ts`**

`src/admin/lib/image.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { fileToImageRef, dataUrlBytes } from './image'

const tinyPngDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function dataUrlToFile(dataUrl: string, name: string, type: string): File {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], name, { type })
}

describe('dataUrlBytes', () => {
  it('estimates decoded size', () => {
    expect(dataUrlBytes('data:text/plain;base64,QUJD')).toBe(3) // "ABC"
  })
})

describe('fileToImageRef', () => {
  it('rejects a non-image file', async () => {
    const file = new File(['hi'], 'notes.txt', { type: 'text/plain' })
    await expect(fileToImageRef(file)).rejects.toThrow('unsupported-type')
  })

  it('returns an upload ImageRef for an image file', async () => {
    const file = dataUrlToFile(tinyPngDataUrl, 'pixel.png', 'image/png')
    const ref = await fileToImageRef(file)
    expect(ref.kind).toBe('upload')
    expect(ref.fileName).toBe('pixel.png')
    expect(ref.src.startsWith('data:image/')).toBe(true)
  })
})
```

> Note: jsdom does not implement canvas rendering; `downscale` catches the failure and falls back to the original data URL, which the test accounts for.

- [ ] **Step 6: Run it**

Run: `npm test -- src/admin/lib/image.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/admin/lib
git commit -m "feat: id and image upload helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Default content data

**Files:**
- Create: `src/content/defaults/sections.ts`
- Create: `src/content/defaults/projects.ts`
- Create: `src/content/defaults/services.ts`
- Create: `src/content/defaults/seo.ts`
- Create: `src/content/defaults/index.ts`
- Test: `src/content/defaults/index.test.ts`

**Interfaces:**
- Consumes: types from `../../admin/types`; `src/i18n/en.json`, `src/i18n/uk.json`.
- Produces:
  - `DATA_VERSION = 1` (exported from `./index`)
  - `buildDefaults(): AdminData` — deterministic; `updatedAt` is a fixed epoch string `'1970-01-01T00:00:00.000Z'` so seeded data is stable for tests.
  - `defaultSections: SectionText[]`, `defaultProjectsHome`, `defaultProjectsPage`, `defaultServicesHome`, `defaultServicesPage`, `defaultSeo` (exported from their modules).

- [ ] **Step 1: Write `src/content/defaults/sections.ts`**

```ts
import type { L, SectionText } from '../../admin/types'
import en from '../../i18n/en.json'
import uk from '../../i18n/uk.json'

const pair = (a: string, b: string): L => ({ en: a, uk: b })

export const defaultSections: SectionText[] = [
  {
    key: 'hero',
    label: 'Hero (top of page)',
    eyebrow: pair(en.hero.eyebrow, uk.hero.eyebrow),
    title: pair(en.hero.title, uk.hero.title),
    body: pair(en.hero.description, uk.hero.description),
    ctaLabel: pair(en.hero.cta, uk.hero.cta),
  },
  {
    key: 'services',
    label: 'Services block',
    eyebrow: pair(en.services.eyebrow, uk.services.eyebrow),
    title: pair(en.services.title, uk.services.title),
    body: pair(en.services.description, uk.services.description),
  },
  {
    key: 'projects',
    label: 'Projects block',
    eyebrow: pair(en.projects.eyebrow, uk.projects.eyebrow),
    title: pair(en.projects.title, uk.projects.title),
    body: pair(en.projects.lede, uk.projects.lede),
  },
  {
    key: 'howWork',
    label: 'How we work block',
    eyebrow: pair(en.howWork.eyebrow, uk.howWork.eyebrow),
    title: pair(en.howWork.title, uk.howWork.title),
    body: pair(en.howWork.description, uk.howWork.description),
  },
  {
    key: 'about',
    label: 'About block',
    eyebrow: pair(en.about.eyebrow, uk.about.eyebrow),
    title: pair(en.about.title, uk.about.title),
    body: pair(en.about.description, uk.about.description),
  },
  {
    key: 'cta',
    label: 'Call-to-action block',
    eyebrow: pair(en.cta.eyebrow, uk.cta.eyebrow),
    title: pair(en.cta.title, uk.cta.title),
    body: pair(en.cta.description, uk.cta.description),
    ctaLabel: pair(en.cta.button, uk.cta.button),
  },
]
```

> If TS rejects a `X as Y[]` cast on a JSON array in `projects.ts` / `services.ts`
> (error 2352, "neither type sufficiently overlaps"), widen through `unknown`:
> `en.projects.items as unknown as RawProject[]`.

- [ ] **Step 2: Write `src/content/defaults/projects.ts`**

```ts
import type { L, ProjectCard } from '../../admin/types'
import en from '../../i18n/en.json'
import uk from '../../i18n/uk.json'

interface RawProject {
  id: string
  title: string
  tags: string[]
  text: string
  image?: string
  imageAlt: string
}

const ukById = new Map<string, RawProject>(
  (uk.projects.items as RawProject[]).map((p) => [p.id, p]),
)

const pair = (a: string, b: string | undefined): L => ({ en: a, uk: b ?? a })

const cards: ProjectCard[] = (en.projects.items as RawProject[]).map(
  (p, i): ProjectCard => {
    const u = ukById.get(p.id)
    return {
      id: p.id,
      order: i,
      published: true,
      title: pair(p.title, u?.title),
      tags: [...p.tags],
      description: pair(p.text, u?.text),
      image: { kind: 'asset', src: p.image ?? `/assets/projects/${p.id}.png` },
      imageAlt: pair(p.imageAlt, u?.imageAlt),
    }
  },
)

const clone = (list: ProjectCard[]): ProjectCard[] =>
  list.map((c, i) => ({
    ...c,
    id: `${c.id}`,
    order: i,
    tags: [...c.tags],
    title: { ...c.title },
    description: { ...c.description },
    image: { ...c.image },
    imageAlt: { ...c.imageAlt },
  }))

export const defaultProjectsHome: ProjectCard[] = clone(cards)
export const defaultProjectsPage: ProjectCard[] = clone(cards)
```

- [ ] **Step 3: Write `src/content/defaults/services.ts`**

```ts
import type { L, ServiceCard } from '../../admin/types'
import en from '../../i18n/en.json'
import uk from '../../i18n/uk.json'

interface RawService {
  id: string
  title: string
  text: string
  featured?: boolean
}

/** design icon assets keyed by service slug (mirrors Services.tsx ASSETS) */
const ICONS: Record<string, string> = {
  'web-development': '/assets/services/icon-web.png',
  support: '/assets/services/icon-support.png',
  'business-analysis': '/assets/services/icon-analysis.png',
  'google-ads': '/assets/services/icon-ads.png',
}

const ukById = new Map<string, RawService>(
  (uk.services.items as RawService[]).map((s) => [s.id, s]),
)

const pair = (a: string, b: string | undefined): L => ({ en: a, uk: b ?? a })

const cards: ServiceCard[] = (en.services.items as RawService[]).map(
  (s, i): ServiceCard => {
    const u = ukById.get(s.id)
    return {
      id: s.id,
      order: i,
      published: true,
      featured: Boolean(s.featured),
      title: pair(s.title, u?.title),
      text: pair(s.text, u?.text),
      icon: {
        kind: 'asset',
        src: ICONS[s.id] ?? '/assets/services/icon-web.png',
      },
    }
  },
)

const clone = (list: ServiceCard[]): ServiceCard[] =>
  list.map((c, i) => ({
    ...c,
    order: i,
    title: { ...c.title },
    text: { ...c.text },
    icon: { ...c.icon },
  }))

export const defaultServicesHome: ServiceCard[] = clone(cards)
export const defaultServicesPage: ServiceCard[] = clone(cards)
```

- [ ] **Step 4: Write `src/content/defaults/seo.ts`**

```ts
import type { L, SeoEntry } from '../../admin/types'
import en from '../../i18n/en.json'

const same = (s: string): L => ({ en: s, uk: s })

export const defaultSeo: SeoEntry[] = [
  {
    pageKey: 'home',
    label: 'Home',
    path: '/',
    title: same(en.meta.title),
    description: same(en.meta.description),
  },
  {
    pageKey: 'services',
    label: 'Services',
    path: '/services',
    title: same('Services — ONVORX'),
    description: same(
      'Web development, website support, business analysis and Google Ads — ONVORX joins your project at the stage where support is needed.',
    ),
  },
  {
    pageKey: 'projects',
    label: 'Projects',
    path: '/projects',
    title: same('Projects — ONVORX'),
    description: same(
      'Selected web development work by ONVORX — websites and digital solutions built around real business requirements.',
    ),
  },
  {
    pageKey: 'about',
    label: 'About',
    path: '/about',
    title: same('About — ONVORX'),
    description: same(
      'ONVORX combines hands-on web development experience with a structured approach to requirements, implementation and ongoing development.',
    ),
  },
  {
    pageKey: 'web-development',
    label: 'Service — Web Development',
    path: '/web-development',
    title: same('Web Development — ONVORX'),
    description: same(
      'Build a new website from ready designs and requirements, with structure and UX/UI support when needed.',
    ),
  },
  {
    pageKey: 'support',
    label: 'Service — Website Support & Development',
    path: '/support',
    title: same('Website Support & Development — ONVORX'),
    description: same(
      'Improve and extend an existing WordPress or Horoshop website with new pages, functionality, integrations and ongoing support.',
    ),
  },
  {
    pageKey: 'business-analysis',
    label: 'Service — Business Analysis',
    path: '/business-analysis',
    title: same('Business Analysis — ONVORX'),
    description: same(
      'Clarify business processes, scope and requirements before automation or software development begins.',
    ),
  },
  {
    pageKey: 'google-ads',
    label: 'Service — Google Ads',
    path: '/google-ads',
    title: same('Google Ads — ONVORX'),
    description: same(
      'Set up and manage Google Ads campaigns as a separate channel for attracting relevant paid traffic.',
    ),
  },
]
```

- [ ] **Step 5: Write `src/content/defaults/index.ts`**

```ts
import type { AdminData } from '../../admin/types'
import { defaultSections } from './sections'
import { defaultProjectsHome, defaultProjectsPage } from './projects'
import { defaultServicesHome, defaultServicesPage } from './services'
import { defaultSeo } from './seo'

export const DATA_VERSION = 1

const EPOCH = '1970-01-01T00:00:00.000Z'

const deepCopy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export function buildDefaults(): AdminData {
  return {
    version: DATA_VERSION,
    updatedAt: EPOCH,
    sections: deepCopy(defaultSections),
    projectsHome: deepCopy(defaultProjectsHome),
    projectsPage: deepCopy(defaultProjectsPage),
    servicesHome: deepCopy(defaultServicesHome),
    servicesPage: deepCopy(defaultServicesPage),
    seo: deepCopy(defaultSeo),
    requests: [],
  }
}
```

- [ ] **Step 6: Write `src/content/defaults/index.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildDefaults, DATA_VERSION } from './index'

describe('buildDefaults', () => {
  it('produces a versioned AdminData with the expected shape', () => {
    const d = buildDefaults()
    expect(d.version).toBe(DATA_VERSION)
    expect(d.sections).toHaveLength(6)
    expect(d.sections.map((s) => s.key)).toEqual([
      'hero',
      'services',
      'projects',
      'howWork',
      'about',
      'cta',
    ])
    expect(d.seo).toHaveLength(8)
    expect(d.requests).toEqual([])
  })

  it('seeds project and service cards from i18n content', () => {
    const d = buildDefaults()
    expect(d.projectsHome.length).toBeGreaterThan(0)
    expect(d.projectsHome[0].image.src).toMatch(/^\/assets\/projects\//)
    expect(d.servicesHome.length).toBeGreaterThan(0)
    expect(d.servicesHome.some((s) => s.featured)).toBe(true)
    expect(d.servicesHome[0].icon.src).toMatch(/^\/assets\/services\//)
  })

  it('returns a fresh independent copy each call', () => {
    const a = buildDefaults()
    const b = buildDefaults()
    a.sections[0].title.en = 'MUTATED'
    expect(b.sections[0].title.en).not.toBe('MUTATED')
  })

  it('hero and cta sections have a ctaLabel; others do not', () => {
    const d = buildDefaults()
    const byKey = Object.fromEntries(d.sections.map((s) => [s.key, s]))
    expect(byKey.hero.ctaLabel).toBeDefined()
    expect(byKey.cta.ctaLabel).toBeDefined()
    expect(byKey.about.ctaLabel).toBeUndefined()
  })
})
```

- [ ] **Step 7: Run it**

Run: `npm test -- src/content/defaults`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add src/content/defaults
git commit -m "feat: default site content seed from i18n

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Mock estimate requests

**Files:**
- Create: `src/admin/mock/requests.ts`
- Test: `src/admin/mock/requests.test.ts`

**Interfaces:**
- Consumes: `EstimateRequest` from `../types`.
- Produces: `mockRequests: EstimateRequest[]` — 7 entries, mixed statuses and languages, ISO `createdAt` strings.

- [ ] **Step 1: Write `src/admin/mock/requests.ts`**

```ts
import type { EstimateRequest } from '../types'

export const mockRequests: EstimateRequest[] = [
  {
    id: 'req_0001',
    createdAt: '2026-08-28T09:12:00.000Z',
    status: 'new',
    name: 'Olena Kravets',
    email: 'olena@brightretail.com',
    company: 'Bright Retail',
    budget: '3-10k',
    interestedIn: ['web-development', 'google-ads'],
    message:
      'We have Figma designs for a new WooCommerce store and need implementation plus ad setup before the autumn season.',
    locale: 'en',
    sourcePage: '/',
  },
  {
    id: 'req_0002',
    createdAt: '2026-08-30T14:47:00.000Z',
    status: 'new',
    name: 'Markus Feld',
    email: 'm.feld@encryptia.io',
    company: 'Encryptia',
    budget: '1-3k',
    interestedIn: ['support'],
    message:
      'Existing WordPress site needs a few new landing pages and a CRM integration. Can you take over ongoing support?',
    locale: 'en',
    sourcePage: '/services',
  },
  {
    id: 'req_0003',
    createdAt: '2026-09-01T07:05:00.000Z',
    status: 'in_progress',
    name: 'Iryna Bondar',
    email: 'iryna.bondar@gmail.com',
    budget: 'not_sure',
    interestedIn: ['business-analysis'],
    message:
      'Small logistics company, we want to clarify our order process before commissioning any software. Where do we start?',
    locale: 'uk',
    sourcePage: '/',
    note: 'Sent intro call link, waiting for a slot.',
  },
  {
    id: 'req_0004',
    createdAt: '2026-09-02T18:20:00.000Z',
    status: 'in_progress',
    name: 'David Osei',
    email: 'david@osei-consulting.co.uk',
    company: 'Osei Consulting',
    budget: '10k+',
    interestedIn: ['web-development', 'business-analysis'],
    message:
      'Full rebuild of our corporate site plus a client portal. Requirements are rough — need help shaping scope.',
    locale: 'en',
    sourcePage: '/',
  },
  {
    id: 'req_0005',
    createdAt: '2026-09-03T11:33:00.000Z',
    status: 'done',
    name: 'Sofiia Melnyk',
    email: 'sofiia@ahill.relax',
    company: 'Relax Ahill',
    budget: '1-3k',
    interestedIn: ['support', 'google-ads'],
    message: 'Seasonal campaign landing page and Google Ads refresh.',
    locale: 'uk',
    sourcePage: '/services',
    note: 'Delivered 2026-09-06. Invoice sent.',
  },
  {
    id: 'req_0006',
    createdAt: '2026-09-04T08:00:00.000Z',
    status: 'new',
    name: 'Tomasz Nowak',
    email: 'tomasz@nowak.dev',
    budget: '<1k',
    interestedIn: ['support'],
    message: 'One-off fix: checkout page throws an error on mobile Safari.',
    locale: 'en',
    sourcePage: '/support',
  },
  {
    id: 'req_0007',
    createdAt: '2026-07-19T15:41:00.000Z',
    status: 'archived',
    name: 'Anna Schmidt',
    email: 'anna.schmidt@example.com',
    company: 'Schmidt GmbH',
    interestedIn: [],
    message: 'Asked for a partnership, not a project. Redirected by email.',
    locale: 'en',
    sourcePage: '/',
    note: 'Not a fit — archived.',
  },
]
```

- [ ] **Step 2: Write `src/admin/mock/requests.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { mockRequests } from './requests'

describe('mockRequests', () => {
  it('has unique ids and valid ISO timestamps', () => {
    const ids = new Set(mockRequests.map((r) => r.id))
    expect(ids.size).toBe(mockRequests.length)
    for (const r of mockRequests) {
      expect(new Date(r.createdAt).toISOString()).toBe(r.createdAt)
    }
  })

  it('covers every status and both locales', () => {
    const statuses = new Set(mockRequests.map((r) => r.status))
    expect(statuses).toEqual(
      new Set(['new', 'in_progress', 'done', 'archived']),
    )
    const locales = new Set(mockRequests.map((r) => r.locale))
    expect(locales).toEqual(new Set(['en', 'uk']))
  })
})
```

- [ ] **Step 3: Run it**

Run: `npm test -- src/admin/mock/requests.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/admin/mock
git commit -m "feat: mock estimate requests seed

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Persistence

**Files:**
- Create: `src/content/persistence.ts`
- Test: `src/content/persistence.test.ts`

**Interfaces:**
- Consumes: `buildDefaults`, `DATA_VERSION` from `./defaults`; `mockRequests` from `../admin/mock/requests`; `AdminData` from `../admin/types`.
- Produces:
  - `STORAGE_KEY = 'onvorx.admin.v1'`
  - `loadAdminData(): AdminData` — returns parsed store; on missing/corrupt/version-mismatch returns a freshly seeded `AdminData` (defaults + `mockRequests`) **and writes it back**.
  - `saveAdminData(data: AdminData): void` — JSON-serializes to `localStorage`, swallows quota errors.
  - `seedAdminData(): AdminData` — pure seed (defaults + `mockRequests`), no write.

- [ ] **Step 1: Write `src/content/persistence.ts`**

```ts
import type { AdminData } from '../admin/types'
import { buildDefaults, DATA_VERSION } from './defaults'
import { mockRequests } from '../admin/mock/requests'

export const STORAGE_KEY = 'onvorx.admin.v1'

export function seedAdminData(): AdminData {
  const base = buildDefaults()
  return { ...base, requests: mockRequests.map((r) => ({ ...r })) }
}

export function saveAdminData(data: AdminData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* private mode / quota exceeded — ignore, keep working from memory */
  }
}

function isAdminData(v: unknown): v is AdminData {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Partial<AdminData>
  return (
    d.version === DATA_VERSION &&
    Array.isArray(d.sections) &&
    Array.isArray(d.projectsHome) &&
    Array.isArray(d.servicesHome) &&
    Array.isArray(d.seo) &&
    Array.isArray(d.requests)
  )
}

export function loadAdminData(): AdminData {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return seedAdminData()
  }
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (isAdminData(parsed)) return parsed
    } catch {
      /* fall through to reseed */
    }
  }
  const seeded = seedAdminData()
  saveAdminData(seeded)
  return seeded
}
```

- [ ] **Step 2: Write `src/content/persistence.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  STORAGE_KEY,
  loadAdminData,
  saveAdminData,
  seedAdminData,
} from './persistence'

beforeEach(() => {
  localStorage.clear()
})

describe('loadAdminData', () => {
  it('seeds and persists when storage is empty', () => {
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    const data = loadAdminData()
    expect(data.sections).toHaveLength(6)
    expect(data.requests.length).toBeGreaterThan(0)
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('round-trips a saved store', () => {
    const seeded = seedAdminData()
    seeded.sections[0].title.en = 'Custom hero'
    saveAdminData(seeded)
    const loaded = loadAdminData()
    expect(loaded.sections[0].title.en).toBe('Custom hero')
  })

  it('reseeds on corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{ not json')
    const data = loadAdminData()
    expect(data.sections).toHaveLength(6)
  })

  it('reseeds on version mismatch', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 0, sections: [] }),
    )
    const data = loadAdminData()
    expect(data.version).toBe(seedAdminData().version)
    expect(data.sections).toHaveLength(6)
  })
})
```

- [ ] **Step 3: Run it**

Run: `npm test -- src/content/persistence.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 4: Commit**

```bash
git add src/content/persistence.ts src/content/persistence.test.ts
git commit -m "feat: localStorage persistence for admin data

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Pure reducers (`actions.ts`)

**Files:**
- Create: `src/admin/actions.ts`
- Test: `src/admin/actions.test.ts`

**Interfaces:**
- Consumes: types from `./types`; `newId` from `./lib/id`; `buildDefaults` from `../content/defaults`; `seedAdminData` from `../content/persistence`.
- Produces (all pure, all return a NEW `AdminData` with a refreshed `updatedAt`, none mutate the input):
  - `updateSection(d: AdminData, key: SectionKey, patch: Partial<Omit<SectionText, 'key' | 'label'>>): AdminData`
  - `addCard(d: AdminData, list: CardListKey): AdminData` — appends a blank, unpublished card with `order` = current length; returns data (new card is last).
  - `blankProjectCard(order: number): ProjectCard` and `blankServiceCard(order: number): ServiceCard` (exported helpers)
  - `updateCard(d, list: CardListKey, id: string, patch: Record<string, unknown>): AdminData` — shallow-merges into the matching card
  - `removeCard(d, list: CardListKey, id: string): AdminData` — removes and re-numbers `order` 0..n-1
  - `moveCard(d, list: CardListKey, id: string, dir: 'up' | 'down'): AdminData` — swaps with the neighbor and re-numbers; no-op at the ends
  - `setCardImage(d, list: CardListKey, id: string, image: ImageRef): AdminData` — sets `image` for a project card or `icon` for a service card
  - `updateSeo(d, pageKey: SeoPageKey, patch: Partial<Pick<SeoEntry, 'title' | 'description'>>): AdminData`
  - `addRequest(d, input: NewRequestInput): AdminData` — prepends a new `EstimateRequest` (`status: 'new'`, generated `id`, `createdAt: new Date().toISOString()`)
  - `setRequestStatus(d, id: string, status: RequestStatus): AdminData`
  - `setRequestNote(d, id: string, note: string): AdminData`
  - `removeRequest(d, id: string): AdminData`
  - `resetAll(): AdminData` — `seedAdminData()`

- [ ] **Step 1: Write the failing test**

`src/admin/actions.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { seedAdminData } from '../content/persistence'
import {
  updateSection,
  addCard,
  updateCard,
  removeCard,
  moveCard,
  setCardImage,
  updateSeo,
  addRequest,
  setRequestStatus,
  setRequestNote,
  removeRequest,
  resetAll,
} from './actions'
import type { NewRequestInput } from './types'

const base = () => seedAdminData()

describe('updateSection', () => {
  it('patches one section and does not mutate input', () => {
    const d = base()
    const next = updateSection(d, 'hero', { title: { en: 'New', uk: 'Нове' } })
    expect(next.sections.find((s) => s.key === 'hero')!.title.en).toBe('New')
    expect(d.sections.find((s) => s.key === 'hero')!.title.en).not.toBe('New')
    expect(next).not.toBe(d)
    expect(next.updatedAt).not.toBe(d.updatedAt)
  })
})

describe('card CRUD', () => {
  it('adds a blank unpublished card at the end', () => {
    const d = base()
    const before = d.projectsHome.length
    const next = addCard(d, 'projectsHome')
    expect(next.projectsHome).toHaveLength(before + 1)
    const added = next.projectsHome[before]
    expect(added.published).toBe(false)
    expect(added.order).toBe(before)
    expect(added.id).toBeTruthy()
  })

  it('updates a card by id', () => {
    const d = base()
    const id = d.servicesHome[0].id
    const next = updateCard(d, 'servicesHome', id, { featured: false })
    expect(next.servicesHome[0].featured).toBe(false)
  })

  it('removes a card and renumbers order', () => {
    const d = addCard(addCard(base(), 'projectsPage'), 'projectsPage')
    const victim = d.projectsPage[1].id
    const next = removeCard(d, 'projectsPage', victim)
    expect(next.projectsPage.find((c) => c.id === victim)).toBeUndefined()
    expect(next.projectsPage.map((c) => c.order)).toEqual(
      next.projectsPage.map((_, i) => i),
    )
  })

  it('moves a card up and renumbers, no-op at the top', () => {
    const d = base()
    const firstId = d.projectsHome[0].id
    const secondId = d.projectsHome[1].id
    const moved = moveCard(d, 'projectsHome', secondId, 'up')
    expect(moved.projectsHome[0].id).toBe(secondId)
    expect(moved.projectsHome[1].id).toBe(firstId)
    expect(moved.projectsHome.map((c) => c.order)).toEqual([0, 1])
    const noop = moveCard(d, 'projectsHome', firstId, 'up')
    expect(noop.projectsHome[0].id).toBe(firstId)
  })

  it('sets image on a project card and icon on a service card', () => {
    const d = base()
    const p = setCardImage(d, 'projectsHome', d.projectsHome[0].id, {
      kind: 'upload',
      src: 'data:image/png;base64,AAAA',
      fileName: 'x.png',
    })
    expect(p.projectsHome[0].image.kind).toBe('upload')
    const s = setCardImage(d, 'servicesHome', d.servicesHome[0].id, {
      kind: 'upload',
      src: 'data:image/png;base64,BBBB',
    })
    expect(s.servicesHome[0].icon.src).toBe('data:image/png;base64,BBBB')
  })
})

describe('updateSeo', () => {
  it('patches title/description for one page', () => {
    const d = base()
    const next = updateSeo(d, 'about', {
      title: { en: 'About us', uk: 'Про нас' },
    })
    expect(next.seo.find((e) => e.pageKey === 'about')!.title.en).toBe(
      'About us',
    )
  })
})

describe('requests', () => {
  const input: NewRequestInput = {
    name: 'Test User',
    email: 'test@example.com',
    interestedIn: ['web-development'],
    message: 'Hello',
    locale: 'en',
    sourcePage: '/',
  }

  it('prepends a new request with status new', () => {
    const d = base()
    const before = d.requests.length
    const next = addRequest(d, input)
    expect(next.requests).toHaveLength(before + 1)
    expect(next.requests[0].name).toBe('Test User')
    expect(next.requests[0].status).toBe('new')
    expect(next.requests[0].id).toBeTruthy()
    expect(new Date(next.requests[0].createdAt).toISOString()).toBe(
      next.requests[0].createdAt,
    )
  })

  it('sets status, note, and removes by id', () => {
    const d = addRequest(base(), input)
    const id = d.requests[0].id
    expect(setRequestStatus(d, id, 'done').requests[0].status).toBe('done')
    expect(setRequestNote(d, id, 'called').requests[0].note).toBe('called')
    expect(removeRequest(d, id).requests.find((r) => r.id === id)).toBeUndefined()
  })
})

describe('resetAll', () => {
  it('returns a fresh seeded dataset', () => {
    const fresh = resetAll()
    expect(fresh.sections).toHaveLength(6)
    expect(fresh.requests.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/admin/actions.test.ts`
Expected: FAIL — `actions.ts` does not exist / exports missing.

- [ ] **Step 3: Write `src/admin/actions.ts`**

```ts
import type {
  AdminData,
  CardListKey,
  ImageRef,
  NewRequestInput,
  ProjectCard,
  RequestStatus,
  SectionKey,
  SectionText,
  SeoEntry,
  SeoPageKey,
  ServiceCard,
} from './types'
import { newId } from './lib/id'
import { seedAdminData } from '../content/persistence'

const stamp = (d: AdminData): AdminData => ({
  ...d,
  updatedAt: new Date().toISOString(),
})

const emptyL = () => ({ en: '', uk: '' })

export function blankProjectCard(order: number): ProjectCard {
  return {
    id: newId('proj'),
    order,
    published: false,
    title: emptyL(),
    tags: [],
    description: emptyL(),
    image: { kind: 'asset', src: '' },
    imageAlt: emptyL(),
  }
}

export function blankServiceCard(order: number): ServiceCard {
  return {
    id: newId('svc'),
    order,
    published: false,
    featured: false,
    title: emptyL(),
    text: emptyL(),
    icon: { kind: 'asset', src: '' },
  }
}

const isProjectList = (list: CardListKey) =>
  list === 'projectsHome' || list === 'projectsPage'

const renumber = <T extends { order: number }>(cards: T[]): T[] =>
  cards.map((c, i) => (c.order === i ? c : { ...c, order: i }))

export function updateSection(
  d: AdminData,
  key: SectionKey,
  patch: Partial<Omit<SectionText, 'key' | 'label'>>,
): AdminData {
  return stamp({
    ...d,
    sections: d.sections.map((s) => (s.key === key ? { ...s, ...patch } : s)),
  })
}

export function addCard(d: AdminData, list: CardListKey): AdminData {
  const current = d[list]
  const card = isProjectList(list)
    ? blankProjectCard(current.length)
    : blankServiceCard(current.length)
  return stamp({ ...d, [list]: [...current, card] })
}

export function updateCard(
  d: AdminData,
  list: CardListKey,
  id: string,
  patch: Record<string, unknown>,
): AdminData {
  return stamp({
    ...d,
    [list]: (d[list] as Array<ProjectCard | ServiceCard>).map((c) =>
      c.id === id ? { ...c, ...patch } : c,
    ),
  })
}

export function removeCard(
  d: AdminData,
  list: CardListKey,
  id: string,
): AdminData {
  const filtered = (d[list] as Array<ProjectCard | ServiceCard>).filter(
    (c) => c.id !== id,
  )
  return stamp({ ...d, [list]: renumber(filtered) })
}

export function moveCard(
  d: AdminData,
  list: CardListKey,
  id: string,
  dir: 'up' | 'down',
): AdminData {
  const cards = [...(d[list] as Array<ProjectCard | ServiceCard>)]
  const i = cards.findIndex((c) => c.id === id)
  if (i < 0) return d
  const j = dir === 'up' ? i - 1 : i + 1
  if (j < 0 || j >= cards.length) return d
  ;[cards[i], cards[j]] = [cards[j], cards[i]]
  return stamp({ ...d, [list]: renumber(cards) })
}

export function setCardImage(
  d: AdminData,
  list: CardListKey,
  id: string,
  image: ImageRef,
): AdminData {
  const field = isProjectList(list) ? 'image' : 'icon'
  return updateCard(d, list, id, { [field]: image })
}

export function updateSeo(
  d: AdminData,
  pageKey: SeoPageKey,
  patch: Partial<Pick<SeoEntry, 'title' | 'description'>>,
): AdminData {
  return stamp({
    ...d,
    seo: d.seo.map((e) => (e.pageKey === pageKey ? { ...e, ...patch } : e)),
  })
}

export function addRequest(d: AdminData, input: NewRequestInput): AdminData {
  return stamp({
    ...d,
    requests: [
      {
        ...input,
        id: newId('req'),
        createdAt: new Date().toISOString(),
        status: 'new',
      },
      ...d.requests,
    ],
  })
}

export function setRequestStatus(
  d: AdminData,
  id: string,
  status: RequestStatus,
): AdminData {
  return stamp({
    ...d,
    requests: d.requests.map((r) => (r.id === id ? { ...r, status } : r)),
  })
}

export function setRequestNote(
  d: AdminData,
  id: string,
  note: string,
): AdminData {
  return stamp({
    ...d,
    requests: d.requests.map((r) => (r.id === id ? { ...r, note } : r)),
  })
}

export function removeRequest(d: AdminData, id: string): AdminData {
  return stamp({ ...d, requests: d.requests.filter((r) => r.id !== id) })
}

export function resetAll(): AdminData {
  return seedAdminData()
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/admin/actions.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Verify lint + typecheck**

Run: `npm run lint && npx tsc -b`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/admin/actions.ts src/admin/actions.test.ts
git commit -m "feat: pure reducers for admin data

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: `SiteContentProvider` + `useSiteContent`

**Files:**
- Create: `src/content/SiteContentProvider.tsx`
- Create: `src/content/useSiteContent.ts`
- Test: `src/content/SiteContentProvider.test.tsx`

**Interfaces:**
- Consumes: `loadAdminData`, `saveAdminData`, `STORAGE_KEY` from `./persistence`; all reducers from `../admin/actions`; `useI18n` from `../i18n/i18n`; types from `../admin/types`.
- Produces:
  - `SiteContentProvider` React component (children prop).
  - `SiteContentContext` (exported for tests).
  - `useSiteContentRaw(): { data: AdminData; actions: SiteContentActions }` — low-level, language-agnostic (for admin screens, Plan 3).
  - `SiteContentActions` interface — one bound method per reducer:
    `updateSection(key, patch)`, `addCard(list)`, `updateCard(list, id, patch)`, `removeCard(list, id)`, `moveCard(list, id, dir)`, `setCardImage(list, id, image)`, `updateSeo(pageKey, patch)`, `addRequest(input)`, `setRequestStatus(id, status)`, `setRequestNote(id, note)`, `removeRequest(id)`, `resetAll()`. All return `void`.
  - `useSiteContent()` (from `./useSiteContent`) returning:
    - `raw: AdminData`
    - `actions: SiteContentActions`
    - `section(key: SectionKey): { eyebrow: string; title: string; body: string; ctaLabel: string }` — resolved to the active language, EN fallback
    - `projectsHome(): ResolvedProjectCard[]` — only `published`, sorted by `order`, each `{ id, indexLabel, title, tags, description, imageSrc, imageAlt }`
    - `servicesHome(): ResolvedServiceCard[]` — only `published`, sorted by `order`, each `{ id, featured, title, text, iconSrc }`
    - `seoFor(pageKey: SeoPageKey): { title: string; description: string }` — resolved, EN fallback

- [ ] **Step 1: Write the failing test**

`src/content/SiteContentProvider.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { I18nProvider, useI18n } from '../i18n/i18n'
import { SiteContentProvider } from './SiteContentProvider'
import { useSiteContent } from './useSiteContent'
import { STORAGE_KEY } from './persistence'

beforeEach(() => localStorage.clear())

function Probe() {
  const { section, servicesHome, actions } = useSiteContent()
  const { setLang } = useI18n()
  return (
    <div>
      <p data-testid="hero-title">{section('hero').title}</p>
      <p data-testid="svc-count">{servicesHome().length}</p>
      <button onClick={() => actions.updateSection('hero', { title: { en: 'Edited EN', uk: 'Edited UK' } })}>
        edit
      </button>
      <button onClick={() => setLang('uk')}>uk</button>
      <button onClick={() => actions.updateCard('servicesHome', servicesHome()[0].id, { published: false })}>
        hide first service
      </button>
    </div>
  )
}

const wrap = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <Probe />
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('SiteContentProvider', () => {
  it('exposes seeded content resolved to the active language', () => {
    wrap()
    expect(screen.getByTestId('hero-title').textContent).toBeTruthy()
  })

  it('applies an edit and persists it to localStorage', () => {
    wrap()
    act(() => {
      screen.getByText('edit').click()
    })
    expect(screen.getByTestId('hero-title')).toHaveTextContent('Edited EN')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored.sections.find((s: { key: string }) => s.key === 'hero').title.en).toBe('Edited EN')
  })

  it('falls back to EN when the active language value is empty', () => {
    wrap()
    act(() => {
      screen.getByText('edit').click() // sets uk: 'Edited UK'
      screen.getByText('uk').click()
    })
    expect(screen.getByTestId('hero-title')).toHaveTextContent('Edited UK')
  })

  it('filters unpublished cards out of the resolved list', () => {
    wrap()
    const before = Number(screen.getByTestId('svc-count').textContent)
    act(() => {
      screen.getByText('hide first service').click()
    })
    expect(Number(screen.getByTestId('svc-count').textContent)).toBe(before - 1)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/content/SiteContentProvider.test.tsx`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Write `src/content/SiteContentProvider.tsx`**

```tsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  AdminData,
  CardListKey,
  ImageRef,
  NewRequestInput,
  RequestStatus,
  SectionKey,
  SectionText,
  SeoEntry,
  SeoPageKey,
} from '../admin/types'
import * as A from '../admin/actions'
import { STORAGE_KEY, loadAdminData, saveAdminData } from './persistence'

export interface SiteContentActions {
  updateSection: (
    key: SectionKey,
    patch: Partial<Omit<SectionText, 'key' | 'label'>>,
  ) => void
  addCard: (list: CardListKey) => void
  updateCard: (
    list: CardListKey,
    id: string,
    patch: Record<string, unknown>,
  ) => void
  removeCard: (list: CardListKey, id: string) => void
  moveCard: (list: CardListKey, id: string, dir: 'up' | 'down') => void
  setCardImage: (list: CardListKey, id: string, image: ImageRef) => void
  updateSeo: (
    pageKey: SeoPageKey,
    patch: Partial<Pick<SeoEntry, 'title' | 'description'>>,
  ) => void
  addRequest: (input: NewRequestInput) => void
  setRequestStatus: (id: string, status: RequestStatus) => void
  setRequestNote: (id: string, note: string) => void
  removeRequest: (id: string) => void
  resetAll: () => void
}

export interface SiteContentContextValue {
  data: AdminData
  actions: SiteContentActions
}

export const SiteContentContext =
  createContext<SiteContentContextValue | null>(null)

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AdminData>(loadAdminData)
  const skipNextPersist = useRef(false)

  // persist (debounced) whenever data changes, except when the change
  // came from another tab's storage event
  useEffect(() => {
    if (skipNextPersist.current) {
      skipNextPersist.current = false
      return
    }
    const id = window.setTimeout(() => saveAdminData(data), 300)
    return () => window.clearTimeout(id)
  }, [data])

  // cross-tab sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      try {
        skipNextPersist.current = true
        setData(JSON.parse(e.newValue) as AdminData)
      } catch {
        skipNextPersist.current = false
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const actions = useMemo<SiteContentActions>(
    () => ({
      updateSection: (key, patch) =>
        setData((d) => A.updateSection(d, key, patch)),
      addCard: (list) => setData((d) => A.addCard(d, list)),
      updateCard: (list, id, patch) =>
        setData((d) => A.updateCard(d, list, id, patch)),
      removeCard: (list, id) => setData((d) => A.removeCard(d, list, id)),
      moveCard: (list, id, dir) => setData((d) => A.moveCard(d, list, id, dir)),
      setCardImage: (list, id, image) =>
        setData((d) => A.setCardImage(d, list, id, image)),
      updateSeo: (pageKey, patch) =>
        setData((d) => A.updateSeo(d, pageKey, patch)),
      addRequest: (input) => setData((d) => A.addRequest(d, input)),
      setRequestStatus: (id, status) =>
        setData((d) => A.setRequestStatus(d, id, status)),
      setRequestNote: (id, note) =>
        setData((d) => A.setRequestNote(d, id, note)),
      removeRequest: (id) => setData((d) => A.removeRequest(d, id)),
      resetAll: () => setData(A.resetAll()),
    }),
    [],
  )

  const value = useMemo(() => ({ data, actions }), [data, actions])

  return (
    <SiteContentContext.Provider value={value}>
      {children}
    </SiteContentContext.Provider>
  )
}

export function useSiteContentRaw(): SiteContentContextValue {
  const ctx = useContext(SiteContentContext)
  if (!ctx)
    throw new Error('useSiteContent must be used within <SiteContentProvider>')
  return ctx
}
```

- [ ] **Step 4: Write `src/content/useSiteContent.ts`**

```ts
import { useMemo } from 'react'
import type { SectionKey, SeoPageKey } from '../admin/types'
import { useI18n } from '../i18n/i18n'
import { useSiteContentRaw } from './SiteContentProvider'

const pad2 = (n: number) => String(n).padStart(2, '0')

export interface ResolvedProjectCard {
  id: string
  indexLabel: string
  title: string
  tags: string[]
  description: string
  imageSrc: string
  imageAlt: string
}

export interface ResolvedServiceCard {
  id: string
  featured: boolean
  title: string
  text: string
  iconSrc: string
}

export function useSiteContent() {
  const { data, actions } = useSiteContentRaw()
  const { lang } = useI18n()

  return useMemo(() => {
    const pick = (l: { en: string; uk: string }) => l[lang] || l.en

    const section = (key: SectionKey) => {
      const s = data.sections.find((x) => x.key === key)
      return {
        eyebrow: s ? pick(s.eyebrow) : '',
        title: s ? pick(s.title) : '',
        body: s ? pick(s.body) : '',
        ctaLabel: s?.ctaLabel ? pick(s.ctaLabel) : '',
      }
    }

    const projectsHome = (): ResolvedProjectCard[] =>
      [...data.projectsHome]
        .filter((c) => c.published)
        .sort((a, b) => a.order - b.order)
        .map((c, i) => ({
          id: c.id,
          indexLabel: pad2(i + 1),
          title: pick(c.title),
          tags: c.tags,
          description: pick(c.description),
          imageSrc: c.image.src,
          imageAlt: pick(c.imageAlt),
        }))

    const servicesHome = (): ResolvedServiceCard[] =>
      [...data.servicesHome]
        .filter((c) => c.published)
        .sort((a, b) => a.order - b.order)
        .map((c) => ({
          id: c.id,
          featured: c.featured,
          title: pick(c.title),
          text: pick(c.text),
          iconSrc: c.icon.src,
        }))

    const seoFor = (pageKey: SeoPageKey) => {
      const e = data.seo.find((x) => x.pageKey === pageKey)
      return {
        title: e ? pick(e.title) : '',
        description: e ? pick(e.description) : '',
      }
    }

    return { raw: data, actions, section, projectsHome, servicesHome, seoFor }
  }, [data, actions, lang])
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/content/SiteContentProvider.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 6: Verify lint + typecheck**

Run: `npm run lint && npx tsc -b`
Expected: clean. (If oxlint flags `react-refresh`/`only-export-components` on the provider file exporting both a component and hooks, that rule is `warn` and acceptable; do not suppress unless it errors.)

- [ ] **Step 7: Commit**

```bash
git add src/content/SiteContentProvider.tsx src/content/useSiteContent.ts src/content/SiteContentProvider.test.tsx
git commit -m "feat: SiteContentProvider + useSiteContent hook

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Wire the provider into the app

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `SiteContentProvider` from `./content/SiteContentProvider`.
- Produces: the running app tree now has `SiteContentProvider` between `I18nProvider` and `BrowserRouter`. No visual change.

- [ ] **Step 1: Write the failing test**

`src/App.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

beforeEach(() => localStorage.clear())

describe('App', () => {
  it('renders the home hero from the content store', () => {
    render(<App />)
    // hero title seeded from i18n en.json
    expect(
      screen.getByRole('heading', {
        name: /Web solutions built around your business requirements/i,
      }),
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it**

Run: `npm test -- src/App.test.tsx`
Expected: PASS already (App renders hero via i18n today) — this is the regression guard for the next step.

- [ ] **Step 3: Modify `src/App.tsx`**

```tsx
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "./i18n/i18n";
import { SiteContentProvider } from "./content/SiteContentProvider";
import { Layout } from "./components/Layout/Layout";
import { HomePage } from "./pages/HomePage";
import { StubPage } from "./pages/StubPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { STUB_ROUTES } from "./data/nav";

export default function App() {
  return (
    <I18nProvider>
      <SiteContentProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              {STUB_ROUTES.map((path) => (
                <Route key={path} path={path} element={<StubPage />} />
              ))}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SiteContentProvider>
    </I18nProvider>
  );
}
```

- [ ] **Step 4: Run the test again**

Run: `npm test -- src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: mount SiteContentProvider in the app tree

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Section header texts from the store

**Files:**
- Modify: `src/sections/Hero/Hero.tsx`
- Modify: `src/sections/Services/Services.tsx`
- Modify: `src/sections/Projects/Projects.tsx`
- Modify: `src/sections/HowWork/HowWork.tsx`
- Modify: `src/sections/About/About.tsx`
- Modify: `src/sections/Cta/Cta.tsx`
- Test: `src/sections/sectionText.test.tsx`

**Interfaces:**
- Consumes: `useSiteContent` from `../../content/useSiteContent`.
- Produces: each section's eyebrow / title / body (and Hero + CTA button label) is rendered from `section(key)`. Card rendering in Services/Projects is unchanged in this task (still `tx()`), handled in Task 11. Unmanaged strings (`t('services.linkLabel')`, `t('projects.viewProject')`, hero cards, how-we-work steps, about stats) stay on `useI18n`.

- [ ] **Step 1: Write the failing test**

`src/sections/sectionText.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../i18n/i18n'
import {
  SiteContentProvider,
  useSiteContentRaw,
} from '../content/SiteContentProvider'
import { Hero } from './Hero/Hero'
import { Cta } from './Cta/Cta'
import { About } from './About/About'

beforeEach(() => localStorage.clear())

function Editor() {
  const { actions } = useSiteContentRaw()
  return (
    <button
      onClick={() =>
        actions.updateSection('hero', {
          title: { en: 'STORE HERO TITLE', uk: 'STORE HERO TITLE' },
        })
      }
    >
      set hero
    </button>
  )
}

const wrap = (ui: React.ReactNode) =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <MemoryRouter>{ui}</MemoryRouter>
        <Editor />
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('section header text comes from the store', () => {
  it('Hero title reflects a store edit', () => {
    wrap(<Hero />)
    act(() => screen.getByText('set hero').click())
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'STORE HERO TITLE',
    )
  })

  it('Cta renders its seeded title and button label from the store', () => {
    wrap(<Cta />)
    // seeded from en.json cta.title / cta.button
    expect(
      screen.getByRole('heading', { name: /turn your requirements/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /request a project estimate/i }),
    ).toBeInTheDocument()
  })

  it('About renders its seeded header from the store', () => {
    wrap(<About />)
    expect(
      screen.getByRole('heading', {
        name: /Practical experience behind every project/i,
      }),
    ).toBeInTheDocument()
  })
})
```

> The Cta test expects the CTA to be a `<button>` — this task changes it. Same for Hero's CTA in Task 13; here Hero's CTA may stay an anchor whose text comes from the store. To keep this test stable, in this task render the Cta button as `<button type="button">` (no handler yet) and Hero's CTA as `<a>` with store text.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/sections/sectionText.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Edit `src/sections/Hero/Hero.tsx`**

Add the hook and swap the four managed strings:
```tsx
import { useI18n } from "../../i18n/i18n";
import { useSiteContent } from "../../content/useSiteContent";
import { Icon, type IconName } from "../../components/Icon/Icon";
import { Reveal } from "../../components/Reveal/Reveal";
import "./Hero.css";

interface HeroCard {
  title: string;
  text: string;
}

const CARD_ICONS: IconName[] = ["target", "users", "document", "sitemap"];

export function Hero() {
  const { t, tx } = useI18n();
  const { section } = useSiteContent();
  const hero = section("hero");
  const cards = tx<HeroCard[]>("hero.cards");
  const launch = tx<HeroCard>("hero.launch");

  return (
    <section className="section hero" data-theme="dark" id="top">
      {/* ...decor unchanged... */}
      <div className="hero__container">
        <div className="hero__inner">
          <div className="hero__body">
            <Reveal className="hero__eyebrow eyebrow eyebrow--stacked" variant="up">
              <span>{hero.eyebrow}</span>
              <span className="eyebrow__line" />
            </Reveal>
            <Reveal as="h1" className="hero__title h1" variant="up" delay={60}>
              {hero.title}
            </Reveal>
            <Reveal as="p" className="hero__description" variant="up" delay={120}>
              {hero.body}
            </Reveal>
            <Reveal variant="up" delay={180}>
              <a href="#" className="btn hero__cta">
                {hero.ctaLabel}
              </a>
            </Reveal>
          </div>
          {/* ...visual, cards, launch unchanged (still use t()/tx()) ... */}
        </div>
      </div>
    </section>
  );
}
```
Keep the rest of the file (decor block, `hero__visual`, `hero__cards`, `hero__launch`, `t("hero.visualAlt")`) exactly as it is.

- [ ] **Step 4: Edit `src/sections/Services/Services.tsx`**

Add `import { useSiteContent } from "../../content/useSiteContent";`, then in the component:
```tsx
const { t, tx } = useI18n();
const { section } = useSiteContent();
const services = section("services");
const items = tx<ServiceItem[]>("services.items");
```
Replace the header render:
```tsx
<span className="eyebrow eyebrow--stacked services__eyebrow">
  <span>{services.eyebrow}</span>
  <span className="eyebrow__line" />
</span>
<h2 className="h2 services__title">{services.title}</h2>
<p className="services__description">{services.body}</p>
```
Leave the `items.map(...)` card grid and `t("services.linkLabel")` unchanged (Task 11 handles the cards).

- [ ] **Step 5: Edit `src/sections/Projects/Projects.tsx`**

```tsx
const { t, tx } = useI18n();
const { section } = useSiteContent();
const projects = section("projects");
const items = tx<ProjectItem[]>("projects.items");
```
Header render:
```tsx
<span className="eyebrow eyebrow--stacked">
  <span>{projects.eyebrow}</span>
  <span className="eyebrow__line" />
</span>
<h2 className="h2 projects__title">{projects.title}</h2>
...
<p className="projects__lede">{projects.body}</p>
```
Leave `t("projects.viewAll")`, `t("projects.viewProject")` and the `items.map` unchanged (Task 11).

- [ ] **Step 6: Edit `src/sections/HowWork/HowWork.tsx`**

```tsx
const { t, tx } = useI18n();
const { section } = useSiteContent();
const howWork = section("howWork");
const steps = tx<Step[]>("howWork.steps");
```
Header:
```tsx
<span className="eyebrow">{howWork.eyebrow}</span>
<h2 className="h2 how-work__title">{howWork.title}</h2>
<p className="how-work__description">{howWork.body}</p>
```
Steps list unchanged.

- [ ] **Step 7: Edit `src/sections/About/About.tsx`**

```tsx
const { t, tx } = useI18n();
const { section } = useSiteContent();
const about = section("about");
const stats = tx<Stat[]>("about.stats");
```
Header:
```tsx
<span className="eyebrow">{about.eyebrow}</span>
<h2 className="h2 about__title">{about.title}</h2>
<span className="about__dash" aria-hidden="true" />
<p className="about__description">{about.body}</p>
```
Stats list unchanged.

- [ ] **Step 8: Edit `src/sections/Cta/Cta.tsx`**

```tsx
import { useSiteContent } from "../../content/useSiteContent";
import { Icon } from "../../components/Icon/Icon";
import { Reveal } from "../../components/Reveal/Reveal";
import "./Cta.css";

export function Cta() {
  const { section } = useSiteContent();
  const cta = section("cta");

  return (
    <section className="section cta" data-theme="dark" id="contact">
      <div className="cta__container">
        <Reveal className="cta__card" variant="up">
          {/* ...decor unchanged... */}
          <div className="cta__content">
            <span className="eyebrow">{cta.eyebrow}</span>
            <h2 className="h2 cta__title">{cta.title}</h2>
            <span className="cta__dash" aria-hidden="true" />
            <p className="cta__description">{cta.body}</p>
            <button type="button" className="btn cta__button">
              {cta.ctaLabel}
              <Icon name="arrow-right" size={16} className="btn__arrow" />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
```
Remove the now-unused `useI18n` import from this file.

- [ ] **Step 9: Run the section test**

Run: `npm test -- src/sections/sectionText.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 10: Run the full suite + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: all green. Fix any unused-import / `noUnusedLocals` errors (e.g. `t` still imported but unused in Cta).

- [ ] **Step 11: Commit**

```bash
git add src/sections
git commit -m "feat: render section header texts from the content store

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: Projects & Services cards from the store

**Files:**
- Modify: `src/sections/Services/Services.tsx`
- Modify: `src/sections/Projects/Projects.tsx`
- Test: `src/sections/cards.test.tsx`

**Interfaces:**
- Consumes: `useSiteContent().projectsHome()` and `.servicesHome()` (resolved, published-only, sorted).
- Produces: the Home Services grid renders from `servicesHome()`; the Home Projects list renders from `projectsHome()`. The `services.linkLabel` / `projects.viewProject` / `projects.viewAll` strings still come from `useI18n`. Services card `preview` image still resolves from the slug→asset map with a neutral fallback.

- [ ] **Step 1: Write the failing test**

`src/sections/cards.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../i18n/i18n'
import {
  SiteContentProvider,
  useSiteContentRaw,
} from '../content/SiteContentProvider'
import { Services } from './Services/Services'
import { Projects } from './Projects/Projects'

beforeEach(() => localStorage.clear())

function HideFirstService() {
  const { data, actions } = useSiteContentRaw()
  return (
    <button
      onClick={() =>
        actions.updateCard('servicesHome', data.servicesHome[0].id, {
          published: false,
        })
      }
    >
      hide
    </button>
  )
}

const wrap = (ui: React.ReactNode) =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <MemoryRouter>{ui}</MemoryRouter>
        <HideFirstService />
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('Services cards from store', () => {
  it('renders seeded service titles', () => {
    wrap(<Services />)
    expect(screen.getByText('Web Development')).toBeInTheDocument()
    expect(screen.getByText('Business Analysis')).toBeInTheDocument()
  })

  it('hides a card when it is unpublished', () => {
    wrap(<Services />)
    expect(screen.getByText('Web Development')).toBeInTheDocument()
    act(() => screen.getByText('hide').click())
    expect(screen.queryByText('Web Development')).not.toBeInTheDocument()
  })
})

describe('Projects cards from store', () => {
  it('renders seeded project titles and a 01/02 index', () => {
    wrap(<Projects />)
    expect(screen.getByText('Relax Ahill')).toBeInTheDocument()
    expect(screen.getByText('Encryptia Cloud')).toBeInTheDocument()
    expect(screen.getByText('01')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/sections/cards.test.tsx`
Expected: FAIL (cards still come from `tx()`, and hiding does nothing).

- [ ] **Step 3: Rewrite the card grid in `src/sections/Services/Services.tsx`**

Replace the `ServiceItem` interface usage and `items` with the resolved list. Keep the `ASSETS` map but use it only for `preview`:
```tsx
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/i18n";
import { useSiteContent } from "../../content/useSiteContent";
import { Icon } from "../../components/Icon/Icon";
import { Reveal } from "../../components/Reveal/Reveal";
import "./Services.css";

/** design preview assets keyed by service slug */
const PREVIEWS: Record<string, string> = {
  "web-development": "/assets/services/preview-web.png",
  support: "/assets/services/preview-support.png",
  "business-analysis": "/assets/services/preview-analysis.png",
  "google-ads": "/assets/services/preview-ads.png",
};
const FALLBACK_PREVIEW = PREVIEWS["web-development"];

export function Services() {
  const { t } = useI18n();
  const { section, servicesHome } = useSiteContent();
  const services = section("services");
  const items = servicesHome();

  return (
    <section className="section services" data-theme="dark" id="services">
      <div className="services__container">
        <div className="services__inner">
          <Reveal className="services__header" variant="up">
            <span className="eyebrow eyebrow--stacked services__eyebrow">
              <span>{services.eyebrow}</span>
              <span className="eyebrow__line" />
            </span>
            <h2 className="h2 services__title">{services.title}</h2>
            <p className="services__description">{services.body}</p>
          </Reveal>

          <div className="services__body">
            <div className="services__hub" aria-hidden="true">
              <img src="/assets/services/hub.png" alt="" loading="lazy" decoding="async" />
            </div>

            <ul className="services__grid">
              {items.map((item, i) => (
                <Reveal
                  as="li"
                  key={item.id}
                  className="services__cell"
                  variant={i % 2 === 0 ? "left" : "right"}
                  delay={(i % 2) * 90}
                >
                  <article
                    className={`services__card ${item.featured ? "services__card--featured" : ""}`}
                  >
                    <div className="services__card-content">
                      <div className="services__card-head">
                        {item.iconSrc ? (
                          <img
                            className="services__card-icon"
                            src={item.iconSrc}
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <span className="services__card-icon services__card-icon--empty" aria-hidden="true" />
                        )}
                        <h3 className="services__card-title">{item.title}</h3>
                      </div>
                      <p className="services__card-text">{item.text}</p>
                      <Link to={`/${item.id}`} className="link-arrow services__card-link">
                        {t("services.linkLabel")}
                        <Icon name="arrow-right" size={15} />
                      </Link>
                    </div>
                    <img
                      className="services__card-preview"
                      src={PREVIEWS[item.id] ?? FALLBACK_PREVIEW}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                  </article>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="services__wave" aria-hidden="true">
        <img src="/assets/decor/wave-particles-tight.png" alt="" loading="lazy" decoding="async" />
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Add the empty-icon style**

In `src/sections/Services/Services.css` append:
```css
.services__card-icon--empty {
  display: inline-block;
  width: 44px;
  height: 44px;
  border: 1px dashed var(--color-border, rgba(255, 255, 255, 0.25));
  border-radius: 10px;
}
```
(Use whatever the file's existing icon sizing is; match `.services__card-icon`'s box.)

- [ ] **Step 5: Rewrite the project list in `src/sections/Projects/Projects.tsx`**

```tsx
import { Link } from "react-router-dom";
import { useI18n } from "../../i18n/i18n";
import { useSiteContent } from "../../content/useSiteContent";
import { Icon } from "../../components/Icon/Icon";
import { Reveal } from "../../components/Reveal/Reveal";
import "./Projects.css";

export function Projects() {
  const { t } = useI18n();
  const { section, projectsHome } = useSiteContent();
  const projects = section("projects");
  const items = projectsHome();

  return (
    <section className="section projects" data-theme="light" id="projects">
      <div className="projects__container">
        <div className="projects__inner">
          <Reveal className="projects__header" variant="up">
            <div className="projects__intro">
              <span className="eyebrow eyebrow--stacked">
                <span>{projects.eyebrow}</span>
                <span className="eyebrow__line" />
              </span>
              <h2 className="h2 projects__title">{projects.title}</h2>
            </div>
            <p className="projects__lede">{projects.body}</p>
            <a href="#" className="btn btn--outline projects__view-all">
              {t("projects.viewAll")}
              <Icon name="arrow-right" size={16} className="btn__arrow" />
            </a>
          </Reveal>

          <ul className="projects__list">
            {items.map((item, i) => (
              <Reveal as="li" key={item.id} className="projects__row" variant="up">
                <article
                  className={`projects__item ${i % 2 === 1 ? "projects__item--reverse" : ""}`}
                >
                  <div className="projects__media">
                    {item.imageSrc ? (
                      <img
                        src={item.imageSrc}
                        alt={item.imageAlt}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="projects__media-empty" aria-hidden="true" />
                    )}
                  </div>
                  <div className="projects__content">
                    <span className="projects__index">{item.indexLabel}</span>
                    <h3 className="projects__project-title">{item.title}</h3>
                    <p className="projects__tags">
                      {item.tags.map((tag, k) => (
                        <span key={tag}>
                          {k > 0 && <span className="projects__tag-sep">•</span>}
                          {tag}
                        </span>
                      ))}
                    </p>
                    <p className="projects__text">{item.description}</p>
                    <Link to={`/projects/${item.id}`} className="link-arrow">
                      {t("projects.viewProject")}
                      <Icon name="arrow-right" size={15} />
                    </Link>
                  </div>
                </article>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Add the empty-media style**

In `src/sections/Projects/Projects.css` append:
```css
.projects__media-empty {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  background: repeating-linear-gradient(
    45deg,
    rgba(0, 0, 0, 0.04),
    rgba(0, 0, 0, 0.04) 10px,
    rgba(0, 0, 0, 0.07) 10px,
    rgba(0, 0, 0, 0.07) 20px
  );
  border-radius: 12px;
}
```

- [ ] **Step 7: Run the card test**

Run: `npm test -- src/sections/cards.test.tsx`
Expected: PASS.

- [ ] **Step 8: Full suite + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: green. Remove any now-unused interfaces (`ServiceItem`, `ProjectItem`, `ASSETS`, `projectImage`, `CARD_ICONS` is still used by Hero only — leave it) flagged by `noUnusedLocals`.

- [ ] **Step 9: Commit**

```bash
git add src/sections
git commit -m "feat: render Home project & service cards from the content store

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Per-page SEO (`<DocumentHead>`)

**Files:**
- Create: `src/data/routeSeo.ts`
- Create: `src/components/DocumentHead/DocumentHead.tsx`
- Modify: `src/components/Layout/Layout.tsx`
- Test: `src/components/DocumentHead/DocumentHead.test.tsx`

**Interfaces:**
- Consumes: `useSiteContent().seoFor`; `useLocation` from react-router; `SeoPageKey` from `../../admin/types`.
- Produces:
  - `ROUTE_SEO: Record<string, SeoPageKey>` and `seoKeyForPath(path: string): SeoPageKey` (fallback `'home'`).
  - `<DocumentHead />` — side-effect-only component (`return null`) that sets `document.title`, `<meta name="description">`, `<meta property="og:title">`, `<meta property="og:description">` from the resolved SEO entry for the current path + language.

- [ ] **Step 1: Write `src/data/routeSeo.ts`**

```ts
import type { SeoPageKey } from '../admin/types'

export const ROUTE_SEO: Record<string, SeoPageKey> = {
  '/': 'home',
  '/services': 'services',
  '/projects': 'projects',
  '/about': 'about',
  '/web-development': 'web-development',
  '/support': 'support',
  '/business-analysis': 'business-analysis',
  '/google-ads': 'google-ads',
}

export function seoKeyForPath(path: string): SeoPageKey {
  return ROUTE_SEO[path] ?? 'home'
}
```

- [ ] **Step 2: Write the failing test**

`src/components/DocumentHead/DocumentHead.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../../i18n/i18n'
import {
  SiteContentProvider,
  useSiteContentRaw,
} from '../../content/SiteContentProvider'
import { DocumentHead } from './DocumentHead'

beforeEach(() => localStorage.clear())

const metaDesc = () =>
  document.querySelector('meta[name="description"]')?.getAttribute('content')

function EditAboutSeo() {
  const { actions } = useSiteContentRaw()
  return (
    <button
      onClick={() =>
        actions.updateSeo('about', {
          title: { en: 'Edited About Title', uk: 'Edited About Title' },
        })
      }
    >
      edit
    </button>
  )
}

const mount = (path: string) =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <MemoryRouter initialEntries={[path]}>
          <DocumentHead />
        </MemoryRouter>
        <EditAboutSeo />
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('DocumentHead', () => {
  it('sets the document title and meta description for the home route', () => {
    mount('/')
    expect(document.title).toMatch(/ONVORX/)
    expect(metaDesc()).toBeTruthy()
  })

  it('uses the About SEO entry on /about and reflects store edits', () => {
    const { getByText } = mount('/about')
    expect(document.title).toMatch(/About/)
    act(() => getByText('edit').click())
    expect(document.title).toBe('Edited About Title')
  })

  it('falls back to home SEO for an unknown route', () => {
    mount('/nope')
    expect(document.title).toMatch(/ONVORX/)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- src/components/DocumentHead/DocumentHead.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Write `src/components/DocumentHead/DocumentHead.tsx`**

```tsx
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useSiteContent } from '../../content/useSiteContent'
import { seoKeyForPath } from '../../data/routeSeo'

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  if (!content) return
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  )
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function DocumentHead() {
  const { pathname } = useLocation()
  const { seoFor } = useSiteContent()
  const { title, description } = seoFor(seoKeyForPath(pathname))

  useEffect(() => {
    if (title) document.title = title
    setMeta('name', 'description', description)
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', description)
  }, [title, description])

  return null
}
```

- [ ] **Step 5: Mount it in `src/components/Layout/Layout.tsx`**

Add the import and render `<DocumentHead />` as the first child inside the fragment:
```tsx
import { DocumentHead } from "../DocumentHead/DocumentHead";
// ...
return (
  <>
    <DocumentHead />
    <a href="#main" className="skip-link">
      {t("nav.skip")}
    </a>
    <SiteHeader />
    <main id="main">
      <Outlet />
    </main>
    <SiteFooter />
  </>
);
```

- [ ] **Step 6: Run the test**

Run: `npm test -- src/components/DocumentHead/DocumentHead.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 7: Full suite + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add src/data/routeSeo.ts src/components/DocumentHead src/components/Layout/Layout.tsx
git commit -m "feat: per-route SEO title & meta via DocumentHead

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: Estimate form (component + open/close context)

**Files:**
- Create: `src/components/EstimateForm/useEstimateForm.tsx`
- Create: `src/components/EstimateForm/EstimateForm.tsx`
- Create: `src/components/EstimateForm/EstimateForm.css`
- Modify: `src/components/Layout/Layout.tsx`
- Test: `src/components/EstimateForm/EstimateForm.test.tsx`

**Interfaces:**
- Consumes: `useSiteContent()` (`servicesHome` for the interest checkboxes, `actions.addRequest`), `useI18n()` (`lang`).
- Produces:
  - `EstimateFormProvider` (children prop) + `useEstimateForm(): { isOpen: boolean; open: (sourcePage?: string) => void; close: () => void }`
  - `<EstimateForm />` — renders `null` when closed; when open, a `role="dialog"` `aria-modal="true"` modal with fields Name*, Email*, Company, Budget (select), "Interested in" (checkbox list), Message*. Validates required fields + email format; on valid submit calls `addRequest({ name, email, company?, budget?, interestedIn, message, locale, sourcePage? })`, shows a success panel, and auto-closes after 2s (also closable immediately).

- [ ] **Step 1: Write the failing test**

`src/components/EstimateForm/EstimateForm.test.tsx`:
```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import {
  SiteContentProvider,
  useSiteContentRaw,
} from '../../content/SiteContentProvider'
import { EstimateFormProvider, useEstimateForm } from './useEstimateForm'
import { EstimateForm } from './EstimateForm'

beforeEach(() => localStorage.clear())

function OpenButton() {
  const { open } = useEstimateForm()
  return <button onClick={() => open('/test')}>open form</button>
}

function RequestCount() {
  const { data } = useSiteContentRaw()
  return <span data-testid="count">{data.requests.length}</span>
}

const setup = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <EstimateFormProvider>
          <OpenButton />
          <RequestCount />
          <EstimateForm />
        </EstimateFormProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('EstimateForm', () => {
  it('is not in the DOM until opened', () => {
    setup()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens and shows the form fields', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('open form'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument()
  })

  it('blocks submit and shows errors when required fields are empty', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('open form'))
    await user.click(screen.getByRole('button', { name: /send request/i }))
    expect(screen.getByText('count')).toHaveTextContent(
      screen.getByTestId('count').textContent!,
    )
    const countBefore = screen.getByTestId('count').textContent
    expect(screen.getAllByText(/required/i).length).toBeGreaterThan(0)
    expect(screen.getByTestId('count')).toHaveTextContent(countBefore!)
  })

  it('rejects an invalid email', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('open form'))
    await user.type(screen.getByLabelText(/name/i), 'Jane')
    await user.type(screen.getByLabelText(/email/i), 'not-an-email')
    await user.type(screen.getByLabelText(/message/i), 'Hi there')
    await user.click(screen.getByRole('button', { name: /send request/i }))
    expect(screen.getByText(/valid email/i)).toBeInTheDocument()
  })

  it('submits a valid form and records a request', async () => {
    const user = userEvent.setup()
    setup()
    const before = Number(screen.getByTestId('count').textContent)
    await user.click(screen.getByText('open form'))
    await user.type(screen.getByLabelText(/name/i), 'Jane Roe')
    await user.type(screen.getByLabelText(/email/i), 'jane@roe.com')
    await user.type(screen.getByLabelText(/message/i), 'We need a new site.')
    await user.click(screen.getByRole('button', { name: /send request/i }))
    expect(await screen.findByText(/thank you/i)).toBeInTheDocument()
    expect(Number(screen.getByTestId('count').textContent)).toBe(before + 1)
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByText('open form'))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/components/EstimateForm/EstimateForm.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write `src/components/EstimateForm/useEstimateForm.tsx`**

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

interface EstimateFormValue {
  isOpen: boolean
  sourcePage?: string
  open: (sourcePage?: string) => void
  close: () => void
}

const Ctx = createContext<EstimateFormValue | null>(null)

export function EstimateFormProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ isOpen: boolean; sourcePage?: string }>({
    isOpen: false,
  })
  const open = useCallback(
    (sourcePage?: string) => setState({ isOpen: true, sourcePage }),
    [],
  )
  const close = useCallback(
    () => setState((s) => ({ isOpen: false, sourcePage: s.sourcePage })),
    [],
  )
  const value = useMemo<EstimateFormValue>(
    () => ({ isOpen: state.isOpen, sourcePage: state.sourcePage, open, close }),
    [state, open, close],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useEstimateForm(): EstimateFormValue {
  const ctx = useContext(Ctx)
  if (!ctx)
    throw new Error('useEstimateForm must be used within <EstimateFormProvider>')
  return ctx
}
```

- [ ] **Step 4: Write `src/components/EstimateForm/EstimateForm.tsx`**

```tsx
import { useEffect, useId, useRef, useState } from 'react'
import type { BudgetRange } from '../../admin/types'
import { useI18n } from '../../i18n/i18n'
import { useSiteContent } from '../../content/useSiteContent'
import { useEstimateForm } from './useEstimateForm'
import './EstimateForm.css'

const BUDGETS: { value: BudgetRange; label: string }[] = [
  { value: '<1k', label: 'Under $1,000' },
  { value: '1-3k', label: '$1,000 – $3,000' },
  { value: '3-10k', label: '$3,000 – $10,000' },
  { value: '10k+', label: 'Over $10,000' },
  { value: 'not_sure', label: 'Not sure yet' },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function EstimateForm() {
  const { isOpen, sourcePage, close } = useEstimateForm()
  const { lang } = useI18n()
  const { servicesHome, actions } = useSiteContent()
  const services = servicesHome()

  const baseId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [budget, setBudget] = useState<BudgetRange | ''>('')
  const [interested, setInterested] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sent, setSent] = useState(false)

  // reset each time it opens
  useEffect(() => {
    if (isOpen) {
      setName('')
      setEmail('')
      setCompany('')
      setBudget('')
      setInterested([])
      setMessage('')
      setErrors({})
      setSent(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    dialogRef.current?.querySelector<HTMLElement>('input,textarea')?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [isOpen, close])

  useEffect(() => {
    if (!sent) return
    const id = window.setTimeout(close, 2000)
    return () => window.clearTimeout(id)
  }, [sent, close])

  if (!isOpen) return null

  const toggleInterest = (id: string) =>
    setInterested((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    )

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Name is required.'
    if (!email.trim()) next.email = 'Email is required.'
    else if (!EMAIL_RE.test(email.trim()))
      next.email = 'Enter a valid email address.'
    if (!message.trim()) next.message = 'A short message is required.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    actions.addRequest({
      name: name.trim(),
      email: email.trim(),
      company: company.trim() || undefined,
      budget: budget || undefined,
      interestedIn: interested,
      message: message.trim(),
      locale: lang,
      sourcePage,
    })
    setSent(true)
  }

  const titleId = `${baseId}-title`

  return (
    <div className="estimate-form__overlay" onClick={close}>
      <div
        ref={dialogRef}
        className="estimate-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="estimate-form__close"
          aria-label="Close"
          onClick={close}
        >
          ×
        </button>

        {sent ? (
          <div className="estimate-form__done">
            <h2 id={titleId}>Thank you</h2>
            <p>
              Your request has been received. ONVORX will review it and get back
              to you shortly.
            </p>
          </div>
        ) : (
          <form className="estimate-form__body" onSubmit={submit} noValidate>
            <h2 id={titleId}>Request a Project Estimate</h2>

            <label htmlFor={`${baseId}-name`}>
              Name
              <input
                id={`${baseId}-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && (
                <span className="estimate-form__error">{errors.name}</span>
              )}
            </label>

            <label htmlFor={`${baseId}-email`}>
              Email
              <input
                id={`${baseId}-email`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && (
                <span className="estimate-form__error">{errors.email}</span>
              )}
            </label>

            <label htmlFor={`${baseId}-company`}>
              Company (optional)
              <input
                id={`${baseId}-company`}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </label>

            <label htmlFor={`${baseId}-budget`}>
              Budget (optional)
              <select
                id={`${baseId}-budget`}
                value={budget}
                onChange={(e) => setBudget(e.target.value as BudgetRange | '')}
              >
                <option value="">Select a range…</option>
                {BUDGETS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>

            {services.length > 0 && (
              <fieldset className="estimate-form__interests">
                <legend>Interested in (optional)</legend>
                {services.map((s) => (
                  <label key={s.id} className="estimate-form__checkbox">
                    <input
                      type="checkbox"
                      checked={interested.includes(s.id)}
                      onChange={() => toggleInterest(s.id)}
                    />
                    {s.title}
                  </label>
                ))}
              </fieldset>
            )}

            <label htmlFor={`${baseId}-message`}>
              Message
              <textarea
                id={`${baseId}-message`}
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                aria-invalid={Boolean(errors.message)}
              />
              {errors.message && (
                <span className="estimate-form__error">{errors.message}</span>
              )}
            </label>

            <button type="submit" className="btn estimate-form__submit">
              Send request
            </button>
            <p className="estimate-form__note">
              Your information is secure and will not be shared.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Write `src/components/EstimateForm/EstimateForm.css`**

```css
.estimate-form__overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 5vh 1rem;
  background: rgba(6, 8, 11, 0.6);
  overflow-y: auto;
}

.estimate-form {
  position: relative;
  width: 100%;
  max-width: 520px;
  background: var(--color-surface, #14161a);
  color: var(--color-text, #f4f5f7);
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.12));
  border-radius: 16px;
  padding: 2rem clamp(1.25rem, 4vw, 2.25rem);
}

.estimate-form__close {
  position: absolute;
  top: 0.75rem;
  right: 0.9rem;
  background: none;
  border: 0;
  color: inherit;
  font-size: 1.6rem;
  line-height: 1;
  cursor: pointer;
}

.estimate-form__body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.estimate-form__body h2 {
  margin: 0 0 0.25rem;
}
.estimate-form__body label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
}
.estimate-form__body input,
.estimate-form__body select,
.estimate-form__body textarea {
  font: inherit;
  padding: 0.6rem 0.7rem;
  border-radius: 8px;
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.18));
  background: var(--color-bg, #0b0d10);
  color: inherit;
}
.estimate-form__body input[aria-invalid='true'],
.estimate-form__body textarea[aria-invalid='true'] {
  border-color: #e0564f;
}
.estimate-form__error {
  color: #f08a84;
  font-size: 0.8rem;
}
.estimate-form__interests {
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.14));
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.estimate-form__checkbox {
  flex-direction: row !important;
  align-items: center;
  gap: 0.5rem;
}
.estimate-form__submit {
  margin-top: 0.25rem;
}
.estimate-form__note {
  font-size: 0.78rem;
  opacity: 0.7;
  margin: 0;
}
.estimate-form__done {
  text-align: center;
  padding: 1.5rem 0;
}
```
(Use the project's real token names from `src/styles/tokens.css` where they exist; the fallbacks above keep it working regardless.)

- [ ] **Step 6: Mount in `src/components/Layout/Layout.tsx`**

Wrap the layout body in `<EstimateFormProvider>` and render `<EstimateForm />` before `</>`:
```tsx
import { EstimateFormProvider } from "../EstimateForm/useEstimateForm";
import { EstimateForm } from "../EstimateForm/EstimateForm";
// ...
return (
  <EstimateFormProvider>
    <DocumentHead />
    <a href="#main" className="skip-link">
      {t("nav.skip")}
    </a>
    <SiteHeader />
    <main id="main">
      <Outlet />
    </main>
    <SiteFooter />
    <EstimateForm />
  </EstimateFormProvider>
);
```

- [ ] **Step 7: Run the test**

Run: `npm test -- src/components/EstimateForm/EstimateForm.test.tsx`
Expected: PASS (6 tests). Adjust the "shows errors" assertion text if your error copy differs — keep the copy and the test in sync.

- [ ] **Step 8: Full suite + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: green.

- [ ] **Step 9: Commit**

```bash
git add src/components/EstimateForm src/components/Layout/Layout.tsx
git commit -m "feat: public estimate request form writing to the content store

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 14: Wire the CTA triggers to open the form

**Files:**
- Modify: `src/components/SiteHeader/SiteHeader.tsx`
- Modify: `src/sections/Hero/Hero.tsx`
- Modify: `src/sections/Cta/Cta.tsx`
- Test: `src/components/EstimateForm/triggers.test.tsx`

**Interfaces:**
- Consumes: `useEstimateForm()` (`open`); `useLocation().pathname` for `sourcePage`.
- Produces: every "Request an Estimate" / "Request a Project Estimate" control opens the modal. No `href="#"` estimate links remain.

- [ ] **Step 1: Write the failing test**

`src/components/EstimateForm/triggers.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider } from '../../content/SiteContentProvider'
import { EstimateFormProvider } from './useEstimateForm'
import { EstimateForm } from './EstimateForm'
import { SiteHeader } from '../SiteHeader/SiteHeader'
import { Hero } from '../../sections/Hero/Hero'
import { Cta } from '../../sections/Cta/Cta'

beforeEach(() => localStorage.clear())

const wrap = (ui: React.ReactNode) =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <EstimateFormProvider>
          <MemoryRouter>{ui}</MemoryRouter>
          <EstimateForm />
        </EstimateFormProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('estimate CTA triggers', () => {
  it('header CTA opens the modal', async () => {
    const user = userEvent.setup()
    wrap(<SiteHeader />)
    await user.click(
      screen.getAllByRole('button', { name: /request an estimate/i })[0],
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('hero CTA opens the modal', async () => {
    const user = userEvent.setup()
    wrap(<Hero />)
    await user.click(screen.getByRole('button', { name: /request an estimate/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('cta section button opens the modal', async () => {
    const user = userEvent.setup()
    wrap(<Cta />)
    await user.click(
      screen.getByRole('button', { name: /request a project estimate/i }),
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/components/EstimateForm/triggers.test.tsx`
Expected: FAIL (controls are still anchors / have no handler).

- [ ] **Step 3: Edit `src/components/SiteHeader/SiteHeader.tsx`**

Add hooks:
```tsx
import { useEstimateForm } from "../EstimateForm/useEstimateForm";
// inside component:
const { open } = useEstimateForm();
const location = useLocation(); // already present
```
Replace the bar CTA:
```tsx
<button
  type="button"
  className="btn btn--outline site-header__cta"
  onClick={() => open(location.pathname)}
>
  {t("nav.cta")}
</button>
```
Replace the drawer CTA:
```tsx
<button
  type="button"
  className="btn site-header__drawer-cta"
  onClick={() => open(location.pathname)}
>
  {t("nav.cta")}
</button>
```

- [ ] **Step 4: Edit `src/sections/Hero/Hero.tsx`**

```tsx
import { useLocation } from "react-router-dom";
import { useEstimateForm } from "../../components/EstimateForm/useEstimateForm";
// inside component:
const { open } = useEstimateForm();
const { pathname } = useLocation();
```
Replace the CTA anchor:
```tsx
<button
  type="button"
  className="btn hero__cta"
  onClick={() => open(pathname)}
>
  {hero.ctaLabel}
</button>
```

- [ ] **Step 5: Edit `src/sections/Cta/Cta.tsx`**

```tsx
import { useLocation } from "react-router-dom";
import { useEstimateForm } from "../../components/EstimateForm/useEstimateForm";
// inside component:
const { open } = useEstimateForm();
const { pathname } = useLocation();
```
Give the existing `<button type="button" className="btn cta__button">` an `onClick={() => open(pathname)}`.

- [ ] **Step 6: Run the trigger test**

Run: `npm test -- src/components/EstimateForm/triggers.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 7: Full suite + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add src/components/SiteHeader/SiteHeader.tsx src/sections/Hero/Hero.tsx src/sections/Cta/Cta.tsx
git commit -m "feat: wire estimate CTAs to open the request form

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 15: Docs + final verification

**Files:**
- Modify: `Readme.md`
- Create: `src/content/README.md`
- Test: full suite + build

**Interfaces:**
- Consumes: everything above.
- Produces: documentation of the content store; a verified green build.

- [ ] **Step 1: Write `src/content/README.md`**

```markdown
# Content store

`SiteContentProvider` holds all owner-editable site content as one `AdminData`
object, seeded from `src/i18n/{en,uk}.json` (+ mock estimate requests) and
persisted to `localStorage` under `onvorx.admin.v1`.

- **Read** managed fields via `useSiteContent()` — language-resolved helpers
  (`section`, `projectsHome`, `servicesHome`, `seoFor`).
- **Read/write** the raw object via `useSiteContentRaw()` — used by the `/admin`
  screens (added in a later plan).
- **Mutations** are pure functions in `src/admin/actions.ts`; the provider binds
  them and persists after each change (debounced, with cross-tab `storage` sync).

Unmanaged strings (nav, hero feature cards, "how we work" steps, About stats,
footer, 404) still come from `useI18n()` and `src/i18n/*.json`.

To move persistence to a real backend later, replace `src/content/persistence.ts`
(`loadAdminData` / `saveAdminData`) — the `AdminData` shape stays the same.
```

- [ ] **Step 2: Add an "Admin panel (in progress)" note to `Readme.md`**

Under the `## Content / CMS` section (or right after it) add:
```markdown
## Admin panel (in progress)

An owner-facing panel at `/admin` (built in phases — see
`docs/superpowers/specs/2026-09-08-admin-panel-design.md`). Phase 1 introduces a
shared content store (`src/content/`) that backs the site's managed content
(section texts, project & service cards, per-page SEO) plus a public
"Request an Estimate" form. Data currently persists to `localStorage` only.
```

- [ ] **Step 3: Run the full verification**

Run:
```bash
npm test
npm run lint
npm run build
```
Expected: all tests pass; oxlint clean; `tsc -b && vite build` succeeds.

- [ ] **Step 4: Manual smoke in the browser**

Run: `npm run dev`, then:
- Home renders unchanged from before.
- Open dev console → `localStorage.getItem('onvorx.admin.v1')` is populated.
- Click "Request an Estimate" (header, hero, CTA section) → modal opens; submit a valid form → success panel.
- In console: `JSON.parse(localStorage['onvorx.admin.v1']).requests[0]` shows the submission.
- Edit a value: `const d = JSON.parse(localStorage['onvorx.admin.v1']); d.sections[0].title.en = 'Hi'; localStorage['onvorx.admin.v1'] = JSON.stringify(d)` → reload → hero title changed.
- `/about` → `document.title` is the About SEO title.

- [ ] **Step 5: Commit**

```bash
git add Readme.md src/content/README.md
git commit -m "docs: content store notes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (Plan 1 scope only — auth and admin UI are Plans 2 & 3):**

| Spec item | Task |
|---|---|
| Shared content store, Approach B, seeded = current content | 4, 6, 8 |
| `localStorage` persistence, key `onvorx.admin.v1`, reset seam | 6 |
| Pure reducers for every managed entity | 7 |
| Bilingual `L` everywhere, EN fallback | 2, 8 |
| Section header texts (eyebrow/title/body + Hero/CTA button) reflected on site | 10 |
| Home Projects cards from store (published filter, order, derived index) | 7, 11 |
| Home Services cards from store (icon/title/text/featured) | 7, 11 |
| Projects-page / Services-page separate lists (no consumer yet) | 4, 7 |
| SEO 8 pages, editable, applied per route | 4, 12 |
| Google SERP-style data available (title/description resolved) | 8, 12 |
| Public estimate form → store inbox | 5, 7, 13, 14 |
| Estimate CTAs (header ×2, hero, CTA section) open the form | 14 |
| Image upload helper (File → downscaled data URL, size cap) | 3 |
| Tests: reducers, persistence, components, integration | every task |
| Lint + `tsc -b && vite build` gates | 7, 10, 11, 12, 13, 14, 15 |

Not in this plan (by design): auth / `/admin/*` routes / admin screens / admin components / `@vercel/node` / dev middleware / e2e Playwright → **Plan 2 (auth)** and **Plan 3 (admin UI)**.

**2. Placeholder scan:** No "TBD/TODO/handle edge cases" left. Two spots call out a deliberate correction to make while typing (the stray `useContext` import in Task 8 Step 3; the `useCallback` casing note in Task 13 Step 3) — these are explicit instructions, not placeholders.

**3. Type consistency:** `AdminData`, `CardListKey`, `SeoPageKey`, `NewRequestInput`, `ImageRef`, `L`, `SectionKey` defined once in Task 2 and imported everywhere. Reducer names in Task 7 (`updateSection`, `addCard`, `updateCard`, `removeCard`, `moveCard`, `setCardImage`, `updateSeo`, `addRequest`, `setRequestStatus`, `setRequestNote`, `removeRequest`, `resetAll`) match the bound `SiteContentActions` in Task 8 and the calls in Tasks 10–14. `useSiteContent()` helper names (`section`, `projectsHome`, `servicesHome`, `seoFor`, `raw`, `actions`) match every consumer. `seoKeyForPath` / `ROUTE_SEO` consistent between Tasks 12 definition and usage.
