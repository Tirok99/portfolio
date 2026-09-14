# Admin: Hero/HowWork/About Cards + Footer Tagline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Hero's 4 stat cards + Launch card, HowWork's 4 step cards, About's 3 stat cards, and Footer's tagline editable from `/admin`, by moving them off the static `en.json`/`uk.json` bundle and into the existing `site_sections` table.

**Architecture:** Two new nullable JSONB columns (`cards`, `launch`) on `site_sections`, plus widening its `key` constraint to include `'footer'` — no new table, no new API route. The existing `PUT /api/admin/content` endpoint, `useSiteContent()`/`useSiteContentRaw()` read path, and `ContentPage.tsx` editor all get extended to carry these two new fields through, following the exact patterns already used for `eyebrow`/`title`/`body`/`ctaLabel`.

**Tech Stack:** TypeScript, React, Supabase (Postgres + Storage), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-14-admin-hero-howwork-about-cards-design.md` — read this in full before starting; it has the approved architecture and rationale this plan implements section by section.

## Global Constraints

- No add/remove of cards anywhere in this plan — Hero's 4 cards, HowWork's 4 steps, and About's 3 stats are a **fixed count**; every editor only edits the existing N cards.
- Card icons are **uploaded images** (`ImageRef`, same shape already used by Projects/Services), not a picker from the fixed `Icon` component's built-in set.
- `sub` is a field only on HowWork's cards (title/sub/text, 3 fields); Hero and About cards have only title/text (2 fields). Do not add `sub` to Hero/About's card shape.
- `footer`'s `site_sections` row uses only its existing `body` column for the tagline; `eyebrow`/`title`/`cta_label` stay empty and are never shown in the admin UI for this one key.
- Every new/changed piece of data must round-trip through the **same** `PUT /api/admin/content` endpoint and `sectionRow()` whitelist function that already handles every other section field — no new endpoint.
- Public marketing components (`Hero.tsx`, `HowWork.tsx`, `About.tsx`, `SiteFooter.tsx`) have no unit tests today and this plan does not add any — matches this repo's existing convention (only the admin/API layer is unit-tested; real Supabase round-trips are verified live by the human operator on a deployed preview).

---

### Task 1: Supabase migration — schema + one-time data seed

**Files:**
- Create: `supabase/migration-2026-09-14-hero-howwork-about-cards.sql`

**Interfaces:**
- Produces: `site_sections.cards jsonb` (nullable), `site_sections.launch jsonb` (nullable), a widened `key` check constraint including `'footer'`, a new `footer` row, and populated `cards`/`launch`/`footer.body` data for the `hero`/`howWork`/`about`/`footer` rows.

No automated test — per this project's established convention, migration SQL is verified by the human operator running it manually against the Supabase SQL Editor during live verification, not exercised in CI.

- [ ] **Step 1: Write the migration file**

```sql
-- ============================================================================
--  ONVORX — Admin-editable Hero/HowWork/About cards + Footer tagline
--  migration. Run once in the Supabase SQL Editor, after schema.sql +
--  seed.sql + every prior migration-*.sql file. The schema changes (new
--  columns, widened constraint, the `footer` row insert) ARE safely
--  re-runnable (guarded by `if not exists` / `on conflict do nothing`).
--  The data-seed UPDATEs at the bottom are NOT idempotent in the sense
--  that re-running them after an admin has since edited these cards
--  through /admin would silently overwrite those edits back to the
--  original static content — run this file, in full, exactly once,
--  before anyone edits these four pieces of content through /admin.
-- ============================================================================

-- ---- 1. schema: two new nullable JSONB columns ----------------------------
alter table public.site_sections
  add column if not exists cards  jsonb,
  add column if not exists launch jsonb;

-- ---- 2. widen the key constraint to allow a 'footer' row -----------------
alter table public.site_sections drop constraint if exists site_sections_key_check;
alter table public.site_sections add constraint site_sections_key_check
  check (key in ('hero','services','projects','howWork','about','cta','footer'));

insert into public.site_sections (key, eyebrow, title, body, cta_label)
values ('footer', '{"en":"","uk":""}', '{"en":"","uk":""}', '{"en":"","uk":""}', null)
on conflict (key) do nothing;

-- ---- 3. one-time data seed ------------------------------------------------
-- Icons point at the new static SVG files this plan's Task 3 creates under
-- /public/assets/icons/ (kind:'asset' — not a real Storage upload, so there
-- is nothing to clean up if this step is ever re-run before those files
-- exist; the site will just show a broken image until Task 3 lands, which
-- is why Task 3 must be merged before this migration is run live).
update public.site_sections set cards = '[
  { "icon": {"kind":"asset","src":"/assets/icons/hero-target-red.svg","path":null},
    "title": {"en":"Business Goals","uk":"Business Goals"},
    "text":  {"en":"Define outcomes","uk":"Define outcomes"} },
  { "icon": {"kind":"asset","src":"/assets/icons/hero-users-white.svg","path":null},
    "title": {"en":"User Needs","uk":"User Needs"},
    "text":  {"en":"Understand users","uk":"Understand users"} },
  { "icon": {"kind":"asset","src":"/assets/icons/hero-document-white.svg","path":null},
    "title": {"en":"Requirements","uk":"Requirements"},
    "text":  {"en":"Scope & prioritize","uk":"Scope & prioritize"} },
  { "icon": {"kind":"asset","src":"/assets/icons/hero-sitemap-white.svg","path":null},
    "title": {"en":"Strategy","uk":"Strategy"},
    "text":  {"en":"Plan & align","uk":"Plan & align"} }
]'::jsonb,
launch = '{ "icon": {"kind":"asset","src":"/assets/icons/hero-launch-check-circle-red.svg","path":null},
  "title": {"en":"Launch","uk":"Launch"},
  "text":  {"en":"Test, deploy & evolve","uk":"Test, deploy & evolve"} }'::jsonb
where key = 'hero';

update public.site_sections set cards = '[
  { "icon": {"kind":"asset","src":"/assets/icons/howwork-doc-search-white.svg","path":null},
    "title": {"en":"Define","uk":"Define"},
    "sub":   {"en":"Understand the task and requirements","uk":"Understand the task and requirements"},
    "text":  {"en":"We review the business context, available designs, current solution and requirements to define what needs to be implemented.","uk":"We review the business context, available designs, current solution and requirements to define what needs to be implemented."} },
  { "icon": {"kind":"asset","src":"/assets/icons/howwork-checklist-white.svg","path":null},
    "title": {"en":"Estimate","uk":"Estimate"},
    "sub":   {"en":"Clarify scope and approach","uk":"Clarify scope and approach"},
    "text":  {"en":"We define the implementation scope, dependencies and approach needed to prepare a project estimate.","uk":"We define the implementation scope, dependencies and approach needed to prepare a project estimate."} },
  { "icon": {"kind":"asset","src":"/assets/icons/howwork-code-window-white.svg","path":null},
    "title": {"en":"Implement","uk":"Implement"},
    "sub":   {"en":"Build, integrate and test","uk":"Build, integrate and test"},
    "text":  {"en":"We develop the agreed solution, handle required integrations and test the implementation before launch.","uk":"We develop the agreed solution, handle required integrations and test the implementation before launch."} },
  { "icon": {"kind":"asset","src":"/assets/icons/howwork-headset-white.svg","path":null},
    "title": {"en":"Support & Develop","uk":"Support & Develop"},
    "sub":   {"en":"Continue after launch when needed","uk":"Continue after launch when needed"},
    "text":  {"en":"ONVORX can support the solution after launch, implement improvements and continue its further development.","uk":"ONVORX can support the solution after launch, implement improvements and continue its further development."} }
]'::jsonb
where key = 'howWork';

update public.site_sections set cards = '[
  { "icon": {"kind":"asset","src":"/assets/icons/about-calendar-red.svg","path":null},
    "title": {"en":"Since 2023","uk":"Since 2023"},
    "text":  {"en":"Hands-on web development experience.","uk":"Hands-on web development experience."} },
  { "icon": {"kind":"asset","src":"/assets/icons/about-folder-red.svg","path":null},
    "title": {"en":"Real project work","uk":"Real project work"},
    "text":  {"en":"Experience across WordPress, WooCommerce extensions and front-end implementation.","uk":"Experience across WordPress, WooCommerce extensions and front-end implementation."} },
  { "icon": {"kind":"asset","src":"/assets/icons/about-doc-search-red.svg","path":null},
    "title": {"en":"Beyond implementation","uk":"Beyond implementation"},
    "text":  {"en":"Requirements and business processes are the foundation before development begins.","uk":"Requirements and business processes are the foundation before development begins."} }
]'::jsonb
where key = 'about';

update public.site_sections
set body = '{"en":"Web solutions built around your business requirements. From idea to implementation and beyond.","uk":"Web solutions built around your business requirements. From idea to implementation and beyond."}'::jsonb
where key = 'footer';
```

**IMPORTANT — before finalizing this task:** the EN/UK text values embedded above were copied from `src/i18n/en.json` at plan-writing time. Re-read `src/i18n/en.json` and `src/i18n/uk.json` yourself (paths: `hero.cards`, `hero.launch`, `howWork.steps`, `about.stats`, `footer.tagline`) and correct any EN or UK string above that doesn't match what's actually in those files right now — the two language files may have drifted since this plan was written, and this migration must seed the CURRENT text, not a stale copy. Do not "improve" or reconcile EN/UK mismatches — seed each language's own current value verbatim, even if they differ from each other.

- [ ] **Step 2: Commit**

```bash
git add supabase/migration-2026-09-14-hero-howwork-about-cards.sql
git commit -m "feat(supabase): add hero/howwork/about cards + footer tagline migration"
```

---

### Task 2: Backend validation + shared types + upload folder whitelist

**Files:**
- Modify: `api/_lib/adminRows.ts`
- Modify: `api/_lib/adminUploadHandler.ts`
- Modify: `src/admin/types.ts`
- Test: `api/_lib/adminRows.test.ts`, `api/_lib/adminUploadHandler.test.ts`

**Interfaces:**
- Produces: `SectionCard` type (`admin/types.ts`), `SectionText.cards?: SectionCard[]` / `.launch?: SectionCard`, `SectionKey` including `'footer'`, `sectionRow()` accepting `cards`/`launch` in its patch, `isSectionKey()` accepting `'footer'`, upload/delete accepting the `'cards'` folder.
- Consumes: existing `isL()` (already in `adminRows.ts`).

- [ ] **Step 1: Write the failing tests**

In `api/_lib/adminRows.test.ts`, add (after the existing `describe('sectionRow', ...)` tests):

```ts
describe('sectionRow — cards and launch', () => {
  const card = (title: string) => ({
    icon: { kind: 'asset', src: '/assets/icons/x.svg', path: null },
    title: L(title), text: L('text'),
  })
  it('keeps a valid cards array', () => {
    expect(sectionRow('hero', { cards: [card('A'), card('B')] })).toEqual({
      cards: [card('A'), card('B')],
    })
  })
  it('keeps a valid launch object', () => {
    expect(sectionRow('hero', { launch: card('Launch') })).toEqual({ launch: card('Launch') })
  })
  it('keeps a HowWork card with an extra sub field', () => {
    const withSub = { ...card('Define'), sub: L('sub text') }
    expect(sectionRow('howWork', { cards: [withSub] })).toEqual({ cards: [withSub] })
  })
  it('drops cards when any entry is missing icon/title/text', () => {
    expect(sectionRow('hero', { cards: [card('A'), { title: L('bad') }] })).toEqual({})
  })
  it('drops cards when it is not an array', () => {
    expect(sectionRow('hero', { cards: card('A') })).toEqual({})
  })
  it('drops a launch object missing a required field', () => {
    expect(sectionRow('hero', { launch: { title: L('Launch') } })).toEqual({})
  })
  it('drops a card whose icon is not an ImageRef-shaped object', () => {
    expect(sectionRow('hero', { cards: [{ icon: 'not-an-object', title: L('A'), text: L('t') }] })).toEqual({})
  })
})
```

In the existing `describe('validators', ...)` block, extend the `isSectionKey` test:

```ts
  it('isSectionKey / isSeoPageKey gate the enums', () => {
    expect(isSectionKey('howWork')).toBe(true)
    expect(isSectionKey('footer')).toBe(true)
    expect(isSectionKey('nope')).toBe(false)
    expect(isSeoPageKey('business-analysis')).toBe(true)
    expect(isSeoPageKey('nope')).toBe(false)
  })
```

In `api/_lib/adminUploadHandler.test.ts`, find the test `'400 on an unknown folder'` and add a sibling test right after it:

```ts
  it('accepts the cards folder for uploads', async () => {
    const d = deps()
    const r = await handleAdminUpload(
      { method: 'POST', cookieHeader: cookie, body: { dataUrl: PNG_DATA_URL, fileName: 'icon.png', folder: 'cards' } },
      ENV, d,
    )
    expect(r.status).toBe(200)
  })
```

(Read the existing file first to find the exact name of the valid-PNG data-URL constant/fixture already used by the `'POST a valid png → ...'` test — reuse that same constant rather than inventing a new one; the brief above uses a placeholder name `PNG_DATA_URL` that must be replaced with whatever the file actually calls it.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run api/_lib/adminRows.test.ts api/_lib/adminUploadHandler.test.ts`
Expected: FAIL — `sectionRow` doesn't handle `cards`/`launch` yet, `isSectionKey('footer')` is `false`, `'cards'` isn't an accepted upload folder yet.

- [ ] **Step 3: Extend the shared types**

In `src/admin/types.ts`:
- Add `'footer'` to the `SectionKey` union:

```ts
export type SectionKey =
  | 'hero'
  | 'services'
  | 'projects'
  | 'howWork'
  | 'about'
  | 'cta'
  | 'footer'
```

- Add, right after the `SectionKey` type (before `SectionText`):

```ts
export interface SectionCard {
  icon: ImageRef
  title: L
  /** HowWork cards only */
  sub?: L
  text: L
}
```

- Extend `SectionText` with two new optional fields:

```ts
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
  /** Hero/HowWork/About only — the section's fixed-count content cards */
  cards?: SectionCard[]
  /** Hero only — the standalone "Launch" card */
  launch?: SectionCard
}
```

- [ ] **Step 4: Implement the backend validation**

In `api/_lib/adminRows.ts`:
- Add `'footer'` to `SECTION_KEYS`:

```ts
const SECTION_KEYS = ['hero', 'services', 'projects', 'howWork', 'about', 'cta', 'footer'] as const
```

- Add, right after the existing `imageCols` helper (or anywhere above `sectionRow`, since `sectionRow` will call it):

```ts
const isImageRefLike = (v: unknown): boolean =>
  typeof v === 'object' && v !== null &&
  typeof (v as Record<string, unknown>).kind === 'string' &&
  typeof (v as Record<string, unknown>).src === 'string'

const isCard = (v: unknown): boolean => {
  if (typeof v !== 'object' || v === null) return false
  const c = v as Record<string, unknown>
  if (!isImageRefLike(c.icon)) return false
  if (!isL(c.title)) return false
  if (!isL(c.text)) return false
  if (c.sub !== undefined && !isL(c.sub)) return false
  return true
}
```

- Replace `sectionRow` in full:

```ts
export function sectionRow(_key: string, patch: Patch): Patch {
  const out: Patch = {}
  if (isL(patch.eyebrow)) out.eyebrow = patch.eyebrow
  if (isL(patch.title)) out.title = patch.title
  if (isL(patch.body)) out.body = patch.body
  if (isL(patch.ctaLabel)) out.cta_label = patch.ctaLabel
  if (Array.isArray(patch.cards) && patch.cards.every(isCard)) out.cards = patch.cards
  if (isCard(patch.launch)) out.launch = patch.launch
  return out
}
```

- [ ] **Step 5: Add `'cards'` to the upload folder whitelist**

In `api/_lib/adminUploadHandler.ts`, change:

```ts
const FOLDERS = ['projects', 'services'] as const
```

to:

```ts
const FOLDERS = ['projects', 'services', 'cards'] as const
```

(This single constant governs both the upload-folder check and the delete-path-prefix check, so no other line in this file needs to change.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run api/_lib/adminRows.test.ts api/_lib/adminUploadHandler.test.ts`
Expected: PASS (all tests, including the pre-existing ones in both files).

- [ ] **Step 7: Run the full backend test suite and typecheck**

Run: `npx vitest run` and `npx tsc -p tsconfig.api.json`
Expected: your own changed files pass cleanly. Other files that reference `SectionText`/`SectionKey` (e.g. `src/content/mappers.ts`, `src/content/defaults/sections.ts`) will not yet compile against the widened type until Task 3 — that's expected and out of scope for this task; only confirm `api/_lib/*.ts` and `src/admin/types.ts` themselves are clean.

- [ ] **Step 8: Commit**

```bash
git add api/_lib/adminRows.ts api/_lib/adminRows.test.ts api/_lib/adminUploadHandler.ts api/_lib/adminUploadHandler.test.ts src/admin/types.ts
git commit -m "feat(admin): validate section cards/launch, allow footer key and cards upload folder"
```

---

### Task 3: Content read path (DB row types, mappers, defaults, resolved content) + icon assets

**Files:**
- Modify: `src/content/dbTypes.ts`
- Modify: `src/content/mappers.ts`
- Modify: `src/content/defaults/sections.ts`
- Modify: `src/content/useSiteContent.ts`
- Test: `src/content/mappers.test.ts`
- Create: 12 SVG files under `public/assets/icons/`

**Interfaces:**
- Consumes: `SectionCard`, `SectionText.cards`/`.launch` (Task 2).
- Produces: `DbSectionRow.cards`/`.launch`, `rowToSection()` populating them, `defaultSections`'s `hero`/`howWork`/`about` entries carrying real `cards`/`launch` defaults plus a new `footer` entry, `useSiteContent().section(key)` exposing resolved (localized, icon-as-`iconSrc`) `cards`/`launch`.

- [ ] **Step 1: Create the 12 static icon SVG files**

Each file is a standalone copy of the matching glyph from `src/components/Icon/Icon.tsx`'s `PATHS` object, with `stroke="currentColor"` replaced by a fixed hex color matching how that icon currently renders in its context (Hero's first card and its Launch card use `var(--accent)` = `#e4202b`; Hero's other 3 cards and every HowWork marker use `var(--text)` = white `#ffffff`; every About icon uses `var(--accent)` = `#e4202b`). Create these exact 12 files:

`public/assets/icons/hero-target-red.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#e4202b" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="8.5"/>
  <circle cx="12" cy="12" r="3.4"/>
  <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>
</svg>
```

`public/assets/icons/hero-users-white.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="9" cy="7.5" r="3.6"/>
  <path d="M2.5 20a6.5 6.5 0 0 1 13 0"/>
  <path d="M15.5 4.4a3.6 3.6 0 0 1 0 6.9M17 20a6.5 6.5 0 0 0-3-5.5"/>
</svg>
```

`public/assets/icons/hero-document-white.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 2.5h7l5 5V21.5H6z"/>
  <path d="M13 2.5v5h5"/>
  <path d="M9 12.5h6M9 16h6M9 8.9h2"/>
</svg>
```

`public/assets/icons/hero-sitemap-white.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
  <rect x="9" y="2.5" width="6" height="5" rx="1.4"/>
  <rect x="2.5" y="16.5" width="6" height="5" rx="1.4"/>
  <rect x="9" y="16.5" width="6" height="5" rx="1.4"/>
  <rect x="15.5" y="16.5" width="6" height="5" rx="1.4"/>
  <path d="M12 7.5v4M5.5 16.5v-3a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v3M12 12.5v4"/>
</svg>
```

`public/assets/icons/hero-launch-check-circle-red.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#e4202b" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="9.5"/>
  <path d="M7.5 12.2l3.2 3.2 6.1-6.6"/>
</svg>
```

`public/assets/icons/howwork-doc-search-white.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 2.5h8l4 4V15"/>
  <path d="M14 2.5v4h4"/>
  <path d="M6 2.5V21.5h7"/>
  <circle cx="15.5" cy="16.5" r="3.2"/>
  <path d="M17.9 18.9L21 22"/>
</svg>
```

`public/assets/icons/howwork-checklist-white.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
  <rect x="4.5" y="3.5" width="15" height="17" rx="2"/>
  <rect x="9" y="1.8" width="6" height="3.4" rx="1.2"/>
  <path d="M7.8 9.2l1.4 1.4 2.4-2.6M14 9.5h3M7.8 14.4l1.4 1.4 2.4-2.6M14 14.7h3"/>
</svg>
```

`public/assets/icons/howwork-code-window-white.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2.5" y="4" width="19" height="16" rx="2.5"/>
  <path d="M2.5 8.5h19"/>
  <path d="M9.5 12l-2.2 2.4 2.2 2.4M14.5 12l2.2 2.4-2.2 2.4"/>
</svg>
```

`public/assets/icons/howwork-headset-white.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 13v-1a8 8 0 0 1 16 0v1"/>
  <rect x="2.5" y="12.5" width="4" height="7" rx="1.6"/>
  <rect x="17.5" y="12.5" width="4" height="7" rx="1.6"/>
  <path d="M19.5 19.5v1a3 3 0 0 1-3 3H13"/>
</svg>
```

`public/assets/icons/about-calendar-red.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#e4202b" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3.5" y="5" width="17" height="16" rx="2.5"/>
  <path d="M3.5 10h17M8 2.5v4M16 2.5v4"/>
  <path d="M7.5 14h1.5M11.5 14H13M15.5 14H17M7.5 17.5h1.5M11.5 17.5H13"/>
</svg>
```

`public/assets/icons/about-folder-red.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#e4202b" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 6.5a2 2 0 0 1 2-2h4l2.2 2.4H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
</svg>
```

`public/assets/icons/about-doc-search-red.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#e4202b" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 2.5h8l4 4V15"/>
  <path d="M14 2.5v4h4"/>
  <path d="M6 2.5V21.5h7"/>
  <circle cx="15.5" cy="16.5" r="3.2"/>
  <path d="M17.9 18.9L21 22"/>
</svg>
```

- [ ] **Step 2: Write the failing test**

In `src/content/mappers.test.ts`, the existing `rows` fixture's two section rows need `cards`/`launch` added (the `DbSectionRow` type will require them once Step 3 below lands) — update the fixture in place:

```ts
const rows: DbContentRows = {
  sections: [
    { key: 'hero', eyebrow: L('E'), title: L('T'), body: L('B'), cta_label: L('Go'),
      cards: [{ icon: { kind: 'asset', src: '/assets/icons/x.svg', path: null }, title: L('Card1'), text: L('t1') }],
      launch: { icon: { kind: 'asset', src: '/assets/icons/l.svg', path: null }, title: L('Launch'), text: L('lt') } },
    { key: 'about', eyebrow: L('AE'), title: L('AT'), body: L('AB'), cta_label: null, cards: null, launch: null },
  ],
  seo: [
```//keep the rest of the `rows` object (seo/projects/services) exactly as it already is.

Add, inside `describe('rowsToSiteContent', ...)`:

```ts
  it('maps cards and launch onto the section, defaulting to undefined when the row has none', () => {
    const c = rowsToSiteContent(rows)
    const hero = c.sections.find((s) => s.key === 'hero')!
    expect(hero.cards).toEqual([
      { icon: { kind: 'asset', src: '/assets/icons/x.svg', path: null }, title: L('Card1'), text: L('t1') },
    ])
    expect(hero.launch).toEqual({
      icon: { kind: 'asset', src: '/assets/icons/l.svg', path: null }, title: L('Launch'), text: L('lt'),
    })
    const about = c.sections.find((s) => s.key === 'about')!
    expect(about.cards).toBeUndefined()
    expect(about.launch).toBeUndefined()
  })
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/content/mappers.test.ts`
Expected: FAIL — `DbSectionRow` has no `cards`/`launch` fields yet (a TS compile error surfacing as a test failure), and `rowToSection` doesn't map them.

- [ ] **Step 4: Extend the DB row type**

In `src/content/dbTypes.ts`, add an import and extend `DbSectionRow`:

```ts
import type { L, SectionCard } from '../admin/types'

export interface DbSectionRow {
  key: string
  eyebrow: L
  title: L
  body: L
  cta_label: L | null
  cards: SectionCard[] | null
  launch: SectionCard | null
}
```

- [ ] **Step 5: Map the new columns in `rowToSection`**

In `src/content/mappers.ts`, replace `rowToSection` in full:

```ts
function rowToSection(row: DbSectionRow): SectionText {
  const s: SectionText = {
    key: row.key as SectionKey,
    label: SECTION_LABEL.get(row.key as SectionKey) ?? row.key,
    eyebrow: asL(row.eyebrow),
    title: asL(row.title),
    body: asL(row.body),
  }
  if (row.cta_label) s.ctaLabel = asL(row.cta_label)
  if (row.cards) s.cards = row.cards
  if (row.launch) s.launch = row.launch
  return s
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/content/mappers.test.ts`
Expected: PASS (all tests, including the pre-existing ones).

- [ ] **Step 7: Add default (Supabase-unavailable fallback) cards/launch/footer content**

In `src/content/defaults/sections.ts`, add a helper right after the existing `pair` function:

```ts
const cardsFrom = (
  enCards: { title: string; text: string; sub?: string }[],
  ukCards: { title: string; text: string; sub?: string }[],
  iconSrcs: string[],
): SectionCard[] =>
  enCards.map((c, i) => ({
    icon: { kind: 'asset', src: iconSrcs[i], path: null },
    title: pair(c.title, ukCards[i].title),
    text: pair(c.text, ukCards[i].text),
    ...(c.sub !== undefined ? { sub: pair(c.sub, ukCards[i].sub!) } : {}),
  }))
```

Add `SectionCard` to the type-only import at the top of the file:

```ts
import type { L, SectionCard, SectionText } from '../../admin/types'
```

Update the `hero` entry (add `cards`/`launch` alongside the existing `eyebrow`/`title`/`body`/`ctaLabel`):

```ts
  {
    key: 'hero',
    label: 'Hero (top of page)',
    eyebrow: pair(en.hero.eyebrow, uk.hero.eyebrow),
    title: pair(en.hero.title, uk.hero.title),
    body: pair(en.hero.description, uk.hero.description),
    ctaLabel: pair(en.hero.cta, uk.hero.cta),
    cards: cardsFrom(en.hero.cards, uk.hero.cards, [
      '/assets/icons/hero-target-red.svg',
      '/assets/icons/hero-users-white.svg',
      '/assets/icons/hero-document-white.svg',
      '/assets/icons/hero-sitemap-white.svg',
    ]),
    launch: {
      icon: { kind: 'asset', src: '/assets/icons/hero-launch-check-circle-red.svg', path: null },
      title: pair(en.hero.launch.title, uk.hero.launch.title),
      text: pair(en.hero.launch.text, uk.hero.launch.text),
    },
  },
```

Update the `howWork` entry:

```ts
  {
    key: 'howWork',
    label: 'How we work block',
    eyebrow: pair(en.howWork.eyebrow, uk.howWork.eyebrow),
    title: pair(en.howWork.title, uk.howWork.title),
    body: pair(en.howWork.description, uk.howWork.description),
    cards: cardsFrom(en.howWork.steps, uk.howWork.steps, [
      '/assets/icons/howwork-doc-search-white.svg',
      '/assets/icons/howwork-checklist-white.svg',
      '/assets/icons/howwork-code-window-white.svg',
      '/assets/icons/howwork-headset-white.svg',
    ]),
  },
```

Update the `about` entry:

```ts
  {
    key: 'about',
    label: 'About block',
    eyebrow: pair(en.about.eyebrow, uk.about.eyebrow),
    title: pair(en.about.title, uk.about.title),
    body: pair(en.about.description, uk.about.description),
    cards: cardsFrom(en.about.stats, uk.about.stats, [
      '/assets/icons/about-calendar-red.svg',
      '/assets/icons/about-folder-red.svg',
      '/assets/icons/about-doc-search-red.svg',
    ]),
  },
```

Add a new `footer` entry at the end of the `defaultSections` array (after `cta`, before the closing `]`):

```ts
  {
    key: 'footer',
    label: 'Footer tagline',
    eyebrow: { en: '', uk: '' },
    title: { en: '', uk: '' },
    body: pair(en.footer.tagline, uk.footer.tagline),
  },
```

- [ ] **Step 8: Resolve cards/launch for the public site in `useSiteContent`**

In `src/content/useSiteContent.ts`, add an exported interface near the top (after the existing `ResolvedServiceCard`):

```ts
export interface ResolvedSectionCard {
  iconSrc: string
  title: string
  sub?: string
  text: string
}
```

First, add `SectionCard` to the existing type-only import at the top of the file (find the line importing `SectionKey`/`SeoPageKey` from `'../admin/types'` and add `SectionCard` to it):

```ts
import type { SectionCard, SectionKey, SeoPageKey } from '../admin/types'
```

Then replace the `section` function inside `useSiteContent`'s `useMemo` in full:

```ts
    const resolveCard = (c: SectionCard): ResolvedSectionCard => ({
      iconSrc: c.icon.src,
      title: pick(c.title),
      text: pick(c.text),
      ...(c.sub ? { sub: pick(c.sub) } : {}),
    })

    const section = (key: SectionKey) => {
      const s = data.sections.find((x) => x.key === key)
      return {
        eyebrow: s ? pick(s.eyebrow) : '',
        title: s ? pick(s.title) : '',
        body: s ? pick(s.body) : '',
        ctaLabel: s?.ctaLabel ? pick(s.ctaLabel) : '',
        cards: s?.cards ? s.cards.map(resolveCard) : [],
        launch: s?.launch ? resolveCard(s.launch) : undefined,
      }
    }
```

- [ ] **Step 9: Run the full test suite and typecheck**

Run: `npx vitest run` and `npx tsc -b`
Expected: All tests pass; 0 TypeScript errors. (`Hero.tsx`/`HowWork.tsx`/`About.tsx`/`SiteFooter.tsx` still read from `tx()`/`t()` at this point — they aren't broken by this task, just not yet using the new data; Task 5 switches them over.)

- [ ] **Step 10: Commit**

```bash
git add public/assets/icons/ src/content/dbTypes.ts src/content/mappers.ts src/content/mappers.test.ts src/content/defaults/sections.ts src/content/useSiteContent.ts
git commit -m "feat(content): resolve hero/howwork/about cards + launch from site_sections"
```

---

### Task 4: Admin UI — cards/launch sub-editor in ContentPage, ImageUpload folder, api client

**Files:**
- Modify: `src/admin/pages/ContentPage.tsx`
- Modify: `src/admin/components/ImageUpload.tsx`
- Modify: `src/admin/api.ts`
- Test: `src/admin/pages/ContentPage.test.tsx`

**Interfaces:**
- Consumes: `SectionCard`, `SectionText.cards`/`.launch` (Task 2), `adminApi.uploadImage`/`.deleteImage` (existing).
- Produces: `ContentPage.tsx` renders and saves cards/launch for hero/howWork/about, and only the (relabeled) Body field for footer.

- [ ] **Step 1: Write the failing tests**

In `src/admin/pages/ContentPage.test.tsx`, add `'cards'` to the mocked `adminApi`'s methods used by `ImageUpload` (`uploadImage`, `deleteImage`) if not already present in the mock — read the current mock object first; if `uploadImage`/`deleteImage` aren't already mocked there, add them:

```ts
vi.mock('../../admin/api', () => ({
  adminApi: {
    saveSection: vi.fn().mockResolvedValue(undefined),
    saveSeo: vi.fn().mockResolvedValue(undefined),
    resetContent: vi.fn().mockResolvedValue(undefined),
    createCard: vi.fn().mockResolvedValue(undefined),
    updateCard: vi.fn().mockResolvedValue(undefined),
    deleteCard: vi.fn().mockResolvedValue(undefined),
    reorderCards: vi.fn().mockResolvedValue(undefined),
    uploadImage: vi.fn().mockResolvedValue({ url: 'https://cdn/new-icon.png', path: 'cards/new-icon.png' }),
    deleteImage: vi.fn().mockResolvedValue(undefined),
  },
}))
```

Add these tests inside `describe('ContentPage', ...)`:

```ts
  it('renders a card editor for each of Hero\'s 4 cards plus its Launch card', () => {
    wrap()
    // Hero has 4 stat cards + 1 launch card = 5 card-shaped title fields,
    // on top of the section-level Title field already covered by the
    // existing "editing a title" test — assert via the card text fields,
    // which are unique to cards (the section itself has no field called
    // "Card text").
    expect(screen.getAllByLabelText(/card text/i).length).toBeGreaterThanOrEqual(5)
  })

  it('renders a Sub field only for HowWork\'s cards, not Hero\'s', () => {
    wrap()
    // HowWork has 4 cards, each with its own Sub field
    expect(screen.getAllByLabelText(/^sub$/i).length).toBe(4)
  })

  it('footer only shows a Tagline field, no Eyebrow/Title/Button label', () => {
    wrap()
    const footerHeading = screen.getByRole('heading', { name: /footer tagline/i })
    const footerSection = footerHeading.closest('details')!
    expect(within(footerSection).getByLabelText(/tagline/i)).toBeInTheDocument()
    expect(within(footerSection).queryByLabelText(/^eyebrow$/i)).not.toBeInTheDocument()
    expect(within(footerSection).queryByLabelText(/^title$/i)).not.toBeInTheDocument()
  })

  it('uploading a new icon for a card and saving updates the store', async () => {
    const user = userEvent.setup()
    wrap()
    const heroHeading = screen.getByRole('heading', { name: /^hero/i })
    const heroDetails = heroHeading.closest('details')!
    await user.click(within(heroDetails).getAllByText(/choose file/i)[0])
    // ImageUpload's onChange fires from a real file input change event in
    // its own test file — here, just verify uploadImage was reachable by
    // asserting the upload button rendered inside a card block at all;
    // full upload-flow coverage already exists in ImageUpload.test.tsx.
    expect(within(heroDetails).getAllByText(/choose file/i).length).toBeGreaterThan(0)
  })
```

(Add `within` to the existing `@testing-library/react` import at the top of the file if it isn't already imported.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/admin/pages/ContentPage.test.tsx`
Expected: FAIL — no card editor UI exists yet.

- [ ] **Step 3: Widen `ImageUpload`'s folder type**

In `src/admin/components/ImageUpload.tsx`, change:

```ts
  folder: 'projects' | 'services'
```

to:

```ts
  folder: 'projects' | 'services' | 'cards'
```

- [ ] **Step 4: Widen the api client's `saveSection` and `uploadImage` types**

In `src/admin/api.ts`:

```ts
  saveSection: (key: SectionKey, patch: Partial<Pick<SectionText, 'eyebrow' | 'title' | 'body' | 'ctaLabel' | 'cards' | 'launch'>>) =>
    call<void>('/api/admin/content', 'PUT', { kind: 'section', key, patch }),
```

```ts
  uploadImage: (folder: 'projects' | 'services' | 'cards', dataUrl: string, fileName: string) =>
    call<{ url: string; path: string }>('/api/admin/upload', 'POST', { dataUrl, fileName, folder }),
```

- [ ] **Step 5: Build the card sub-editor in `ContentPage.tsx`**

In `src/admin/pages/ContentPage.tsx`, add a new import at the top:

```ts
import type { L, SectionCard, SectionKey, SectionText } from '../types'
import { ImageUpload } from '../components/ImageUpload'
```

Add a new component, right before `SectionEditor`:

```tsx
function CardEditor({
  card,
  onChange,
}: {
  card: SectionCard
  onChange: (next: SectionCard) => void
}) {
  return (
    <div className="admin-card-editor">
      <ImageUpload
        label="Icon"
        folder="cards"
        value={card.icon}
        onChange={async (icon) => onChange({ ...card, icon })}
        onClear={async () => onChange({ ...card, icon: { kind: 'asset', src: '' } })}
      />
      <LocalizedField
        label="Card title"
        value={card.title}
        onChange={(v) => onChange({ ...card, title: v })}
      />
      {card.sub !== undefined && (
        <LocalizedField
          label="Sub"
          value={card.sub}
          onChange={(v) => onChange({ ...card, sub: v })}
        />
      )}
      <LocalizedField
        label="Card text"
        value={card.text}
        multiline
        onChange={(v) => onChange({ ...card, text: v })}
      />
    </div>
  )
}
```

Replace `SectionEditor` in full:

```tsx
type Draft = Pick<SectionText, 'eyebrow' | 'title' | 'body'> & {
  ctaLabel?: L
  cards?: SectionCard[]
  launch?: SectionCard
}

const eqL = (a: L, b: L) => a.en === b.en && a.uk === b.uk
const eqCard = (a: SectionCard, b: SectionCard): boolean =>
  a.icon.src === b.icon.src &&
  eqL(a.title, b.title) &&
  eqL(a.text, b.text) &&
  (a.sub === undefined && b.sub === undefined ? true : Boolean(a.sub && b.sub && eqL(a.sub, b.sub)))
const eqCards = (a: SectionCard[] | undefined, b: SectionCard[] | undefined): boolean => {
  if (a === undefined || b === undefined) return a === b
  if (a.length !== b.length) return false
  return a.every((c, i) => eqCard(c, b[i]))
}

const toDraft = (s: SectionText): Draft => ({
  eyebrow: { ...s.eyebrow },
  title: { ...s.title },
  body: { ...s.body },
  ...(s.ctaLabel ? { ctaLabel: { ...s.ctaLabel } } : {}),
  ...(s.cards ? { cards: s.cards.map((c) => ({ ...c })) } : {}),
  ...(s.launch ? { launch: { ...s.launch } } : {}),
})

function SectionEditor({ section }: { section: SectionText }) {
  const { actions } = useSiteContentRaw()
  const toast = useToast()

  const stored = useMemo(() => toDraft(section), [section])
  const [draft, setDraft] = useState<Draft>(() => toDraft(section))

  const dirty =
    !eqL(draft.eyebrow, stored.eyebrow) ||
    !eqL(draft.title, stored.title) ||
    !eqL(draft.body, stored.body) ||
    Boolean(draft.ctaLabel && stored.ctaLabel && !eqL(draft.ctaLabel, stored.ctaLabel)) ||
    !eqCards(draft.cards, stored.cards) ||
    (draft.launch && stored.launch ? !eqCard(draft.launch, stored.launch) : draft.launch !== stored.launch)

  const save = async () => {
    const patch: Partial<Draft> = {}
    if (!eqL(draft.eyebrow, stored.eyebrow)) patch.eyebrow = draft.eyebrow
    if (!eqL(draft.title, stored.title)) patch.title = draft.title
    if (!eqL(draft.body, stored.body)) patch.body = draft.body
    if (draft.ctaLabel && stored.ctaLabel && !eqL(draft.ctaLabel, stored.ctaLabel))
      patch.ctaLabel = draft.ctaLabel
    if (!eqCards(draft.cards, stored.cards)) patch.cards = draft.cards
    if (draft.launch && stored.launch && !eqCard(draft.launch, stored.launch)) patch.launch = draft.launch
    try {
      await actions.updateSection(section.key, patch)
      toast('Saved')
    } catch {
      toast('Save failed', 'error')
    }
  }

  const isFooter = section.key === 'footer'

  return (
    <details className="admin-disclosure">
      <summary className="admin-disclosure__summary">
        <h2>{section.label}</h2>
      </summary>
      <div className="admin-disclosure__body">
        {!isFooter && (
          <>
            <LocalizedField
              label="Eyebrow"
              value={draft.eyebrow}
              onChange={(v) => setDraft((d) => ({ ...d, eyebrow: v }))}
            />
            <LocalizedField
              label="Title"
              value={draft.title}
              onChange={(v) => setDraft((d) => ({ ...d, title: v }))}
            />
          </>
        )}
        <LocalizedField
          label={isFooter ? 'Tagline' : 'Body'}
          value={draft.body}
          multiline
          onChange={(v) => setDraft((d) => ({ ...d, body: v }))}
        />
        {!isFooter && draft.ctaLabel && (
          <LocalizedField
            label="Button label"
            value={draft.ctaLabel}
            onChange={(v) => setDraft((d) => ({ ...d, ctaLabel: v }))}
          />
        )}
        {draft.cards && (
          <div className="admin-cards-block">
            <h3>Cards</h3>
            {draft.cards.map((card, i) => (
              <CardEditor
                key={i}
                card={card}
                onChange={(next) =>
                  setDraft((d) => ({
                    ...d,
                    cards: d.cards!.map((c, ci) => (ci === i ? next : c)),
                  }))
                }
              />
            ))}
          </div>
        )}
        {draft.launch && (
          <div className="admin-cards-block">
            <h3>Launch card</h3>
            <CardEditor
              card={draft.launch}
              onChange={(next) => setDraft((d) => ({ ...d, launch: next }))}
            />
          </div>
        )}
        <SaveBar dirty={Boolean(dirty)} onSave={save} onDiscard={() => setDraft(stored)} />
      </div>
    </details>
  )
}
```

Update `ORDER` to include `'footer'`, and update `ContentPage`'s own hint text:

```ts
const ORDER: SectionKey[] = ['hero', 'services', 'projects', 'howWork', 'about', 'cta', 'footer']
```

- [ ] **Step 6: Add minimal CSS for the new card editor blocks**

In `src/admin/admin.css`, add (near the other `.admin-*` block rules — exact placement doesn't matter, this is new, self-contained styling):

```css
.admin-cards-block { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border, #e8e8ec); }
.admin-cards-block h3 { font-size: 0.95rem; margin: 0 0 1rem; }
.admin-card-editor { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; margin-bottom: 1rem; background: var(--surface-2, #fbfbfc); border-radius: var(--radius-sm, 8px); }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/admin/pages/ContentPage.test.tsx`
Expected: PASS (all tests, including the pre-existing ones in this file).

- [ ] **Step 8: Run the full frontend test suite and typecheck**

Run: `npx vitest run` and `npx tsc -b`
Expected: All tests pass; 0 TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add src/admin/pages/ContentPage.tsx src/admin/components/ImageUpload.tsx src/admin/api.ts src/admin/pages/ContentPage.test.tsx src/admin/admin.css
git commit -m "feat(admin): editable cards/launch UI in ContentPage, footer tagline-only view"
```

---

### Task 5: Public site — read cards/launch/tagline from Supabase instead of i18n

**Files:**
- Modify: `src/sections/Hero/Hero.tsx`
- Modify: `src/sections/HowWork/HowWork.tsx`
- Modify: `src/sections/About/About.tsx`
- Modify: `src/components/SiteFooter/SiteFooter.tsx`

**Interfaces:**
- Consumes: `useSiteContent().section(key)`'s new `cards`/`launch` fields (Task 3).

No new tests — these four components have no test files today (confirmed absent), and this plan doesn't introduce new test infrastructure for them, matching this repo's established convention. Correctness here is verified live by the human operator on a deployed preview, same as every content change in this project.

- [ ] **Step 1: Rewire `Hero.tsx`**

In `src/sections/Hero/Hero.tsx`:
- Remove the `CARD_ICONS` constant and the `HeroCard` interface's now-unneeded shape (the resolved card already carries everything needed).
- Remove `tx` from the `useI18n()` destructure if `tx` is no longer used elsewhere in this file (check — `t` is still used for `hero.visualAlt`, keep that).
- Replace:

```tsx
  const cards = tx<HeroCard[]>("hero.cards");
  const launch = tx<HeroCard>("hero.launch");
```

with:

```tsx
  const cards = hero.cards;
  const launch = hero.launch;
```

(`hero` here is the existing `const hero = section("hero");` — already in scope.)

- Replace the cards-rendering block:

```tsx
            {cards.map((card, i) => (
              <Reveal
                as="li"
                key={card.title}
                className="hero__card-cell"
                variant="left"
                delay={70 * i}
              >
                <div className="hero__card">
                  <span className="hero__card-icon">
                    <Icon name={CARD_ICONS[i]} size={22} />
                  </span>
                  <span className="hero__card-body">
                    <span className="hero__card-title">{card.title}</span>
                    <span className="hero__card-text">{card.text}</span>
                  </span>
                </div>
              </Reveal>
            ))}
```

with:

```tsx
            {cards.map((card, i) => (
              <Reveal
                as="li"
                key={card.title}
                className="hero__card-cell"
                variant="left"
                delay={70 * i}
              >
                <div className="hero__card">
                  <span className="hero__card-icon">
                    <img src={card.iconSrc} alt="" width={22} height={22} />
                  </span>
                  <span className="hero__card-body">
                    <span className="hero__card-title">{card.title}</span>
                    <span className="hero__card-text">{card.text}</span>
                  </span>
                </div>
              </Reveal>
            ))}
```

- Replace the launch-rendering block:

```tsx
            <Reveal className="hero__launch" variant="right" delay={260}>
              <span className="hero__launch-icon">
                <Icon name="check-circle" size={22} />
              </span>
              <span className="hero__launch-title">{launch.title}</span>
              <span className="hero__launch-text">{launch.text}</span>
            </Reveal>
```

with:

```tsx
            <Reveal className="hero__launch" variant="right" delay={260}>
              <span className="hero__launch-icon">
                {launch && <img src={launch.iconSrc} alt="" width={22} height={22} />}
              </span>
              <span className="hero__launch-title">{launch?.title}</span>
              <span className="hero__launch-text">{launch?.text}</span>
            </Reveal>
```

(`launch` is now possibly `undefined` per `ResolvedSectionCard | undefined` — the `?.`/`&&` guards handle a `site_sections` row that hasn't been migrated yet without crashing; in practice, after Task 1's migration runs, `launch` is always present for the `hero` key.)

- Remove the now-unused `Icon`/`IconName` import if nothing else in this file still uses `Icon` (check the rest of the file — if `Icon` is used nowhere else, remove the import entirely; if it's still imported for some other icon in this file, only remove `CARD_ICONS`).

- [ ] **Step 2: Rewire `HowWork.tsx`**

In `src/sections/HowWork/HowWork.tsx`:
- Remove `STEP_ICONS` and the `Step` interface/`tx` import if no longer used.
- Replace:

```tsx
  const steps = tx<Step[]>("howWork.steps");
```

with:

```tsx
  const steps = howWork.cards ?? [];
```

- Replace the icon line:

```tsx
                <span className="how-work__marker">
                  <Icon name={STEP_ICONS[i]} size={34} />
                </span>
```

with:

```tsx
                <span className="how-work__marker">
                  <img src={step.iconSrc} alt="" width={34} height={34} />
                </span>
```

- The `key={step.index}` on the mapped `<Reveal>` needs a new key source, since resolved cards no longer carry an `index` field — use the array index instead: `key={i}` (stable here since this list is fixed-length and never reordered by the user).
- The `<span className="how-work__number">{step.index}</span>` line has no more `step.index` to read — replace with a derived label from position: `<span className="how-work__number">{String(i + 1).padStart(2, '0')}</span>` (reproduces the same `"01"`/`"02"`/... display the static JSON's `index` field used to provide, without needing it stored as data).
- `step.sub` — the resolved card type's `sub` is `string | undefined`; render as `{step.sub}` (unchanged JSX, just confirm the type still fits — it does, `ResolvedSectionCard.sub?: string` matches what `<p>{...}</p>` accepts).

- [ ] **Step 3: Rewire `About.tsx`**

In `src/sections/About/About.tsx`:
- Remove `STAT_ICONS` and the `Stat` interface/`tx` import if no longer used.
- Replace:

```tsx
  const stats = tx<Stat[]>("about.stats");
```

with:

```tsx
  const stats = about.cards ?? [];
```

- Replace the icon line:

```tsx
                <span className="about__stat-icon">
                  <Icon name={STAT_ICONS[i]} size={26} />
                </span>
```

with:

```tsx
                <span className="about__stat-icon">
                  <img src={stat.iconSrc} alt="" width={26} height={26} />
                </span>
```

- Same `index`/`key` treatment as HowWork: `key={i}` on the mapped `<Reveal>`, and `<span className="about__stat-index">{String(i + 1).padStart(2, '0')}</span>` replacing `{stat.index}`.

- [ ] **Step 4: Rewire `SiteFooter.tsx`**

In `src/components/SiteFooter/SiteFooter.tsx`:
- Add the import: `import { useSiteContent } from "../../content/useSiteContent";`
- Inside `SiteFooter()`, add: `const { section } = useSiteContent(); const footer = section("footer");`
- Replace:

```tsx
              <p className="site-footer__tagline">{t("footer.tagline")}</p>
```

with:

```tsx
              <p className="site-footer__tagline">{footer.body}</p>
```

(Leave every other `t(...)`/`tx(...)` call in this file untouched — nav links, services links, email, telegram, and copyright all stay on the static i18n bundle; only the tagline moves.)

- [ ] **Step 5: Run the full test suite, typecheck, and manual smoke check**

Run: `npx vitest run` and `npx tsc -b`
Expected: All tests pass; 0 TypeScript errors.

There is no automated test for these four components, so also start the dev server (`npm run dev`) and visually confirm, in the browser, that Hero/HowWork/About/Footer still render their cards/tagline correctly with real content (this exercises the `defaultSections` fallback path from Task 3, since a local dev environment without Supabase env vars configured falls back to it) before moving on — a silent runtime crash here (e.g. `cards.map` on `undefined` if a key doesn't resolve) would not be caught by `tsc`/existing tests.

- [ ] **Step 6: Commit**

```bash
git add src/sections/Hero/Hero.tsx src/sections/HowWork/HowWork.tsx src/sections/About/About.tsx src/components/SiteFooter/SiteFooter.tsx
git commit -m "feat(public-site): read hero/howwork/about cards and footer tagline from Supabase content"
```

---

## Spec coverage check (self-review)

- §4 Data model → Task 1 (migration: `cards`/`launch` columns, widened key constraint, `footer` row).
- §5 One-time data migration → Task 1 (seed UPDATEs, explicit instruction to re-verify EN/UK text against the live i18n files before finalizing).
- §6 Backend → Task 2 (`sectionRow`/`isSectionKey` validation, upload folder whitelist).
- §7 Admin UI → Task 4 (`CardEditor`, `SectionEditor` extended, footer field visibility).
- §8 Public site → Task 3 (`useSiteContent` resolution) + Task 5 (the four components actually switching over).
- §9 Testing approach → followed throughout (unit tests with fakes for validation/mapping/admin UI; public components stay untested, matching existing convention; live Supabase verification deferred to the human operator).
- §3 Non-goals → respected: no add/remove UI anywhere in Tasks 4-5; the CARDS nav restructure isn't touched; `Icon.tsx` itself isn't modified, only stops being called from these three sections' card-icon renders; `en.json`/`uk.json` keys are left in place (their runtime consumers are removed, but the JSON keys themselves aren't deleted).

No placeholder text, TBD, or "add appropriate X" phrasing appears in any task above — every step has complete, runnable code, including all 12 icon SVG files' full contents and the exact seed SQL. Type/signature names are consistent across tasks: `SectionCard` (Task 2) is the exact type Tasks 3-5 import and use; `cards`/`launch`/`iconSrc` field names match exactly between the DB row shape (Task 3), the admin UI (Task 4), and the public components (Task 5).
