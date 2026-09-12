# Telegram Bot Admin — Plan 2: Content & SEO Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `Content` and `SEO` stubs from Plan 1 with fully working edit flows — list → pick a block/page → view current EN/UA text → pick a field → pick a language → send new text → saved — with every write going through the exact same `handleAdminContent` function the web `/admin` panel already uses, so there is zero duplicated business logic.

**Architecture:** Two new read-only lookups (`getSection`/`getSeo`, backed by the service-role Supabase client, mirroring every other `_lib` module's `Deps` pattern) feed a set of pure `BotReply` builders, which feed an extension of Plan 1's `dispatch()` state machine. Every save signs a fresh `admin_session` cookie via the existing `signToken(ADMIN_SESSION_SECRET)` and calls `handleAdminContent({ method: 'PUT', cookieHeader, body }, env, deps.adminContent)` — the identical function `/admin`'s PUT requests hit today, now reached through a second transport (Telegram) instead of HTTP.

**Tech Stack:** Same as Plan 1 — grammY (already wired), Supabase (`site_sections`/`seo_pages`, already exist, no new migration), Vercel Functions, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-12-telegram-bot-admin.md` — this plan implements Goal §1's Content and SEO rows (text-only, no images — image editing is Plan 3's Projects/Services scope) and the corresponding branches of Menu Structure §5. Read Plan 1 (`docs/superpowers/plans/2026-09-12-telegram-bot-plan-1-foundation.md`, merged to `main` at `e762094`) first — this plan extends its files, not the spec, for exact current signatures.

## Global Constraints

- Server-only env vars, never `VITE_`-prefixed (unchanged from Plan 1: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_IDS`, `TELEGRAM_WEBHOOK_SECRET`; this plan additionally requires `ADMIN_SESSION_SECRET` — already set in `.env.local`/Vercel for the web admin panel, this plan just threads it into the bot's `Env` type).
- Every new `api/_lib/*.ts` module follows the existing injectable-`Deps`-interface pattern: a `Deps` interface, a `defaultXDeps` implementation built on `getSupabaseAdmin(env)`, and an orchestration function that takes `deps` as a defaulted last parameter.
- `api/package.json` pins `{"type":"commonjs"}` for the whole `api/` tree — never touch it, and never use a dynamic `await import()` inside `api/_lib/*`. Static imports only.
- **Zero duplicated business logic**: every write to `site_sections`/`seo_pages` goes through the existing `handleAdminContent` function in `api/_lib/adminContentHandler.ts`. This plan never calls Supabase `.update()` directly for a write.
- **Never send a single-language patch.** `isL` (in `api/_lib/adminRows.ts`) requires both `en` and `uk` to be set together — `sectionRow`/`seoRow` silently drop any field where `isL` fails, so a patch built from only the edited language would write nothing and the user would see a false "Saved." Every save in this plan reads the current record first and merges the new text into the untouched language's existing value before calling `handleAdminContent`.
- **Display label for the `uk` locale is "UA", not "UK"** — matches the web admin's own convention (`src/admin/components/LocalizedField.tsx`: `{ code: 'uk', label: 'UA' }`). The internal field/callback-data name stays `uk` (matches `isL`'s `{ en, uk }` shape); only the button text shown to the human says "UA".
- Test files are `*.test.ts` next to the file they test, run via `npx vitest run <path>`.
- No live Telegram/Supabase calls from unit tests — every test in this plan injects fakes.
- Model-selection discipline (same as Plan 1): the cheapest capable model for mechanical, fully-specified tasks (Tasks 1 and 2 below); a standard model for integration/judgment work and all task reviewers (Task 3, and every reviewer); the most capable available model for the single final whole-branch review. Executed via `superpowers:subagent-driven-development`.

---

## File structure (this plan)

```
onvorx/
  api/
    _lib/
      telegramContent.ts         # CREATE: read-only site_sections/seo_pages lookup (Supabase-backed)
      telegramContent.test.ts    # CREATE
      telegramMenu.ts            # MODIFY: add Content + SEO list/detail/prompt builders
      telegramMenu.test.ts       # MODIFY: cover the new builders + update 1 stale assertion
      telegramDispatch.ts        # MODIFY: wire Content + SEO into the state machine
      telegramDispatch.test.ts   # MODIFY: extensive new coverage + 1 updated stub test
      telegramBot.ts             # MODIFY: `Env` gains `AuthEnv` (one-line type change)
      telegramHandler.ts         # MODIFY: `Env` gains `AuthEnv` (one-line type change)
      adminContentHandler.ts     # MODIFY: export the existing private `defaultDeps` as `defaultAdminContentDeps`
    telegram/
      webhook.ts                 # MODIFY: pass `ADMIN_SESSION_SECRET` through to the handler
```

No new Supabase migration — `site_sections` and `seo_pages` already exist in `supabase/schema.sql`.

### Interfaces produced by this plan

```ts
// api/_lib/telegramContent.ts
export type ContentField = 'eyebrow' | 'title' | 'body' | 'ctaLabel'
export type SeoField = 'title' | 'description'
export interface SectionRecord {
  key: string
  eyebrow: L
  title: L
  body: L
  ctaLabel: L | null
}
export interface SeoRecord {
  pageKey: string
  title: L
  description: L
}
export interface TelegramContentDeps {
  getSection: (key: string, env: SupabaseAdminEnv) => Promise<SectionRecord | null>
  getSeo: (pageKey: string, env: SupabaseAdminEnv) => Promise<SeoRecord | null>
}
export const defaultTelegramContentDeps: TelegramContentDeps

// api/_lib/telegramMenu.ts — added
export function buildContentList(): BotReply
export function buildSectionDetail(record: SectionRecord, opts?: { saved?: boolean }): BotReply
export function sectionFieldValue(record: SectionRecord, field: ContentField): L
export function buildContentFieldLangPrompt(key: string, field: ContentField): BotReply
export function buildContentValuePrompt(field: ContentField, lang: 'en' | 'uk', currentText: string): BotReply
export function buildSeoList(): BotReply
export function buildSeoDetail(record: SeoRecord, opts?: { saved?: boolean }): BotReply
export function buildSeoFieldLangPrompt(pageKey: string, field: SeoField): BotReply
export function buildSeoValuePrompt(field: SeoField, lang: 'en' | 'uk', currentText: string): BotReply
export function buildSaveFailed(backCallback: string): BotReply

// api/_lib/telegramDispatch.ts — DispatchDeps grows one field
export interface DispatchDeps {
  admins: TelegramAdminsDeps
  sessions: TelegramSessionsDeps
  content: TelegramContentDeps        // new
  adminContent: AdminContentDeps      // new — reused from adminContentHandler.ts
}

// api/_lib/adminContentHandler.ts — newly exported
export const defaultAdminContentDeps: AdminContentDeps
```

---

## Task 1: Read-only Content & SEO lookup — `api/_lib/telegramContent.ts`

**Files:**
- Create: `api/_lib/telegramContent.ts`
- Test: `api/_lib/telegramContent.test.ts`

**Interfaces:**
- Consumes: `getSupabaseAdmin` from `api/_lib/supabaseAdmin.ts`, `type L` from `api/_lib/adminRows.ts`, `type SupabaseAdminEnv` from `api/_lib/types.ts`.
- Produces: `ContentField`, `SeoField`, `SectionRecord`, `SeoRecord`, `TelegramContentDeps`, `defaultTelegramContentDeps` — all listed in full above. Tasks 2 and 3 import these types and the default deps.

The bot needs to show the human the *current* text before asking for an edit — something no existing handler does server-side (the web admin panel reads content client-side, via the browser's anon Supabase client in `src/content/remote.ts`, which cannot run in this serverless function). This is a small, self-contained read path, following the exact same `getSupabaseAdmin(env)` pattern as `telegramAdmins.ts`'s `findManager`.

- [ ] **Step 1: Write the failing tests**

```ts
// api/_lib/telegramContent.test.ts
import { describe, it, expect } from 'vitest'
import { defaultTelegramContentDeps } from './telegramContent'

describe('defaultTelegramContentDeps', () => {
  it('getSection returns null when Supabase is not configured', async () => {
    expect(await defaultTelegramContentDeps.getSection('hero', {})).toBeNull()
  })
  it('getSeo returns null when Supabase is not configured', async () => {
    expect(await defaultTelegramContentDeps.getSeo('home', {})).toBeNull()
  })
})
```

(This mirrors the existing convention in this codebase — see `api/_lib/telegramAdmins.test.ts` and `api/_lib/telegramSessions.test.ts`: a `defaultXDeps` implementation built directly on `getSupabaseAdmin` gets only its "not configured" branch unit-tested; its real Supabase round-trip is verified live, in this plan's own Integration Verification section below, exactly like Plan 1's `telegram_admins`/`telegram_sessions` CRUD was.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run api/_lib/telegramContent.test.ts`
Expected: FAIL — `Cannot find module './telegramContent'`.

- [ ] **Step 3: Implement `api/_lib/telegramContent.ts`**

```ts
import type { SupabaseAdminEnv } from './types'
import { getSupabaseAdmin } from './supabaseAdmin'
import type { L } from './adminRows'

export type ContentField = 'eyebrow' | 'title' | 'body' | 'ctaLabel'
export type SeoField = 'title' | 'description'

export interface SectionRecord {
  key: string
  eyebrow: L
  title: L
  body: L
  ctaLabel: L | null
}

export interface SeoRecord {
  pageKey: string
  title: L
  description: L
}

export interface TelegramContentDeps {
  getSection: (key: string, env: SupabaseAdminEnv) => Promise<SectionRecord | null>
  getSeo: (pageKey: string, env: SupabaseAdminEnv) => Promise<SeoRecord | null>
}

const emptyL = (): L => ({ en: '', uk: '' })

export const defaultTelegramContentDeps: TelegramContentDeps = {
  getSection: async (key, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return null
    const { data, error } = await c.from('site_sections').select('*').eq('key', key).maybeSingle()
    if (error || !data) return null
    return {
      key: String(data.key),
      eyebrow: (data.eyebrow as L) ?? emptyL(),
      title: (data.title as L) ?? emptyL(),
      body: (data.body as L) ?? emptyL(),
      ctaLabel: (data.cta_label as L | null) ?? null,
    }
  },
  getSeo: async (pageKey, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return null
    const { data, error } = await c.from('seo_pages').select('*').eq('page_key', pageKey).maybeSingle()
    if (error || !data) return null
    return {
      pageKey: String(data.page_key),
      title: (data.title as L) ?? emptyL(),
      description: (data.description as L) ?? emptyL(),
    }
  },
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run api/_lib/telegramContent.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/telegramContent.ts api/_lib/telegramContent.test.ts
git commit -m "feat(telegram-bot): read-only content/SEO lookup for the bot (site_sections + seo_pages)"
```

---

## Task 2: Content & SEO menu builders — `api/_lib/telegramMenu.ts`

**Files:**
- Modify: `api/_lib/telegramMenu.ts`
- Modify: `api/_lib/telegramMenu.test.ts`

**Interfaces:**
- Consumes: `ContentField`, `SeoField`, `SectionRecord`, `SeoRecord` from `api/_lib/telegramContent.ts` (Task 1) — types only, these are pure functions with no I/O.
- Produces: every function listed in "Interfaces produced by this plan" above under `telegramMenu.ts`. Task 3 (dispatch) calls all of them by these exact names.

This task also refactors `buildMainMenu`'s routing so the `Content` and `SEO` buttons point at the new real flows instead of the generic `stub:` prefix — `Projects`, `Services`, and `Requests` keep using `stub:` (they stay stubs until Plan 3/4).

- [ ] **Step 1: Write the failing tests**

Add to `api/_lib/telegramMenu.test.ts` (keep every existing `describe` block; only the one assertion called out below changes):

```ts
// CHANGE this one line inside the existing `describe('buildMainMenu', ...)` block,
// in the "owner sees all six sections" test:
//   expect(buttons.find((b) => b.text === 'Content')?.data).toBe('stub:content')
// becomes:
    expect(buttons.find((b) => b.text === 'Content')?.data).toBe('content:list')
    expect(buttons.find((b) => b.text === 'SEO')?.data).toBe('seo:list')
    expect(buttons.find((b) => b.text === 'Projects')?.data).toBe('stub:projects')
```

Then add new `describe` blocks at the end of the file:

```ts
import type { SectionRecord, SeoRecord } from './telegramContent'
// (add this import at the top of the file, next to the existing `telegramAdmins` import)

const L = (en: string, uk: string) => ({ en, uk })

const HERO: SectionRecord = {
  key: 'hero',
  eyebrow: L('Web solutions', 'Веб-рішення'),
  title: L('Built around your business', 'Створено під ваш бізнес'),
  body: L('We design and build.', 'Ми проєктуємо і будуємо.'),
  ctaLabel: L('Request an estimate', 'Отримати оцінку'),
}

const ABOUT: SectionRecord = {
  key: 'about',
  eyebrow: L('About', 'Про нас'),
  title: L('Who we are', 'Хто ми'),
  body: L('A small team.', 'Невелика команда.'),
  ctaLabel: null,
}

const HOME_SEO: SeoRecord = {
  pageKey: 'home',
  title: L('ONVORX', 'ONVORX'),
  description: L('Web solutions built around your business.', 'Веб-рішення під ваш бізнес.'),
}

describe('buildContentList', () => {
  it('lists all six blocks, each routing to content:section:<key>, then Back to menu:main', () => {
    const buttons = readButtons(buildContentList())
    expect(buttons).toEqual([
      { text: 'Hero', data: 'content:section:hero' },
      { text: 'Services', data: 'content:section:services' },
      { text: 'Projects', data: 'content:section:projects' },
      { text: 'How We Work', data: 'content:section:howWork' },
      { text: 'About', data: 'content:section:about' },
      { text: 'CTA', data: 'content:section:cta' },
      { text: '⬅ Back', data: 'menu:main' },
    ])
  })
})

describe('buildSectionDetail', () => {
  it('hero shows Eyebrow/Title/Body/CTA label buttons and current text for both languages', () => {
    const r = buildSectionDetail(HERO)
    expect(r.text).toContain('Built around your business')
    expect(r.text).toContain('Створено під ваш бізнес')
    expect(readButtons(r)).toEqual([
      { text: 'Eyebrow', data: 'content:field:eyebrow' },
      { text: 'Title', data: 'content:field:title' },
      { text: 'Body', data: 'content:field:body' },
      { text: 'CTA label', data: 'content:field:ctaLabel' },
      { text: '⬅ Back', data: 'content:list' },
    ])
  })
  it('about has no CTA label field or button (ctaLabel is null and about is not a CTA section)', () => {
    const r = buildSectionDetail(ABOUT)
    expect(r.text).not.toContain('CTA label')
    expect(readButtons(r).map((b) => b.text)).toEqual(['Eyebrow', 'Title', 'Body', '⬅ Back'])
  })
  it('prefixes "Saved." when opts.saved is true', () => {
    expect(buildSectionDetail(HERO, { saved: true }).text.startsWith('Saved.\n\n')).toBe(true)
  })
})

describe('sectionFieldValue', () => {
  it('reads a plain field', () => {
    expect(sectionFieldValue(HERO, 'title')).toEqual(HERO.title)
  })
  it('falls back to an empty L when ctaLabel is null', () => {
    expect(sectionFieldValue(ABOUT, 'ctaLabel')).toEqual({ en: '', uk: '' })
  })
})

describe('buildContentFieldLangPrompt', () => {
  it('offers EN/UA and a Back to the section detail', () => {
    const r = buildContentFieldLangPrompt('hero', 'title')
    expect(r.text).toContain('Title')
    expect(readButtons(r)).toEqual([
      { text: 'EN', data: 'content:lang:en' },
      { text: 'UA', data: 'content:lang:uk' },
      { text: '⬅ Back', data: 'content:section:hero' },
    ])
  })
})

describe('buildContentValuePrompt', () => {
  it('shows the current text and asks for the new one, no keyboard', () => {
    const r = buildContentValuePrompt('title', 'en', 'Built around your business')
    expect(r.text).toContain('Built around your business')
    expect(r.text).toContain('EN')
    expect(r.keyboard).toBeUndefined()
  })
  it('shows "(empty)" when there is no current text', () => {
    expect(buildContentValuePrompt('ctaLabel', 'uk', '').text).toContain('(empty)')
  })
})

describe('buildSeoList', () => {
  it('lists all eight pages, then Back to menu:main', () => {
    const buttons = readButtons(buildSeoList())
    expect(buttons).toEqual([
      { text: 'Home', data: 'seo:page:home' },
      { text: 'Services', data: 'seo:page:services' },
      { text: 'Projects', data: 'seo:page:projects' },
      { text: 'About', data: 'seo:page:about' },
      { text: 'Web Development', data: 'seo:page:web-development' },
      { text: 'Support', data: 'seo:page:support' },
      { text: 'Business Analysis', data: 'seo:page:business-analysis' },
      { text: 'Google Ads', data: 'seo:page:google-ads' },
      { text: '⬅ Back', data: 'menu:main' },
    ])
  })
})

describe('buildSeoDetail', () => {
  it('shows Title/Description buttons and current text for both languages', () => {
    const r = buildSeoDetail(HOME_SEO)
    expect(r.text).toContain('ONVORX')
    expect(readButtons(r)).toEqual([
      { text: 'Title', data: 'seo:field:title' },
      { text: 'Description', data: 'seo:field:description' },
      { text: '⬅ Back', data: 'seo:list' },
    ])
  })
  it('prefixes "Saved." when opts.saved is true', () => {
    expect(buildSeoDetail(HOME_SEO, { saved: true }).text.startsWith('Saved.\n\n')).toBe(true)
  })
})

describe('buildSeoFieldLangPrompt', () => {
  it('offers EN/UA and a Back to the page detail', () => {
    const r = buildSeoFieldLangPrompt('home', 'description')
    expect(readButtons(r)).toEqual([
      { text: 'EN', data: 'seo:lang:en' },
      { text: 'UA', data: 'seo:lang:uk' },
      { text: '⬅ Back', data: 'seo:page:home' },
    ])
  })
})

describe('buildSeoValuePrompt', () => {
  it('shows the current text and asks for the new one', () => {
    const r = buildSeoValuePrompt('title', 'uk', 'ONVORX')
    expect(r.text).toContain('ONVORX')
    expect(r.text).toContain('UA')
  })
})

describe('buildSaveFailed', () => {
  it('offers a Back button to the given callback', () => {
    const r = buildSaveFailed('content:section:hero')
    expect(r.text).toBe('Could not save — please try again.')
    expect(readButtons(r)).toEqual([{ text: '⬅ Back', data: 'content:section:hero' }])
  })
})
```

Update the existing imports at the top of `api/_lib/telegramMenu.test.ts` to also pull in the new function names:

```ts
import {
  buildMainMenu,
  buildStubReply,
  buildNoAccessReply,
  buildAdminsList,
  buildAddIdPrompt,
  buildRolePrompt,
  buildLabelPrompt,
  buildRemoveConfirm,
  canAccessSection,
  buildContentList,
  buildSectionDetail,
  sectionFieldValue,
  buildContentFieldLangPrompt,
  buildContentValuePrompt,
  buildSeoList,
  buildSeoDetail,
  buildSeoFieldLangPrompt,
  buildSeoValuePrompt,
  buildSaveFailed,
} from './telegramMenu'
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run api/_lib/telegramMenu.test.ts`
Expected: FAIL — `buildContentList` (and the other new names) are not exported yet; the changed `buildMainMenu` assertion also fails (`stub:content` ≠ `content:list`).

- [ ] **Step 3: Implement the changes in `api/_lib/telegramMenu.ts`**

Replace the existing `MENU_ITEMS`/`buildMainMenu` block:

```ts
const MENU_ITEMS: { key: string; label: string; roles: Role[]; callback: string }[] = [
  { key: 'content', label: 'Content', roles: ['owner', 'content_manager'], callback: 'content:list' },
  { key: 'projects', label: 'Projects', roles: ['owner', 'content_manager'], callback: 'stub:projects' },
  { key: 'services', label: 'Services', roles: ['owner', 'content_manager'], callback: 'stub:services' },
  { key: 'seo', label: 'SEO', roles: ['owner', 'content_manager'], callback: 'seo:list' },
  { key: 'requests', label: 'Requests', roles: ['owner', 'sales_manager'], callback: 'stub:requests' },
  { key: 'admins', label: 'Administrators', roles: ['owner'], callback: 'menu:admins' },
]

export function buildMainMenu(role: Role): BotReply {
  const items = MENU_ITEMS.filter((m) => m.roles.includes(role))
  const kb = new InlineKeyboard()
  items.forEach((m, i) => {
    kb.text(m.label, m.callback)
    if (i < items.length - 1) kb.row()
  })
  return { text: 'ONVORX admin — choose a section:', keyboard: kb }
}
```

(`canAccessSection` below it is unchanged — it still keys off `MENU_ITEMS[].key`/`.roles`, not `.callback`.)

Add the import and all the new builders at the end of the file:

```ts
import type { ContentField, SeoField, SectionRecord, SeoRecord } from './telegramContent'
// (add next to the existing `InlineKeyboard`/`telegramAdmins` imports at the top of the file)

// ---- Content ----

const CONTENT_SECTIONS: { key: string; label: string }[] = [
  { key: 'hero', label: 'Hero' },
  { key: 'services', label: 'Services' },
  { key: 'projects', label: 'Projects' },
  { key: 'howWork', label: 'How We Work' },
  { key: 'about', label: 'About' },
  { key: 'cta', label: 'CTA' },
]

const CTA_SECTIONS = ['hero', 'cta']

const CONTENT_FIELD_LABEL: Record<ContentField, string> = {
  eyebrow: 'Eyebrow',
  title: 'Title',
  body: 'Body',
  ctaLabel: 'CTA label',
}

function sectionFieldsFor(key: string): ContentField[] {
  return CTA_SECTIONS.includes(key) ? ['eyebrow', 'title', 'body', 'ctaLabel'] : ['eyebrow', 'title', 'body']
}

export function sectionFieldValue(record: SectionRecord, field: ContentField): { en: string; uk: string } {
  return field === 'ctaLabel' ? (record.ctaLabel ?? { en: '', uk: '' }) : record[field]
}

export function buildContentList(): BotReply {
  const kb = new InlineKeyboard()
  CONTENT_SECTIONS.forEach((s) => kb.text(s.label, `content:section:${s.key}`).row())
  kb.text('⬅ Back', 'menu:main')
  return { text: 'Content — choose a block:', keyboard: kb }
}

export function buildSectionDetail(record: SectionRecord, opts: { saved?: boolean } = {}): BotReply {
  const fields = sectionFieldsFor(record.key)
  const lines = fields.map((f) => {
    const v = sectionFieldValue(record, f)
    return `${CONTENT_FIELD_LABEL[f]} — EN: ${v.en || '(empty)'} / UA: ${v.uk || '(empty)'}`
  })
  const kb = new InlineKeyboard()
  fields.forEach((f) => kb.text(CONTENT_FIELD_LABEL[f], `content:field:${f}`).row())
  kb.text('⬅ Back', 'content:list')
  const prefix = opts.saved ? 'Saved.\n\n' : ''
  return { text: `${prefix}${record.key}\n${lines.join('\n')}`, keyboard: kb }
}

export function buildContentFieldLangPrompt(key: string, field: ContentField): BotReply {
  const kb = new InlineKeyboard()
    .text('EN', 'content:lang:en')
    .text('UA', 'content:lang:uk')
    .row()
    .text('⬅ Back', `content:section:${key}`)
  return { text: `Edit ${CONTENT_FIELD_LABEL[field]} — choose a language:`, keyboard: kb }
}

export function buildContentValuePrompt(field: ContentField, lang: 'en' | 'uk', currentText: string): BotReply {
  const langLabel = lang === 'en' ? 'EN' : 'UA'
  return {
    text: `Current ${CONTENT_FIELD_LABEL[field]} (${langLabel}):\n${currentText || '(empty)'}\n\nSend the new ${langLabel} text.`,
  }
}

// ---- SEO ----

const SEO_PAGES: { key: string; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'services', label: 'Services' },
  { key: 'projects', label: 'Projects' },
  { key: 'about', label: 'About' },
  { key: 'web-development', label: 'Web Development' },
  { key: 'support', label: 'Support' },
  { key: 'business-analysis', label: 'Business Analysis' },
  { key: 'google-ads', label: 'Google Ads' },
]

const SEO_FIELD_LABEL: Record<SeoField, string> = { title: 'Title', description: 'Description' }
const SEO_FIELDS: SeoField[] = ['title', 'description']

export function buildSeoList(): BotReply {
  const kb = new InlineKeyboard()
  SEO_PAGES.forEach((p) => kb.text(p.label, `seo:page:${p.key}`).row())
  kb.text('⬅ Back', 'menu:main')
  return { text: 'SEO — choose a page:', keyboard: kb }
}

export function buildSeoDetail(record: SeoRecord, opts: { saved?: boolean } = {}): BotReply {
  const lines = SEO_FIELDS.map(
    (f) => `${SEO_FIELD_LABEL[f]} — EN: ${record[f].en || '(empty)'} / UA: ${record[f].uk || '(empty)'}`,
  )
  const kb = new InlineKeyboard()
  SEO_FIELDS.forEach((f) => kb.text(SEO_FIELD_LABEL[f], `seo:field:${f}`).row())
  kb.text('⬅ Back', 'seo:list')
  const prefix = opts.saved ? 'Saved.\n\n' : ''
  return { text: `${prefix}${record.pageKey}\n${lines.join('\n')}`, keyboard: kb }
}

export function buildSeoFieldLangPrompt(pageKey: string, field: SeoField): BotReply {
  const kb = new InlineKeyboard()
    .text('EN', 'seo:lang:en')
    .text('UA', 'seo:lang:uk')
    .row()
    .text('⬅ Back', `seo:page:${pageKey}`)
  return { text: `Edit ${SEO_FIELD_LABEL[field]} — choose a language:`, keyboard: kb }
}

export function buildSeoValuePrompt(field: SeoField, lang: 'en' | 'uk', currentText: string): BotReply {
  const langLabel = lang === 'en' ? 'EN' : 'UA'
  return {
    text: `Current ${SEO_FIELD_LABEL[field]} (${langLabel}):\n${currentText || '(empty)'}\n\nSend the new ${langLabel} text.`,
  }
}

export function buildSaveFailed(backCallback: string): BotReply {
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
git commit -m "feat(telegram-bot): Content & SEO menu builders (list/detail/field/lang prompts)"
```

---

## Task 3: Wire Content & SEO into the dispatch state machine

**Files:**
- Modify: `api/_lib/adminContentHandler.ts` (export the existing private `defaultDeps`)
- Modify: `api/_lib/types.ts` — no new interface needed, `AuthEnv` already exists; this task only imports it into the files below
- Modify: `api/_lib/telegramBot.ts` (widen its local `Env` type alias)
- Modify: `api/_lib/telegramHandler.ts` (widen its local `Env` type alias)
- Modify: `api/telegram/webhook.ts` (pass `ADMIN_SESSION_SECRET` through)
- Modify: `api/_lib/telegramDispatch.ts` (the state machine — the core of this task)
- Modify: `api/_lib/telegramDispatch.test.ts` (extensive new coverage)

**Interfaces:**
- Consumes: `TelegramContentDeps`, `defaultTelegramContentDeps`, `SectionRecord`, `SeoRecord`, `ContentField`, `SeoField` (Task 1); `buildContentList`, `buildSectionDetail`, `sectionFieldValue`, `buildContentFieldLangPrompt`, `buildContentValuePrompt`, `buildSeoList`, `buildSeoDetail`, `buildSeoFieldLangPrompt`, `buildSeoValuePrompt`, `buildSaveFailed` (Task 2); `signToken` from `api/_lib/session.ts` (already exists — Plan 1 imported `safeEqual` from the same file); `handleAdminContent`, `type AdminContentDeps` from `api/_lib/adminContentHandler.ts` (already exists, exported type).
- Produces: `DispatchDeps` grows two fields (`content`, `adminContent`) — nothing outside this plan consumes `DispatchDeps` directly except `telegramBot.ts`, which already passes `defaultDispatchDeps` through untouched.

### Why this task also touches 4 small files besides the dispatch file

Calling `handleAdminContent` requires signing an `admin_session` cookie via `signToken(env.ADMIN_SESSION_SECRET)` — so the `Env` type threaded through `telegramDispatch.ts`, `telegramBot.ts`, and `telegramHandler.ts` (currently `TelegramEnv & SupabaseAdminEnv` in all three, each declared as its own local alias) must widen to include `AuthEnv`, and `api/telegram/webhook.ts` must actually read `process.env.ADMIN_SESSION_SECRET` into the object it builds. This is pure plumbing — no new behavior — so it rides along with the task that needs it rather than getting its own review gate.

- [ ] **Step 1: Export `adminContentHandler.ts`'s default deps**

In `api/_lib/adminContentHandler.ts`, change:

```ts
const defaultDeps: AdminContentDeps = {
```

to:

```ts
export const defaultAdminContentDeps: AdminContentDeps = {
```

And update its two internal uses (the `handleAdminContent` function signature's default parameter) from `defaultDeps` to `defaultAdminContentDeps`:

```ts
export async function handleAdminContent(
  input: { method: string; cookieHeader: string | undefined; body: unknown },
  env: Env,
  deps: AdminContentDeps = defaultAdminContentDeps,
): Promise<HandlerResult> {
```

Run: `npx vitest run api/_lib/adminContentHandler.test.ts`
Expected: PASS, unchanged — that test file never referenced the old private name.

- [ ] **Step 2: Widen the `Env` type in `telegramBot.ts` and `telegramHandler.ts`**

In `api/_lib/telegramBot.ts`, change:

```ts
import type { SupabaseAdminEnv, TelegramEnv } from './types'
```
```ts
type Env = TelegramEnv & SupabaseAdminEnv
```

to:

```ts
import type { AuthEnv, SupabaseAdminEnv, TelegramEnv } from './types'
```
```ts
type Env = TelegramEnv & SupabaseAdminEnv & AuthEnv
```

In `api/_lib/telegramHandler.ts`, change:

```ts
type Env = TelegramEnv & SupabaseAdminEnv
```

to:

```ts
type Env = TelegramEnv & SupabaseAdminEnv & AuthEnv
```

(`AuthEnv` needs adding to that file's existing `import type { HandlerResult, SupabaseAdminEnv, TelegramEnv } from './types'` line — becomes `import type { AuthEnv, HandlerResult, SupabaseAdminEnv, TelegramEnv } from './types'`.)

- [ ] **Step 3: Thread `ADMIN_SESSION_SECRET` through the webhook route**

In `api/telegram/webhook.ts`, add one line to the env object literal:

```ts
  const result = await handleTelegramWebhook(
    { secretHeader, body: req.body },
    {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_ADMIN_IDS: process.env.TELEGRAM_ADMIN_IDS,
      TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
    },
  )
```

Run: `npm run typecheck:api`
Expected: still 0 errors — confirms Steps 1-3 compile before the state-machine work begins.

- [ ] **Step 4: Write the failing tests for the dispatch changes**

Replace the top of `api/_lib/telegramDispatch.test.ts` (imports and `makeDeps`/fixtures) with:

```ts
import { describe, it, expect, vi } from 'vitest'
import { dispatch } from './telegramDispatch'
import type { BotCtx, DispatchDeps } from './telegramDispatch'
import type { TelegramAdminsDeps, ManagerRecord } from './telegramAdmins'
import type { TelegramSessionsDeps, TelegramState } from './telegramSessions'
import type { TelegramContentDeps, SectionRecord, SeoRecord } from './telegramContent'
import type { AdminContentDeps } from './adminContentHandler'

const ENV = { TELEGRAM_ADMIN_IDS: '111', ADMIN_SESSION_SECRET: 'a-long-enough-test-secret-value' }
const OWNER_ID = 111
const MANAGER: ManagerRecord = {
  telegramId: 42, role: 'content_manager', label: 'Anna', addedBy: OWNER_ID, createdAt: '2026-01-01T00:00:00Z',
}
const SALES: ManagerRecord = {
  telegramId: 77, role: 'sales_manager', label: 'Sam', addedBy: OWNER_ID, createdAt: '2026-01-01T00:00:00Z',
}

const L = (en: string, uk: string) => ({ en, uk })

const HERO: SectionRecord = {
  key: 'hero',
  eyebrow: L('Web solutions', 'Веб-рішення'),
  title: L('Built around your business', 'Створено під ваш бізнес'),
  body: L('We design and build.', 'Ми проєктуємо і будуємо.'),
  ctaLabel: L('Request an estimate', 'Отримати оцінку'),
}
const ABOUT: SectionRecord = {
  key: 'about',
  eyebrow: L('About', 'Про нас'),
  title: L('Who we are', 'Хто ми'),
  body: L('A small team.', 'Невелика команда.'),
  ctaLabel: null,
}
const HOME_SEO: SeoRecord = {
  pageKey: 'home',
  title: L('ONVORX', 'ONVORX'),
  description: L('Web solutions built around your business.', 'Веб-рішення під ваш бізнес.'),
}

function applySectionPatch(record: SectionRecord, patch: Record<string, unknown>): SectionRecord {
  const next = { ...record }
  if ('eyebrow' in patch) next.eyebrow = patch.eyebrow as SectionRecord['eyebrow']
  if ('title' in patch) next.title = patch.title as SectionRecord['title']
  if ('body' in patch) next.body = patch.body as SectionRecord['body']
  if ('cta_label' in patch) next.ctaLabel = patch.cta_label as SectionRecord['ctaLabel']
  return next
}

function applySeoPatch(record: SeoRecord, patch: Record<string, unknown>): SeoRecord {
  return { ...record, ...(patch as Partial<SeoRecord>) }
}

function makeDeps(initialState: TelegramState = { screen: 'main_menu' }) {
  let state = initialState
  let managers: ManagerRecord[] = []
  let sections: Record<string, SectionRecord> = { hero: { ...HERO }, about: { ...ABOUT } }
  let seoPages: Record<string, SeoRecord> = { home: { ...HOME_SEO } }

  const admins: TelegramAdminsDeps = {
    findManager: vi.fn(async (id: number) => managers.find((m) => m.telegramId === id) ?? null),
    listManagers: vi.fn(async () => managers),
    addManager: vi.fn(async (record) => {
      managers = [...managers, { ...record, createdAt: '2026-01-01T00:00:00Z' }]
      return { error: null }
    }),
    removeManager: vi.fn(async (id: number) => {
      managers = managers.filter((m) => m.telegramId !== id)
      return { error: null }
    }),
  }
  const sessions: TelegramSessionsDeps = {
    load: vi.fn(async () => state),
    save: vi.fn(async (_chatId, next) => {
      state = next
    }),
  }
  const content: TelegramContentDeps = {
    getSection: vi.fn(async (key: string) => sections[key] ?? null),
    getSeo: vi.fn(async (pageKey: string) => seoPages[pageKey] ?? null),
  }
  const adminContent: AdminContentDeps = {
    updateSection: vi.fn(async (key: string, patch: Record<string, unknown>) => {
      if (!sections[key]) return { error: 'not_found' }
      sections[key] = applySectionPatch(sections[key], patch)
      return { error: null }
    }),
    updateSeo: vi.fn(async (pageKey: string, patch: Record<string, unknown>) => {
      if (!seoPages[pageKey]) return { error: 'not_found' }
      seoPages[pageKey] = applySeoPatch(seoPages[pageKey], patch)
      return { error: null }
    }),
    resetAll: vi.fn(async () => ({ error: null })),
  }
  const deps: DispatchDeps = { admins, sessions, content, adminContent }
  return {
    deps, admins, sessions, content, adminContent,
    getState: () => state,
    getManagers: () => managers,
    setManagers: (m: ManagerRecord[]) => (managers = m),
    getSections: () => sections,
    getSeoPages: () => seoPages,
  }
}

function makeCtx(overrides: Partial<BotCtx>): BotCtx {
  return {
    chatId: 1,
    fromId: OWNER_ID,
    reply: vi.fn(async () => {}),
    answerCallback: vi.fn(async () => {}),
    ...overrides,
  }
}
```

Keep every existing `describe` block in the file as-is (they already use `makeDeps`/`makeCtx` and only needed the fixtures above to grow), **except** the `'stub:content replies with a coming-soon message for anyone with access'` test inside `describe('dispatch — stub sections', ...)` — `content` is no longer a stub, so replace that one test with:

```ts
  it('stub:projects replies with a coming-soon message for anyone with access', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ callbackData: 'stub:projects' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.answerCallback).toHaveBeenCalled()
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'projects management is coming in a later update.' })
  })
```

Then append these new `describe` blocks at the end of the file:

```ts
describe('dispatch — Content, owner + content_manager', () => {
  it('a sales_manager cannot open content:list', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([SALES])
    const ctx = makeCtx({ fromId: 77, callbackData: 'content:list' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: "You don't have access to this bot." })
  })

  it('owner opens content:list and sees the six blocks', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ callbackData: 'content:list' })
    await dispatch(ctx, ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe('Content — choose a block:')
  })

  it('a content_manager opens a section detail and sees current EN/UA text', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([MANAGER])
    const ctx = makeCtx({ fromId: 42, callbackData: 'content:section:hero' })
    await dispatch(ctx, ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Built around your business')
    expect(reply.text).toContain('Створено під ваш бізнес')
  })

  it('an unknown section key shows an error and falls back to the list', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ callbackData: 'content:section:bogus' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Could not load that section — please try again.' })
    const listReply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[1][0]
    expect(listReply.text).toBe('Content — choose a block:')
  })

  it('full edit flow: section -> field -> language -> new text -> saved, other language untouched', async () => {
    const { deps, getSections } = makeDeps()
    await dispatch(makeCtx({ callbackData: 'content:section:hero' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'content:field:title' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'content:lang:en' }), ENV, deps)
    const finalCtx = makeCtx({ text: 'New English title' })
    await dispatch(finalCtx, ENV, deps)

    expect(getSections().hero.title).toEqual({ en: 'New English title', uk: 'Створено під ваш бізнес' })
    const reply = (finalCtx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Saved.')
    expect(reply.text).toContain('New English title')
  })

  it('editing UA preserves the existing EN text', async () => {
    const { deps, getSections } = makeDeps()
    await dispatch(makeCtx({ callbackData: 'content:section:hero' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'content:field:body' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'content:lang:uk' }), ENV, deps)
    await dispatch(makeCtx({ text: 'Новий текст' }), ENV, deps)

    expect(getSections().hero.body).toEqual({ en: 'We design and build.', uk: 'Новий текст' })
  })

  it('editing the CTA label on hero works and merges correctly', async () => {
    const { deps, getSections } = makeDeps()
    await dispatch(makeCtx({ callbackData: 'content:section:hero' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'content:field:ctaLabel' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'content:lang:en' }), ENV, deps)
    await dispatch(makeCtx({ text: 'Get a quote' }), ENV, deps)

    expect(getSections().hero.ctaLabel).toEqual({ en: 'Get a quote', uk: 'Отримати оцінку' })
  })

  it('about has no ctaLabel button, so its detail view never offers editing a null CTA label', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ callbackData: 'content:section:about' })
    await dispatch(ctx, ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    const buttonTexts = (reply.keyboard.inline_keyboard as { text: string }[][]).flat().map((b) => b.text)
    expect(buttonTexts).not.toContain('CTA label')
  })

  it('a stale field tap with no section chosen yet shows "session out of sync"', async () => {
    const { deps } = makeDeps({ screen: 'main_menu' })
    const ctx = makeCtx({ callbackData: 'content:field:title' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Session out of sync — please /start and try again.' })
  })

  it('a save failure shows an error with a Back button and does not change the record', async () => {
    const { deps, adminContent, getSections } = makeDeps()
    ;(adminContent.updateSection as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: 'boom' })
    await dispatch(makeCtx({ callbackData: 'content:section:hero' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'content:field:title' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'content:lang:en' }), ENV, deps)
    const finalCtx = makeCtx({ text: 'This should not stick' })
    await dispatch(finalCtx, ENV, deps)

    expect(getSections().hero.title).toEqual(HERO.title)
    expect(finalCtx.reply).toHaveBeenCalledWith({
      text: 'Could not save — please try again.',
      keyboard: expect.anything(),
    })
  })

  it('replies with a config error and does not call handleAdminContent when ADMIN_SESSION_SECRET is missing', async () => {
    const { deps, adminContent } = makeDeps()
    const badEnv = { TELEGRAM_ADMIN_IDS: '111' }
    await dispatch(makeCtx({ callbackData: 'content:section:hero' }), badEnv, deps)
    await dispatch(makeCtx({ callbackData: 'content:field:title' }), badEnv, deps)
    await dispatch(makeCtx({ callbackData: 'content:lang:en' }), badEnv, deps)
    const finalCtx = makeCtx({ text: 'Anything' })
    await dispatch(finalCtx, badEnv, deps)

    expect(adminContent.updateSection).not.toHaveBeenCalled()
    expect(finalCtx.reply).toHaveBeenCalledWith({ text: 'Bot is not fully configured — contact the site owner.' })
  })
})

describe('dispatch — SEO, owner + content_manager', () => {
  it('a sales_manager cannot open seo:list', async () => {
    const { deps, setManagers } = makeDeps()
    setManagers([SALES])
    const ctx = makeCtx({ fromId: 77, callbackData: 'seo:list' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: "You don't have access to this bot." })
  })

  it('owner opens seo:list and sees all eight pages', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ callbackData: 'seo:list' })
    await dispatch(ctx, ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe('SEO — choose a page:')
  })

  it('full edit flow: page -> field -> language -> new text -> saved, other language untouched', async () => {
    const { deps, getSeoPages } = makeDeps()
    await dispatch(makeCtx({ callbackData: 'seo:page:home' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'seo:field:description' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'seo:lang:en' }), ENV, deps)
    const finalCtx = makeCtx({ text: 'New English description' })
    await dispatch(finalCtx, ENV, deps)

    expect(getSeoPages().home.description).toEqual({
      en: 'New English description',
      uk: 'Веб-рішення під ваш бізнес.',
    })
    const reply = (finalCtx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toContain('Saved.')
  })

  it('an unknown page key shows an error and falls back to the list', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ callbackData: 'seo:page:bogus' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Could not load that page — please try again.' })
  })

  it('a stale field tap with no page chosen yet shows "session out of sync"', async () => {
    const { deps } = makeDeps({ screen: 'main_menu' })
    const ctx = makeCtx({ callbackData: 'seo:field:title' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: 'Session out of sync — please /start and try again.' })
  })

  it('a save failure shows an error with a Back button and does not change the record', async () => {
    const { deps, adminContent, getSeoPages } = makeDeps()
    ;(adminContent.updateSeo as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ error: 'boom' })
    await dispatch(makeCtx({ callbackData: 'seo:page:home' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'seo:field:title' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'seo:lang:uk' }), ENV, deps)
    const finalCtx = makeCtx({ text: 'Nope' })
    await dispatch(finalCtx, ENV, deps)

    expect(getSeoPages().home.title).toEqual(HOME_SEO.title)
    expect(finalCtx.reply).toHaveBeenCalledWith({
      text: 'Could not save — please try again.',
      keyboard: expect.anything(),
    })
  })
})
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `npx vitest run api/_lib/telegramDispatch.test.ts`
Expected: FAIL — `content`/`adminContent` are missing from `DispatchDeps`, and none of the `content:*`/`seo:*` handling exists yet.

- [ ] **Step 6: Implement the changes in `api/_lib/telegramDispatch.ts`**

Update the imports and type/deps declarations at the top of the file:

```ts
import type { AuthEnv, SupabaseAdminEnv, TelegramEnv } from './types'
import {
  resolveRole,
  defaultTelegramAdminsDeps,
  MANAGER_ROLES,
  type TelegramAdminsDeps,
  type ManagerRole,
  type Role,
} from './telegramAdmins'
import {
  defaultTelegramSessionsDeps,
  MAIN_MENU_STATE,
  type TelegramSessionsDeps,
} from './telegramSessions'
import {
  defaultTelegramContentDeps,
  type TelegramContentDeps,
  type ContentField,
  type SeoField,
} from './telegramContent'
import { handleAdminContent, defaultAdminContentDeps, type AdminContentDeps } from './adminContentHandler'
import { signToken } from './session'
import * as menu from './telegramMenu'

export interface BotCtx {
  chatId: number
  fromId: number
  text?: string
  callbackData?: string
  reply: (r: menu.BotReply) => Promise<void>
  answerCallback: () => Promise<void>
}

export interface DispatchDeps {
  admins: TelegramAdminsDeps
  sessions: TelegramSessionsDeps
  content: TelegramContentDeps
  adminContent: AdminContentDeps
}

export const defaultDispatchDeps: DispatchDeps = {
  admins: defaultTelegramAdminsDeps,
  sessions: defaultTelegramSessionsDeps,
  content: defaultTelegramContentDeps,
  adminContent: defaultAdminContentDeps,
}

type Env = TelegramEnv & SupabaseAdminEnv & AuthEnv
```

Add this helper near the top of the file, after the type/deps declarations:

```ts
function adminCookieHeader(env: Env): string | null {
  if (!env.ADMIN_SESSION_SECRET) return null
  return `admin_session=${signToken(env.ADMIN_SESSION_SECRET)}`
}
```

Insert the Content and SEO routing into `handleCallback`, right after the existing `if (data === 'menu:main') { ... }` block and **before** the existing `if (data.startsWith('stub:')) { ... }` block:

```ts
  if (data.startsWith('content:')) {
    if (!menu.canAccessSection(role, 'content')) {
      await ctx.reply(menu.buildNoAccessReply())
      return
    }
    await handleContentCallback(ctx, data, env, deps)
    return
  }

  if (data.startsWith('seo:')) {
    if (!menu.canAccessSection(role, 'seo')) {
      await ctx.reply(menu.buildNoAccessReply())
      return
    }
    await handleSeoCallback(ctx, data, env, deps)
    return
  }
```

Add these new functions after `showAdminsList` (or anywhere at module scope outside `handleCallback`):

```ts
async function showContentList(ctx: BotCtx, env: Env, deps: DispatchDeps): Promise<void> {
  await deps.sessions.save(ctx.chatId, { screen: 'content_list' }, env)
  await ctx.reply(menu.buildContentList())
}

async function showSectionDetail(
  ctx: BotCtx, env: Env, deps: DispatchDeps, key: string, saved = false,
): Promise<void> {
  const record = await deps.content.getSection(key, env)
  if (!record) {
    await ctx.reply({ text: 'Could not load that section — please try again.' })
    await showContentList(ctx, env, deps)
    return
  }
  await deps.sessions.save(ctx.chatId, { screen: 'content_detail', data: { key } }, env)
  await ctx.reply(menu.buildSectionDetail(record, { saved }))
}

async function handleContentCallback(ctx: BotCtx, data: string, env: Env, deps: DispatchDeps): Promise<void> {
  if (data === 'content:list') {
    await showContentList(ctx, env, deps)
    return
  }
  if (data.startsWith('content:section:')) {
    await showSectionDetail(ctx, env, deps, data.slice('content:section:'.length))
    return
  }
  if (data.startsWith('content:field:')) {
    const field = data.slice('content:field:'.length) as ContentField
    const state = await deps.sessions.load(ctx.chatId, env)
    const key = state.data?.key as string | undefined
    if (!key) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await deps.sessions.save(ctx.chatId, { screen: 'content_lang', data: { key, field } }, env)
    await ctx.reply(menu.buildContentFieldLangPrompt(key, field))
    return
  }
  if (data.startsWith('content:lang:')) {
    const lang = data.slice('content:lang:'.length) as 'en' | 'uk'
    const state = await deps.sessions.load(ctx.chatId, env)
    const key = state.data?.key as string | undefined
    const field = state.data?.field as ContentField | undefined
    if (!key || !field) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    const record = await deps.content.getSection(key, env)
    if (!record) {
      await ctx.reply({ text: 'Could not load that section — please try again.' })
      await showContentList(ctx, env, deps)
      return
    }
    const current = menu.sectionFieldValue(record, field)
    await deps.sessions.save(ctx.chatId, { screen: 'content_value', data: { key, field, lang } }, env)
    await ctx.reply(menu.buildContentValuePrompt(field, lang, current[lang]))
  }
}

async function saveContentField(
  ctx: BotCtx, env: Env, deps: DispatchDeps, key: string, field: ContentField, lang: 'en' | 'uk', text: string,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const record = await deps.content.getSection(key, env)
  if (!record) {
    await ctx.reply({ text: 'Could not load that section — please try again.' })
    await showContentList(ctx, env, deps)
    return
  }
  const current = menu.sectionFieldValue(record, field)
  const nextValue = lang === 'en' ? { en: text, uk: current.uk } : { en: current.en, uk: text }
  const result = await handleAdminContent(
    { method: 'PUT', cookieHeader, body: { kind: 'section', key, patch: { [field]: nextValue } } },
    env,
    deps.adminContent,
  )
  if (result.status !== 200) {
    await ctx.reply(menu.buildSaveFailed(`content:section:${key}`))
    return
  }
  await showSectionDetail(ctx, env, deps, key, true)
}

async function showSeoList(ctx: BotCtx, env: Env, deps: DispatchDeps): Promise<void> {
  await deps.sessions.save(ctx.chatId, { screen: 'seo_list' }, env)
  await ctx.reply(menu.buildSeoList())
}

async function showSeoDetail(
  ctx: BotCtx, env: Env, deps: DispatchDeps, pageKey: string, saved = false,
): Promise<void> {
  const record = await deps.content.getSeo(pageKey, env)
  if (!record) {
    await ctx.reply({ text: 'Could not load that page — please try again.' })
    await showSeoList(ctx, env, deps)
    return
  }
  await deps.sessions.save(ctx.chatId, { screen: 'seo_detail', data: { pageKey } }, env)
  await ctx.reply(menu.buildSeoDetail(record, { saved }))
}

async function handleSeoCallback(ctx: BotCtx, data: string, env: Env, deps: DispatchDeps): Promise<void> {
  if (data === 'seo:list') {
    await showSeoList(ctx, env, deps)
    return
  }
  if (data.startsWith('seo:page:')) {
    await showSeoDetail(ctx, env, deps, data.slice('seo:page:'.length))
    return
  }
  if (data.startsWith('seo:field:')) {
    const field = data.slice('seo:field:'.length) as SeoField
    const state = await deps.sessions.load(ctx.chatId, env)
    const pageKey = state.data?.pageKey as string | undefined
    if (!pageKey) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    await deps.sessions.save(ctx.chatId, { screen: 'seo_lang', data: { pageKey, field } }, env)
    await ctx.reply(menu.buildSeoFieldLangPrompt(pageKey, field))
    return
  }
  if (data.startsWith('seo:lang:')) {
    const lang = data.slice('seo:lang:'.length) as 'en' | 'uk'
    const state = await deps.sessions.load(ctx.chatId, env)
    const pageKey = state.data?.pageKey as string | undefined
    const field = state.data?.field as SeoField | undefined
    if (!pageKey || !field) {
      await ctx.reply({ text: 'Session out of sync — please /start and try again.' })
      return
    }
    const record = await deps.content.getSeo(pageKey, env)
    if (!record) {
      await ctx.reply({ text: 'Could not load that page — please try again.' })
      await showSeoList(ctx, env, deps)
      return
    }
    await deps.sessions.save(ctx.chatId, { screen: 'seo_value', data: { pageKey, field, lang } }, env)
    await ctx.reply(menu.buildSeoValuePrompt(field, lang, record[field][lang]))
  }
}

async function saveSeoField(
  ctx: BotCtx, env: Env, deps: DispatchDeps, pageKey: string, field: SeoField, lang: 'en' | 'uk', text: string,
): Promise<void> {
  const cookieHeader = adminCookieHeader(env)
  if (!cookieHeader) {
    await ctx.reply({ text: 'Bot is not fully configured — contact the site owner.' })
    return
  }
  const record = await deps.content.getSeo(pageKey, env)
  if (!record) {
    await ctx.reply({ text: 'Could not load that page — please try again.' })
    await showSeoList(ctx, env, deps)
    return
  }
  const current = record[field]
  const nextValue = lang === 'en' ? { en: text, uk: current.uk } : { en: current.en, uk: text }
  const result = await handleAdminContent(
    { method: 'PUT', cookieHeader, body: { kind: 'seo', pageKey, patch: { [field]: nextValue } } },
    env,
    deps.adminContent,
  )
  if (result.status !== 200) {
    await ctx.reply(menu.buildSaveFailed(`seo:page:${pageKey}`))
    return
  }
  await showSeoDetail(ctx, env, deps, pageKey, true)
}
```

Finally, update `handleText` so `content_value`/`seo_value` are reachable by `content_manager` (not just `owner`), while everything else keeps the existing owner-only gate:

```ts
async function handleText(
  ctx: BotCtx,
  text: string,
  role: Role,
  env: Env,
  deps: DispatchDeps,
): Promise<void> {
  const state = await deps.sessions.load(ctx.chatId, env)

  if (state.screen === 'content_value') {
    if (!menu.canAccessSection(role, 'content')) {
      await ctx.reply(TEXT_FALLBACK_REPLY)
      return
    }
    const { key, field, lang } = state.data as { key: string; field: ContentField; lang: 'en' | 'uk' }
    await saveContentField(ctx, env, deps, key, field, lang, text)
    return
  }

  if (state.screen === 'seo_value') {
    if (!menu.canAccessSection(role, 'seo')) {
      await ctx.reply(TEXT_FALLBACK_REPLY)
      return
    }
    const { pageKey, field, lang } = state.data as { pageKey: string; field: SeoField; lang: 'en' | 'uk' }
    await saveSeoField(ctx, env, deps, pageKey, field, lang, text)
    return
  }

  if (role !== 'owner') {
    await ctx.reply(TEXT_FALLBACK_REPLY)
    return
  }

  if (state.screen === 'admins_add_id') {
    const telegramId = Number(text)
    if (!Number.isInteger(telegramId) || telegramId <= 0) {
      await ctx.reply({ text: 'That does not look like a valid Telegram ID. Try again, or /start to cancel.' })
      return
    }
    await deps.sessions.save(ctx.chatId, { screen: 'admins_add_role', data: { telegramId } }, env)
    await ctx.reply(menu.buildRolePrompt())
    return
  }

  if (state.screen === 'admins_add_label') {
    await finishAddManager(ctx, env, deps, text)
    return
  }

  await ctx.reply(TEXT_FALLBACK_REPLY)
}
```

(This is the same body as before, with the two new `if (state.screen === ...)` blocks inserted at the top, before the existing `if (role !== 'owner')` gate — the `admins_add_id`/`admins_add_label` branches and the closing `TEXT_FALLBACK_REPLY` are unchanged, just moved after the gate as they already were.)

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run api/_lib/telegramDispatch.test.ts`
Expected: PASS (all tests, old and new).

- [ ] **Step 8: Run the full test suite, typecheck, and lint**

Run: `npm test`
Expected: all test files pass (this plan touches shared files — `adminContentHandler.ts`'s test, `telegramBot.test.ts`, `telegramHandler.test.ts` should all still be green).

Run: `npm run typecheck:api`
Expected: 0 errors.

Run: `npm run build`
Expected: succeeds (`tsc -b && tsc -p tsconfig.api.json && vite build`).

Run: `npm run lint`
Expected: 0 errors (pre-existing warnings elsewhere are unrelated and unchanged).

- [ ] **Step 9: Commit**

```bash
git add api/_lib/adminContentHandler.ts api/_lib/telegramBot.ts api/_lib/telegramHandler.ts \
        api/telegram/webhook.ts api/_lib/telegramDispatch.ts api/_lib/telegramDispatch.test.ts
git commit -m "feat(telegram-bot): wire Content & SEO editing into the dispatch state machine"
```

---

## Integration verification (live Telegram + live Supabase)

Not a subagent task — the controller runs this after all 3 tasks are merged and pushed, against a real deployed preview, exactly like Plan 1's own live-verification step (and Supabase Plan 4's before it).

1. Push the branch; confirm Vercel deployed it; re-register the webhook against that deployment's domain with `node --env-file=.env.local scripts/telegram-set-webhook.mjs <domain>` (append `?x-vercel-protection-bypass=<VERCEL_PROTECTION_BYPASS_SECRET>` to the domain argument's resulting URL if the deployment has Vercel Deployment Protection enabled for Preview — see the operator note below).
2. As the owner: `/start` → `Content` → confirm the six blocks list, in order: Hero, Services, Projects, How We Work, About, CTA.
3. Tap `Hero` → confirm current Eyebrow/Title/Body/CTA label are shown for both EN and UA, matching what `/admin`'s Content editor shows for the same block.
4. Tap `Title` → `EN` → send new text → confirm "Saved." and the detail view immediately reflects the new EN text with the UA text unchanged.
5. Reload `/admin`'s Content editor for Hero in a browser → confirm the new title is visible there too (proves the write went through the same table the web panel reads).
6. Repeat for a UA edit on a different field (e.g. Body) → confirm the EN half is untouched.
7. Tap `About` → confirm there is no "CTA label" button (only Eyebrow/Title/Body) — `about` is not a CTA section.
8. `/start` → `SEO` → confirm all eight pages list, then open `Home`, edit its Title (EN), confirm "Saved." and the change is visible in `/admin`'s SEO editor.
9. From the second Telegram account added as `content_manager` in Plan 1's own live verification (re-add via Administrators if it was removed): confirm it can do everything in steps 2-8 above.
10. From a `sales_manager` account (or a fresh one added via Administrators for this test, then removed afterward): confirm `Content` and `SEO` do not appear on `/start`'s menu at all, and confirm a stale `content:list` tap (if reachable via an old message) replies "You don't have access to this bot."
11. Directly query Supabase (`site_sections`, `seo_pages`) to spot-check that the rows match exactly what was edited in steps 4-8, and that no unrelated field was clobbered by a save.
12. Revert any test-only text changes made during this verification back to their original content in `/admin`, so the live site isn't left with placeholder copy.

**Operator note carried over from Plan 1's live verification:** if the preview deployment has Vercel Deployment Protection enabled, `setWebhook` needs `VERCEL_PROTECTION_BYPASS_SECRET` appended as a query param (see `scripts/telegram-set-webhook.mjs`'s existing support for this, added during Plan 1's live testing) — otherwise Telegram receives a platform-level 401 before this plan's code ever runs. Also confirm `TELEGRAM_BOT_TOKEN`/`TELEGRAM_ADMIN_IDS`/`TELEGRAM_WEBHOOK_SECRET`/`ADMIN_SESSION_SECRET`/`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are all scoped to **Preview** (not just Production) in Vercel before testing, per the same lesson learned in Plan 1.

---

## Self-review — spec coverage

- Spec §1 Content row (view/edit eyebrow/title/body EN+UA; ctaLabel EN+UA only on hero/cta) → Tasks 1-3, fully implemented.
- Spec §1 SEO row (view/edit title/description EN+UA, nothing else) → Tasks 1-3, fully implemented.
- Spec §1 role table (Content/SEO: owner + content_manager only) → enforced at both the menu level (Task 2's `buildMainMenu`/`canAccessSection`, unchanged from Plan 1) and at every `content:*`/`seo:*` callback and the `content_value`/`seo_value` text step (Task 3), closing the same "stale tap after a role change" gap Plan 1 closed for `stub:*`.
- Spec §2 "auth reuse, not reimplementation" → Task 3's `saveContentField`/`saveSeoField` call the real `handleAdminContent` with a freshly signed `admin_session` cookie; zero direct Supabase writes anywhere in this plan.
- Spec §2 "two-layer access control" → unchanged from Plan 1, this plan adds no new entry point (still the one webhook, still the one secret-header check).
- Spec §5 menu structure, Content/SEO branches (`list → detail → field edit`) → Task 2 (builders) + Task 3 (state machine) match the spec's bullet list exactly, including the short-text-prompt pattern spec §5 calls for ("Telegram has no forms").
- Photo upload, tags, published/featured toggles, card ordering, card deletion → explicitly **not** in this plan (Plan 3's Projects/Services scope, per spec §1's row for Projects/Services).
- Requests (list/status/note/delete) → explicitly **not** in this plan (Plan 4's scope).
- Reset content → never in the bot, per spec §1 — untouched here.

No placeholders remain — every test block in Task 3's Step 4 is a complete, runnable assertion.

### Deferred to Plan 3+ (not in this plan)

- Projects/Services cards: list, order, publish/featured toggles, edit text fields, photo upload with JPEG→WebP conversion, delete with confirmation (Plan 3).
- Requests: list/filter, view, status, note, delete with confirmation (Plan 4).

### Notes for the executor

- Task 3 is the only judgment-heavy task in this plan — it touches 6 files, 4 of which are one-line plumbing changes. If a reviewer questions why those 4 small changes aren't their own task: Task Right-Sizing calls for folding setup/plumbing into the task whose deliverable actually needs it, and none of the 4 are independently meaningful or testable on their own (a widened `Env` type alias with nothing yet reading the new field is not a deliverable).
- The `content:`/`seo:` prefix checks in `handleCallback` run `canAccessSection` **before** dispatching into `handleContentCallback`/`handleSeoCallback`, exactly mirroring how the pre-existing `stub:` branch already re-checks access on every tap (not just at the menu) — this is what makes a demoted user's stale button presses fail closed instead of leaking a stray screen.
- If the final whole-branch reviewer asks why `defaultTelegramContentDeps`'s Supabase round-trip (the actual `select().eq().maybeSingle()` call) has no vitest coverage: point to this same plan's own Task 1 rationale and to Plan 1's `telegramAdmins.ts`/`telegramSessions.ts` precedent — this codebase verifies `getSupabaseAdmin`-backed reads/writes live, not with a hand-rolled Supabase client mock, and this plan's Integration Verification section is where that happens.
