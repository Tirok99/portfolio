# Telegram Bot Admin — Plan 3: Projects & Services Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `Projects`/`Services` stubs from Plan 1 with fully working card-editing flows — pick a type (Projects/Services) → pick Home/Page → pick a card → view/edit its text fields, tags (Projects only), image, published state, featured state (Services/Home only) → move it up/down → delete it with confirmation — with every write going through the exact same `handleAdminCards`/`handleAdminUpload` functions the web `/admin` panel already uses.

**Architecture:** Two new read-only lookups (`listProjects`/`getProject`/`listServices`/`getService` in `api/_lib/telegramCards.ts`, mirroring Plan 2's `telegramContent.ts`) feed a set of pure `BotReply` builders in `telegramMenu.ts`. All the new state-machine logic lives in a **new file**, `api/_lib/telegramCardsDispatch.ts` — not `telegramDispatch.ts`, which Plan 2's final review already flagged as approaching a size where a further plan should split it rather than grow it further (it sat at 447 lines after Plan 2; this plan's scope — two card types, five field kinds, three boolean/ordering actions, and a whole new photo-upload capability — would push a single-file design well past a reasonable size). `telegramDispatch.ts` gains only a thin `cards:` prefix delegation. Every save signs the same `admin_session` cookie Plan 2 already established and calls `handleAdminCards`/`handleAdminUpload` directly — zero duplicated business logic, exactly like Plan 2's Content/SEO writes.

**Tech Stack:** Same as Plans 1-2 — grammY (already wired), Supabase (`projects`/`services` tables and Storage, already exist), Vercel Functions, Vitest. **No new dependency** — see the WebP decision below.

**Spec:** `docs/superpowers/specs/2026-09-12-telegram-bot-admin.md` — this plan implements Goal §1's Projects and Services rows. Read Plan 2 (`docs/superpowers/plans/2026-09-12-telegram-bot-plan-2-content-seo.md`, merged to `main` at `d6781ea`) first — this plan extends its files and reuses its exact patterns (read-only Deps module, pure builders, EN/UA merge-before-save, `adminCookieHeader`).

## Decided during this plan's authoring (overrides the spec's literal text)

**No WebP conversion.** The spec's §2/§8 originally called for converting bot-uploaded photos to WebP before storing them. Investigation for this plan found: `api/_lib/adminUploadHandler.ts`'s `MIME_EXT` allowlist already accepts `image/jpeg` (the exact same code path the web admin's own upload button uses), and Telegram's Bot API always delivers a "photo" message pre-compressed as JPEG. Uploading those bytes as-is satisfies every existing validation with **zero new dependencies**. A WebP encoder for a Vercel Node serverless function would mean `sharp` (native binaries — bundle-size and `{"type":"commonjs"}`-compatibility risk this project has already flagged as unresolved) or a slower pure-JS encoder, for a payoff (smaller files than a phone-camera JPEG Telegram has already recompressed) that doesn't justify either. **This plan adds no image-processing library.**

## Global Constraints

Carried forward from Plans 1-2, unchanged and still binding:
- Server-only env vars, never `VITE_`-prefixed.
- Every new `api/_lib/*.ts` module follows the injectable-`Deps`-interface pattern: a `Deps` interface, a `defaultXDeps` implementation built on `getSupabaseAdmin(env)`, an orchestration function taking `deps` as a defaulted last parameter.
- `api/package.json` pins `{"type":"commonjs"}` for the whole `api/` tree — never touch it, and never use a dynamic `await import()` inside `api/_lib/*`. Static imports only. (This plan's one raw `fetch()` call, see Task 4, is a global function call, not an import — it does not trigger this rule.)
- **Zero duplicated business logic**: every write to `projects`/`services`/Storage goes through `handleAdminCards`/`handleAdminUpload` — this plan never calls Supabase `.update()`/`.storage` directly for a write.
- **Never send a single-language patch** for any `L`-typed field (`title`, `description`/`text`, `imageAlt`) — read the current record first, merge the edited language into the untouched one, exactly like Plan 2's content/SEO saves.
- Display label for the `uk` locale is **"UA"**, not "UK" (internal field/callback name stays `uk`).
- `canAccessSection(role, 'projects')` and `canAccessSection(role, 'services')` currently resolve identically for every role in this codebase (`MENU_ITEMS` gives both the same `['owner', 'content_manager']`) — this plan's single `cards:` access gate relies on that invariant (checking either key is equivalent to checking both). If a future plan ever gives Projects and Services different role requirements, that single gate must be split — this plan does not need to guard against that, but a comment at the gate says so.
- No live Telegram/Supabase calls from unit tests — every test injects fakes; the one new exception (Task 4) is `vi.stubGlobal('fetch', ...)` for the raw file-download call, which is not a grammY/Supabase call.
- Test files are `*.test.ts` next to the file they test, run via `npx vitest run <path>`.
- Model-selection discipline (unchanged): cheapest capable model for mechanical/fully-specified tasks (Tasks 1-2), a standard model for judgment/integration tasks and all task reviewers (Tasks 3-4), the most capable available model for the single final whole-branch review. Executed via `superpowers:subagent-driven-development`.

---

## File structure (this plan)

```
onvorx/
  api/
    _lib/
      telegramCards.ts            # CREATE: read-only projects/services lookup (Supabase-backed)
      telegramCards.test.ts       # CREATE
      telegramMenu.ts             # MODIFY: add card list/detail/prompt builders (Projects + Services)
      telegramMenu.test.ts        # MODIFY
      telegramCardsDispatch.ts    # CREATE: the Projects/Services state machine (new file — see Architecture)
      telegramCardsDispatch.test.ts # CREATE
      telegramDispatch.ts         # MODIFY: thin `cards:` prefix delegation + photo-message entry point
      telegramDispatch.test.ts    # MODIFY
      telegramBot.ts              # MODIFY: async `toBotCtx`, photo download, `message:photo` registration
      telegramBot.test.ts         # MODIFY
      adminCardsHandler.ts        # MODIFY: export the existing private `defaultDeps` as `defaultAdminCardsDeps`
      adminUploadHandler.ts       # MODIFY: export the existing private `defaultDeps` as `defaultAdminUploadDeps`
```

No new Supabase migration — `projects`/`services` tables and the `public-media` Storage bucket already exist.

### Interfaces produced by this plan

```ts
// api/_lib/telegramCards.ts
export type ProjectField = 'title' | 'description' | 'imageAlt' | 'tags'
export type ServiceField = 'title' | 'text'
export interface ProjectCardRecord {
  list: 'home' | 'page'
  id: string
  sort: number
  published: boolean
  title: L
  tags: string[]
  description: L
  imageUrl: string | null
  imagePath: string | null
  imageAlt: L
}
export interface ServiceCardRecord {
  list: 'home' | 'page'
  id: string
  sort: number
  published: boolean
  featured: boolean
  title: L
  text: L
  iconUrl: string | null
  iconPath: string | null
}
export interface TelegramCardsDeps {
  listProjects: (list: 'home' | 'page', env: SupabaseAdminEnv) => Promise<ProjectCardRecord[]>
  getProject: (list: 'home' | 'page', id: string, env: SupabaseAdminEnv) => Promise<ProjectCardRecord | null>
  listServices: (list: 'home' | 'page', env: SupabaseAdminEnv) => Promise<ServiceCardRecord[]>
  getService: (list: 'home' | 'page', id: string, env: SupabaseAdminEnv) => Promise<ServiceCardRecord | null>
}
export const defaultTelegramCardsDeps: TelegramCardsDeps

// api/_lib/telegramMenu.ts — added
export function buildCardTypeTabs(type: 'projects' | 'services'): BotReply
export function buildProjectList(list: 'home' | 'page', cards: ProjectCardRecord[]): BotReply
export function buildServiceList(list: 'home' | 'page', cards: ServiceCardRecord[]): BotReply
export function buildProjectDetail(card: ProjectCardRecord, position: { index: number; total: number }, opts?: { saved?: boolean }): BotReply
export function buildServiceDetail(card: ServiceCardRecord, position: { index: number; total: number }, opts?: { saved?: boolean }): BotReply
export function buildCardFieldLangPrompt(label: string, backCallback: string): BotReply
export function buildCardValuePrompt(label: string, lang: 'en' | 'uk', currentText: string): BotReply
export function buildTagsPrompt(currentTags: string[]): BotReply
export function buildPhotoPrompt(backCallback: string): BotReply
export function buildCardDeleteConfirm(title: string, kind: 'project' | 'service'): BotReply
export function buildCardSaveFailed(backCallback: string): BotReply

// api/_lib/telegramCardsDispatch.ts
export interface CardsDispatchDeps {
  cards: TelegramCardsDeps
  adminCards: AdminCardsDeps
  adminUpload: AdminUploadDeps
  sessions: TelegramSessionsDeps
}
export function dispatchCardsCallback(ctx: BotCtx, data: string, env: Env, deps: CardsDispatchDeps): Promise<void>
export function dispatchCardsText(ctx: BotCtx, text: string, env: Env, deps: CardsDispatchDeps): Promise<void>
export function dispatchCardsPhoto(ctx: BotCtx, env: Env, deps: CardsDispatchDeps): Promise<void>

// api/_lib/telegramDispatch.ts — BotCtx and DispatchDeps grow
export interface BotCtx {
  // ...unchanged fields from Plans 1-2...
  photoDataUrl?: string // NEW — a ready-made `data:image/jpeg;base64,...` string
}
export interface DispatchDeps {
  // ...unchanged fields from Plans 1-2...
  cards: TelegramCardsDeps        // new
  adminCards: AdminCardsDeps      // new
  adminUpload: AdminUploadDeps    // new
}

// api/_lib/adminCardsHandler.ts / adminUploadHandler.ts — newly exported
export const defaultAdminCardsDeps: AdminCardsDeps
export const defaultAdminUploadDeps: AdminUploadDeps
```

---

## Task 1: Read-only Projects & Services lookup — `api/_lib/telegramCards.ts`

**Files:**
- Create: `api/_lib/telegramCards.ts`
- Test: `api/_lib/telegramCards.test.ts`

**Interfaces:**
- Consumes: `getSupabaseAdmin` from `./supabaseAdmin`, `type L` from `./adminRows`, `type SupabaseAdminEnv` from `./types`.
- Produces: `ProjectField`, `ServiceField`, `ProjectCardRecord`, `ServiceCardRecord`, `TelegramCardsDeps`, `defaultTelegramCardsDeps` — exact shapes above. Tasks 2 and 3 import these by exact name.

- [ ] **Step 1: Write the failing tests**

```ts
// api/_lib/telegramCards.test.ts
import { describe, it, expect } from 'vitest'
import { defaultTelegramCardsDeps } from './telegramCards'

describe('defaultTelegramCardsDeps', () => {
  it('listProjects returns [] when Supabase is not configured', async () => {
    expect(await defaultTelegramCardsDeps.listProjects('home', {})).toEqual([])
  })
  it('getProject returns null when Supabase is not configured', async () => {
    expect(await defaultTelegramCardsDeps.getProject('home', 'x', {})).toBeNull()
  })
  it('listServices returns [] when Supabase is not configured', async () => {
    expect(await defaultTelegramCardsDeps.listServices('home', {})).toEqual([])
  })
  it('getService returns null when Supabase is not configured', async () => {
    expect(await defaultTelegramCardsDeps.getService('home', 'x', {})).toBeNull()
  })
})
```

(This mirrors the established convention from `telegramAdmins.ts`/`telegramSessions.ts`/`telegramContent.ts`: a `defaultXDeps` implementation built directly on `getSupabaseAdmin` gets only its "not configured" branch unit-tested; the real Supabase round-trip is verified live in this plan's Integration Verification section.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run api/_lib/telegramCards.test.ts`
Expected: FAIL — `Cannot find module './telegramCards'`.

- [ ] **Step 3: Implement `api/_lib/telegramCards.ts`**

```ts
import type { SupabaseAdminEnv } from './types'
import { getSupabaseAdmin } from './supabaseAdmin'
import type { L } from './adminRows'

export type ProjectField = 'title' | 'description' | 'imageAlt' | 'tags'
export type ServiceField = 'title' | 'text'

export interface ProjectCardRecord {
  list: 'home' | 'page'
  id: string
  sort: number
  published: boolean
  title: L
  tags: string[]
  description: L
  imageUrl: string | null
  imagePath: string | null
  imageAlt: L
}

export interface ServiceCardRecord {
  list: 'home' | 'page'
  id: string
  sort: number
  published: boolean
  featured: boolean
  title: L
  text: L
  iconUrl: string | null
  iconPath: string | null
}

export interface TelegramCardsDeps {
  listProjects: (list: 'home' | 'page', env: SupabaseAdminEnv) => Promise<ProjectCardRecord[]>
  getProject: (list: 'home' | 'page', id: string, env: SupabaseAdminEnv) => Promise<ProjectCardRecord | null>
  listServices: (list: 'home' | 'page', env: SupabaseAdminEnv) => Promise<ServiceCardRecord[]>
  getService: (list: 'home' | 'page', id: string, env: SupabaseAdminEnv) => Promise<ServiceCardRecord | null>
}

const emptyL = (): L => ({ en: '', uk: '' })

const rowToProject = (row: Record<string, unknown>): ProjectCardRecord => ({
  list: row.list as 'home' | 'page',
  id: String(row.id),
  sort: Number(row.sort),
  published: Boolean(row.published),
  title: (row.title as L) ?? emptyL(),
  tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
  description: (row.description as L) ?? emptyL(),
  imageUrl: (row.image_url as string | null) ?? null,
  imagePath: (row.image_path as string | null) ?? null,
  imageAlt: (row.image_alt as L) ?? emptyL(),
})

const rowToService = (row: Record<string, unknown>): ServiceCardRecord => ({
  list: row.list as 'home' | 'page',
  id: String(row.id),
  sort: Number(row.sort),
  published: Boolean(row.published),
  featured: Boolean(row.featured),
  title: (row.title as L) ?? emptyL(),
  text: (row.text as L) ?? emptyL(),
  iconUrl: (row.icon_url as string | null) ?? null,
  iconPath: (row.icon_path as string | null) ?? null,
})

export const defaultTelegramCardsDeps: TelegramCardsDeps = {
  listProjects: async (list, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return []
    const { data, error } = await c
      .from('projects')
      .select('*')
      .eq('list', list)
      .order('sort', { ascending: true })
    if (error || !data) return []
    return data.map(rowToProject)
  },
  getProject: async (list, id, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return null
    const { data, error } = await c
      .from('projects')
      .select('*')
      .eq('list', list)
      .eq('id', id)
      .maybeSingle()
    if (error || !data) return null
    return rowToProject(data)
  },
  listServices: async (list, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return []
    const { data, error } = await c
      .from('services')
      .select('*')
      .eq('list', list)
      .order('sort', { ascending: true })
    if (error || !data) return []
    return data.map(rowToService)
  },
  getService: async (list, id, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return null
    const { data, error } = await c
      .from('services')
      .select('*')
      .eq('list', list)
      .eq('id', id)
      .maybeSingle()
    if (error || !data) return null
    return rowToService(data)
  },
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run api/_lib/telegramCards.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/telegramCards.ts api/_lib/telegramCards.test.ts
git commit -m "feat(telegram-bot): read-only Projects/Services lookup for the bot"
```

---

## Task 2: Card menu builders — `api/_lib/telegramMenu.ts`

**Files:**
- Modify: `api/_lib/telegramMenu.ts`
- Modify: `api/_lib/telegramMenu.test.ts`

**Interfaces:**
- Consumes: `ProjectField`, `ServiceField`, `ProjectCardRecord`, `ServiceCardRecord` from `api/_lib/telegramCards.ts` (Task 1) — types only, pure functions, no I/O.
- Produces: every function listed under `telegramMenu.ts` in "Interfaces produced by this plan" above. Task 3 calls all of them by these exact names.

This task also repoints `MENU_ITEMS`'s `projects`/`services` entries away from the generic `stub:` prefix, exactly like Plan 2 repointed `content`/`seo`.

- [ ] **Step 1: Write the failing tests**

Add to `api/_lib/telegramMenu.test.ts`. First, change the one stale assertion inside the existing `describe('buildMainMenu', ...)` "owner sees all six sections" test:

```ts
// CHANGE these two lines (currently `stub:projects` / `stub:services`):
    expect(buttons.find((b) => b.text === 'Projects')?.data).toBe('cards:projects:list')
    expect(buttons.find((b) => b.text === 'Services')?.data).toBe('cards:services:list')
```

Add the import at the top of the file:

```ts
import type { ProjectCardRecord, ServiceCardRecord } from './telegramCards'
```

Then append these new `describe` blocks at the end of the file:

```ts
const L = (en: string, uk: string) => ({ en, uk })

const PROJECT_A: ProjectCardRecord = {
  list: 'home', id: 'encryptia-cloud', sort: 0, published: true,
  title: L('Encryptia Cloud', 'Encryptia Cloud'),
  tags: ['WordPress'],
  description: L('Website implementation for a cloud-focused business.', 'Реалізація сайту для хмарного бізнесу.'),
  imageUrl: 'https://example.supabase.co/storage/v1/object/public/public-media/projects/encryptia-abcd.jpg',
  imagePath: 'projects/encryptia-abcd.jpg',
  imageAlt: L('Encryptia Cloud website shown on a laptop', 'Сайт Encryptia Cloud на ноутбуці'),
}
const PROJECT_NO_IMAGE: ProjectCardRecord = {
  list: 'home', id: 'no-image', sort: 1, published: false,
  title: L('Draft', 'Чернетка'), tags: [], description: L('', ''),
  imageUrl: null, imagePath: null, imageAlt: L('', ''),
}
const SERVICE_A: ServiceCardRecord = {
  list: 'home', id: 'web-development', sort: 0, published: true, featured: true,
  title: L('Web Development', 'Веб-розробка'),
  text: L('Build a new website.', 'Створення нового сайту.'),
  iconUrl: 'https://example.supabase.co/storage/v1/object/public/public-media/services/icon.png',
  iconPath: 'services/icon.png',
}

describe('buildCardTypeTabs', () => {
  it('projects: "On the home page" / "Projects page"', () => {
    const buttons = readButtons(buildCardTypeTabs('projects'))
    expect(buttons).toEqual([
      { text: 'On the home page', data: 'cards:projects:tab:home' },
      { text: 'Projects page', data: 'cards:projects:tab:page' },
      { text: '⬅ Back', data: 'menu:main' },
    ])
  })
  it('services: "On the home page" / "Services page"', () => {
    const buttons = readButtons(buildCardTypeTabs('services'))
    expect(buttons).toEqual([
      { text: 'On the home page', data: 'cards:services:tab:home' },
      { text: 'Services page', data: 'cards:services:tab:page' },
      { text: '⬅ Back', data: 'menu:main' },
    ])
  })
})

describe('buildProjectList', () => {
  it('shows each card with a published marker, then Back', () => {
    const r = buildProjectList('home', [PROJECT_A, PROJECT_NO_IMAGE])
    const buttons = readButtons(r)
    expect(buttons).toEqual([
      { text: '✅ Encryptia Cloud', data: 'cards:card:encryptia-cloud' },
      { text: '🚫 Draft', data: 'cards:card:no-image' },
      { text: '⬅ Back', data: 'cards:projects:list' },
    ])
  })
  it('empty list still offers Back', () => {
    const r = buildProjectList('page', [])
    expect(r.text).toContain('No cards')
    expect(readButtons(r)).toEqual([{ text: '⬅ Back', data: 'cards:projects:list' }])
  })
})

describe('buildServiceList', () => {
  it('shows each card with a published marker, then Back', () => {
    const buttons = readButtons(buildServiceList('home', [SERVICE_A]))
    expect(buttons).toEqual([
      { text: '✅ Web Development', data: 'cards:card:web-development' },
      { text: '⬅ Back', data: 'cards:services:list' },
    ])
  })
})

describe('buildProjectDetail', () => {
  it('shows fields, tags, image state, published toggle, move, delete, back', () => {
    const r = buildProjectDetail(PROJECT_A, { index: 0, total: 2 })
    expect(r.text).toContain('Position 1 of 2')
    expect(r.text).toContain('Encryptia Cloud')
    expect(r.text).toContain('WordPress')
    const buttons = readButtons(r)
    expect(buttons).toEqual([
      { text: 'Title', data: 'cards:field:title' },
      { text: 'Description', data: 'cards:field:description' },
      { text: 'Tags', data: 'cards:field:tags' },
      { text: 'Image alt text', data: 'cards:field:imageAlt' },
      { text: '🖼 Replace image', data: 'cards:image:replace' },
      { text: '🗑 Remove image', data: 'cards:image:remove' },
      { text: '✅ Published (tap to hide)', data: 'cards:toggle:published' },
      { text: '▲ Move up', data: 'cards:move:up' },
      { text: '▼ Move down', data: 'cards:move:down' },
      { text: '🗑 Delete card', data: 'cards:delete' },
      { text: '⬅ Back', data: 'cards:back:list' },
    ])
  })
  it('omits "Remove image" when there is no image', () => {
    const buttons = readButtons(buildProjectDetail(PROJECT_NO_IMAGE, { index: 1, total: 2 }))
    expect(buttons.map((b) => b.text)).not.toContain('🗑 Remove image')
    expect(buttons.map((b) => b.text)).toContain('🖼 Replace image')
  })
  it('hidden card shows the "tap to publish" toggle label', () => {
    const r = buildProjectDetail(PROJECT_NO_IMAGE, { index: 1, total: 2 })
    expect(readButtons(r).find((b) => b.data === 'cards:toggle:published')?.text).toBe(
      '🚫 Hidden (tap to publish)',
    )
  })
  it('prefixes "Saved." when opts.saved is true', () => {
    expect(buildProjectDetail(PROJECT_A, { index: 0, total: 1 }, { saved: true }).text.startsWith('Saved.\n\n')).toBe(true)
  })
})

describe('buildServiceDetail', () => {
  it('services show Title/Text/image/published/featured/move/delete/back, no tags or image-alt', () => {
    const r = buildServiceDetail(SERVICE_A, { index: 0, total: 1 })
    const buttons = readButtons(r)
    expect(buttons).toEqual([
      { text: 'Title', data: 'cards:field:title' },
      { text: 'Text', data: 'cards:field:text' },
      { text: '🖼 Replace image', data: 'cards:image:replace' },
      { text: '🗑 Remove image', data: 'cards:image:remove' },
      { text: '✅ Published (tap to hide)', data: 'cards:toggle:published' },
      { text: '⭐ Featured (tap to unfeature)', data: 'cards:toggle:featured' },
      { text: '▲ Move up', data: 'cards:move:up' },
      { text: '▼ Move down', data: 'cards:move:down' },
      { text: '🗑 Delete card', data: 'cards:delete' },
      { text: '⬅ Back', data: 'cards:back:list' },
    ])
  })
  it('omits the featured toggle when list is "page"', () => {
    const pageService: ServiceCardRecord = { ...SERVICE_A, list: 'page' }
    const buttons = readButtons(buildServiceDetail(pageService, { index: 0, total: 1 }))
    expect(buttons.map((b) => b.text)).not.toContain('⭐ Featured (tap to unfeature)')
  })
  it('non-featured card shows the "tap to feature" toggle label', () => {
    const notFeatured: ServiceCardRecord = { ...SERVICE_A, featured: false }
    const r = buildServiceDetail(notFeatured, { index: 0, total: 1 })
    expect(readButtons(r).find((b) => b.data === 'cards:toggle:featured')?.text).toBe(
      '☆ Not featured (tap to feature)',
    )
  })
})

describe('buildCardFieldLangPrompt', () => {
  it('offers EN/UA and the given back callback', () => {
    const r = buildCardFieldLangPrompt('Title', 'cards:card:encryptia-cloud')
    expect(r.text).toContain('Title')
    expect(readButtons(r)).toEqual([
      { text: 'EN', data: 'cards:lang:en' },
      { text: 'UA', data: 'cards:lang:uk' },
      { text: '⬅ Back', data: 'cards:card:encryptia-cloud' },
    ])
  })
})

describe('buildCardValuePrompt', () => {
  it('shows current text and language label, no keyboard', () => {
    const r = buildCardValuePrompt('Title', 'en', 'Encryptia Cloud')
    expect(r.text).toContain('Encryptia Cloud')
    expect(r.text).toContain('EN')
    expect(r.keyboard).toBeUndefined()
  })
  it('shows "(empty)" for empty text', () => {
    expect(buildCardValuePrompt('Description', 'uk', '').text).toContain('(empty)')
  })
})

describe('buildTagsPrompt', () => {
  it('shows current tags, no keyboard', () => {
    const r = buildTagsPrompt(['WordPress', 'WooCommerce'])
    expect(r.text).toContain('WordPress, WooCommerce')
    expect(r.keyboard).toBeUndefined()
  })
  it('shows "(none)" for an empty tag list', () => {
    expect(buildTagsPrompt([]).text).toContain('(none)')
  })
})

describe('buildPhotoPrompt', () => {
  it('has the given back callback, no other buttons', () => {
    const r = buildPhotoPrompt('cards:card:encryptia-cloud')
    expect(readButtons(r)).toEqual([{ text: '⬅ Back', data: 'cards:card:encryptia-cloud' }])
  })
})

describe('buildCardDeleteConfirm', () => {
  it('names the card and offers Yes/Cancel, project copy', () => {
    const r = buildCardDeleteConfirm('Encryptia Cloud', 'project')
    expect(r.text).toContain('Encryptia Cloud')
    expect(r.text).toContain('project card')
    expect(readButtons(r)).toEqual([
      { text: 'Yes, delete', data: 'cards:delete:confirm' },
      { text: 'Cancel', data: 'cards:delete:cancel' },
    ])
  })
  it('service copy says "service card"', () => {
    expect(buildCardDeleteConfirm('Web Development', 'service').text).toContain('service card')
  })
})

describe('buildCardSaveFailed', () => {
  it('offers a Back button to the given callback', () => {
    const r = buildCardSaveFailed('cards:card:encryptia-cloud')
    expect(r.text).toBe('Could not save — please try again.')
    expect(readButtons(r)).toEqual([{ text: '⬅ Back', data: 'cards:card:encryptia-cloud' }])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run api/_lib/telegramMenu.test.ts`
Expected: FAIL — new function names are not exported yet; the changed `buildMainMenu` assertions also fail.

- [ ] **Step 3: Implement the changes in `api/_lib/telegramMenu.ts`**

In the existing `MENU_ITEMS` array, change the `projects`/`services` entries' `callback` field:

```ts
  { key: 'projects', label: 'Projects', roles: ['owner', 'content_manager'], callback: 'cards:projects:list' },
  { key: 'services', label: 'Services', roles: ['owner', 'content_manager'], callback: 'cards:services:list' },
```

(`content`/`seo`/`requests`/`admins` entries are unchanged from Plan 2.)

Add the import and all the new builders at the end of the file:

```ts
import type { ProjectField, ServiceField, ProjectCardRecord, ServiceCardRecord } from './telegramCards'
// (add next to the existing `telegramContent` import at the top of the file)

// ---- Cards: Projects & Services ----

const PROJECT_FIELD_LABEL: Record<ProjectField, string> = {
  title: 'Title', description: 'Description', imageAlt: 'Image alt text', tags: 'Tags',
}
const SERVICE_FIELD_LABEL: Record<ServiceField, string> = { title: 'Title', text: 'Text' }

export function buildCardTypeTabs(type: 'projects' | 'services'): BotReply {
  const pageLabel = type === 'projects' ? 'Projects page' : 'Services page'
  const kb = new InlineKeyboard()
    .text('On the home page', `cards:${type}:tab:home`)
    .row()
    .text(pageLabel, `cards:${type}:tab:page`)
    .row()
    .text('⬅ Back', 'menu:main')
  return { text: type === 'projects' ? 'Projects — choose a list:' : 'Services — choose a list:', keyboard: kb }
}

export function buildProjectList(list: 'home' | 'page', cards: ProjectCardRecord[]): BotReply {
  const kb = new InlineKeyboard()
  cards.forEach((c) => {
    kb.text(`${c.published ? '✅' : '🚫'} ${c.title.en || c.id}`, `cards:card:${c.id}`).row()
  })
  kb.text('⬅ Back', 'cards:projects:list')
  if (cards.length === 0) return { text: 'No cards in this list yet.', keyboard: kb }
  return { text: `Projects — ${list === 'home' ? 'home page' : 'Projects page'}:`, keyboard: kb }
}

export function buildServiceList(list: 'home' | 'page', cards: ServiceCardRecord[]): BotReply {
  const kb = new InlineKeyboard()
  cards.forEach((c) => {
    kb.text(`${c.published ? '✅' : '🚫'} ${c.title.en || c.id}`, `cards:card:${c.id}`).row()
  })
  kb.text('⬅ Back', 'cards:services:list')
  if (cards.length === 0) return { text: 'No cards in this list yet.', keyboard: kb }
  return { text: `Services — ${list === 'home' ? 'home page' : 'Services page'}:`, keyboard: kb }
}

const publishedToggleLabel = (published: boolean): string =>
  published ? '✅ Published (tap to hide)' : '🚫 Hidden (tap to publish)'
const featuredToggleLabel = (featured: boolean): string =>
  featured ? '⭐ Featured (tap to unfeature)' : '☆ Not featured (tap to feature)'

export function buildProjectDetail(
  card: ProjectCardRecord,
  position: { index: number; total: number },
  opts: { saved?: boolean } = {},
): BotReply {
  const lines = [
    `Title — EN: ${card.title.en || '(empty)'} / UA: ${card.title.uk || '(empty)'}`,
    `Description — EN: ${card.description.en || '(empty)'} / UA: ${card.description.uk || '(empty)'}`,
    `Tags: ${card.tags.length ? card.tags.join(', ') : '(none)'}`,
    `Image alt — EN: ${card.imageAlt.en || '(empty)'} / UA: ${card.imageAlt.uk || '(empty)'}`,
    `Image: ${card.imageUrl ? 'set' : 'none'}`,
  ]
  const kb = new InlineKeyboard()
    .text('Title', 'cards:field:title')
    .row()
    .text('Description', 'cards:field:description')
    .row()
    .text('Tags', 'cards:field:tags')
    .row()
    .text('Image alt text', 'cards:field:imageAlt')
    .row()
    .text('🖼 Replace image', 'cards:image:replace')
    .row()
  if (card.imageUrl) kb.text('🗑 Remove image', 'cards:image:remove').row()
  kb.text(publishedToggleLabel(card.published), 'cards:toggle:published')
    .row()
    .text('▲ Move up', 'cards:move:up')
    .text('▼ Move down', 'cards:move:down')
    .row()
    .text('🗑 Delete card', 'cards:delete')
    .row()
    .text('⬅ Back', 'cards:back:list')
  const prefix = opts.saved ? 'Saved.\n\n' : ''
  return {
    text: `${prefix}${card.title.en || card.id}\nPosition ${position.index + 1} of ${position.total}\n${lines.join('\n')}`,
    keyboard: kb,
  }
}

export function buildServiceDetail(
  card: ServiceCardRecord,
  position: { index: number; total: number },
  opts: { saved?: boolean } = {},
): BotReply {
  const lines = [
    `Title — EN: ${card.title.en || '(empty)'} / UA: ${card.title.uk || '(empty)'}`,
    `Text — EN: ${card.text.en || '(empty)'} / UA: ${card.text.uk || '(empty)'}`,
    `Icon: ${card.iconUrl ? 'set' : 'none'}`,
  ]
  const kb = new InlineKeyboard()
    .text('Title', 'cards:field:title')
    .row()
    .text('Text', 'cards:field:text')
    .row()
    .text('🖼 Replace image', 'cards:image:replace')
    .row()
  if (card.iconUrl) kb.text('🗑 Remove image', 'cards:image:remove').row()
  kb.text(publishedToggleLabel(card.published), 'cards:toggle:published').row()
  if (card.list === 'home') kb.text(featuredToggleLabel(card.featured), 'cards:toggle:featured').row()
  kb.text('▲ Move up', 'cards:move:up')
    .text('▼ Move down', 'cards:move:down')
    .row()
    .text('🗑 Delete card', 'cards:delete')
    .row()
    .text('⬅ Back', 'cards:back:list')
  const prefix = opts.saved ? 'Saved.\n\n' : ''
  return {
    text: `${prefix}${card.title.en || card.id}\nPosition ${position.index + 1} of ${position.total}\n${lines.join('\n')}`,
    keyboard: kb,
  }
}

export function buildCardFieldLangPrompt(label: string, backCallback: string): BotReply {
  const kb = new InlineKeyboard()
    .text('EN', 'cards:lang:en')
    .text('UA', 'cards:lang:uk')
    .row()
    .text('⬅ Back', backCallback)
  return { text: `Edit ${label} — choose a language:`, keyboard: kb }
}

export function buildCardValuePrompt(label: string, lang: 'en' | 'uk', currentText: string): BotReply {
  const langLabel = lang === 'en' ? 'EN' : 'UA'
  return {
    text: `Current ${label} (${langLabel}):\n${currentText || '(empty)'}\n\nSend the new ${langLabel} text.`,
  }
}

export function buildTagsPrompt(currentTags: string[]): BotReply {
  const current = currentTags.length ? currentTags.join(', ') : '(none)'
  return { text: `Current tags: ${current}\n\nSend comma-separated tags, e.g. WordPress, WooCommerce.` }
}

export function buildPhotoPrompt(backCallback: string): BotReply {
  const kb = new InlineKeyboard().text('⬅ Back', backCallback)
  return { text: 'Send a new photo for this card.', keyboard: kb }
}

export function buildCardDeleteConfirm(title: string, kind: 'project' | 'service'): BotReply {
  const kb = new InlineKeyboard()
    .text('Yes, delete', 'cards:delete:confirm')
    .row()
    .text('Cancel', 'cards:delete:cancel')
  return {
    text: `Delete "${title}"? It will be removed from the list as a ${kind} card. This cannot be undone.`,
    keyboard: kb,
  }
}

export function buildCardSaveFailed(backCallback: string): BotReply {
  const kb = new InlineKeyboard().text('⬅ Back', backCallback)
  return { text: 'Could not save — please try again.', keyboard: kb }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run api/_lib/telegramMenu.test.ts`
Expected: PASS (all tests, old and new).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/telegramMenu.ts api/_lib/telegramMenu.test.ts
git commit -m "feat(telegram-bot): Projects/Services card menu builders"
```

---

## Task 3: Card dispatch — list, detail, field edits, tags, toggles, reorder, delete

**Files:**
- Modify: `api/_lib/adminCardsHandler.ts` (export the existing private `defaultDeps` as `defaultAdminCardsDeps`)
- Create: `api/_lib/telegramCardsDispatch.ts`
- Create: `api/_lib/telegramCardsDispatch.test.ts`
- Modify: `api/_lib/telegramDispatch.ts` (thin `cards:` delegation only — NOT the photo entry point, that's Task 4)
- Modify: `api/_lib/telegramDispatch.test.ts` (a handful of delegation tests)

**Interfaces:**
- Consumes: `TelegramCardsDeps`, `defaultTelegramCardsDeps`, `ProjectCardRecord`, `ServiceCardRecord`, `ProjectField`, `ServiceField` (Task 1); every builder from Task 2; `AdminCardsDeps`, `handleAdminCards` from `api/_lib/adminCardsHandler.ts` (already exists); `signToken` from `api/_lib/session.ts`; `BotCtx`, `adminCookieHeader` — **`adminCookieHeader` is already defined in `telegramDispatch.ts` from Plan 2 as a private (non-exported) function** `function adminCookieHeader(env: Env): string | null`. This task must **export** it (add the `export` keyword — no signature change) so `telegramCardsDispatch.ts` can import and reuse it instead of redefining the same cookie-signing logic in a second file.
- Produces: `CardsDispatchDeps`, `dispatchCardsCallback`, `dispatchCardsText` — exact shapes above. Task 4 imports these plus adds `dispatchCardsPhoto` to the same file.

### Step 1: Export `adminCookieHeader` from `telegramDispatch.ts`

Find:
```ts
function adminCookieHeader(env: Env): string | null {
```
Change to:
```ts
export function adminCookieHeader(env: Env): string | null {
```

Run: `npx tsc -p tsconfig.api.json` — expect 0 errors (adding `export` to an already-correct function never breaks anything that already compiled).

### Step 2: Export `adminCardsHandler.ts`'s and `adminUploadHandler.ts`'s default deps

`telegramCardsDispatch.ts` (Step 5 below) imports `defaultAdminCardsDeps` from `./adminCardsHandler` **and** `defaultAdminUploadDeps` from `./adminUploadHandler` — do both exports now, in this task, even though the upload path itself isn't wired up until Task 4. Doing both here means this task's own `tsc` run (Step 9) passes cleanly, and Task 4 starts from already-correct plumbing instead of needing to touch these two handler files itself.

In `api/_lib/adminCardsHandler.ts`, change:
```ts
const defaultDeps: AdminCardsDeps = {
```
to:
```ts
export const defaultAdminCardsDeps: AdminCardsDeps = {
```
And update `handleAdminCards`'s default parameter from `defaultDeps` to `defaultAdminCardsDeps`:
```ts
export async function handleAdminCards(
  input: { method: string; cookieHeader: string | undefined; query: Record<string, string | undefined>; body: unknown },
  env: Env,
  deps: AdminCardsDeps = defaultAdminCardsDeps,
): Promise<HandlerResult> {
```

In `api/_lib/adminUploadHandler.ts`, apply the identical rename:
```ts
export const defaultAdminUploadDeps: AdminUploadDeps = {
```
and update `handleAdminUpload`'s default parameter from `defaultDeps` to `defaultAdminUploadDeps`.

Run: `npx vitest run api/_lib/adminCardsHandler.test.ts api/_lib/adminUploadHandler.test.ts` — expect PASS, unchanged (neither test file references the old private name).

- [ ] **Step 3: Write the failing tests for `telegramCardsDispatch.ts`**

```ts
// api/_lib/telegramCardsDispatch.test.ts
import { describe, it, expect, vi } from 'vitest'
import { dispatchCardsCallback, dispatchCardsText } from './telegramCardsDispatch'
import type { CardsDispatchDeps } from './telegramCardsDispatch'
import type { BotCtx } from './telegramDispatch'
import type { TelegramCardsDeps, ProjectCardRecord, ServiceCardRecord } from './telegramCards'
import type { AdminCardsDeps } from './adminCardsHandler'
import type { AdminUploadDeps } from './adminUploadHandler'
import type { TelegramSessionsDeps, TelegramState } from './telegramSessions'

const ENV = { ADMIN_SESSION_SECRET: 'a-long-enough-test-secret-value', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }

const L = (en: string, uk: string) => ({ en, uk })

const PROJECT_A: ProjectCardRecord = {
  list: 'home', id: 'a', sort: 0, published: true,
  title: L('Alpha', 'Альфа'), tags: ['WordPress'],
  description: L('Alpha desc', 'Опис альфа'),
  imageUrl: 'https://x/a.jpg', imagePath: 'projects/a.jpg',
  imageAlt: L('Alpha image', 'Зображення альфа'),
}
const PROJECT_B: ProjectCardRecord = {
  list: 'home', id: 'b', sort: 1, published: false,
  title: L('Beta', 'Бета'), tags: [], description: L('', ''),
  imageUrl: null, imagePath: null, imageAlt: L('', ''),
}
const SERVICE_A: ServiceCardRecord = {
  list: 'home', id: 's1', sort: 0, published: true, featured: false,
  title: L('Web Dev', 'Веброзробка'), text: L('Build sites', 'Створення сайтів'),
  iconUrl: 'https://x/i.png', iconPath: 'services/i.png',
}

function applyProjectPatch(record: ProjectCardRecord, patch: Record<string, unknown>): ProjectCardRecord {
  const next = { ...record }
  if ('title' in patch) next.title = patch.title as ProjectCardRecord['title']
  if ('description' in patch) next.description = patch.description as ProjectCardRecord['description']
  if ('image_alt' in patch) next.imageAlt = patch.image_alt as ProjectCardRecord['imageAlt']
  if ('tags' in patch) next.tags = patch.tags as string[]
  if ('published' in patch) next.published = patch.published as boolean
  if ('image_url' in patch) next.imageUrl = patch.image_url as string | null
  if ('image_path' in patch) next.imagePath = patch.image_path as string | null
  return next
}
function applyServicePatch(record: ServiceCardRecord, patch: Record<string, unknown>): ServiceCardRecord {
  const next = { ...record }
  if ('title' in patch) next.title = patch.title as ServiceCardRecord['title']
  if ('text' in patch) next.text = patch.text as ServiceCardRecord['text']
  if ('published' in patch) next.published = patch.published as boolean
  if ('featured' in patch) next.featured = patch.featured as boolean
  if ('icon_url' in patch) next.iconUrl = patch.icon_url as string | null
  if ('icon_path' in patch) next.iconPath = patch.icon_path as string | null
  return next
}

function makeDeps(initialState: TelegramState = { screen: 'main_menu' }) {
  let state = initialState
  let projects: ProjectCardRecord[] = [{ ...PROJECT_A }, { ...PROJECT_B }]
  let services: ServiceCardRecord[] = [{ ...SERVICE_A }]

  const cards: TelegramCardsDeps = {
    listProjects: vi.fn(async () => projects),
    getProject: vi.fn(async (_list: string, id: string) => projects.find((p) => p.id === id) ?? null),
    listServices: vi.fn(async () => services),
    getService: vi.fn(async (_list: string, id: string) => services.find((s) => s.id === id) ?? null),
  }
  const adminCards: AdminCardsDeps = {
    create: vi.fn(async () => ({ error: null })),
    update: vi.fn(async (type: 'project' | 'service', _list, id: string, patch: Record<string, unknown>) => {
      if (type === 'project') projects = projects.map((p) => (p.id === id ? applyProjectPatch(p, patch) : p))
      else services = services.map((s) => (s.id === id ? applyServicePatch(s, patch) : s))
      return { error: null }
    }),
    remove: vi.fn(async (type: 'project' | 'service', _list, id: string) => {
      if (type === 'project') projects = projects.filter((p) => p.id !== id)
      else services = services.filter((s) => s.id !== id)
      return { error: null }
    }),
    reorder: vi.fn(async (type: 'project' | 'service', _list, orderedIds: string[]) => {
      const apply = <T extends { id: string; sort: number }>(list: T[]): T[] =>
        orderedIds.map((id, i) => ({ ...list.find((x) => x.id === id)!, sort: i }))
      if (type === 'project') projects = apply(projects)
      else services = apply(services)
      return { error: null }
    }),
  }
  const adminUpload: AdminUploadDeps = {
    put: vi.fn(async () => ({ url: '', path: '', error: 'not_used_in_this_task' })),
    del: vi.fn(async () => ({ error: null })),
  }
  const sessions: TelegramSessionsDeps = {
    load: vi.fn(async () => state),
    save: vi.fn(async (_chatId, next) => {
      state = next
    }),
  }
  const deps: CardsDispatchDeps = { cards, adminCards, adminUpload, sessions }
  return {
    deps, cards, adminCards, sessions,
    getState: () => state,
    getProjects: () => projects,
    getServices: () => services,
  }
}

function makeCtx(overrides: Partial<BotCtx>): BotCtx {
  return {
    chatId: 1,
    fromId: 111,
    reply: vi.fn(async () => {}),
    answerCallback: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('dispatchCardsCallback — list and detail', () => {
  it('cards:projects:list shows the tab choice', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({})
    await dispatchCardsCallback(ctx, 'cards:projects:list', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe('Projects — choose a list:')
  })

  it('cards:projects:tab:home lists the home cards', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({})
    await dispatchCardsCallback(ctx, 'cards:projects:tab:home', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Projects')
  })

  it('cards:card:<id> shows the project detail with position', async () => {
    const { deps } = makeDeps({ screen: 'cards_list', data: { type: 'projects', list: 'home' } })
    const ctx = makeCtx({})
    await dispatchCardsCallback(ctx, 'cards:card:a', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Alpha')
    expect(reply.text).toContain('Position 1 of 2')
  })

  it('cards:card:<id> for services shows the service detail', async () => {
    const { deps } = makeDeps({ screen: 'cards_list', data: { type: 'services', list: 'home' } })
    const ctx = makeCtx({})
    await dispatchCardsCallback(ctx, 'cards:card:s1', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Web Dev')
  })

  it('an unknown card id shows an error and falls back to the list', async () => {
    const { deps } = makeDeps({ screen: 'cards_list', data: { type: 'projects', list: 'home' } })
    const ctx = makeCtx({})
    await dispatchCardsCallback(ctx, 'cards:card:bogus', ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Could not load that card — please try again.' })
  })
})

describe('dispatchCardsCallback — field edit flow (L fields)', () => {
  it('full edit flow: field -> lang -> new text -> saved, other language untouched', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    await dispatchCardsCallback(makeCtx({}), 'cards:field:title', ENV, deps)
    await dispatchCardsCallback(makeCtx({}), 'cards:lang:en', ENV, deps)
    const finalCtx = makeCtx({})
    await dispatchCardsText(finalCtx, 'New English title', ENV, deps)

    expect(getProjects().find((p) => p.id === 'a')?.title).toEqual({ en: 'New English title', uk: 'Альфа' })
    const reply = (finalCtx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Saved.')
  })

  it('editing a service text field works the same way', async () => {
    const { deps, getServices } = makeDeps({ screen: 'cards_detail', data: { type: 'services', list: 'home', id: 's1' } })
    await dispatchCardsCallback(makeCtx({}), 'cards:field:text', ENV, deps)
    await dispatchCardsCallback(makeCtx({}), 'cards:lang:uk', ENV, deps)
    await dispatchCardsText(makeCtx({}), 'Новий текст', ENV, deps)

    expect(getServices().find((s) => s.id === 's1')?.text).toEqual({ en: 'Build sites', uk: 'Новий текст' })
  })

  it('a stale field tap with no card chosen yet shows "session out of sync"', async () => {
    const { deps } = makeDeps({ screen: 'main_menu' })
    const ctx = makeCtx({})
    await dispatchCardsCallback(ctx, 'cards:field:title', ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Session out of sync — please /start and try again.' })
  })
})

describe('dispatchCardsCallback — tags (Projects only, no language split)', () => {
  it('editing tags goes straight to a text prompt, no language step', async () => {
    const { deps } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    const ctx = makeCtx({})
    await dispatchCardsCallback(ctx, 'cards:field:tags', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('WordPress')
    expect(reply.keyboard).toBeUndefined()
  })

  it('saving tags splits on comma, trims, and drops empties', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    await dispatchCardsCallback(makeCtx({}), 'cards:field:tags', ENV, deps)
    await dispatchCardsText(makeCtx({}), 'WordPress,  WooCommerce ,, Elementor', ENV, deps)
    expect(getProjects().find((p) => p.id === 'a')?.tags).toEqual(['WordPress', 'WooCommerce', 'Elementor'])
  })
})

describe('dispatchCardsCallback — toggles', () => {
  it('cards:toggle:published flips published and re-renders the detail', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    const ctx = makeCtx({})
    await dispatchCardsCallback(ctx, 'cards:toggle:published', ENV, deps)
    expect(getProjects().find((p) => p.id === 'a')?.published).toBe(false)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Hidden (tap to publish)')
  })

  it('cards:toggle:featured flips featured for a service', async () => {
    const { deps, getServices } = makeDeps({ screen: 'cards_detail', data: { type: 'services', list: 'home', id: 's1' } })
    await dispatchCardsCallback(makeCtx({}), 'cards:toggle:featured', ENV, deps)
    expect(getServices().find((s) => s.id === 's1')?.featured).toBe(true)
  })
})

describe('dispatchCardsCallback — reorder', () => {
  it('cards:move:down swaps the card with its next neighbour', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    await dispatchCardsCallback(makeCtx({}), 'cards:move:down', ENV, deps)
    const sorted = [...getProjects()].sort((x, y) => x.sort - y.sort)
    expect(sorted.map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('moving the first card up is a no-op', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    await dispatchCardsCallback(makeCtx({}), 'cards:move:up', ENV, deps)
    const sorted = [...getProjects()].sort((x, y) => x.sort - y.sort)
    expect(sorted.map((p) => p.id)).toEqual(['a', 'b'])
  })
})

describe('dispatchCardsCallback — delete', () => {
  it('delete -> confirm removes the card and returns to the list', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    await dispatchCardsCallback(makeCtx({}), 'cards:delete', ENV, deps)
    const confirmCtx = makeCtx({})
    await dispatchCardsCallback(confirmCtx, 'cards:delete:confirm', ENV, deps)
    expect(getProjects().find((p) => p.id === 'a')).toBeUndefined()
    const reply = (confirmCtx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Projects')
  })

  it('delete -> cancel keeps the card and returns to the detail', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    await dispatchCardsCallback(makeCtx({}), 'cards:delete', ENV, deps)
    const cancelCtx = makeCtx({})
    await dispatchCardsCallback(cancelCtx, 'cards:delete:cancel', ENV, deps)
    expect(getProjects().find((p) => p.id === 'a')).toBeDefined()
    const reply = (cancelCtx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Alpha')
  })
})

describe('dispatchCardsCallback — save failure', () => {
  it('shows an error and does not change the record', async () => {
    const { deps, adminCards, getProjects } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    ;(adminCards.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: 'boom' })
    await dispatchCardsCallback(makeCtx({}), 'cards:field:title', ENV, deps)
    await dispatchCardsCallback(makeCtx({}), 'cards:lang:en', ENV, deps)
    const finalCtx = makeCtx({})
    await dispatchCardsText(finalCtx, 'Should not stick', ENV, deps)

    expect(getProjects().find((p) => p.id === 'a')?.title).toEqual(PROJECT_A.title)
    expect(finalCtx.reply).toHaveBeenCalledWith({
      text: 'Could not save — please try again.',
      keyboard: expect.anything(),
    })
  })

  it('replies with a config error and does not call adminCards.update when ADMIN_SESSION_SECRET is missing', async () => {
    const { deps, adminCards } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    const badEnv = {}
    await dispatchCardsCallback(makeCtx({}), 'cards:field:title', badEnv, deps)
    await dispatchCardsCallback(makeCtx({}), 'cards:lang:en', badEnv, deps)
    const finalCtx = makeCtx({})
    await dispatchCardsText(finalCtx, 'Anything', badEnv, deps)

    expect(adminCards.update).not.toHaveBeenCalled()
    expect(finalCtx.reply).toHaveBeenCalledWith({ text: 'Bot is not fully configured — contact the site owner.' })
  })
})
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run api/_lib/telegramCardsDispatch.test.ts`
Expected: FAIL — `Cannot find module './telegramCardsDispatch'`.

- [ ] **Step 5: Implement `api/_lib/telegramCardsDispatch.ts`**

```ts
import type { AuthEnv, SupabaseAdminEnv, TelegramEnv } from './types'
import { adminCookieHeader, type BotCtx } from './telegramDispatch'
import {
  defaultTelegramCardsDeps,
  type TelegramCardsDeps,
  type ProjectCardRecord,
  type ServiceCardRecord,
  type ProjectField,
  type ServiceField,
} from './telegramCards'
import { handleAdminCards, defaultAdminCardsDeps, type AdminCardsDeps } from './adminCardsHandler'
import { defaultAdminUploadDeps, type AdminUploadDeps } from './adminUploadHandler'
import { defaultTelegramSessionsDeps, type TelegramSessionsDeps, type TelegramState } from './telegramSessions'
import * as menu from './telegramMenu'

type Env = TelegramEnv & SupabaseAdminEnv & AuthEnv
type CardType = 'projects' | 'services'
type CardList = 'home' | 'page'

export interface CardsDispatchDeps {
  cards: TelegramCardsDeps
  adminCards: AdminCardsDeps
  adminUpload: AdminUploadDeps
  sessions: TelegramSessionsDeps
}

export const defaultCardsDispatchDeps: CardsDispatchDeps = {
  cards: defaultTelegramCardsDeps,
  adminCards: defaultAdminCardsDeps,
  adminUpload: defaultAdminUploadDeps,
  sessions: defaultTelegramSessionsDeps,
}

const singularType = (type: CardType): 'project' | 'service' => (type === 'projects' ? 'project' : 'service')

async function loadState(ctx: BotCtx, env: Env, deps: CardsDispatchDeps): Promise<TelegramState> {
  return deps.sessions.load(ctx.chatId, env)
}

// ---- list / detail rendering ----

async function showTabs(ctx: BotCtx, type: CardType, env: Env, deps: CardsDispatchDeps): Promise<void> {
  await deps.sessions.save(ctx.chatId, { screen: 'cards_tabs', data: { type } }, env)
  await ctx.reply(menu.buildCardTypeTabs(type))
}

async function showList(ctx: BotCtx, type: CardType, list: CardList, env: Env, deps: CardsDispatchDeps): Promise<void> {
  await deps.sessions.save(ctx.chatId, { screen: 'cards_list', data: { type, list } }, env)
  if (type === 'projects') {
    const cards = await deps.cards.listProjects(list, env)
    await ctx.reply(menu.buildProjectList(list, cards))
  } else {
    const cards = await deps.cards.listServices(list, env)
    await ctx.reply(menu.buildServiceList(list, cards))
  }
}

async function showDetail(
  ctx: BotCtx, type: CardType, list: CardList, id: string, env: Env, deps: CardsDispatchDeps, saved = false,
): Promise<void> {
  if (type === 'projects') {
    const all = await deps.cards.listProjects(list, env)
    const index = all.findIndex((c) => c.id === id)
    if (index < 0) {
      await ctx.reply({ text: 'Could not load that card — please try again.' })
      await showList(ctx, type, list, env, deps)
      return
    }
    await deps.sessions.save(ctx.chatId, { screen: 'cards_detail', data: { type, list, id } }, env)
    await ctx.reply(menu.buildProjectDetail(all[index], { index, total: all.length }, { saved }))
  } else {
    const all = await deps.cards.listServices(list, env)
    const index = all.findIndex((c) => c.id === id)
    if (index < 0) {
      await ctx.reply({ text: 'Could not load that card — please try again.' })
      await showList(ctx, type, list, env, deps)
      return
    }
    await deps.sessions.save(ctx.chatId, { screen: 'cards_detail', data: { type, list, id } }, env)
    await ctx.reply(menu.buildServiceDetail(all[index], { index, total: all.length }, { saved }))
  }
}

// ---- field edit (L fields: title, description/text, imageAlt) ----

const PROJECT_FIELD_LABEL: Record<ProjectField, string> = {
  title: 'Title', description: 'Description', imageAlt: 'Image alt text', tags: 'Tags',
}
const SERVICE_FIELD_LABEL: Record<ServiceField, string> = { title: 'Title', text: 'Text' }

function fieldLabel(type: CardType, field: string): string {
  return type === 'projects'
    ? PROJECT_FIELD_LABEL[field as ProjectField]
    : SERVICE_FIELD_LABEL[field as ServiceField]
}

function fieldValue(
  type: CardType, card: ProjectCardRecord | ServiceCardRecord, field: string,
): { en: string; uk: string } {
  if (type === 'projects') {
    const p = card as ProjectCardRecord
    if (field === 'imageAlt') return p.imageAlt
    if (field === 'description') return p.description
    return p.title
  }
  const s = card as ServiceCardRecord
  if (field === 'text') return s.text
  return s.title
}

async function startFieldEdit(
  ctx: BotCtx, type: CardType, list: CardList, id: string, field: string, env: Env, deps: CardsDispatchDeps,
): Promise<void> {
  if (field === 'tags') {
    const card = await deps.cards.getProject(list, id, env)
    if (!card) {
      await ctx.reply({ text: 'Could not load that card — please try again.' })
      await showList(ctx, type, list, env, deps)
      return
    }
    await deps.sessions.save(ctx.chatId, { screen: 'cards_tags_value', data: { type, list, id } }, env)
    await ctx.reply(menu.buildTagsPrompt(card.tags))
    return
  }
  await deps.sessions.save(ctx.chatId, { screen: 'cards_lang', data: { type, list, id, field } }, env)
  await ctx.reply(menu.buildCardFieldLangPrompt(fieldLabel(type, field), `cards:card:${id}`))
}

async function startValuePrompt(
  ctx: BotCtx, type: CardType, list: CardList, id: string, field: string, lang: 'en' | 'uk',
  env: Env, deps: CardsDispatchDeps,
): Promise<void> {
  const card = type === 'projects' ? await deps.cards.getProject(list, id, env) : await deps.cards.getService(list, id, env)
  if (!card) {
    await ctx.reply({ text: 'Could not load that card — please try again.' })
    await showList(ctx, type, list, env, deps)
    return
  }
  const current = fieldValue(type, card, field)
  await deps.sessions.save(ctx.chatId, { screen: 'cards_value', data: { type, list, id, field, lang } }, env)
  await ctx.reply(menu.buildCardValuePrompt(fieldLabel(type, field), lang, current[lang]))
}

async function saveFieldValue(
  ctx: BotCtx, type: CardType, list: CardList, id: string, field: string, lang: 'en' | 'uk', text: string,
  env: Env, deps: CardsDispatchDeps,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const card = type === 'projects' ? await deps.cards.getProject(list, id, env) : await deps.cards.getService(list, id, env)
  if (!card) {
    await ctx.reply({ text: 'Could not load that card — please try again.' })
    await showList(ctx, type, list, env, deps)
    return
  }
  const current = fieldValue(type, card, field)
  const nextValue = lang === 'en' ? { en: text, uk: current.uk } : { en: current.en, uk: text }
  const result = await handleAdminCards(
    {
      method: 'PUT',
      cookieHeader,
      query: { type: singularType(type) },
      body: { list, id, patch: { [field]: nextValue } },
    },
    env,
    deps.adminCards,
  )
  if (result.status !== 200) {
    await ctx.reply(menu.buildCardSaveFailed(`cards:card:${id}`))
    return
  }
  await showDetail(ctx, type, list, id, env, deps, true)
}

async function saveTags(
  ctx: BotCtx, list: CardList, id: string, text: string, env: Env, deps: CardsDispatchDeps,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const tags = text.split(',').map((t) => t.trim()).filter(Boolean)
  const result = await handleAdminCards(
    { method: 'PUT', cookieHeader, query: { type: 'project' }, body: { list, id, patch: { tags } } },
    env,
    deps.adminCards,
  )
  if (result.status !== 200) {
    await ctx.reply(menu.buildCardSaveFailed(`cards:card:${id}`))
    return
  }
  await showDetail(ctx, 'projects', list, id, env, deps, true)
}

// ---- toggles ----

async function toggleField(
  ctx: BotCtx, type: CardType, list: CardList, id: string, field: 'published' | 'featured',
  env: Env, deps: CardsDispatchDeps,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const card = type === 'projects' ? await deps.cards.getProject(list, id, env) : await deps.cards.getService(list, id, env)
  if (!card) {
    await ctx.reply({ text: 'Could not load that card — please try again.' })
    await showList(ctx, type, list, env, deps)
    return
  }
  const current = field === 'published' ? card.published : (card as ServiceCardRecord).featured
  const result = await handleAdminCards(
    { method: 'PUT', cookieHeader, query: { type: singularType(type) }, body: { list, id, patch: { [field]: !current } } },
    env,
    deps.adminCards,
  )
  if (result.status !== 200) {
    await ctx.reply(menu.buildCardSaveFailed(`cards:card:${id}`))
    return
  }
  await showDetail(ctx, type, list, id, env, deps)
}

// ---- reorder ----

function orderedIdsAfterMove(cards: { id: string; sort: number }[], id: string, dir: 'up' | 'down'): string[] {
  const sorted = [...cards].sort((a, b) => a.sort - b.sort)
  const i = sorted.findIndex((c) => c.id === id)
  if (i < 0) return sorted.map((c) => c.id)
  const j = dir === 'up' ? i - 1 : i + 1
  if (j < 0 || j >= sorted.length) return sorted.map((c) => c.id)
  ;[sorted[i], sorted[j]] = [sorted[j], sorted[i]]
  return sorted.map((c) => c.id)
}

async function moveCard(
  ctx: BotCtx, type: CardType, list: CardList, id: string, dir: 'up' | 'down', env: Env, deps: CardsDispatchDeps,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const all = type === 'projects' ? await deps.cards.listProjects(list, env) : await deps.cards.listServices(list, env)
  const orderedIds = orderedIdsAfterMove(all, id, dir)
  const result = await handleAdminCards(
    { method: 'POST', cookieHeader, query: { type: singularType(type) }, body: { list, op: 'reorder', orderedIds } },
    env,
    deps.adminCards,
  )
  if (result.status !== 200) {
    await ctx.reply(menu.buildCardSaveFailed(`cards:card:${id}`))
    return
  }
  await showDetail(ctx, type, list, id, env, deps)
}

// ---- delete ----

async function startDelete(
  ctx: BotCtx, type: CardType, list: CardList, id: string, env: Env, deps: CardsDispatchDeps,
): Promise<void> {
  const card = type === 'projects' ? await deps.cards.getProject(list, id, env) : await deps.cards.getService(list, id, env)
  if (!card) {
    await ctx.reply({ text: 'Could not load that card — please try again.' })
    await showList(ctx, type, list, env, deps)
    return
  }
  await deps.sessions.save(ctx.chatId, { screen: 'cards_delete_confirm', data: { type, list, id } }, env)
  await ctx.reply(menu.buildCardDeleteConfirm(card.title.en || id, singularType(type)))
}

async function confirmDelete(
  ctx: BotCtx, type: CardType, list: CardList, id: string, env: Env, deps: CardsDispatchDeps,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const result = await handleAdminCards(
    { method: 'DELETE', cookieHeader, query: { type: singularType(type) }, body: { list, id } },
    env,
    deps.adminCards,
  )
  if (result.status !== 200) {
    await ctx.reply(menu.buildCardSaveFailed(`cards:card:${id}`))
    return
  }
  await showList(ctx, type, list, env, deps)
}

// ---- callback entry point ----

export async function dispatchCardsCallback(
  ctx: BotCtx, data: string, env: Env, deps: CardsDispatchDeps = defaultCardsDispatchDeps,
): Promise<void> {
  if (data === 'cards:projects:list' || data === 'cards:services:list') {
    await showTabs(ctx, data.split(':')[1] as CardType, env, deps)
    return
  }
  if (data.startsWith('cards:projects:tab:') || data.startsWith('cards:services:tab:')) {
    const parts = data.split(':') // ['cards', type, 'tab', list]
    await showList(ctx, parts[1] as CardType, parts[3] as CardList, env, deps)
    return
  }

  const state = await loadState(ctx, env, deps)
  const type = state.data?.type as CardType | undefined
  const list = state.data?.list as CardList | undefined
  const id = state.data?.id as string | undefined

  if (data.startsWith('cards:card:')) {
    if (!type || !list) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await showDetail(ctx, type, list, data.slice('cards:card:'.length), env, deps)
    return
  }
  if (data === 'cards:back:list') {
    if (!type || !list) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await showList(ctx, type, list, env, deps)
    return
  }
  if (data.startsWith('cards:field:')) {
    if (!type || !list || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await startFieldEdit(ctx, type, list, id, data.slice('cards:field:'.length), env, deps)
    return
  }
  if (data.startsWith('cards:lang:')) {
    const field = state.data?.field as string | undefined
    if (!type || !list || !id || !field) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await startValuePrompt(ctx, type, list, id, field, data.slice('cards:lang:'.length) as 'en' | 'uk', env, deps)
    return
  }
  if (data === 'cards:toggle:published' || data === 'cards:toggle:featured') {
    if (!type || !list || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await toggleField(ctx, type, list, id, data === 'cards:toggle:published' ? 'published' : 'featured', env, deps)
    return
  }
  if (data === 'cards:move:up' || data === 'cards:move:down') {
    if (!type || !list || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await moveCard(ctx, type, list, id, data === 'cards:move:up' ? 'up' : 'down', env, deps)
    return
  }
  if (data === 'cards:delete') {
    if (!type || !list || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await startDelete(ctx, type, list, id, env, deps)
    return
  }
  if (data === 'cards:delete:confirm') {
    if (!type || !list || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await confirmDelete(ctx, type, list, id, env, deps)
    return
  }
  if (data === 'cards:delete:cancel') {
    if (!type || !list || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await showDetail(ctx, type, list, id, env, deps)
    return
  }
  // cards:image:* is handled in Task 4 (photo capability) — this task does not
  // add those branches yet, so an image:* tap here would fall through to no
  // reply. That is fine: Task 4 lands in the same PR-series before this branch
  // ships to production, and its own tests cover cards:image:*.
}

// ---- text entry point (field values, tags) ----

export async function dispatchCardsText(
  ctx: BotCtx, text: string, env: Env, deps: CardsDispatchDeps = defaultCardsDispatchDeps,
): Promise<void> {
  const state = await loadState(ctx, env, deps)
  const type = state.data?.type as CardType | undefined
  const list = state.data?.list as CardList | undefined
  const id = state.data?.id as string | undefined

  if (state.screen === 'cards_value') {
    const field = state.data?.field as string | undefined
    const lang = state.data?.lang as 'en' | 'uk' | undefined
    if (!type || !list || !id || !field || !lang) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await saveFieldValue(ctx, type, list, id, field, lang, text, env, deps)
    return
  }
  if (state.screen === 'cards_tags_value') {
    if (!list || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await saveTags(ctx, list, id, text, env, deps)
    return
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run api/_lib/telegramCardsDispatch.test.ts`
Expected: PASS (all tests).

- [ ] **Step 7: Wire the thin delegation into `telegramDispatch.ts`**

Add the import at the top of `api/_lib/telegramDispatch.ts`:

```ts
import { dispatchCardsCallback, dispatchCardsText, defaultCardsDispatchDeps, type CardsDispatchDeps } from './telegramCardsDispatch'
```

Extend `DispatchDeps` and `defaultDispatchDeps`:

```ts
export interface DispatchDeps {
  admins: TelegramAdminsDeps
  sessions: TelegramSessionsDeps
  content: TelegramContentDeps
  adminContent: AdminContentDeps
  cardsDispatch: CardsDispatchDeps
}

export const defaultDispatchDeps: DispatchDeps = {
  admins: defaultTelegramAdminsDeps,
  sessions: defaultTelegramSessionsDeps,
  content: defaultTelegramContentDeps,
  adminContent: defaultAdminContentDeps,
  cardsDispatch: defaultCardsDispatchDeps,
}
```

In `handleCallback`, insert the `cards:` prefix branch right after the existing `seo:` branch and before the `stub:` branch:

```ts
  if (data.startsWith('cards:')) {
    // Projects and Services currently share the exact same role requirement
    // in MENU_ITEMS (['owner', 'content_manager']) — checking either key's
    // access is equivalent to checking both, so one gate covers this whole
    // prefix regardless of which type a deeper callback concerns. If a future
    // plan gives the two types different roles, this gate must be split.
    if (!menu.canAccessSection(role, 'projects')) {
      await ctx.reply(menu.buildNoAccessReply())
      return
    }
    await dispatchCardsCallback(ctx, data, env, deps.cardsDispatch)
    return
  }
```

In `handleText`, add a `cards_value`/`cards_tags_value` branch before the existing `role !== 'owner'` gate (same position as Plan 2's `content_value`/`seo_value` branches — the cards session screens are also reachable by `content_manager`):

```ts
  if (state.screen === 'cards_value' || state.screen === 'cards_tags_value') {
    if (!menu.canAccessSection(role, 'projects')) {
      await ctx.reply(TEXT_FALLBACK_REPLY)
      return
    }
    await dispatchCardsText(ctx, text, env, deps.cardsDispatch)
    return
  }
```

(Place this alongside the existing `content_value`/`seo_value` checks — all three live in the same `if` chain, above the `role !== 'owner'` gate that follows.)

- [ ] **Step 8: Write and run the delegation tests in `telegramDispatch.test.ts`**

Append to `api/_lib/telegramDispatch.test.ts` (the file's existing `makeDeps()` helper needs a `cardsDispatch` fake added to the `DispatchDeps` literal it returns — a minimal one is enough since Task 3's own `telegramCardsDispatch.test.ts` already covers the cards logic in depth; this file only needs to prove the delegation wiring itself works):

```ts
import { dispatchCardsCallback as _unused_marker_for_reviewers } from './telegramCardsDispatch'
void _unused_marker_for_reviewers // delete this line — it exists only to remind the
// implementer that telegramCardsDispatch.ts must already compile before this file's
// own makeDeps() can construct a real cardsDispatch fake; see the actual fake below
```

Do not actually add the two lines above — they are a note for you, not code to ship. Instead, extend `makeDeps()`'s returned `DispatchDeps` object with a `cardsDispatch` field built from plain `vi.fn()`s (this file does not need to exercise real cards behavior, only prove that `cards:` and `cards_value`/`cards_tags_value` route to the right functions):

```ts
// Add near the top of telegramDispatch.test.ts, alongside the other imports:
import type { CardsDispatchDeps } from './telegramCardsDispatch'

// Inside makeDeps(), alongside the existing `content`/`adminContent` construction:
  const cardsDispatch: CardsDispatchDeps = {
    cards: { listProjects: vi.fn(async () => []), getProject: vi.fn(async () => null), listServices: vi.fn(async () => []), getService: vi.fn(async () => null) },
    adminCards: { create: vi.fn(async () => ({ error: null })), update: vi.fn(async () => ({ error: null })), remove: vi.fn(async () => ({ error: null })), reorder: vi.fn(async () => ({ error: null })) },
    adminUpload: { put: vi.fn(async () => ({ url: '', path: '', error: null })), del: vi.fn(async () => ({ error: null })) },
    sessions,
  }
// And add `cardsDispatch` to the returned `DispatchDeps` object literal:
  const deps: DispatchDeps = { admins, sessions, content, adminContent, cardsDispatch }
```

Then append these tests:

```ts
describe('dispatch — cards delegation', () => {
  it('cards:projects:list is reachable by a content_manager and shows the tab choice', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([MANAGER])
    const ctx = makeCtx({ fromId: 42, callbackData: 'cards:projects:list' })
    await dispatch(ctx, ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe('Projects — choose a list:')
  })

  it('cards:services:list is blocked for a sales_manager', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([SALES])
    const ctx = makeCtx({ fromId: 77, callbackData: 'cards:services:list' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: "You don't have access to this bot." })
  })

  it('stub:projects no longer fires — the main menu now routes Projects to cards:projects:list', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ text: '/start' })
    await dispatch(ctx, ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const projectsButton = (reply.keyboard.inline_keyboard as { text: string; callback_data?: string }[][])
      .flat()
      .find((b) => b.text === 'Projects')
    expect(projectsButton?.callback_data).toBe('cards:projects:list')
  })
})
```

- [ ] **Step 9: Run the full test suite, typecheck**

Run: `npx vitest run api/_lib/telegramDispatch.test.ts api/_lib/telegramCardsDispatch.test.ts api/_lib/adminCardsHandler.test.ts`
Expected: PASS.

Run: `npx tsc -p tsconfig.api.json`
Expected: 0 errors.

- [ ] **Step 10: Commit**

```bash
git add api/_lib/adminCardsHandler.ts api/_lib/telegramCardsDispatch.ts api/_lib/telegramCardsDispatch.test.ts \
        api/_lib/telegramDispatch.ts api/_lib/telegramDispatch.test.ts
git commit -m "feat(telegram-bot): Projects/Services card editing (list, fields, tags, toggles, reorder, delete)"
```

---

## Task 4: Photo upload/replace/remove

**Files:**
- Modify: `api/_lib/adminUploadHandler.ts` (export the existing private `defaultDeps` as `defaultAdminUploadDeps`)
- Modify: `api/_lib/telegramBot.ts` (async `toBotCtx`, photo download, `message:photo` registration)
- Modify: `api/_lib/telegramBot.test.ts`
- Modify: `api/_lib/telegramCardsDispatch.ts` (add `dispatchCardsPhoto` and the `cards:image:*` callback branches)
- Modify: `api/_lib/telegramCardsDispatch.test.ts`
- Modify: `api/_lib/telegramDispatch.ts` (`BotCtx` gains `photoDataUrl?: string`; `dispatch()` gains a photo entry point)
- Modify: `api/_lib/telegramDispatch.test.ts`

**Interfaces:**
- Consumes: everything from Task 3 (`CardsDispatchDeps`, `dispatchCardsCallback`, `dispatchCardsText`, all the `show*`/state-machine helpers already defined in `telegramCardsDispatch.ts` — this task only ADDS to that file, it does not change any Task 3 signature). `defaultAdminUploadDeps` from `api/_lib/adminUploadHandler.ts` already exists — Task 3's Step 2 exported it (and `defaultAdminCardsDeps`) together in one pass, so this task needs no handler-file changes at all.
- Produces: `dispatchCardsPhoto(ctx: BotCtx, env: Env, deps: CardsDispatchDeps): Promise<void>` in `telegramCardsDispatch.ts`; `BotCtx.photoDataUrl?: string` in `telegramDispatch.ts`.

- [ ] **Step 1: Write the failing tests for the photo dispatch logic**

Append to `api/_lib/telegramCardsDispatch.test.ts` (reuse the file's existing `makeDeps`/`makeCtx`/fixtures — add one more thing: `makeCtx` needs a way to carry `photoDataUrl`, which it already supports via `Partial<BotCtx>` spread since `photoDataUrl` will be a valid `BotCtx` field after this task's `telegramDispatch.ts` change):

```ts
import { dispatchCardsPhoto } from './telegramCardsDispatch'

describe('dispatchCardsPhoto — replace flow', () => {
  it('cards:image:replace prompts for a photo', async () => {
    const { deps } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    const ctx = makeCtx({})
    await dispatchCardsCallback(ctx, 'cards:image:replace', ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe('Send a new photo for this card.')
  })

  it('a real photo uploads, updates the card, and best-effort deletes the old object', async () => {
    const { deps, adminCards, getProjects } = makeDeps({
      screen: 'cards_photo_wait', data: { type: 'projects', list: 'home', id: 'a' },
    })
    const put = vi.fn(async () => ({ url: 'https://x/new.jpg', path: 'projects/new.jpg', error: null }))
    const del = vi.fn(async () => ({ error: null }))
    deps.adminUpload.put = put
    deps.adminUpload.del = del

    const ctx = makeCtx({ photoDataUrl: 'data:image/jpeg;base64,AAAA' })
    await dispatchCardsPhoto(ctx, ENV, deps)

    expect(put).toHaveBeenCalledWith('projects', 'data:image/jpeg;base64,AAAA', expect.any(String), ENV)
    const updated = getProjects().find((p) => p.id === 'a')
    expect(updated?.imageUrl).toBe('https://x/new.jpg')
    expect(updated?.imagePath).toBe('projects/new.jpg')
    expect(del).toHaveBeenCalledWith('projects/a.jpg', ENV) // PROJECT_A's original imagePath
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Saved.')
  })

  it('does not delete the old object when there was none', async () => {
    const { deps } = makeDeps({ screen: 'cards_photo_wait', data: { type: 'projects', list: 'home', id: 'b' } })
    const del = vi.fn(async () => ({ error: null }))
    deps.adminUpload.put = vi.fn(async () => ({ url: 'https://x/new.jpg', path: 'projects/new.jpg', error: null }))
    deps.adminUpload.del = del
    const ctx = makeCtx({ photoDataUrl: 'data:image/jpeg;base64,AAAA' })
    await dispatchCardsPhoto(ctx, ENV, deps)
    expect(del).not.toHaveBeenCalled()
  })

  it('a delete failure on the OLD object does not fail the save (best-effort)', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_photo_wait', data: { type: 'projects', list: 'home', id: 'a' } })
    deps.adminUpload.put = vi.fn(async () => ({ url: 'https://x/new.jpg', path: 'projects/new.jpg', error: null }))
    deps.adminUpload.del = vi.fn(async () => ({ error: 'boom' }))
    const ctx = makeCtx({ photoDataUrl: 'data:image/jpeg;base64,AAAA' })
    await dispatchCardsPhoto(ctx, ENV, deps)
    expect(getProjects().find((p) => p.id === 'a')?.imageUrl).toBe('https://x/new.jpg')
  })

  it('uploading for a service writes to the icon fields via the "services" folder', async () => {
    const { deps, getServices } = makeDeps({ screen: 'cards_photo_wait', data: { type: 'services', list: 'home', id: 's1' } })
    const put = vi.fn(async () => ({ url: 'https://x/new-icon.png', path: 'services/new-icon.png', error: null }))
    deps.adminUpload.put = put
    const ctx = makeCtx({ photoDataUrl: 'data:image/png;base64,BBBB' })
    await dispatchCardsPhoto(ctx, ENV, deps)
    expect(put).toHaveBeenCalledWith('services', expect.any(String), expect.any(String), ENV)
    expect(getServices().find((s) => s.id === 's1')?.iconUrl).toBe('https://x/new-icon.png')
  })

  it('an upload failure shows an error and does not touch the record', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_photo_wait', data: { type: 'projects', list: 'home', id: 'a' } })
    deps.adminUpload.put = vi.fn(async () => ({ url: '', path: '', error: 'too_large' }))
    const ctx = makeCtx({ photoDataUrl: 'data:image/jpeg;base64,AAAA' })
    await dispatchCardsPhoto(ctx, ENV, deps)
    expect(getProjects().find((p) => p.id === 'a')?.imageUrl).toBe(PROJECT_A.imageUrl)
    expect(ctx.reply).toHaveBeenCalledWith({
      text: 'Could not upload that photo — please try again.',
      keyboard: expect.anything(),
    })
  })

  it('receiving text instead of a photo asks for a photo again and does not touch the record', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_photo_wait', data: { type: 'projects', list: 'home', id: 'a' } })
    const ctx = makeCtx({ text: 'oops, wrong message' })
    await dispatchCardsText(ctx, 'oops, wrong message', ENV, deps)
    expect(getProjects().find((p) => p.id === 'a')?.imageUrl).toBe(PROJECT_A.imageUrl)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Please send a photo, or /start to cancel.' })
  })
})

describe('dispatchCardsCallback — cards:image:remove', () => {
  it('clears the ref first, then best-effort deletes the old object', async () => {
    const { deps, getProjects } = makeDeps({ screen: 'cards_detail', data: { type: 'projects', list: 'home', id: 'a' } })
    const del = vi.fn(async () => ({ error: null }))
    deps.adminUpload.del = del
    const ctx = makeCtx({})
    await dispatchCardsCallback(ctx, 'cards:image:remove', ENV, deps)
    expect(getProjects().find((p) => p.id === 'a')?.imageUrl).toBeNull()
    expect(del).toHaveBeenCalledWith('projects/a.jpg', ENV)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Saved.')
  })
})
```

Note: the "upload for a service" test needs a `PROJECT_A`-shaped `imagePath` assertion adapted — no changes needed to the shared `makeDeps`/fixtures from Task 3; `SERVICE_A.iconPath` is already `'services/i.png'` from Task 3's fixtures, so the "does not delete when there was none" style test isn't needed for services (Task 3's `SERVICE_A` already has an icon) — the tests above cover both the with-old-image and without-old-image cases using the existing `PROJECT_A`/`PROJECT_B` fixtures, which is sufficient.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run api/_lib/telegramCardsDispatch.test.ts`
Expected: FAIL — `dispatchCardsPhoto` does not exist yet; `cards:image:replace`/`cards:image:remove` are unhandled.

- [ ] **Step 3: Add photo support to `api/_lib/telegramCardsDispatch.ts`**

Add these functions (anywhere at module scope) and wire the two new callback branches plus the photo entry point:

```ts
const FOLDER_FOR_TYPE: Record<CardType, 'projects' | 'services'> = { projects: 'projects', services: 'services' }

async function startImageReplace(
  ctx: BotCtx, type: CardType, list: CardList, id: string, env: Env, deps: CardsDispatchDeps,
): Promise<void> {
  await deps.sessions.save(ctx.chatId, { screen: 'cards_photo_wait', data: { type, list, id } }, env)
  await ctx.reply(menu.buildPhotoPrompt(`cards:card:${id}`))
}

async function removeImage(
  ctx: BotCtx, type: CardType, list: CardList, id: string, env: Env, deps: CardsDispatchDeps,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const card = type === 'projects' ? await deps.cards.getProject(list, id, env) : await deps.cards.getService(list, id, env)
  if (!card) {
    await ctx.reply({ text: 'Could not load that card — please try again.' })
    await showList(ctx, type, list, env, deps)
    return
  }
  const oldPath = type === 'projects' ? (card as ProjectCardRecord).imagePath : (card as ServiceCardRecord).iconPath
  const field = type === 'projects' ? 'image' : 'icon'
  const result = await handleAdminCards(
    { method: 'PUT', cookieHeader, query: { type: singularType(type) }, body: { list, id, patch: { [field]: { src: '' } } } },
    env,
    deps.adminCards,
  )
  if (result.status !== 200) {
    await ctx.reply(menu.buildCardSaveFailed(`cards:card:${id}`))
    return
  }
  if (oldPath) await deps.adminUpload.del(oldPath, env).catch(() => ({ error: 'ignored' }))
  await showDetail(ctx, type, list, id, env, deps, true)
}

export async function dispatchCardsPhoto(
  ctx: BotCtx, env: Env, deps: CardsDispatchDeps = defaultCardsDispatchDeps,
): Promise<void> {
  const state = await loadState(ctx, env, deps)
  const type = state.data?.type as CardType | undefined
  const list = state.data?.list as CardList | undefined
  const id = state.data?.id as string | undefined
  if (!type || !list || !id || !ctx.photoDataUrl) return

  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const card = type === 'projects' ? await deps.cards.getProject(list, id, env) : await deps.cards.getService(list, id, env)
  if (!card) {
    await ctx.reply({ text: 'Could not load that card — please try again.' })
    await showList(ctx, type, list, env, deps)
    return
  }
  const oldPath = type === 'projects' ? (card as ProjectCardRecord).imagePath : (card as ServiceCardRecord).iconPath

  const uploadResult = await deps.adminUpload.put(FOLDER_FOR_TYPE[type], ctx.photoDataUrl, `${id}.jpg`, env)
  if (uploadResult.error) {
    await ctx.reply(menu.buildCardSaveFailed(`cards:card:${id}`))
    return
  }

  const field = type === 'projects' ? 'image' : 'icon'
  const saveResult = await handleAdminCards(
    {
      method: 'PUT',
      cookieHeader,
      query: { type: singularType(type) },
      body: { list, id, patch: { [field]: { src: uploadResult.url, path: uploadResult.path } } },
    },
    env,
    deps.adminCards,
  )
  if (saveResult.status !== 200) {
    await ctx.reply(menu.buildCardSaveFailed(`cards:card:${id}`))
    return
  }
  if (oldPath && oldPath !== uploadResult.path) {
    await deps.adminUpload.del(oldPath, env).catch(() => ({ error: 'ignored' }))
  }
  await showDetail(ctx, type, list, id, env, deps, true)
}
```

Note: `deps.adminUpload.put`'s real signature (from `api/_lib/adminUploadHandler.ts`'s `AdminUploadDeps`) is `put(folder, key, bytes, contentType, env)` — it operates on already-decoded bytes, not a data URL, because `handleAdminUpload` (the orchestration function) is what parses the incoming `dataUrl` into bytes before calling `deps.put`. This plan's bot code does **not** call `deps.adminUpload.put` directly — it must go through `handleAdminUpload` itself (the actual orchestration function, exactly like every other write in this plan goes through its handler, not its raw deps). Replace the two `deps.adminUpload.put(...)` call above with the correct pattern:

```ts
import { handleAdminUpload } from './adminUploadHandler'
// (add to the existing import line from adminUploadHandler.ts)
```

```ts
  const uploadResult = await handleAdminUpload(
    { method: 'POST', cookieHeader, body: { dataUrl: ctx.photoDataUrl, fileName: `${id}.jpg`, folder: FOLDER_FOR_TYPE[type] } },
    env,
    deps.adminUpload,
  )
  if (uploadResult.status !== 200) {
    await ctx.reply(menu.buildCardSaveFailed(`cards:card:${id}`))
    return
  }
  const { url, path } = uploadResult.body as { url: string; path: string }
```

(and use `url`/`path` in place of `uploadResult.url`/`uploadResult.path` below it). Apply the same correction to `removeImage`'s deletion call — it already correctly calls `deps.adminUpload.del(oldPath, env)` directly, which matches `AdminUploadDeps.del`'s real signature `del(path, env)`, so no correction needed there; only the upload (`put`) path needed routing through `handleAdminUpload` instead of the raw `deps.put`.

Now add the two callback branches in `dispatchCardsCallback`, replacing the placeholder comment left at the end of the function in Task 3:

```ts
  if (data === 'cards:image:replace') {
    if (!type || !list || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await startImageReplace(ctx, type, list, id, env, deps)
    return
  }
  if (data === 'cards:image:remove') {
    if (!type || !list || !id) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await removeImage(ctx, type, list, id, env, deps)
    return
  }
```

Finally, handle the "text sent while waiting for a photo" case in `dispatchCardsText`, adding this branch alongside `cards_value`/`cards_tags_value`:

```ts
  if (state.screen === 'cards_photo_wait') {
    await ctx.reply({ text: 'Please send a photo, or /start to cancel.' })
    return
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run api/_lib/telegramCardsDispatch.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Add `photoDataUrl` to `BotCtx` and the photo entry point in `telegramDispatch.ts`**

In `api/_lib/telegramDispatch.ts`, extend `BotCtx`:

```ts
export interface BotCtx {
  chatId: number
  fromId: number
  text?: string
  callbackData?: string
  photoDataUrl?: string
  reply: (r: menu.BotReply) => Promise<void>
  answerCallback: () => Promise<void>
}
```

In the top-level `dispatch()` function, add a photo branch. Place it after the `/start` check and before the free-text `handleText` call (photo messages never have `ctx.text` set, so ordering relative to the text branch does not matter for correctness, but keeping it grouped with the other "what kind of update is this" checks near the top of `dispatch()` keeps the function's shape readable):

```ts
  if (ctx.photoDataUrl) {
    if (!role) {
      await ctx.reply(menu.buildNoAccessReply())
      return
    }
    if (!menu.canAccessSection(role, 'projects')) {
      await ctx.reply(menu.buildNoAccessReply())
      return
    }
    await dispatchCardsPhoto(ctx, env, deps.cardsDispatch)
    return
  }
```

(Add the `dispatchCardsPhoto` import to the existing `from './telegramCardsDispatch'` import line at the top of the file.)

- [ ] **Step 6: Write the dispatch-level delegation test**

Append to `api/_lib/telegramDispatch.test.ts`:

```ts
describe('dispatch — photo delegation', () => {
  it('a photo message from an unauthorized id gets "no access"', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ fromId: 999, photoDataUrl: 'data:image/jpeg;base64,AAAA' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: "You don't have access to this bot." })
  })

  it('a photo message from a sales_manager gets "no access" (cards is content_manager-only)', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([SALES])
    const ctx = makeCtx({ fromId: 77, photoDataUrl: 'data:image/jpeg;base64,AAAA' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: "You don't have access to this bot." })
  })
})
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run api/_lib/telegramDispatch.test.ts`
Expected: PASS.

- [ ] **Step 8: Add photo support to `api/_lib/telegramBot.ts`**

Read the current file in full first. Change `toBotCtx` from a synchronous function returning `BotCtx | null` to an `async` function, and add the photo-download logic:

```ts
async function toBotCtx(ctx: Context): Promise<BotCtx | null> {
  const chatId = ctx.chatId
  const fromId = ctx.from?.id
  if (chatId == null || fromId == null) return null

  let photoDataUrl: string | undefined
  const photoSizes = ctx.message?.photo
  if (photoSizes && photoSizes.length > 0) {
    try {
      const largest = photoSizes[photoSizes.length - 1]
      const file = await ctx.api.getFile(largest.file_id)
      if (file.file_path) {
        const token = ctx.api.token
        const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`)
        if (res.ok) {
          const bytes = Buffer.from(await res.arrayBuffer())
          photoDataUrl = `data:image/jpeg;base64,${bytes.toString('base64')}`
        }
      }
    } catch {
      // Leave photoDataUrl undefined — dispatch replies "please send a photo
      // again" for any cards_photo_wait step that never got one, so a flaky
      // download degrades gracefully instead of crashing the update.
    }
  }

  return {
    chatId,
    fromId,
    text: ctx.message?.text,
    callbackData: ctx.callbackQuery?.data,
    photoDataUrl,
    reply: async (r: BotReply) => {
      await ctx.reply(r.text, r.keyboard ? { reply_markup: r.keyboard } : undefined)
    },
    answerCallback: async () => {
      try {
        await ctx.answerCallbackQuery()
      } catch {
        // best-effort: an expired/already-answered query shouldn't abort the reply
      }
    },
  }
}
```

Update `registerHandlers`'s `bot.on([...])` call and the `toBotCtx` call site:

```ts
function registerHandlers(bot: Bot, env: Env, deps: DispatchDeps): void {
  bot.on(['message:text', 'message:photo', 'callback_query:data'], async (ctx) => {
    const botCtx = await toBotCtx(ctx)
    if (botCtx) await dispatch(botCtx, env, deps)
  })
}
```

Note: `ctx.api.token` — confirm this property exists on grammY's `Api` class by checking `node_modules/grammy/out/core/api.d.ts` before relying on it; if it is not public, use the `env.TELEGRAM_BOT_TOKEN` closure variable already in scope inside `getBot`/`registerHandlers` instead (it is available in this function's closure since `registerHandlers(bot, env, deps)` already receives `env`), i.e. build the download URL as `` `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}` `` inside `toBotCtx` — but `toBotCtx` currently only receives `ctx`, not `env`, so if `ctx.api.token` is not available, change `toBotCtx`'s signature to `toBotCtx(ctx: Context, token: string)` and update its one call site in `registerHandlers` to `await toBotCtx(ctx, env.TELEGRAM_BOT_TOKEN ?? '')`. Verify which path is needed and use exactly one — do not leave both in the code.

- [ ] **Step 9: Update `api/_lib/telegramBot.test.ts` for the new photo capability**

Read the existing file in full. It drives a real `Bot` via grammY's `client: { fetch }` test seam (per Plan 1's established pattern). Add a new test that sends a photo update and confirms `dispatch` receives a `photoDataUrl`. Because the raw file-download call inside `toBotCtx` uses the **global** `fetch`, not grammY's `client.fetch` override, this test needs `vi.stubGlobal('fetch', ...)` for that one call — grammY's own API calls (`getMe` during `bot.init()`, `getFile`, `answerCallbackQuery`, `sendMessage`) still go through the existing `client: { fetch: fakeGrammyFetch }` mechanism unchanged from Plan 1:

```ts
it('a photo message is downloaded and passed through as photoDataUrl', async () => {
  const dispatchDeps = defaultDispatchDeps // or the file's existing fake DispatchDeps builder, if one exists — check the file
  const seen: { photoDataUrl?: string }[] = []
  const deps: DispatchDeps = {
    ...dispatchDeps,
    // Reuse whatever fake-deps pattern this file's other tests already use;
    // the key addition is intercepting dispatch to record ctx.photoDataUrl.
  }

  const grammyFetch = vi.fn(async (url: string) => {
    if (url.includes('getMe')) {
      return new Response(JSON.stringify({ ok: true, result: { id: 1, is_bot: true, first_name: 'B', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false } }), { status: 200 })
    }
    if (url.includes('getFile')) {
      return new Response(JSON.stringify({ ok: true, result: { file_id: 'f1', file_unique_id: 'u1', file_path: 'photos/f1.jpg' } }), { status: 200 })
    }
    return new Response(JSON.stringify({ ok: true, result: true }), { status: 200 })
  })

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.startsWith('https://api.telegram.org/file/')) {
        return new Response(new Uint8Array([1, 2, 3]).buffer, { status: 200 })
      }
      return grammyFetch(url)
    }),
  )

  const bot = await getBot({ TELEGRAM_BOT_TOKEN: 't' }, deps, { fetch: grammyFetch as unknown as typeof fetch })
  await bot.handleUpdate({
    update_id: 1,
    message: {
      message_id: 1, date: 0, chat: { id: 1, type: 'private' }, from: { id: 111, is_bot: false, first_name: 'U' },
      photo: [{ file_id: 'f1', file_unique_id: 'u1', width: 10, height: 10 }],
    },
  })

  vi.unstubAllGlobals()
  expect(seen[0]?.photoDataUrl).toMatch(/^data:image\/jpeg;base64,/)
})
```

Adapt the fake-deps plumbing (`seen`, `deps`) to whatever this file's existing tests already use to observe what `dispatch` was called with — read the file first and match its established style exactly rather than introducing a second pattern. Add `vi.unstubAllGlobals()` inside an `afterEach` if the file doesn't already reset globals between tests, so this test's `fetch` stub cannot leak into a later test.

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run api/_lib/telegramBot.test.ts`
Expected: PASS (all tests, old and new).

- [ ] **Step 11: Run the full verification suite**

Run: `npm test`
Expected: all test files pass.

Run: `npx tsc -p tsconfig.api.json`
Expected: 0 errors.

Run: `npm run build`
Expected: succeeds.

Run: `npm run lint`
Expected: 0 errors (pre-existing warnings elsewhere unrelated).

- [ ] **Step 12: Commit**

```bash
git add api/_lib/adminUploadHandler.ts api/_lib/telegramBot.ts api/_lib/telegramBot.test.ts \
        api/_lib/telegramCardsDispatch.ts api/_lib/telegramCardsDispatch.test.ts \
        api/_lib/telegramDispatch.ts api/_lib/telegramDispatch.test.ts
git commit -m "feat(telegram-bot): photo upload/replace/remove for Projects & Services cards"
```

---

## Integration verification (live Telegram + live Supabase)

Not a subagent task — the controller runs this after all 4 tasks are merged and pushed, against a real deployed preview, exactly like Plans 1-2's own live-verification steps.

1. Push the branch; confirm Vercel deployed it; re-register the webhook against that deployment's domain (append the `x-vercel-protection-bypass` query param if Deployment Protection is on for Preview, per the operator note in Plan 2's own Integration Verification section). Confirm `TELEGRAM_*`/`ADMIN_SESSION_SECRET`/`SUPABASE_*` are all scoped to Preview, not just Production.
2. As owner: `/start` → `Projects` → confirm the "On the home page" / "Projects page" tab choice, then open a tab and confirm the card list shows real cards with ✅/🚫 published markers.
3. Open a card → confirm Title/Description/Tags/Image alt/image state/Position N of M all match what `/admin`'s Projects editor shows for the same card.
4. Edit Title (EN), confirm "Saved." and the change is visible in `/admin` and on the live public site's Projects section.
5. Edit Tags → send `WordPress, WooCommerce` → confirm the card's tags update and the OTHER fields are untouched.
6. Tap "🖼 Replace image" → send a real photo from the Telegram client → confirm "Saved.", then open `/admin`'s Projects editor for the same card and confirm the image preview shows the new photo, and open the image URL directly in a browser to confirm it's a real JPEG served from Supabase Storage.
7. Tap "🗑 Remove image" → confirm the card's image clears in both the bot and `/admin`, and directly check Supabase Storage (`public-media` bucket, `projects/` folder) that the old object file is actually gone, not just unreferenced.
8. Tap "▲ Move up" / "▼ Move down" a couple of times → confirm the card list's order changes both in the bot and on the live public site's Projects section, and that Position N of M updates accordingly.
9. Toggle Published off → confirm the card disappears from the live public site but still appears in the bot's list (with a 🚫 marker) and in `/admin`.
10. Repeat steps 2-9 for a Services card, including the Featured toggle (Home list only — confirm the toggle button does not appear at all when editing a Page-list service card).
11. Tap "🗑 Delete card" on a throwaway test card → "Yes, delete" → confirm it's gone from the bot's list, `/admin`, the live public site, AND its Storage object (if it had one) is gone from the bucket.
12. From a `content_manager` account: confirm it can do everything in steps 2-11. From a `sales_manager` account (or an unlisted account): confirm `Projects`/`Services` do not appear on `/start`'s menu, and a stale `cards:projects:list` tap (if reachable) replies "You don't have access to this bot."
13. Spot-check Supabase (`projects`, `services` tables) directly to confirm the rows match exactly what was edited above, and that `sort` values are a clean contiguous sequence after the reorder tests.

---

## Self-review — spec coverage

- Spec §1 Projects row (list w/ order+published; edit title/tags/description/imageAlt EN/UA; upload/replace/delete image; toggle published; reorder; delete w/ confirmation) → Tasks 1-4, fully implemented. WebP conversion explicitly dropped per the documented decision above — spec text superseded.
- Spec §1 Services row (same minus tags, plus featured toggle Home-only) → Tasks 1-4, fully implemented.
- Spec §1 role table (Projects/Services: owner + content_manager only) → enforced at the menu level (unchanged from Plans 1-2) and re-checked on every `cards:*` callback and the `cards_value`/`cards_tags_value`/`cards_photo_wait` text/photo steps (Tasks 3-4), matching Plan 2's "stale tap after a role change fails closed" discipline.
- Spec §2 "auth reuse, not reimplementation" → every write goes through `handleAdminCards`/`handleAdminUpload`, signed via the same `adminCookieHeader` Plan 2 established (now exported for reuse, Task 3 Step 1).
- Spec §2 "real photo-upload parity" → Task 4, using Telegram's own JPEG (no re-encoding), through the exact same `handleAdminUpload` path and `MIME_EXT`/`MAX_BYTES` validation the web admin's upload button already uses.
- Spec §5 menu structure, Projects/Services branches → Task 2 (builders) + Task 3-4 (state machine) match the spec's bullet list (tabs → list → detail → field edit / image / toggle / reorder / delete) exactly.
- Card creation → explicitly out of scope per spec §1, not implemented here.
- Requests (list/status/note/delete) → explicitly out of scope, Plan 4's scope.
- Reset content → never in the bot, per spec §1 — untouched here.

No placeholders remain. The one piece of authoring self-correction visible in Task 4 (the `deps.adminUpload.put` vs. `handleAdminUpload` fix, and the `ctx.api.token` verify-before-use note) is left in deliberately, as exact guidance for the executor rather than a hidden assumption — both are resolved with concrete, complete code, not a "figure it out" placeholder.

### Deferred to Plan 4 (not in this plan)

- Requests: list/filter, view, status, note, delete with confirmation.
- Reset content — never in the bot, web-only forever.

### Notes for the executor

- **Read `node_modules/grammy/out/core/api.d.ts` and `node_modules/@grammyjs/types/message.d.ts` before starting Task 4** to confirm `ctx.api.token`'s exact availability and `PhotoSize[]`'s shape — this plan's authoring already did this and found `bot.api.getFile(file_id)` returns a `File` with `file_path`, and `ctx.message?.photo` is `PhotoSize[]` sorted smallest-to-largest — but confirm `ctx.api.token`'s public accessibility yourself before relying on it, per Task 4 Step 8's explicit fallback instructions.
- `telegramCardsDispatch.ts` is a new file specifically so `telegramDispatch.ts` does not grow past the size Plan 2's final review flagged as worth revisiting — if a future Plan 4 (Requests) follows the same list/detail/edit/delete shape, consider giving Requests its own dispatch file too, for the same reason.
- The `orderedIdsAfterMove` logic in `telegramCardsDispatch.ts` (Task 3) is a deliberate small duplication of `src/admin/actions.ts`'s pure function of the same name and behavior — not an import, because `api/_lib/*` and `src/*` are different `tsc` projects (`tsconfig.api.json` vs. the root `tsconfig.json`) built by different pipelines (`tsc -p tsconfig.api.json` vs. `vite build`), and this codebase has never imported across that boundary. Ten lines of duplicated pure logic is cheaper than introducing a shared package boundary for one function.
