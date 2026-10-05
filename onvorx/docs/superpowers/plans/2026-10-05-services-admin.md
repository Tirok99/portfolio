# Admin: /services page content + unified Content / Cards / SEO tabs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every text, list, card and image on `/services` editable from `/admin` (and title/body from the Telegram bot) by moving it from `en.json` / `uk.json` into seven new `site_sections` rows, and give the admin's Content, Cards and SEO areas the same tabbed navigation.

**Architecture:** Seven `svc*` keys are added to `site_sections`, plus two JSONB columns with one owner each: `texts` (written only by the Content screen) and `media` (written only by the Cards screen); feature items and hero cards reuse the existing `cards` column with two new optional card fields (`tags`, `track`). Everything flows through the existing `PUT /api/admin/content` → `sectionRow()` path, the shared `SiteContentProvider` store and `useSiteContent()`; the public `/services` components switch from `useI18n().tx()` to a new `svcSection(key)` resolver. No new tables, endpoints or serverless functions.

**Tech Stack:** TypeScript, React 19, react-router 7, Supabase (Postgres + Storage), grammY (Telegram), Vitest + Testing Library, oxlint.

**Spec:** `docs/superpowers/specs/2026-10-05-services-admin-design.md` — read it in full before starting; this plan implements it section by section and refers to it as "spec §N".

## Global Constraints

- Work on a branch: `git switch -c feat/services-admin` before Task 1. Every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No new Supabase tables, no new API routes, no new serverless functions (spec §4). All writes go through `PUT /api/admin/content` and `sectionRow()`.
- New section keys, exactly: `svcHero`, `svcWebDevelopment`, `svcAiBuild`, `svcWebsiteSupport`, `svcBusinessAnalysis`, `svcGoogleAds`, `svcCta` (spec §5.1).
- `texts` is written **only** by the Content screen, `media` **only** by the Cards screen; each screen sends only its own columns (spec §5.3).
- Fixed counts: 4 service blocks, 4 hero cards, 2 Business Analysis tracks. Flexible: feature items, block tags, AI Build stack (spec §3 #3).
- `uk` values are seeded with the English text (spec §4). Do not translate anything.
- Not editable, stay in code / i18n: block order, theme, anchors, layout, alt texts (`servicesPage.*.pictureAlt`, `servicesPage.aiBuild.mockupsAlt`), chrome strings (`servicesPage.serviceLabel`, `servicesPage.whatYouGet`, `servicesPage.hero.cardsLabel`) (spec §4).
- The Google Ads block's DOM id/class is `paid-search` (`SERVICE_BLOCKS.googleAds.id`), **never** `google-ads` — EasyList ad blockers hide `#google-ads` / `.google-ads`. Any address shown for that block is `/services#paid-search`.
- Old `services` rows with `list='page'` stay in the database; they are only hidden from the web admin and the bot (spec §4).
- Telegram bot: only **Title** and **Body** of `svc*` sections are editable; no new handlers, no new permissions (spec §7).
- Test commands: `npx vitest run <path>` for one file, `npm test` for everything, `npm run lint`, `npm run build` (runs both `tsc` projects + `vite build`).

## Review Focus

1. **Production DB without the new rows, or a browser holding an old content cache** — the page must still render `/services` from the in-code defaults instead of a blank page. Pinned in Task 3 (mapper fills missing sections; cache key bumped to `v3`).
2. **A Content save right after a Cards save on the same section (or the reverse)** — neither may overwrite the other's columns. Pinned in Task 8 (Content patch never contains `cards`/`media`) and Task 9 (Cards patch never contains `texts`).
3. **Business Analysis items edited per track** — removing every item of Track 01, or adding to Track 02, must keep the array "Track 01 items, then Track 02 items" and each item must render under its own track on the site even if a hand-edited row stores them out of order. Pinned in Task 2 (`mergeTrack`), Task 6 (public grouping), Task 9 (editor save).
4. **Empty or duplicate list items** (an empty new tag row saved, two tags "WordPress") — the site must not render empty pills or crash on duplicate React keys. Pinned in Task 5 (resolver drops empty items) and Task 6 (index keys).
5. **Stale Telegram buttons** — an old "Services page" card button or an "Eyebrow" button on a `svc*` section must not write to hidden data. Pinned in Task 11.

---

## File Structure

| File | Responsibility |
|---|---|
| `api/_lib/adminRows.ts` (modify) | Server whitelist: new keys, key-aware `texts` / `media` / `cards` validation |
| `src/admin/types.ts` (modify) | Shared types: key unions, `texts` / `media` shapes, `SectionCard.tags/track` |
| `src/content/servicesSections.ts` (create) | Key lists, type guards and `mergeTrack` shared by admin, resolver and site |
| `src/content/defaults/servicesPage.content.json` (create) | The `/services` copy, moved out of `en.json` |
| `src/content/defaults/servicesPage.ts` (create) | Builds the 7 default `svc*` sections |
| `src/content/defaults/sections.ts` (modify) | Appends the 7 sections to `defaultSections` |
| `src/data/servicesPage.ts` (modify) | Asset paths + `sectionKey` per block + `AI_BUILD_MOCKUPS` |
| `src/content/mappers.ts`, `dbTypes.ts`, `contentCache.ts` (modify) | DB → store mapping for the new columns; missing-section fallback; cache v3 |
| `scripts/gen-seed.ts` (modify) | Seed + migration insert generation incl. `texts` / `media` |
| `supabase/migration-2026-10-05-services-page.sql` (create), `schema.sql`, `seed.sql` (modify) | Columns, key constraint, 7 rows, `reset_content` |
| `src/content/useSiteContent.ts` (modify) | `svcSection(key)` language-resolved helper |
| `src/sections/ServicesHero`, `ServiceBlock`, `AiBuild`, `src/pages/ServicesPage.tsx` (modify) | Read from the store |
| `src/i18n/en.json`, `uk.json` (modify) | Keep only chrome + alt strings under `servicesPage` |
| `src/admin/components/LocalizedListField.tsx` (create) | Editable list of `L` items |
| `src/admin/components/FeatureListEditor.tsx` (create) | Editable list of feature cards (icon, title, text) |
| `src/admin/pages/ContentPage.tsx` (modify), `ServicesContent.tsx` (create) | Content tabs Home / Services |
| `src/admin/pages/ServicesPageCards.tsx` (create), `ServicesPage.tsx`, `DashboardPage.tsx` (modify) | Cards → Services → Services page editor |
| `src/admin/pages/SeoPage.tsx` (modify) | SEO tabs Home / Services / Projects / About |
| `api/_lib/telegramMenu.ts`, `telegramDispatch.ts`, `telegramCardsDispatch.ts` (modify) | Bot: page choice, svc Title/Body, Services cards = Home only |
| `docs/PROJECT-MAP.md` (modify) | Status update |

---

### Task 1: Server validation for the new keys and columns

**Files:**
- Modify: `api/_lib/adminRows.ts`
- Test: `api/_lib/adminRows.test.ts`, `api/_lib/adminReset.test.ts`

**Interfaces:**
- Produces: `isSectionKey()` accepts the 7 `svc*` keys; `sectionRow(key, patch)` additionally returns `texts` / `media` (only for valid `svc*` shapes) and validates `cards` per key (spec §5.5). `resetContent()` needs no code change — it spreads `sectionRow()`'s output, so `texts` / `media` reach the RPC payload automatically.

- [ ] **Step 1: Write the failing tests**

Append to `api/_lib/adminRows.test.ts`:

```ts
describe('sectionRow — /services sections (spec §5.5)', () => {
  const img = (src: string) => ({ kind: 'asset', src })
  const card = (title: string, extra: Record<string, unknown> = {}) => ({
    icon: img('/assets/services-page/icons/code.svg'), title: L(title), text: L('t'), ...extra,
  })

  it('accepts the 7 svc keys', () => {
    for (const k of ['svcHero', 'svcWebDevelopment', 'svcAiBuild', 'svcWebsiteSupport',
      'svcBusinessAnalysis', 'svcGoogleAds', 'svcCta']) expect(isSectionKey(k)).toBe(true)
  })

  it('keeps block texts with tags and an optional get', () => {
    const texts = { tags: [L('WordPress')], get: { title: L('G'), text: L('g') } }
    expect(sectionRow('svcWebDevelopment', { texts })).toEqual({ texts })
    expect(sectionRow('svcGoogleAds', { texts: { tags: [] } })).toEqual({ texts: { tags: [] } })
  })

  it('requires exactly 2 tracks on Business Analysis, and none elsewhere', () => {
    const head = { label: L('Track 01'), title: L('T') }
    expect(sectionRow('svcBusinessAnalysis', { texts: { tags: [], tracks: [head, head] } }))
      .toEqual({ texts: { tags: [], tracks: [head, head] } })
    expect(sectionRow('svcBusinessAnalysis', { texts: { tags: [], tracks: [head] } })).toEqual({})
    expect(sectionRow('svcBusinessAnalysis', { texts: { tags: [] } })).toEqual({})
    expect(sectionRow('svcWebDevelopment', { texts: { tags: [], tracks: [head, head] } })).toEqual({})
  })

  it('keeps AI Build texts as a stack of L', () => {
    expect(sectionRow('svcAiBuild', { texts: { stack: [L('Design'), L('Site')] } }))
      .toEqual({ texts: { stack: [L('Design'), L('Site')] } })
    expect(sectionRow('svcAiBuild', { texts: { stack: ['Design'] } })).toEqual({})
  })

  it('drops texts / media on keys that do not own them', () => {
    expect(sectionRow('hero', { texts: { tags: [] }, media: { badge: img('/b.webp') } })).toEqual({})
    expect(sectionRow('svcHero', { texts: { tags: [] } })).toEqual({})
    expect(sectionRow('svcCta', { media: { badge: img('/b.webp') } })).toEqual({})
  })

  it('drops texts with a non-L tag', () => {
    expect(sectionRow('svcWebDevelopment', { texts: { tags: ['WordPress'] } })).toEqual({})
  })

  it('keeps block media with a badge and an optional picture', () => {
    expect(sectionRow('svcWebDevelopment', { media: { badge: img('/b.webp'), picture: img('/p.webp') } }))
      .toEqual({ media: { badge: img('/b.webp'), picture: img('/p.webp') } })
    expect(sectionRow('svcGoogleAds', { media: { badge: img('/b.webp') } }))
      .toEqual({ media: { badge: img('/b.webp') } })
    expect(sectionRow('svcGoogleAds', { media: {} })).toEqual({})
  })

  it('keeps AI Build media only with all three mockups', () => {
    const media = { site: img('/s.webp'), admin: img('/a.webp'), bot: img('/b.webp') }
    expect(sectionRow('svcAiBuild', { media })).toEqual({ media })
    expect(sectionRow('svcAiBuild', { media: { site: img('/s.webp') } })).toEqual({})
  })

  it('requires exactly 4 svcHero cards, each may carry tags', () => {
    const four = [1, 2, 3, 4].map((n) => card(`C${n}`, { tags: [L('x')] }))
    expect(sectionRow('svcHero', { cards: four })).toEqual({ cards: four })
    expect(sectionRow('svcHero', { cards: four.slice(0, 3) })).toEqual({})
  })

  it('requires track 0 or 1 on every Business Analysis card', () => {
    const ok = [card('A', { track: 0 }), card('B', { track: 1 })]
    expect(sectionRow('svcBusinessAnalysis', { cards: ok })).toEqual({ cards: ok })
    expect(sectionRow('svcBusinessAnalysis', { cards: [card('A')] })).toEqual({})
    expect(sectionRow('svcBusinessAnalysis', { cards: [card('A', { track: 2 })] })).toEqual({})
  })

  it('accepts an empty feature list on a block', () => {
    expect(sectionRow('svcWebDevelopment', { cards: [] })).toEqual({ cards: [] })
  })

  it('leaves the Home keys unchanged (no tags/track rules there)', () => {
    expect(sectionRow('hero', { cards: [card('A')] })).toEqual({ cards: [card('A')] })
  })
})
```

Append to `api/_lib/adminReset.test.ts` inside `describe('resetContent', …)`:

```ts
  it('carries svc texts and media through to the rpc', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })
    const texts = { tags: [L('WordPress')] }
    const media = { badge: { kind: 'asset', src: '/b.webp' } }
    await resetContent({ rpc } as never, {
      ...content,
      sections: [...content.sections, { key: 'svcGoogleAds', title: L('Google Ads'), texts, media }],
    })
    const p = rpc.mock.calls[0][1].payload
    const ads = p.sections.find((s: { key: string }) => s.key === 'svcGoogleAds')
    expect(ads.texts).toEqual(texts)
    expect(ads.media).toEqual(media)
    expect('texts' in p.sections.find((s: { key: string }) => s.key === 'hero')).toBe(false)
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run api/_lib/adminRows.test.ts api/_lib/adminReset.test.ts`
Expected: FAIL — `isSectionKey('svcHero')` is `false`, `texts`/`media` are dropped, the 3-card `svcHero` patch is accepted.

- [ ] **Step 3: Implement**

In `api/_lib/adminRows.ts` replace the `SECTION_KEYS` line with:

```ts
const HOME_SECTION_KEYS = ['hero', 'services', 'projects', 'howWork', 'about', 'cta', 'footer'] as const
const SVC_BLOCK_KEYS = ['svcWebDevelopment', 'svcWebsiteSupport', 'svcBusinessAnalysis', 'svcGoogleAds'] as const
const SECTION_KEYS = [...HOME_SECTION_KEYS, 'svcHero', ...SVC_BLOCK_KEYS, 'svcAiBuild', 'svcCta'] as const
```

Replace the `isCard` function and `sectionRow` with:

```ts
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isLArray = (v: unknown): boolean => Array.isArray(v) && v.every(isL)
const isBlockKey = (k: string): boolean => (SVC_BLOCK_KEYS as readonly string[]).includes(k)

const isCard = (v: unknown): boolean => {
  if (!isObject(v)) return false
  if (!isImageRefLike(v.icon)) return false
  if (!isL(v.title)) return false
  if (!isL(v.text)) return false
  if (v.sub !== undefined && !isL(v.sub)) return false
  if (v.tags !== undefined && !isLArray(v.tags)) return false
  if (v.track !== undefined && v.track !== 0 && v.track !== 1) return false
  return true
}

/** spec §5.5: per-key rules on top of the per-card shape check. */
const isCardsFor = (key: string, v: unknown): boolean => {
  if (!Array.isArray(v) || !v.every(isCard)) return false
  if (key === 'svcHero') return v.length === 4
  if (key === 'svcBusinessAnalysis') return v.every((c) => c.track === 0 || c.track === 1)
  return true
}

const isTrackHead = (v: unknown): boolean => isObject(v) && isL(v.label) && isL(v.title)

/** spec §5.3 `texts` — Content-owned; only the 4 blocks and AI Build have one. */
const isTextsFor = (key: string, v: unknown): boolean => {
  if (!isObject(v)) return false
  if (key === 'svcAiBuild') return isLArray(v.stack)
  if (!isBlockKey(key)) return false
  if (!isLArray(v.tags)) return false
  if (v.get !== undefined && !(isObject(v.get) && isL(v.get.title) && isL(v.get.text))) return false
  if (key === 'svcBusinessAnalysis')
    return Array.isArray(v.tracks) && v.tracks.length === 2 && v.tracks.every(isTrackHead)
  return v.tracks === undefined
}

/** spec §5.3 `media` — Cards-owned; only the 4 blocks and AI Build have one. */
const isMediaFor = (key: string, v: unknown): boolean => {
  if (!isObject(v)) return false
  if (key === 'svcAiBuild') return isImageRefLike(v.site) && isImageRefLike(v.admin) && isImageRefLike(v.bot)
  if (!isBlockKey(key)) return false
  return isImageRefLike(v.badge) && (v.picture === undefined || isImageRefLike(v.picture))
}

/** section patch → DB column subset. Only well-typed fields survive. */
export function sectionRow(key: string, patch: Patch): Patch {
  const out: Patch = {}
  if (isL(patch.eyebrow)) out.eyebrow = patch.eyebrow
  if (isL(patch.title)) out.title = patch.title
  if (isL(patch.body)) out.body = patch.body
  if (isL(patch.ctaLabel)) out.cta_label = patch.ctaLabel
  if (isCardsFor(key, patch.cards)) out.cards = patch.cards
  if (isCard(patch.launch)) out.launch = patch.launch
  if (isTextsFor(key, patch.texts)) out.texts = patch.texts
  if (isMediaFor(key, patch.media)) out.media = patch.media
  return out
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run api/_lib/adminRows.test.ts api/_lib/adminReset.test.ts api/_lib/adminContentHandler.test.ts`
Expected: PASS (all, including the pre-existing cases).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/adminRows.ts api/_lib/adminRows.test.ts api/_lib/adminReset.test.ts
git commit -m "feat(api): validate /services sections — svc keys, texts, media, per-key card rules"
```

---

### Task 2: Types, shared helpers and in-code defaults for the 7 sections

**Files:**
- Modify: `src/admin/types.ts`, `src/admin/api.ts:23`, `src/data/servicesPage.ts`, `src/content/defaults/sections.ts`
- Create: `src/content/servicesSections.ts`, `src/content/defaults/servicesPage.content.json`, `src/content/defaults/servicesPage.ts`
- Test: `src/content/defaults/index.test.ts`, `src/content/servicesSections.test.ts` (create), `src/admin/actions.test.ts:149`

**Interfaces:**
- Produces (types, `src/admin/types.ts`): `HomeSectionKey`, `ServicesSectionKey`, `ServiceBlockKey`, `SectionKey = HomeSectionKey | ServicesSectionKey`, `TrackHead { label: L; title: L }`, `ServiceBlockTexts { tags: L[]; get?: { title: L; text: L }; tracks?: [TrackHead, TrackHead] }`, `AiBuildTexts { stack: L[] }`, `SectionTexts`, `ServiceBlockMedia { badge: ImageRef; picture?: ImageRef }`, `AiBuildMedia { site; admin; bot: ImageRef }`, `SectionMedia`; `SectionCard.tags?: L[]`, `SectionCard.track?: 0 | 1`; `SectionText.texts?: SectionTexts`, `SectionText.media?: SectionMedia`.
- Produces (`src/content/servicesSections.ts`): `SVC_SECTION_KEYS: ServicesSectionKey[]` (page order), `SVC_BLOCK_KEYS: ServiceBlockKey[]`, `isServicesSectionKey(k: string): k is ServicesSectionKey`, `isBlockTexts(t: SectionTexts): t is ServiceBlockTexts`, `isAiBuildTexts(t): t is AiBuildTexts`, `isBlockMedia(m: SectionMedia): m is ServiceBlockMedia`, `isAiBuildMedia(m): m is AiBuildMedia`, `mergeTrack(cards: SectionCard[], track: 0 | 1, next: SectionCard[]): SectionCard[]`.
- Produces (`src/data/servicesPage.ts`): `ServiceBlockConfig.sectionKey: ServiceBlockKey`, `AI_BUILD_MOCKUPS: Record<'site' | 'admin' | 'bot', { src: string; width: number; height: number }>`.
- Produces (`src/content/defaults/servicesPage.ts`): `defaultServicesSections: SectionText[]`; `defaultSections` now has 14 entries (7 Home + 7 `svc*`, page order).

- [ ] **Step 1: Write the failing tests**

Replace the first test in `src/content/defaults/index.test.ts` and add three more:

```ts
  it('produces a versioned AdminData with the expected shape', () => {
    const d = buildDefaults()
    expect(d.version).toBe(DATA_VERSION)
    expect(d.sections.map((s) => s.key)).toEqual([
      'hero', 'services', 'projects', 'howWork', 'about', 'cta', 'footer',
      'svcHero', 'svcWebDevelopment', 'svcAiBuild', 'svcWebsiteSupport',
      'svcBusinessAnalysis', 'svcGoogleAds', 'svcCta',
    ])
    expect(d.seo).toHaveLength(8)
  })

  it('seeds the /services sections from the moved copy, uk = en', () => {
    const byKey = Object.fromEntries(buildDefaults().sections.map((s) => [s.key, s]))
    expect(byKey.svcHero.title.en).toBe('Every stage of your web project, covered')
    expect(byKey.svcHero.cards).toHaveLength(4)
    expect(byKey.svcHero.cards![3].tags!.map((t) => t.en)).toEqual(['Search', 'Analytics', 'Optimization'])
    expect(byKey.svcHero.cards![0].icon.src).toBe('/assets/services-page/icons/hero-code.svg')
    expect(byKey.svcWebDevelopment.ctaLabel!.en).toBe('Get a project estimate')
    expect(byKey.svcWebDevelopment.cards).toHaveLength(6)
    expect(byKey.svcWebDevelopment.media).toEqual({
      badge: { kind: 'asset', src: '/assets/services-page/badge-web.webp' },
      picture: { kind: 'asset', src: '/assets/services-page/picture-web.webp' },
    })
    expect(byKey.svcAiBuild.eyebrow.en).toBe('New')
    expect(byKey.svcAiBuild.texts).toEqual({ stack: expect.arrayContaining([{ en: 'Database', uk: 'Database' }]) })
    expect(byKey.svcCta.ctaLabel!.en).toBe('Request a Project Estimate')
    expect(byKey.svcWebDevelopment.title.uk).toBe(byKey.svcWebDevelopment.title.en)
  })

  it('Business Analysis has 2 track heads and items ordered Track 01 then Track 02', () => {
    const ba = buildDefaults().sections.find((s) => s.key === 'svcBusinessAnalysis')!
    expect(ba.texts).toMatchObject({ tracks: [{ title: { en: 'Business Process Analysis' } }, { title: { en: 'IT Business Analysis' } }] })
    expect(ba.cards!.map((c) => c.track)).toEqual([0, 0, 0, 1, 1, 1])
    expect(ba.cards![3].icon.src).toBe('/assets/services-page/icons/chat.svg')
  })

  it('Google Ads has no picture and no "What you get"', () => {
    const ads = buildDefaults().sections.find((s) => s.key === 'svcGoogleAds')!
    expect(ads.media).toEqual({ badge: { kind: 'asset', src: '/assets/services-page/badge-ads.webp' } })
    expect(ads.texts).toEqual({ tags: expect.any(Array) })
  })
```

Change `src/admin/actions.test.ts:149` from `toHaveLength(7)` to `toHaveLength(14)`.

Create `src/content/servicesSections.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isServicesSectionKey, mergeTrack, SVC_SECTION_KEYS } from './servicesSections'
import type { SectionCard } from '../admin/types'

const L = (s: string) => ({ en: s, uk: s })
const item = (title: string, track?: 0 | 1): SectionCard => ({
  icon: { kind: 'asset', src: '' }, title: L(title), text: L(''), ...(track !== undefined ? { track } : {}),
})

describe('servicesSections', () => {
  it('lists the 7 keys in page order', () => {
    expect(SVC_SECTION_KEYS).toEqual(['svcHero', 'svcWebDevelopment', 'svcAiBuild', 'svcWebsiteSupport',
      'svcBusinessAnalysis', 'svcGoogleAds', 'svcCta'])
    expect(isServicesSectionKey('svcCta')).toBe(true)
    expect(isServicesSectionKey('hero')).toBe(false)
  })

  it('mergeTrack replaces one track and keeps Track 01 items before Track 02 items', () => {
    const cards = [item('a', 0), item('b', 0), item('c', 1)]
    expect(mergeTrack(cards, 1, [item('c', 1), item('new')]).map((c) => [c.title.en, c.track]))
      .toEqual([['a', 0], ['b', 0], ['c', 1], ['new', 1]])
    expect(mergeTrack(cards, 0, []).map((c) => [c.title.en, c.track])).toEqual([['c', 1]])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/content/defaults/index.test.ts src/content/servicesSections.test.ts src/admin/actions.test.ts`
Expected: FAIL — `servicesSections` module not found, only 7 sections in defaults.

- [ ] **Step 3: Extend the types**

In `src/admin/types.ts` replace the `SectionKey` type, `SectionCard` and `SectionText` with:

```ts
export type HomeSectionKey =
  | 'hero'
  | 'services'
  | 'projects'
  | 'howWork'
  | 'about'
  | 'cta'
  | 'footer'

/** The four numbered blocks on /services (spec §5.1). */
export type ServiceBlockKey =
  | 'svcWebDevelopment'
  | 'svcWebsiteSupport'
  | 'svcBusinessAnalysis'
  | 'svcGoogleAds'

export type ServicesSectionKey = 'svcHero' | ServiceBlockKey | 'svcAiBuild' | 'svcCta'

export type SectionKey = HomeSectionKey | ServicesSectionKey

export interface SectionCard {
  icon: ImageRef
  title: L
  /** HowWork cards only */
  sub?: L
  text: L
  /** svcHero cards only — the small tags under the card title */
  tags?: L[]
  /** svcBusinessAnalysis feature items only — which of the 2 tracks */
  track?: 0 | 1
}

export interface TrackHead {
  label: L
  title: L
}

/** `texts` of the 4 service blocks — Content-owned (spec §5.3). */
export interface ServiceBlockTexts {
  tags: L[]
  /** "What you get" box — absent on svcGoogleAds */
  get?: { title: L; text: L }
  /** svcBusinessAnalysis only, exactly 2 */
  tracks?: [TrackHead, TrackHead]
}

/** `texts` of svcAiBuild — Content-owned. */
export interface AiBuildTexts {
  stack: L[]
}

export type SectionTexts = ServiceBlockTexts | AiBuildTexts

/** `media` of the 4 service blocks — Cards-owned (spec §5.3). */
export interface ServiceBlockMedia {
  badge: ImageRef
  /** absent on svcGoogleAds */
  picture?: ImageRef
}

/** `media` of svcAiBuild — Cards-owned. */
export interface AiBuildMedia {
  site: ImageRef
  admin: ImageRef
  bot: ImageRef
}

export type SectionMedia = ServiceBlockMedia | AiBuildMedia

export interface SectionText {
  key: SectionKey
  /** English label shown in the admin UI */
  label: string
  eyebrow: L
  title: L
  /** maps to the section's description / lede */
  body: L
  /** Hero + CTA (Home), every svc section except svcHero — button / link text */
  ctaLabel?: L
  /** Hero/HowWork/About cards; svcHero cards; svc block feature items */
  cards?: SectionCard[]
  /** Hero only — the standalone "Launch" card */
  launch?: SectionCard
  /** svc blocks + svcAiBuild — short text lists (Content-owned) */
  texts?: SectionTexts
  /** svc blocks + svcAiBuild — images (Cards-owned) */
  media?: SectionMedia
}
```

In `src/admin/api.ts` line 23 widen the `saveSection` patch type:

```ts
  saveSection: (key: SectionKey, patch: Partial<Pick<SectionText, 'eyebrow' | 'title' | 'body' | 'ctaLabel' | 'cards' | 'launch' | 'texts' | 'media'>>) =>
```

- [ ] **Step 4: Create the shared helpers**

Create `src/content/servicesSections.ts`:

```ts
import type {
  AiBuildMedia,
  AiBuildTexts,
  SectionCard,
  SectionMedia,
  SectionTexts,
  ServiceBlockKey,
  ServiceBlockMedia,
  ServiceBlockTexts,
  ServicesSectionKey,
} from '../admin/types'

/** The /services sections in page order (spec §5.1). */
export const SVC_SECTION_KEYS: ServicesSectionKey[] = [
  'svcHero',
  'svcWebDevelopment',
  'svcAiBuild',
  'svcWebsiteSupport',
  'svcBusinessAnalysis',
  'svcGoogleAds',
  'svcCta',
]

export const SVC_BLOCK_KEYS: ServiceBlockKey[] = [
  'svcWebDevelopment',
  'svcWebsiteSupport',
  'svcBusinessAnalysis',
  'svcGoogleAds',
]

export const isServicesSectionKey = (k: string): k is ServicesSectionKey =>
  (SVC_SECTION_KEYS as string[]).includes(k)

export const isBlockTexts = (t: SectionTexts): t is ServiceBlockTexts => 'tags' in t
export const isAiBuildTexts = (t: SectionTexts): t is AiBuildTexts => 'stack' in t
export const isBlockMedia = (m: SectionMedia): m is ServiceBlockMedia => 'badge' in m
export const isAiBuildMedia = (m: SectionMedia): m is AiBuildMedia => 'site' in m

/**
 * Business Analysis keeps its feature items in one `cards` array, Track 01
 * items first, then Track 02. Replace one track's items with `next` (stamping
 * the track on each) and keep that order.
 */
export function mergeTrack(cards: SectionCard[], track: 0 | 1, next: SectionCard[]): SectionCard[] {
  const t0 = track === 0 ? next.map((c) => ({ ...c, track: 0 as const })) : cards.filter((c) => c.track === 0)
  const t1 = track === 1 ? next.map((c) => ({ ...c, track: 1 as const })) : cards.filter((c) => c.track === 1)
  return [...t0, ...t1]
}
```

- [ ] **Step 5: Add `sectionKey` and the AI Build mockups to the asset config**

In `src/data/servicesPage.ts`:

1. Add at the top, after the header comment: `import type { ServiceBlockKey } from "../admin/types";`
2. Add to `ServiceBlockConfig`, under `contentKey`:

```ts
  /** the site_sections row this block reads from */
  sectionKey: ServiceBlockKey;
```

3. Add `sectionKey` to each `SERVICE_BLOCKS` entry: `sectionKey: "svcWebDevelopment"`, `sectionKey: "svcWebsiteSupport"`, `sectionKey: "svcBusinessAnalysis"`, `sectionKey: "svcGoogleAds"` (each directly under its `contentKey` line).
4. Update the doc comment of `badge`, `picture`, `featureIcons` and `SERVICES_HERO_CARDS` icons — they are now **default** assets: replace `featureIcons` comment with `/** default icon per feature item, in item order (tracked blocks: Track 01 first) */` and add above `SERVICES_HERO_CARDS`: `/** Hero navigation cards: anchor per index; \`icon\` is the default card icon. */` (replacing the old comment line).
5. Append:

```ts
/** Built-in AI Build mockups — their intrinsic sizes are only known for these files. */
export const AI_BUILD_MOCKUPS = {
  site: { src: `${ASSETS}/ai-mockup-site.webp`, width: 1357, height: 931 },
  admin: { src: `${ASSETS}/ai-mockup-admin.webp`, width: 1107, height: 497 },
  bot: { src: `${ASSETS}/ai-mockup-bot.webp`, width: 370, height: 548 },
} as const;
```

- [ ] **Step 6: Move the /services copy into a defaults JSON**

Run from the repo root (it copies today's `servicesPage` content, minus the chrome and alt strings that stay in i18n):

```bash
node -e "
const fs = require('fs')
const s = require('./src/i18n/en.json').servicesPage
const strip = ({ pictureAlt, mockupsAlt, ...rest }) => rest
const out = {
  hero: { eyebrow: s.hero.eyebrow, title: s.hero.title, body: s.hero.body, cards: s.hero.cards },
  webDevelopment: strip(s.webDevelopment),
  aiBuild: strip(s.aiBuild),
  websiteSupport: strip(s.websiteSupport),
  businessAnalysis: strip(s.businessAnalysis),
  googleAds: strip(s.googleAds),
  cta: s.cta,
}
fs.writeFileSync('src/content/defaults/servicesPage.content.json', JSON.stringify(out, null, 2) + '\n')
"
```

Check: `src/content/defaults/servicesPage.content.json` exists, has the 7 top-level keys, and contains no `pictureAlt` / `mockupsAlt`.

- [ ] **Step 7: Build the default sections**

Create `src/content/defaults/servicesPage.ts`:

```ts
import type { ImageRef, L, SectionCard, SectionText, ServiceBlockKey, TrackHead } from '../../admin/types'
import {
  AI_BUILD_MOCKUPS,
  SERVICE_BLOCKS,
  SERVICES_HERO_CARDS,
  type ServiceBlockConfig,
} from '../../data/servicesPage'
import c from './servicesPage.content.json'

// UA copy = EN until the site is translated (spec §4)
const same = (s: string): L => ({ en: s, uk: s })
const asset = (src: string): ImageRef => ({ kind: 'asset', src })

interface Feature {
  title: string
  text: string
}

interface BlockSource {
  title: string
  body: string
  tags: string[]
  cta: string
  features?: Feature[]
  tracks?: { label: string; title: string; features: Feature[] }[]
  get?: { title: string; text: string }
}

const LABELS: Record<ServiceBlockKey, string> = {
  svcWebDevelopment: 'Web Development',
  svcWebsiteSupport: 'Website Support & Development',
  svcBusinessAnalysis: 'Business Analysis',
  svcGoogleAds: 'Google Ads',
}

const head = (t: { label: string; title: string }): TrackHead => ({ label: same(t.label), title: same(t.title) })

function block(cfg: ServiceBlockConfig, src: BlockSource): SectionText {
  // tracked blocks keep one item list, Track 01 first; default icons follow it
  const items: { f: Feature; track?: 0 | 1 }[] = src.tracks
    ? src.tracks.flatMap((t, ti) => t.features.map((f) => ({ f, track: ti as 0 | 1 })))
    : (src.features ?? []).map((f) => ({ f }))
  const cards: SectionCard[] = items.map(({ f, track }, i) => ({
    icon: asset(cfg.featureIcons[i] ?? ''),
    title: same(f.title),
    text: same(f.text),
    ...(track !== undefined ? { track } : {}),
  }))
  return {
    key: cfg.sectionKey,
    label: LABELS[cfg.sectionKey],
    eyebrow: same(''),
    title: same(src.title),
    body: same(src.body),
    ctaLabel: same(src.cta),
    cards,
    texts: {
      tags: src.tags.map(same),
      ...(src.get ? { get: { title: same(src.get.title), text: same(src.get.text) } } : {}),
      ...(src.tracks ? { tracks: [head(src.tracks[0]), head(src.tracks[1])] as [TrackHead, TrackHead] } : {}),
    },
    media: {
      badge: asset(cfg.badge),
      ...(cfg.picture ? { picture: asset(cfg.picture.src) } : {}),
    },
  }
}

export const defaultServicesSections: SectionText[] = [
  {
    key: 'svcHero',
    label: 'Hero',
    eyebrow: same(c.hero.eyebrow),
    title: same(c.hero.title),
    body: same(c.hero.body),
    cards: c.hero.cards.map((card, i) => ({
      icon: asset(SERVICES_HERO_CARDS[i]?.icon ?? ''),
      title: same(card.title),
      text: same(''),
      tags: card.tags.map(same),
    })),
  },
  block(SERVICE_BLOCKS.webDevelopment, c.webDevelopment),
  {
    key: 'svcAiBuild',
    label: 'AI Build',
    eyebrow: same(c.aiBuild.badge),
    title: same(c.aiBuild.title),
    body: same(c.aiBuild.body),
    ctaLabel: same(c.aiBuild.link),
    texts: { stack: c.aiBuild.stack.map(same) },
    media: {
      site: asset(AI_BUILD_MOCKUPS.site.src),
      admin: asset(AI_BUILD_MOCKUPS.admin.src),
      bot: asset(AI_BUILD_MOCKUPS.bot.src),
    },
  },
  block(SERVICE_BLOCKS.websiteSupport, c.websiteSupport),
  block(SERVICE_BLOCKS.businessAnalysis, c.businessAnalysis),
  block(SERVICE_BLOCKS.googleAds, c.googleAds),
  {
    key: 'svcCta',
    label: 'Call-to-action',
    eyebrow: same(c.cta.eyebrow),
    title: same(c.cta.title),
    body: same(c.cta.body),
    ctaLabel: same(c.cta.button),
  },
]
```

In `src/content/defaults/sections.ts`:
1. Add `import { defaultServicesSections } from './servicesPage'` under the existing imports.
2. Rename `export const defaultSections: SectionText[] = [` to `const homeSections: SectionText[] = [`.
3. Append at the end of the file:

```ts
/** Home sections first, then the /services sections in page order. */
export const defaultSections: SectionText[] = [...homeSections, ...defaultServicesSections]
```

- [ ] **Step 8: Run the tests and the type check**

Run: `npx vitest run src/content/defaults/index.test.ts src/content/servicesSections.test.ts src/admin/actions.test.ts && npx tsc -b --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 9: Commit**

```bash
git add src/admin/types.ts src/admin/api.ts src/data/servicesPage.ts src/content/servicesSections.ts src/content/servicesSections.test.ts src/content/defaults/ src/admin/actions.test.ts
git commit -m "feat(content): /services section types, shared helpers and in-code defaults"
```

---

### Task 3: Map the new columns from Supabase; never lose the defaults

**Files:**
- Modify: `src/content/dbTypes.ts`, `src/content/mappers.ts`, `src/content/contentCache.ts`
- Test: `src/content/mappers.test.ts`, `src/content/contentCache.test.ts`

**Interfaces:**
- Consumes: types from Task 2; `defaultSections` (14 entries).
- Produces: `DbSectionRow.texts?: unknown`, `DbSectionRow.media?: unknown`; `rowsToSiteContent()` maps `texts` / `media` / card `tags` / `track` defensively and **appends any default section whose key has no row**; `CONTENT_CACHE_KEY = 'onvorx.content.cache.v3'`.

- [ ] **Step 1: Write the failing tests**

Append to `src/content/mappers.test.ts`:

```ts
describe('rowsToSiteContent — /services sections', () => {
  const svcRow = (over: Partial<DbContentRows['sections'][number]>): DbContentRows['sections'][number] => ({
    key: 'svcWebDevelopment', eyebrow: L(''), title: L('Web Development'), body: L('B'), cta_label: L('Go'),
    cards: null, launch: null, ...over,
  })

  it('maps block texts, media and card tags/track', () => {
    const c = rowsToSiteContent(withSections([
      svcRow({
        texts: { tags: [L('WordPress')], get: { title: L('G'), text: L('g') } },
        media: { badge: { kind: 'upload', src: 'https://cdn/b.webp', path: 'cards/b.webp' } },
      }),
      svcRow({
        key: 'svcBusinessAnalysis',
        texts: { tags: [], tracks: [{ label: L('T1'), title: L('A') }, { label: L('T2'), title: L('B') }] },
        cards: [{ icon: { kind: 'asset', src: '/i.svg' }, title: L('x'), text: L('y'), track: 1 }],
      }),
      svcRow({ key: 'svcHero', cards: [{ icon: { kind: 'asset', src: '/i.svg' }, title: L('x'), text: L(''), tags: [L('a')] }] }),
    ]))
    const wd = c.sections.find((s) => s.key === 'svcWebDevelopment')!
    expect(wd.texts).toEqual({ tags: [L('WordPress')], get: { title: L('G'), text: L('g') } })
    expect(wd.media).toEqual({ badge: { kind: 'upload', src: 'https://cdn/b.webp', path: 'cards/b.webp' } })
    const ba = c.sections.find((s) => s.key === 'svcBusinessAnalysis')!
    expect(ba.texts).toMatchObject({ tracks: [{ label: L('T1') }, { label: L('T2') }] })
    expect(ba.cards![0].track).toBe(1)
    expect(c.sections.find((s) => s.key === 'svcHero')!.cards![0].tags).toEqual([L('a')])
  })

  it('maps AI Build texts and media', () => {
    const img = { kind: 'asset', src: '/m.webp' }
    const c = rowsToSiteContent(withSections([
      svcRow({ key: 'svcAiBuild', texts: { stack: [L('Design')] }, media: { site: img, admin: img, bot: img } }),
    ]))
    const ai = c.sections.find((s) => s.key === 'svcAiBuild')!
    expect(ai.texts).toEqual({ stack: [L('Design')] })
    expect(ai.media).toEqual({ site: { kind: 'asset', src: '/m.webp' }, admin: { kind: 'asset', src: '/m.webp' }, bot: { kind: 'asset', src: '/m.webp' } })
  })

  it('ignores malformed hand-edited texts/media instead of throwing', () => {
    const c = rowsToSiteContent(withSections([
      svcRow({ texts: { tags: 'WordPress' }, media: { badge: 42 } }),
      svcRow({ key: 'svcGoogleAds', texts: { tags: [L('ok'), 'bad', null] }, media: null }),
    ]))
    const wd = c.sections.find((s) => s.key === 'svcWebDevelopment')!
    expect(wd.texts).toBeUndefined()
    expect(wd.media).toBeUndefined()
    expect(c.sections.find((s) => s.key === 'svcGoogleAds')!.texts).toEqual({ tags: [L('ok')] })
  })

  it('fills sections that have no row yet (DB not migrated) from the defaults', () => {
    const c = rowsToSiteContent(rows) // only hero + about rows
    expect(c.sections.map((s) => s.key)).toEqual(defaultSections.map((s) => s.key))
    const ads = c.sections.find((s) => s.key === 'svcGoogleAds')!
    expect(ads.title.en).toBe('Google Ads')
    expect(c.sections.find((s) => s.key === 'hero')!.title).toEqual(L('T')) // DB row still wins
  })
})
```

In `src/content/contentCache.test.ts` add:

```ts
  it('uses the v3 key, so a cache written before the /services sections existed is ignored', () => {
    expect(CONTENT_CACHE_KEY).toBe('onvorx.content.cache.v3')
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/content/mappers.test.ts src/content/contentCache.test.ts`
Expected: FAIL — `texts`/`media` undefined, only 2 sections returned, key is `v2`.

- [ ] **Step 3: Implement**

`src/content/dbTypes.ts` — add to `DbSectionRow` (optional: rows read before the migration have no such columns):

```ts
  /** svc sections only — raw JSONB, shape-checked by mappers.ts */
  texts?: unknown
  media?: unknown
```

`src/content/contentCache.ts` — change the key and its comment:

```ts
/**
 * Local mirror of the last-known-good remote `SiteContent`. Bumped to `v3` when
 * the /services sections were added: a `v2` cache has no `svc*` sections and
 * would otherwise replace the defaults with a page that has no content.
 */
export const CONTENT_CACHE_KEY = 'onvorx.content.cache.v3'
```

`src/content/mappers.ts`:

1. Extend the type import with `ImageRef, SectionMedia, SectionTexts, ServiceBlockTexts, TrackHead`.
2. Replace `asCard` / `asCards` with:

```ts
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const asImageRef = (v: unknown): ImageRef | undefined => {
  if (!isObj(v) || typeof v.src !== 'string') return undefined
  const ref: ImageRef = { kind: v.kind === 'upload' ? 'upload' : 'asset', src: v.src }
  if (typeof v.path === 'string' && v.path) ref.path = v.path
  return ref
}

/** Keeps the well-formed `L` entries of an array; anything else is dropped. */
const asLList = (v: unknown[]): L[] => v.filter(isLLike).map(asL)

const asCard = (v: unknown): SectionCard | undefined => {
  if (!isObj(v)) return undefined
  if (!isLLike(v.title) || !isLLike(v.text)) return undefined
  const card: SectionCard = {
    icon: asImageRef(v.icon) ?? { kind: 'asset', src: '' },
    title: asL(v.title),
    text: asL(v.text),
  }
  if (isLLike(v.sub)) card.sub = asL(v.sub)
  if (Array.isArray(v.tags)) card.tags = asLList(v.tags)
  if (v.track === 0 || v.track === 1) card.track = v.track
  return card
}

/** Non-array → `undefined`; otherwise every entry that fails `asCard` is dropped. */
const asCards = (v: unknown): SectionCard[] | undefined =>
  Array.isArray(v)
    ? v.map(asCard).filter((c): c is SectionCard => c !== undefined)
    : undefined

const asTrackHead = (v: unknown): TrackHead | undefined =>
  isObj(v) && isLLike(v.label) && isLLike(v.title) ? { label: asL(v.label), title: asL(v.title) } : undefined

/** Same idea as `asCard`: `sectionRow()` validates admin writes, a hand-edited row may not be. */
const asTexts = (v: unknown): SectionTexts | undefined => {
  if (!isObj(v)) return undefined
  if (Array.isArray(v.stack)) return { stack: asLList(v.stack) }
  if (!Array.isArray(v.tags)) return undefined
  const t: ServiceBlockTexts = { tags: asLList(v.tags) }
  if (isObj(v.get) && isLLike(v.get.title) && isLLike(v.get.text))
    t.get = { title: asL(v.get.title), text: asL(v.get.text) }
  if (Array.isArray(v.tracks) && v.tracks.length === 2) {
    const a = asTrackHead(v.tracks[0])
    const b = asTrackHead(v.tracks[1])
    if (a && b) t.tracks = [a, b]
  }
  return t
}

const asMedia = (v: unknown): SectionMedia | undefined => {
  if (!isObj(v)) return undefined
  const site = asImageRef(v.site)
  const admin = asImageRef(v.admin)
  const bot = asImageRef(v.bot)
  if (site && admin && bot) return { site, admin, bot }
  const badge = asImageRef(v.badge)
  if (!badge) return undefined
  const picture = asImageRef(v.picture)
  return picture ? { badge, picture } : { badge }
}
```

3. In `rowToSection`, after the `launch` lines, add:

```ts
  const texts = asTexts(row.texts)
  if (texts) s.texts = texts
  const media = asMedia(row.media)
  if (media) s.media = media
```

4. In `rowsToSiteContent` replace the `const sections = …` statement with:

```ts
  // A section with no row yet (production DB before its migration ran) falls
  // back to the bundled default instead of disappearing from the page.
  const present = new Set(rows.sections.map((r) => r.key))
  const missing = defaultSections
    .filter((s) => !present.has(s.key))
    .map((s) => JSON.parse(JSON.stringify(s)) as SectionText)
  const sections = [...rows.sections.map(rowToSection), ...missing].sort(
    (a, b) => SECTION_ORDER.indexOf(a.key) - SECTION_ORDER.indexOf(b.key),
  )
```

- [ ] **Step 4: Run the content tests**

Run: `npx vitest run src/content`
Expected: PASS (all content tests, including `remote.test.ts` and `SiteContentProvider.test.tsx`).

- [ ] **Step 5: Commit**

```bash
git add src/content/dbTypes.ts src/content/mappers.ts src/content/mappers.test.ts src/content/contentCache.ts src/content/contentCache.test.ts
git commit -m "feat(content): map svc texts/media from Supabase, fall back to defaults for missing sections"
```

---

### Task 4: Migration, schema and seed

**Files:**
- Modify: `scripts/gen-seed.ts`, `scripts/gen-seed.test.ts`, `supabase/schema.sql`, `supabase/seed.sql` (regenerated)
- Create: `supabase/migration-2026-10-05-services-page.sql`

**Interfaces:**
- Consumes: `buildDefaults()` (14 sections, Task 2).
- Produces: `sectionInsertSql(s: SectionText): string` (no trailing `;`), `buildServicesMigrationInserts(): string`; DB columns `site_sections.texts jsonb`, `site_sections.media jsonb`; key constraint with the 7 new keys; `reset_content` that also writes `texts` / `media`.

- [ ] **Step 1: Write the failing tests**

In `scripts/gen-seed.test.ts`:
1. Change the import to `import { buildSeedSql, buildServicesMigrationInserts, q } from './gen-seed'`.
2. Change `SECTION_COLS` to `['key', 'eyebrow', 'title', 'body', 'cta_label', 'cards', 'launch', 'texts', 'media']` and the `jsonbArg` `col` parameter type to `'cards' | 'launch' | 'texts' | 'media'`. In the existing count test change `.match(/insert into public\.site_sections/gi) ?? []).toHaveLength(7)` to `toHaveLength(14)`; if the existing loop over `sectionInserts` asserts an argument count, it now reads `SECTION_COLS.length` (9).
3. Add inside `describe('buildSeedSql', …)`:

```ts
  it('inserts the 7 /services sections with their texts and media', () => {
    const ads = sectionInserts.find((l) => l.includes("'svcGoogleAds'"))!
    expect(JSON.parse(jsonbArg(ads, 'media')!)).toEqual({
      badge: { kind: 'asset', src: '/assets/services-page/badge-ads.webp' },
    })
    expect(JSON.parse(jsonbArg(ads, 'texts')!).tags.length).toBeGreaterThan(0)
    const hero = sectionInserts.find((l) => l.includes("('hero',"))!
    expect(jsonbArg(hero, 'texts')).toBeNull()
    expect(sectionInserts).toHaveLength(14)
  })
```

4. Add a new block:

```ts
describe('buildServicesMigrationInserts', () => {
  it('emits one non-destructive insert per svc section', () => {
    const lines = buildServicesMigrationInserts().trim().split('\n')
    expect(lines).toHaveLength(7)
    for (const l of lines) {
      expect(l).toMatch(/^insert into public\.site_sections .* on conflict \(key\) do nothing;$/)
      expect(l).toMatch(/'svc[A-Za-z]+'/)
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/gen-seed.test.ts`
Expected: FAIL — `buildServicesMigrationInserts` is not exported; inserts have 7 columns.

- [ ] **Step 3: Implement the generator changes**

In `scripts/gen-seed.ts`:
1. Change the type import to `import type { L, ProjectCard, SectionText, ServiceCard } from '../src/admin/types'`.
2. Replace `jsonbAny` (keep its doc comment, update the last sentence to "…or SQL `null` when the section has no such value.") with:

```ts
export const jsonbAny = (v: unknown) =>
  v === null || v === undefined ? 'null' : `${q(JSON.stringify(v))}::jsonb`
```

3. Add above `buildSeedSql`:

```ts
/** One `site_sections` insert, without the trailing `;`. */
export const sectionInsertSql = (s: SectionText): string =>
  `insert into public.site_sections (key,eyebrow,title,body,cta_label,cards,launch,texts,media) values (` +
  `${q(s.key)},${jsonb(s.eyebrow)},${jsonb(s.title)},${jsonb(s.body)},` +
  `${s.ctaLabel ? jsonb(s.ctaLabel) : 'null'},${jsonbAny(s.cards)},${jsonbAny(s.launch)},` +
  `${jsonbAny(s.texts)},${jsonbAny(s.media)})`

/**
 * The /services rows for `supabase/migration-2026-10-05-services-page.sql` —
 * `on conflict do nothing`, so re-running it never overwrites admin edits.
 */
export function buildServicesMigrationInserts(): string {
  return buildDefaults()
    .sections.filter((s) => s.key.startsWith('svc'))
    .map((s) => `${sectionInsertSql(s)} on conflict (key) do nothing;`)
    .join('\n') + '\n'
}
```

4. In `buildSeedSql` replace the `for (const s of d.sections)` loop body with `lines.push(\`${sectionInsertSql(s)};\`)`.

- [ ] **Step 4: Run the generator tests**

Run: `npx vitest run scripts/gen-seed.test.ts`
Expected: PASS.

- [ ] **Step 5: Update `schema.sql` for fresh projects**

In `supabase/schema.sql`, in `create table if not exists public.site_sections`:
1. Replace the `check (key in (…))` line with:

```sql
             check (key in ('hero','services','projects','howWork','about','cta','footer',
                            'svcHero','svcWebDevelopment','svcAiBuild','svcWebsiteSupport',
                            'svcBusinessAnalysis','svcGoogleAds','svcCta')),
```

2. Add after the `launch jsonb,` line:

```sql
  -- /services sections only: `texts` is written by the admin Content screen,
  -- `media` by the Cards screen (one owner each, so saves never collide).
  -- Added live by migration-2026-10-05-services-page.sql.
  texts      jsonb,
  media      jsonb,
```

- [ ] **Step 6: Regenerate `seed.sql`**

Run: `npm run seed:gen`
Expected: `[seed] wrote …/supabase/seed.sql`; `git diff --stat supabase/seed.sql` shows the 7 home inserts changed (two extra `null` columns) and 7 new `svc*` inserts.

- [ ] **Step 7: Write the migration**

Generate the row inserts:

```bash
npx tsx -e "import('./scripts/gen-seed.ts').then((m) => process.stdout.write(m.buildServicesMigrationInserts()))" > "$TEMP/svc-inserts.sql"
```

Create `supabase/migration-2026-10-05-services-page.sql` with the content below, then replace the single line `-- <<< paste the 7 lines of $TEMP/svc-inserts.sql here >>>` with the 7 generated lines verbatim (do not edit them):

```sql
-- ============================================================================
--  ONVORX — /services page content becomes admin-editable.
--  Run once in the Supabase SQL Editor, after every prior migration-*.sql.
--  Fully re-runnable: columns use `if not exists`, the constraint is dropped
--  and re-created, rows use `on conflict (key) do nothing` (re-running never
--  overwrites edits made in /admin), reset_content is `create or replace`.
--  Must run BEFORE the matching code is deployed (spec §11).
-- ============================================================================

-- ---- 1. schema: two JSONB columns, one owner each ------------------------
--   texts — written only by the admin Content screen
--   media — written only by the admin Cards screen
alter table public.site_sections
  add column if not exists texts jsonb,
  add column if not exists media jsonb;

-- ---- 2. widen the key constraint with the 7 /services keys ----------------
alter table public.site_sections drop constraint if exists site_sections_key_check;
alter table public.site_sections add constraint site_sections_key_check
  check (key in ('hero','services','projects','howWork','about','cta','footer',
                 'svcHero','svcWebDevelopment','svcAiBuild','svcWebsiteSupport',
                 'svcBusinessAnalysis','svcGoogleAds','svcCta'));

-- ---- 3. the 7 rows, with today's /services content -------------------------
-- GENERATED by `buildServicesMigrationInserts()` in scripts/gen-seed.ts.
-- <<< paste the 7 lines of $TEMP/svc-inserts.sql here >>>

-- ---- 4. teach reset_content about texts/media ------------------------------
-- Same as migration-2026-09-14-hero-howwork-about-cards.sql apart from the two
-- new `texts` / `media` assignments in the sections loop.
create or replace function public.reset_content(payload jsonb) returns void
  language plpgsql
  set search_path = ''
as $$
declare
  s jsonb;
  e jsonb;
  card jsonb;
begin
  if payload is null
     or jsonb_typeof(payload -> 'cards') <> 'array'
     or jsonb_typeof(payload -> 'sections') <> 'array'
     or jsonb_typeof(payload -> 'seo') <> 'array' then
    raise exception 'reset_content: payload must have array keys sections, seo, cards';
  end if;

  for s in select * from jsonb_array_elements(payload -> 'sections') loop
    update public.site_sections set
      eyebrow   = coalesce(s -> 'eyebrow',   eyebrow),
      title     = coalesce(s -> 'title',     title),
      body      = coalesce(s -> 'body',      body),
      cta_label = case when s -> 'cta_label' = 'null'::jsonb or s -> 'cta_label' is null then null else s -> 'cta_label' end,
      cards     = case when s ? 'cards'  then nullif(s -> 'cards',  'null'::jsonb) else cards  end,
      launch    = case when s ? 'launch' then nullif(s -> 'launch', 'null'::jsonb) else launch end,
      texts     = case when s ? 'texts'  then nullif(s -> 'texts',  'null'::jsonb) else texts  end,
      media     = case when s ? 'media'  then nullif(s -> 'media',  'null'::jsonb) else media  end
    where key = s ->> 'key';
  end loop;

  for e in select * from jsonb_array_elements(payload -> 'seo') loop
    update public.seo_pages set
      title       = coalesce(e -> 'title',       title),
      description  = coalesce(e -> 'description', description)
    where page_key = e ->> 'page_key';
  end loop;

  delete from public.projects where true;
  delete from public.services where true;

  for card in select * from jsonb_array_elements(payload -> 'cards') loop
    if card ->> 'table' = 'projects' then
      insert into public.projects (list, id, sort, published, title, tags, description, image_url, image_path, image_alt)
      values (
        card ->> 'list', card ->> 'id', (card ->> 'sort')::int,
        coalesce((card ->> 'published')::boolean, false),
        coalesce(card -> 'title', '{"en":"","uk":""}'::jsonb),
        coalesce((select array_agg(x) from jsonb_array_elements_text(card -> 'tags') x), '{}'),
        coalesce(card -> 'description', '{"en":"","uk":""}'::jsonb),
        card ->> 'image_url', card ->> 'image_path',
        coalesce(card -> 'image_alt', '{"en":"","uk":""}'::jsonb)
      );
    else
      insert into public.services (list, id, sort, published, featured, title, text, icon_url, icon_path)
      values (
        card ->> 'list', card ->> 'id', (card ->> 'sort')::int,
        coalesce((card ->> 'published')::boolean, false),
        coalesce((card ->> 'featured')::boolean, false),
        coalesce(card -> 'title', '{"en":"","uk":""}'::jsonb),
        coalesce(card -> 'text', '{"en":"","uk":""}'::jsonb),
        card ->> 'icon_url', card ->> 'icon_path'
      );
    end if;
  end loop;
end $$;

revoke execute on function public.reset_content(jsonb) from anon, authenticated;
```

Check: `grep -c "on conflict (key) do nothing" supabase/migration-2026-10-05-services-page.sql` prints `7`, and the placeholder line is gone (`grep -c "paste the 7 lines" …` prints `0`).

- [ ] **Step 8: Commit**

```bash
git add scripts/gen-seed.ts scripts/gen-seed.test.ts supabase/schema.sql supabase/seed.sql supabase/migration-2026-10-05-services-page.sql
git commit -m "feat(db): migration + seed for the /services sections (texts, media, 7 rows, reset_content)"
```

---

### Task 5: `svcSection(key)` — the language-resolved read helper

**Files:**
- Modify: `src/content/useSiteContent.ts`
- Test: `src/content/useSiteContent.test.tsx` (create)

**Interfaces:**
- Consumes: `SectionText.texts` / `media`, guards from `src/content/servicesSections.ts`.
- Produces:

```ts
export interface ResolvedSvcCard { iconSrc: string; title: string; text: string; tags: string[]; track?: 0 | 1 }
export interface ResolvedSvcSection {
  eyebrow: string; title: string; body: string; ctaLabel: string
  cards: ResolvedSvcCard[]
  tags: string[]      // block tags (empty items dropped)
  stack: string[]     // AI Build stack (empty items dropped)
  get?: { title: string; text: string }
  tracks: { label: string; title: string }[]
  images: Partial<Record<'badge' | 'picture' | 'site' | 'admin' | 'bot', string>>  // only non-empty srcs
}
// on the object returned by useSiteContent():
svcSection: (key: ServicesSectionKey) => ResolvedSvcSection
```

- [ ] **Step 1: Write the failing test**

Create `src/content/useSiteContent.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { I18nProvider } from '../i18n/i18n'
import { SiteContentProvider } from './SiteContentProvider'
import { useSiteContent } from './useSiteContent'
import { saveContentCache } from './contentCache'
import { toSiteContent } from './toSiteContent'
import { buildDefaults } from './defaults'

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider>
    <SiteContentProvider>{children}</SiteContentProvider>
  </I18nProvider>
)

beforeEach(() => localStorage.clear())

describe('useSiteContent().svcSection', () => {
  it('resolves a block from the defaults', () => {
    const { result } = renderHook(() => useSiteContent(), { wrapper })
    const wd = result.current.svcSection('svcWebDevelopment')
    expect(wd.title).toBe('Web Development')
    expect(wd.ctaLabel).toBe('Get a project estimate')
    expect(wd.tags).toEqual(['WordPress', 'Webflow', 'Framer'])
    expect(wd.cards[0]).toMatchObject({ title: 'Design implementation', iconSrc: '/assets/services-page/icons/code.svg' })
    expect(wd.get?.title).toBe('A responsive website, ready to launch')
    expect(wd.images).toEqual({
      badge: '/assets/services-page/badge-web.webp',
      picture: '/assets/services-page/picture-web.webp',
    })
  })

  it('resolves tracks, stack and AI Build images', () => {
    const { result } = renderHook(() => useSiteContent(), { wrapper })
    const ba = result.current.svcSection('svcBusinessAnalysis')
    expect(ba.tracks.map((t) => t.label)).toEqual(['Track 01', 'Track 02'])
    expect(ba.cards.filter((c) => c.track === 1)).toHaveLength(3)
    const ai = result.current.svcSection('svcAiBuild')
    expect(ai.stack).toContain('Telegram bot')
    expect(Object.keys(ai.images).sort()).toEqual(['admin', 'bot', 'site'])
  })

  it('drops empty list items and empty image srcs', () => {
    const content = toSiteContent(buildDefaults())
    const ads = content.sections.find((s) => s.key === 'svcGoogleAds')!
    ads.texts = { tags: [{ en: 'Search', uk: '' }, { en: '', uk: '' }] }
    ads.media = { badge: { kind: 'asset', src: '' } }
    saveContentCache(content)
    const { result } = renderHook(() => useSiteContent(), { wrapper })
    const s = result.current.svcSection('svcGoogleAds')
    expect(s.tags).toEqual(['Search'])
    expect(s.images).toEqual({})
    expect(s.get).toBeUndefined()
    expect(s.tracks).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/content/useSiteContent.test.tsx`
Expected: FAIL — `svcSection is not a function`.

- [ ] **Step 3: Implement**

In `src/content/useSiteContent.ts`:
1. Change the type import to `import type { SectionCard, SectionKey, SeoPageKey, ServicesSectionKey } from '../admin/types'` and add `import { isAiBuildMedia, isAiBuildTexts, isBlockMedia, isBlockTexts } from './servicesSections'`.
2. Add after `ResolvedSectionCard`:

```ts
export interface ResolvedSvcCard {
  iconSrc: string
  title: string
  text: string
  tags: string[]
  track?: 0 | 1
}

export interface ResolvedSvcSection {
  eyebrow: string
  title: string
  body: string
  ctaLabel: string
  cards: ResolvedSvcCard[]
  /** block tags; empty items are dropped */
  tags: string[]
  /** AI Build stack; empty items are dropped */
  stack: string[]
  get?: { title: string; text: string }
  tracks: { label: string; title: string }[]
  /** only the images that have a src */
  images: Partial<Record<'badge' | 'picture' | 'site' | 'admin' | 'bot', string>>
}
```

3. Inside the `useMemo`, after `section`, add:

```ts
    const list = (items: { en: string; uk: string }[] | undefined) =>
      (items ?? []).map(pick).filter((s) => s !== '')

    const svcSection = (key: ServicesSectionKey): ResolvedSvcSection => {
      const s = data.sections.find((x) => x.key === key)
      const texts = s?.texts
      const media = s?.media
      const block = texts && isBlockTexts(texts) ? texts : undefined
      const images: ResolvedSvcSection['images'] = {}
      const put = (slot: keyof ResolvedSvcSection['images'], src: string | undefined) => {
        if (src) images[slot] = src
      }
      if (media && isBlockMedia(media)) {
        put('badge', media.badge.src)
        put('picture', media.picture?.src)
      }
      if (media && isAiBuildMedia(media)) {
        put('site', media.site.src)
        put('admin', media.admin.src)
        put('bot', media.bot.src)
      }
      return {
        eyebrow: s ? pick(s.eyebrow) : '',
        title: s ? pick(s.title) : '',
        body: s ? pick(s.body) : '',
        ctaLabel: s?.ctaLabel ? pick(s.ctaLabel) : '',
        cards: (s?.cards ?? []).map((c) => ({
          iconSrc: c.icon.src,
          title: pick(c.title),
          text: pick(c.text),
          tags: list(c.tags),
          ...(c.track !== undefined ? { track: c.track } : {}),
        })),
        tags: list(block?.tags),
        stack: list(texts && isAiBuildTexts(texts) ? texts.stack : undefined),
        ...(block?.get ? { get: { title: pick(block.get.title), text: pick(block.get.text) } } : {}),
        tracks: (block?.tracks ?? []).map((t) => ({ label: pick(t.label), title: pick(t.title) })),
        images,
      }
    }
```

4. Add `svcSection` to the returned object: `return { raw: data, actions, section, svcSection, projectsHome, servicesHome, seoFor }`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/content/useSiteContent.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/useSiteContent.ts src/content/useSiteContent.test.tsx
git commit -m "feat(content): svcSection() resolver for the /services sections"
```

---

### Task 6: `/services` reads from the store; i18n keeps only chrome strings

**Files:**
- Modify: `src/sections/ServicesHero/ServicesHero.tsx`, `src/sections/ServiceBlock/ServiceBlock.tsx`, `src/sections/AiBuild/AiBuild.tsx`, `src/pages/ServicesPage.tsx`, `src/i18n/en.json`, `src/i18n/uk.json`
- Test: `src/pages/ServicesPage.test.tsx`

**Interfaces:**
- Consumes: `svcSection()` (Task 5), `SERVICE_BLOCKS[*].sectionKey`, `SERVICES_HERO_CARDS[*].anchor`, `AI_BUILD_MOCKUPS` (Task 2).
- Produces: no new exports. After this task `servicesPage` in `en.json` / `uk.json` holds only `hero.cardsLabel`, `serviceLabel`, `whatYouGet`, `*.pictureAlt`, `aiBuild.mockupsAlt`.

- [ ] **Step 1: Write the failing tests**

Append to `src/pages/ServicesPage.test.tsx` (add `within` to the `@testing-library/react` import and these imports at the top):

```tsx
import { saveContentCache } from '../content/contentCache'
import { toSiteContent } from '../content/toSiteContent'
import { buildDefaults } from '../content/defaults'
import type { SiteContent } from '../content/mappers'

/** Seed the store through the content cache, then open /services. */
function renderWith(edit: (c: SiteContent) => void) {
  const content = toSiteContent(buildDefaults())
  edit(content)
  saveContentCache(content)
  window.history.pushState({}, '', '/services')
  return render(<App />)
}
const sec = (c: SiteContent, key: string) => c.sections.find((s) => s.key === key)!

describe('/services — content from the store', () => {
  it('shows edited titles, tags and hero cards', () => {
    renderWith((c) => {
      sec(c, 'svcWebDevelopment').title = { en: 'Websites, built right', uk: 'x' }
      sec(c, 'svcWebDevelopment').texts = { tags: [{ en: 'Astro', uk: 'Astro' }] }
      sec(c, 'svcHero').cards![0].title = { en: 'Build', uk: 'x' }
    })
    expect(screen.getByRole('heading', { level: 2, name: 'Websites, built right' })).toBeInTheDocument()
    expect(screen.getByText('Astro')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Build/ })).toHaveAttribute('href', '/services#web-development')
  })

  it('renders a block with no tags, no features and no badge without crashing', () => {
    const { container } = renderWith((c) => {
      const ads = sec(c, 'svcGoogleAds')
      ads.texts = { tags: [] }
      ads.cards = []
      ads.media = { badge: { kind: 'asset', src: '' } }
    })
    const block = container.querySelector('#paid-search')!
    expect(within(block as HTMLElement).getByRole('heading', { level: 2, name: 'Google Ads' })).toBeInTheDocument()
    expect(block.querySelector('.service-block__tags')).toBeNull()
    expect(block.querySelector('.service-block__badge')).toBeNull()
  })

  it('groups Business Analysis items by their track, whatever the array order', () => {
    renderWith((c) => {
      const ba = sec(c, 'svcBusinessAnalysis')
      const icon = { kind: 'asset' as const, src: '' }
      ba.cards = [
        { icon, title: { en: 'Second-track item', uk: '' }, text: { en: '', uk: '' }, track: 1 },
        { icon, title: { en: 'First-track item', uk: '' }, text: { en: '', uk: '' }, track: 0 },
      ]
    })
    const second = screen.getByText('Second-track item').closest('.service-block__track')!
    expect(second).toHaveTextContent('IT Business Analysis')
    const first = screen.getByText('First-track item').closest('.service-block__track')!
    expect(first).toHaveTextContent('Business Process Analysis')
  })

  it('an uploaded illustration has no fixed width/height; the built-in one keeps them', () => {
    const { container } = renderWith((c) => {
      sec(c, 'svcWebDevelopment').media = {
        badge: { kind: 'asset', src: '/assets/services-page/badge-web.webp' },
        picture: { kind: 'upload', src: 'https://cdn.example/new.webp', path: 'cards/new.webp' },
      }
    })
    const uploaded = container.querySelector('img[src="https://cdn.example/new.webp"]')!
    expect(uploaded.hasAttribute('width')).toBe(false)
    const builtIn = container.querySelector('img[src="/assets/services-page/picture-support.webp"]')!
    expect(builtIn.getAttribute('width')).toBe('960')
  })

  it('uses the svcCta texts for the bottom call-to-action', () => {
    renderWith((c) => {
      sec(c, 'svcCta').title = { en: 'Let us talk', uk: '' }
    })
    expect(screen.getByRole('heading', { level: 2, name: 'Let us talk' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/pages/ServicesPage.test.tsx`
Expected: the 5 new tests FAIL (the page still reads `en.json`); the existing ones PASS.

- [ ] **Step 3: Rewrite `ServicesHero`**

In `src/sections/ServicesHero/ServicesHero.tsx`:
1. Replace the imports block's i18n line and the `HeroCard` interface: keep `useI18n` (for `cardsLabel`), add `import { useSiteContent } from "../../content/useSiteContent";`, delete the `HeroCard` interface.
2. Replace the first two lines of the component body with:

```tsx
  const { t } = useI18n();
  const { svcSection } = useSiteContent();
  const hero = svcSection("svcHero");
```

3. Replace `{t("servicesPage.hero.eyebrow")}`, `{t("servicesPage.hero.title")}`, `{t("servicesPage.hero.body")}` with `{hero.eyebrow}`, `{hero.title}`, `{hero.body}`.
4. Replace the cards `map` body: `const content = cards[i];` → `const content = hero.cards[i];`; the icon `<img src={card.icon} alt="" />` → `{content.iconSrc && <img src={content.iconSrc} alt="" />}`; the tags map → 

```tsx
                      {content.tags.map((tag, j) => (
                        <span key={j} className="services-hero__card-tag">
                          {tag}
                        </span>
                      ))}
```

(`card.anchor` stays — anchors are code-owned, spec §5.4.)

- [ ] **Step 4: Rewrite `ServiceBlock`**

Replace the whole of `src/sections/ServiceBlock/ServiceBlock.tsx` with:

```tsx
import { useLocation } from "react-router-dom";
import { useI18n } from "../../i18n/i18n";
import { useSiteContent, type ResolvedSvcCard } from "../../content/useSiteContent";
import { useEstimateForm } from "../../components/EstimateForm/useEstimateForm";
import { Reveal } from "../../components/Reveal/Reveal";
import type { ServiceBlockConfig } from "../../data/servicesPage";
import "./ServiceBlock.css";

function FeatureList({
  features,
  headingLevel: Heading,
}: {
  features: ResolvedSvcCard[];
  headingLevel: "h3" | "h4";
}) {
  return (
    <ul className="service-block__features">
      {features.map((feature, i) => (
        <Reveal as="li" key={i} className="service-block__feature" variant="up" delay={50 * i}>
          <span className="service-block__feature-icon" aria-hidden="true">
            {feature.iconSrc && <img src={feature.iconSrc} alt="" />}
          </span>
          <div className="service-block__feature-body">
            <Heading className="service-block__feature-title">{feature.title}</Heading>
            <p className="service-block__feature-text">{feature.text}</p>
          </div>
        </Reveal>
      ))}
    </ul>
  );
}

export function ServiceBlock({ config }: { config: ServiceBlockConfig }) {
  const { t, tx } = useI18n();
  const { svcSection } = useSiteContent();
  const { open } = useEstimateForm();
  const { pathname } = useLocation();
  const content = svcSection(config.sectionKey);
  const { id, theme } = config;
  const titleId = `${id}-title`;
  const badgeSrc = content.images.badge;
  const pictureSrc = content.images.picture;
  // only the built-in illustration has known dimensions; an upload keeps CSS sizing
  const pictureSize = config.picture && config.picture.src === pictureSrc ? config.picture : undefined;
  const pictureAlt = tx<string | undefined>(`servicesPage.${config.contentKey}.pictureAlt`) ?? "";
  // items are grouped by their own `track`, not by array position
  const tracks = content.tracks.map((head, i) => ({
    ...head,
    features: content.cards.filter((c) => c.track === i),
  }));

  return (
    <section
      className={`section service-block ${id}`}
      data-theme={theme}
      id={id}
      aria-labelledby={titleId}
    >
      <div className={`${id}__container`}>
        <div className={`service-block__inner${pictureSrc ? "" : " service-block__inner--no-picture"}`}>
          <Reveal className="service-block__intro" variant="up">
            <div className="service-block__head">
              {badgeSrc && (
                <img
                  className="service-block__badge"
                  src={badgeSrc}
                  alt=""
                  width={64}
                  height={64}
                  loading="lazy"
                  decoding="async"
                />
              )}
              <span className="service-block__label">
                {config.number} / {t("servicesPage.serviceLabel")}
              </span>
            </div>
            <h2 className="service-block__title" id={titleId}>
              {content.title}
            </h2>
            <p className="service-block__description">{content.body}</p>
            {content.tags.length > 0 && (
              <ul className="service-block__tags">
                {content.tags.map((tag, i) => (
                  <li key={i} className="service-block__tag">
                    {tag}
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="service-block__cta" onClick={() => open(pathname)}>
              {content.ctaLabel}
              <img
                className="service-block__cta-arrow"
                src="/assets/services-page/icons/btn-arrow.svg"
                alt=""
              />
            </button>
          </Reveal>

          {pictureSrc && (
            <Reveal className="service-block__picture" variant="fade" delay={120}>
              <img
                src={pictureSrc}
                alt={pictureAlt}
                {...(pictureSize ? { width: pictureSize.width, height: pictureSize.height } : {})}
                loading="lazy"
                decoding="async"
              />
            </Reveal>
          )}

          <div className="service-block__body">
            {tracks.length > 0 ? (
              <div className="service-block__tracks">
                {tracks.map((track, i) => (
                  <div className="service-block__track" key={i}>
                    <h3 className="service-block__track-head">
                      <span className="service-block__track-label">{track.label}</span>
                      <span className="service-block__track-title">{track.title}</span>
                    </h3>
                    <FeatureList features={track.features} headingLevel="h4" />
                  </div>
                ))}
              </div>
            ) : (
              <FeatureList features={content.cards} headingLevel="h3" />
            )}

            {content.get && (
              <Reveal className="service-block__get" variant="up">
                <p className="service-block__get-eyebrow">{t("servicesPage.whatYouGet")}</p>
                <p className="service-block__get-title">{content.get.title}</p>
                <p className="service-block__get-text">{content.get.text}</p>
              </Reveal>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Rewrite `AiBuild`**

In `src/sections/AiBuild/AiBuild.tsx`:
1. Imports: add `import { useSiteContent } from "../../content/useSiteContent";` and `import { AI_BUILD_MOCKUPS } from "../../data/servicesPage";`; keep `ASSETS` (used for the link arrow).
2. Replace the two lines at the top of the component with:

```tsx
  const { t } = useI18n();
  const { svcSection } = useSiteContent();
  const ai = svcSection("svcAiBuild");
  const mockups = (["site", "admin", "bot"] as const).map((slot) => ({
    slot,
    src: ai.images[slot],
    // only the built-in files have known dimensions; uploads keep CSS sizing
    size: ai.images[slot] === AI_BUILD_MOCKUPS[slot].src ? AI_BUILD_MOCKUPS[slot] : undefined,
  }));
```

3. Replace `<span className="ai-build__pill">{t("servicesPage.aiBuild.badge")}</span>` with `{ai.eyebrow && <span className="ai-build__pill">{ai.eyebrow}</span>}`; `{t("servicesPage.aiBuild.title")}` → `{ai.title}`; `{t("servicesPage.aiBuild.body")}` → `{ai.body}`; `{t("servicesPage.aiBuild.link")}` → `{ai.ctaLabel}`.
4. In the stack map replace `stack.map((item, i) => (` with `ai.stack.map((item, i) => (`, `key={item}` with `key={i}`, and `i < stack.length - 1` with `i < ai.stack.length - 1`.
5. Replace the three `<img className="ai-build__mockup …">` elements with:

```tsx
              {mockups.map(
                (m) =>
                  m.src && (
                    <img
                      key={m.slot}
                      className={`ai-build__mockup ai-build__mockup--${m.slot}`}
                      src={m.src}
                      alt=""
                      {...(m.size ? { width: m.size.width, height: m.size.height } : {})}
                      loading="lazy"
                      decoding="async"
                    />
                  ),
              )}
```

- [ ] **Step 6: Point the page CTA at `svcCta`**

Replace `src/pages/ServicesPage.tsx` with:

```tsx
import { ServicesHero } from "../sections/ServicesHero/ServicesHero";
import { ServiceBlock } from "../sections/ServiceBlock/ServiceBlock";
import { AiBuild } from "../sections/AiBuild/AiBuild";
import { Cta } from "../sections/Cta/Cta";
import { SERVICE_BLOCKS } from "../data/servicesPage";
import { useSiteContent } from "../content/useSiteContent";

export function ServicesPage() {
  const { svcSection } = useSiteContent();
  const cta = svcSection("svcCta");

  return (
    <>
      <ServicesHero />
      <ServiceBlock config={SERVICE_BLOCKS.webDevelopment} />
      <AiBuild />
      <ServiceBlock config={SERVICE_BLOCKS.websiteSupport} />
      <ServiceBlock config={SERVICE_BLOCKS.businessAnalysis} />
      <ServiceBlock config={SERVICE_BLOCKS.googleAds} />
      <Cta
        content={{ eyebrow: cta.eyebrow, title: cta.title, body: cta.body, ctaLabel: cta.ctaLabel }}
      />
    </>
  );
}
```

- [ ] **Step 7: Remove the moved copy from i18n**

In both `src/i18n/en.json` and `src/i18n/uk.json`, replace the whole value of the top-level `"servicesPage"` key with exactly:

```json
  "servicesPage": {
    "hero": { "cardsLabel": "Service areas" },
    "serviceLabel": "Service",
    "whatYouGet": "What you get",
    "webDevelopment": { "pictureAlt": "Website layout illustration" },
    "aiBuild": { "mockupsAlt": "Website, admin panel and Telegram bot built on one shared database" },
    "websiteSupport": { "pictureAlt": "Website settings and release check illustration" },
    "businessAnalysis": { "pictureAlt": "Process flow diagram illustration" }
  }
```

(Keep the surrounding commas valid. `googleAds` and `cta` disappear entirely.) Then check nothing still reads a removed key:

Run: `grep -rn "servicesPage\.\(hero\.\(eyebrow\|title\|body\|cards\)\|cta\|googleAds\|aiBuild\.\(badge\|title\|body\|stack\|link\)\)" src --include=*.tsx --include=*.ts`
Expected: no output.

- [ ] **Step 8: Run the page tests and the type check**

Run: `npx vitest run src/pages && npx tsc -b --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 9: Look at the page**

Run `npx vite --port 5191`, open `http://localhost:5191/services` at 1440 px and 390 px wide, and compare with the production site: hero, 4 blocks, AI Build and CTA must look identical. Stop the server afterwards.

- [ ] **Step 10: Commit**

```bash
git add src/sections/ServicesHero src/sections/ServiceBlock src/sections/AiBuild src/pages/ServicesPage.tsx src/pages/ServicesPage.test.tsx src/i18n/en.json src/i18n/uk.json
git commit -m "feat(services): render /services from the content store instead of i18n"
```

---

### Task 7: `LocalizedListField` — an editable list of EN/UA items

**Files:**
- Create: `src/admin/components/LocalizedListField.tsx`, `src/admin/components/LocalizedListField.test.tsx`
- Modify: `src/admin/admin.css`

**Interfaces:**
- Produces: `LocalizedListField({ label: string; items: L[]; onChange: (next: L[]) => void; addLabel?: string })`. Accessible names: inputs `"<label> <n> EN"` / `"<label> <n> UA"`; buttons `"Move up: <label> <n>"`, `"Move down: <label> <n>"`, `"Remove: <label> <n>"`, `"<addLabel>"` (default `"Add item"`, visible text `+ <addLabel>`).

- [ ] **Step 1: Write the failing test**

Create `src/admin/components/LocalizedListField.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { L } from '../types'
import { LocalizedListField } from './LocalizedListField'

function Harness({ initial }: { initial: L[] }) {
  const [items, setItems] = useState(initial)
  return (
    <>
      <LocalizedListField label="Tags" items={items} onChange={setItems} addLabel="Add tag" />
      <output data-testid="value">{JSON.stringify(items)}</output>
    </>
  )
}
const value = () => JSON.parse(screen.getByTestId('value').textContent!) as L[]
const two = [{ en: 'A', uk: 'А' }, { en: 'B', uk: 'Б' }]

describe('LocalizedListField', () => {
  it('edits EN and UA separately', async () => {
    const user = userEvent.setup()
    render(<Harness initial={two} />)
    await user.type(screen.getByLabelText('Tags 2 UA'), '!')
    expect(value()[1]).toEqual({ en: 'B', uk: 'Б!' })
  })

  it('adds an empty item at the end', async () => {
    const user = userEvent.setup()
    render(<Harness initial={two} />)
    await user.click(screen.getByRole('button', { name: 'Add tag' }))
    expect(value()).toEqual([...two, { en: '', uk: '' }])
    expect(screen.getByLabelText('Tags 3 EN')).toHaveValue('')
  })

  it('removes an item', async () => {
    const user = userEvent.setup()
    render(<Harness initial={two} />)
    await user.click(screen.getByRole('button', { name: 'Remove: Tags 1' }))
    expect(value()).toEqual([two[1]])
  })

  it('moves items; the edge buttons are disabled', async () => {
    const user = userEvent.setup()
    render(<Harness initial={two} />)
    expect(screen.getByRole('button', { name: 'Move up: Tags 1' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move down: Tags 2' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Move down: Tags 1' }))
    expect(value()).toEqual([two[1], two[0]])
  })

  it('says so when the list is empty', () => {
    render(<Harness initial={[]} />)
    expect(screen.getByText(/no items yet/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/admin/components/LocalizedListField.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/admin/components/LocalizedListField.tsx`:

```tsx
import type { L } from '../types'

/** An editable list of short EN/UA strings: add, remove, move up / down. */
export function LocalizedListField({
  label,
  items,
  onChange,
  addLabel = 'Add item',
}: {
  label: string
  items: L[]
  onChange: (next: L[]) => void
  addLabel?: string
}) {
  const set = (i: number, patch: Partial<L>) =>
    onChange(items.map((item, j) => (j === i ? { ...item, ...patch } : item)))
  const move = (i: number, j: number) => {
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <fieldset className="admin-field admin-llist">
      <legend className="admin-field__label">{label}</legend>
      {items.length === 0 && <p className="admin-field__hint">No items yet.</p>}
      {items.map((item, i) => {
        const name = `${label} ${i + 1}`
        return (
          <div key={i} className="admin-llist__row">
            <input
              className="admin-input"
              aria-label={`${name} EN`}
              placeholder="EN"
              value={item.en}
              onChange={(e) => set(i, { en: e.target.value })}
            />
            <input
              className="admin-input"
              aria-label={`${name} UA`}
              placeholder="UA"
              value={item.uk}
              onChange={(e) => set(i, { uk: e.target.value })}
            />
            <button
              type="button"
              className="admin-cardrow__move"
              aria-label={`Move up: ${name}`}
              disabled={i === 0}
              onClick={() => move(i, i - 1)}
            >
              ▲
            </button>
            <button
              type="button"
              className="admin-cardrow__move"
              aria-label={`Move down: ${name}`}
              disabled={i === items.length - 1}
              onClick={() => move(i, i + 1)}
            >
              ▼
            </button>
            <button
              type="button"
              className="admin-cardrow__move"
              aria-label={`Remove: ${name}`}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        )
      })}
      <button
        type="button"
        className="admin-btn"
        aria-label={addLabel}
        onClick={() => onChange([...items, { en: '', uk: '' }])}
      >
        + {addLabel}
      </button>
    </fieldset>
  )
}
```

Append to `src/admin/admin.css`:

```css
/* --- localized list (tags, stack) --- */
.admin-llist { border: 0; padding: 0; margin: 0 0 1rem; min-width: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.admin-llist__row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto auto auto; gap: 0.4rem; align-items: center; }
.admin-llist > .admin-btn { align-self: flex-start; }
@media (max-width: 560px) {
  .admin-llist__row { grid-template-columns: minmax(0, 1fr) auto auto auto; }
  .admin-llist__row > .admin-input:nth-child(2) { grid-column: 1; grid-row: 2; }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/admin/components/LocalizedListField.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/components/LocalizedListField.tsx src/admin/components/LocalizedListField.test.tsx src/admin/admin.css
git commit -m "feat(admin): LocalizedListField for editable EN/UA lists"
```

---

### Task 8: Content — tabs `Home | Services` and the 7 Services editors

**Files:**
- Modify: `src/admin/pages/ContentPage.tsx`
- Create: `src/admin/pages/ServicesContent.tsx`
- Test: `src/admin/pages/ContentPage.test.tsx`

**Interfaces:**
- Consumes: `LocalizedListField` (Task 7); `SVC_SECTION_KEYS`, `isBlockTexts`, `isAiBuildTexts` (Task 2); `actions.updateSection(key, patch)`.
- Produces: `ServicesContent()` component. A Services save sends only `eyebrow` / `title` / `body` / `ctaLabel` / `texts` — **never** `cards` or `media`.

- [ ] **Step 1: Write the failing tests**

Append inside `describe('ContentPage', …)` in `src/admin/pages/ContentPage.test.tsx`:

```tsx
  it('has Home and Services tabs; Home is the default', async () => {
    const user = userEvent.setup()
    wrap()
    expect(screen.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('tab', { name: 'Services' }))
    for (const label of ['Hero', 'Web Development', 'AI Build', 'Website Support & Development',
      'Business Analysis', 'Google Ads', 'Call-to-action']) {
      expect(screen.getByRole('heading', { level: 2, name: label })).toBeInTheDocument()
    }
    expect(screen.queryByRole('heading', { name: /footer tagline/i })).not.toBeInTheDocument()
  })

  it('shows only the fields each /services section uses', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByRole('tab', { name: 'Services' }))
    const box = (name: string) => screen.getByRole('heading', { level: 2, name }).closest('details')!
    expect(within(box('AI Build')).getByLabelText('Badge')).toBeInTheDocument()
    expect(within(box('AI Build')).getByLabelText('Link text')).toBeInTheDocument()
    expect(within(box('AI Build')).getByLabelText('Stack 1 EN')).toBeInTheDocument()
    expect(within(box('Web Development')).queryByLabelText('Eyebrow')).not.toBeInTheDocument()
    expect(within(box('Web Development')).getByLabelText('Button label')).toBeInTheDocument()
    expect(within(box('Business Analysis')).getByLabelText('Track 02 — title')).toBeInTheDocument()
    expect(within(box('Google Ads')).queryByLabelText('What you get — title')).not.toBeInTheDocument()
    expect(within(box('Hero')).queryByLabelText('Button label')).not.toBeInTheDocument()
  })

  it('saving tags sends only texts — never cards or media', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByRole('tab', { name: 'Services' }))
    const wd = screen.getByRole('heading', { level: 2, name: 'Web Development' }).closest('details')!
    await user.click(within(wd).getByRole('button', { name: 'Add tag' }))
    await user.type(within(wd).getByLabelText('Tags 4 EN'), 'Astro')
    await user.click(within(wd).getByRole('button', { name: /^save$/i }))
    const [key, patch] = vi.mocked(adminApi.saveSection).mock.calls.at(-1)!
    expect(key).toBe('svcWebDevelopment')
    expect(Object.keys(patch)).toEqual(['texts'])
    expect((patch.texts as { tags: { en: string }[] }).tags.map((t) => t.en))
      .toEqual(['WordPress', 'Webflow', 'Framer', 'Astro'])
  })

  it('Discard restores the stored texts', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByRole('tab', { name: 'Services' }))
    const ai = screen.getByRole('heading', { level: 2, name: 'AI Build' }).closest('details')!
    await user.click(within(ai).getByRole('button', { name: 'Remove: Stack 1' }))
    await user.click(within(ai).getByRole('button', { name: /discard/i }))
    expect(within(ai).getByLabelText('Stack 1 EN')).toHaveValue('Design')
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/admin/pages/ContentPage.test.tsx`
Expected: the 4 new tests FAIL (no tabs); the existing ones PASS.

- [ ] **Step 3: Create the Services editors**

Create `src/admin/pages/ServicesContent.tsx`:

```tsx
import { useMemo, useState } from 'react'
import type { L, SectionText, SectionTexts, ServicesSectionKey, TrackHead } from '../types'
import { useSiteContentRaw } from '../../content/SiteContentProvider'
import { SVC_SECTION_KEYS, isAiBuildTexts, isBlockTexts } from '../../content/servicesSections'
import { LocalizedField } from '../components/LocalizedField'
import { LocalizedListField } from '../components/LocalizedListField'
import { SaveBar } from '../components/SaveBar'
import { useToast } from '../components/Toast'

/** Which of the optional columns each section shows, and under what name (spec §5.2). */
const FIELD_LABELS: Record<ServicesSectionKey, { eyebrow?: string; ctaLabel?: string }> = {
  svcHero: { eyebrow: 'Eyebrow' },
  svcWebDevelopment: { ctaLabel: 'Button label' },
  svcAiBuild: { eyebrow: 'Badge', ctaLabel: 'Link text' },
  svcWebsiteSupport: { ctaLabel: 'Button label' },
  svcBusinessAnalysis: { ctaLabel: 'Button label' },
  svcGoogleAds: { ctaLabel: 'Button label' },
  svcCta: { eyebrow: 'Eyebrow', ctaLabel: 'Button label' },
}

interface Draft {
  eyebrow: L
  title: L
  body: L
  ctaLabel?: L
  texts?: SectionTexts
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const toDraft = (s: SectionText): Draft =>
  clone({
    eyebrow: s.eyebrow,
    title: s.title,
    body: s.body,
    ...(s.ctaLabel ? { ctaLabel: s.ctaLabel } : {}),
    ...(s.texts ? { texts: s.texts } : {}),
  })

function SvcSectionEditor({ section }: { section: SectionText }) {
  const key = section.key as ServicesSectionKey
  const labels = FIELD_LABELS[key]
  const { actions } = useSiteContentRaw()
  const toast = useToast()

  const stored = useMemo(() => toDraft(section), [section])
  const [draft, setDraft] = useState<Draft>(() => toDraft(section))
  const dirty = !same(draft, stored)

  const save = async () => {
    // Content owns these columns only — never `cards` / `media` (spec §5.3),
    // so a save here cannot overwrite an image change made under Cards.
    const patch: Partial<Draft> = {}
    if (!same(draft.eyebrow, stored.eyebrow)) patch.eyebrow = draft.eyebrow
    if (!same(draft.title, stored.title)) patch.title = draft.title
    if (!same(draft.body, stored.body)) patch.body = draft.body
    if (draft.ctaLabel && !same(draft.ctaLabel, stored.ctaLabel)) patch.ctaLabel = draft.ctaLabel
    if (draft.texts && !same(draft.texts, stored.texts)) patch.texts = draft.texts
    try {
      await actions.updateSection(key, patch)
      toast('Saved')
    } catch {
      toast('Save failed', 'error')
    }
  }

  const texts = draft.texts
  const setTexts = (next: SectionTexts) => setDraft((d) => ({ ...d, texts: next }))

  return (
    <details className="admin-disclosure">
      <summary className="admin-disclosure__summary">
        <h2>{section.label}</h2>
      </summary>
      <div className="admin-disclosure__body">
        {labels.eyebrow && (
          <LocalizedField
            label={labels.eyebrow}
            value={draft.eyebrow}
            onChange={(v) => setDraft((d) => ({ ...d, eyebrow: v }))}
          />
        )}
        <LocalizedField label="Title" value={draft.title} onChange={(v) => setDraft((d) => ({ ...d, title: v }))} />
        <LocalizedField
          label="Body"
          value={draft.body}
          multiline
          onChange={(v) => setDraft((d) => ({ ...d, body: v }))}
        />
        {labels.ctaLabel && draft.ctaLabel && (
          <LocalizedField
            label={labels.ctaLabel}
            value={draft.ctaLabel}
            onChange={(v) => setDraft((d) => ({ ...d, ctaLabel: v }))}
          />
        )}

        {texts && isBlockTexts(texts) && (
          <>
            <LocalizedListField
              label="Tags"
              items={texts.tags}
              onChange={(tags) => setTexts({ ...texts, tags })}
              addLabel="Add tag"
            />
            {texts.tracks?.map((track, i) => {
              const setTrack = (patch: Partial<TrackHead>) =>
                setTexts({
                  ...texts,
                  tracks: texts.tracks!.map((t, j) => (j === i ? { ...t, ...patch } : t)) as [TrackHead, TrackHead],
                })
              return (
                <div key={i}>
                  <LocalizedField
                    label={`Track 0${i + 1} — label`}
                    value={track.label}
                    onChange={(label) => setTrack({ label })}
                  />
                  <LocalizedField
                    label={`Track 0${i + 1} — title`}
                    value={track.title}
                    onChange={(title) => setTrack({ title })}
                  />
                </div>
              )
            })}
            {texts.get && (
              <>
                <LocalizedField
                  label="What you get — title"
                  value={texts.get.title}
                  onChange={(title) => setTexts({ ...texts, get: { ...texts.get!, title } })}
                />
                <LocalizedField
                  label="What you get — text"
                  value={texts.get.text}
                  multiline
                  onChange={(text) => setTexts({ ...texts, get: { ...texts.get!, text } })}
                />
              </>
            )}
          </>
        )}

        {texts && isAiBuildTexts(texts) && (
          <LocalizedListField
            label="Stack"
            items={texts.stack}
            onChange={(stack) => setTexts({ stack })}
            addLabel="Add item"
          />
        )}

        <SaveBar dirty={dirty} onSave={save} onDiscard={() => setDraft(clone(stored))} />
      </div>
    </details>
  )
}

/** Content → Services: the texts of the 7 /services sections, in page order. */
export function ServicesContent() {
  const { data } = useSiteContentRaw()
  const sections = SVC_SECTION_KEYS.map((k) => data.sections.find((s) => s.key === k)).filter(
    (s): s is SectionText => Boolean(s),
  )
  return (
    <>
      <p className="admin-page__hint">
        Texts on the /services page. Cards and images are edited under Cards → Services → Services page.
      </p>
      {sections.map((s) => (
        <SvcSectionEditor key={s.key} section={s} />
      ))}
    </>
  )
}
```

- [ ] **Step 4: Add the tabs to `ContentPage`**

In `src/admin/pages/ContentPage.tsx`:
1. Add `import { ServicesContent } from './ServicesContent'` and change `ORDER`'s type to `HomeSectionKey[]` (import `HomeSectionKey` instead of `SectionKey`).
2. Replace the `ContentPage` function with:

```tsx
type PageTab = 'home' | 'services'
const PAGE_TABS: { key: PageTab; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'services', label: 'Services' },
]

export function ContentPage() {
  useAdminTitle('Content')
  const { data } = useSiteContentRaw()
  const [tab, setTab] = useState<PageTab>('home')
  const sections = ORDER.map((k) => data.sections.find((s) => s.key === k)).filter(
    (s): s is SectionText => Boolean(s),
  )
  return (
    <section className="admin-page">
      <h1>Content</h1>
      <div className="admin-tabs" role="tablist" aria-label="Page">
        {PAGE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === tab}
            className={`admin-tab${t.key === tab ? ' is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'home' && (
        <>
          <p className="admin-page__hint">
            The heading and text for each block on the home page. Changes appear on the
            site immediately after you save.
          </p>
          {sections.map((s) => (
            <SectionEditor key={s.key} section={s} />
          ))}
        </>
      )}
      {tab === 'services' && <ServicesContent />}
    </section>
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/admin/pages/ContentPage.test.tsx`
Expected: PASS (new and existing).

- [ ] **Step 6: Commit**

```bash
git add src/admin/pages/ContentPage.tsx src/admin/pages/ServicesContent.tsx src/admin/pages/ContentPage.test.tsx
git commit -m "feat(admin): Content tabs Home/Services with editors for the /services texts"
```

---

### Task 9: Cards → Services → Services page becomes the `/services` card editor

**Files:**
- Create: `src/admin/components/FeatureListEditor.tsx`, `src/admin/pages/ServicesPageCards.tsx`, `src/admin/pages/ServicesPageCards.test.tsx`
- Modify: `src/admin/pages/ServicesPage.tsx`, `src/admin/pages/ServicesPage.test.tsx`, `src/admin/pages/CardsPage.test.tsx`, `src/admin/pages/DashboardPage.tsx`, `src/admin/admin.css`

**Interfaces:**
- Consumes: `CardScreen`, `FixedCardList`, `ImageUpload` (`folder="cards"`, `deferDelete`), `LocalizedField`, `LocalizedListField`, `mergeTrack`, `isBlockMedia`, `isAiBuildMedia`, `defaultSections`.
- Produces: `FeatureListEditor({ label: string; items: SectionCard[]; onChange: (next: SectionCard[]) => void; newItemIcon: ImageRef })`; `ServicesPageCards<K extends string>({ tabs: { key: K; label: string }[]; activeList: K; onActiveListChange: (l: K) => void })`. A Cards save sends only `cards` / `media` — **never** `texts`.

- [ ] **Step 1: Write the failing tests**

Create `src/admin/pages/ServicesPageCards.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider } from '../../content/SiteContentProvider'
import { ToastProvider, ToastRegion } from '../components/Toast'
import { ServicesPageCards } from './ServicesPageCards'
import { adminApi } from '../../admin/api'
import type { SectionCard } from '../types'

vi.mock('../../admin/api', () => ({
  adminApi: {
    saveSection: vi.fn().mockResolvedValue(undefined),
    saveSeo: vi.fn().mockResolvedValue(undefined),
    resetContent: vi.fn().mockResolvedValue(undefined),
    createCard: vi.fn().mockResolvedValue(undefined),
    updateCard: vi.fn().mockResolvedValue(undefined),
    deleteCard: vi.fn().mockResolvedValue(undefined),
    reorderCards: vi.fn().mockResolvedValue(undefined),
    uploadImage: vi.fn().mockResolvedValue({ url: 'https://cdn/x.png', path: 'cards/x.png' }),
    deleteImage: vi.fn().mockResolvedValue(undefined),
  },
}))

beforeEach(() => {
  localStorage.clear()
  vi.mocked(adminApi.saveSection).mockClear()
})

const wrap = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <ToastProvider>
          <ServicesPageCards tabs={[{ key: 'page', label: 'Services page' }]} activeList="page" onActiveListChange={() => {}} />
          <ToastRegion />
        </ToastProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )
const lastPatch = () => vi.mocked(adminApi.saveSection).mock.calls.at(-1)!

describe('ServicesPageCards', () => {
  it('lists the 6 groups with nothing selected', () => {
    wrap()
    for (const g of ['Hero cards', 'Web Development', 'AI Build', 'Website Support', 'Business Analysis', 'Google Ads'])
      expect(screen.getByText(g)).toBeInTheDocument()
    expect(screen.getByText(/no group selected/i)).toBeInTheDocument()
  })

  it('Google Ads: badge and 4 feature items, no illustration', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Google Ads'))
    expect(screen.getByText('Badge')).toBeInTheDocument()
    expect(screen.queryByText('Illustration')).not.toBeInTheDocument()
    expect(screen.getAllByText(/^Item \d$/)).toHaveLength(4)
  })

  it('Hero cards: exactly 4 cards, no add button', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Hero cards'))
    expect(screen.getAllByText(/^Card \d$/)).toHaveLength(4)
    expect(screen.queryByRole('button', { name: /^add item/i })).not.toBeInTheDocument()
  })

  it('adding a feature item saves cards only, with the block icon as placeholder', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Web Development'))
    await user.click(screen.getByRole('button', { name: 'Add item to Features' }))
    const titles = screen.getAllByLabelText('Title')
    await user.type(titles[titles.length - 1], 'SEO basics')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    const [key, patch] = lastPatch()
    expect(key).toBe('svcWebDevelopment')
    expect(Object.keys(patch)).toEqual(['cards'])
    const cards = patch.cards as SectionCard[]
    expect(cards).toHaveLength(7)
    expect(cards[6].title.en).toBe('SEO basics')
    expect(cards[6].icon.src).toBe('/assets/services-page/icons/code.svg')
  })

  it('removing a badge saves media only', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Google Ads'))
    const badge = screen.getByText('Badge').closest('.admin-imageupload')! as HTMLElement
    await user.click(within(badge).getByRole('button', { name: /remove/i }))
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    const [key, patch] = lastPatch()
    expect(key).toBe('svcGoogleAds')
    expect(Object.keys(patch)).toEqual(['media'])
    expect(patch.media).toEqual({ badge: { kind: 'asset', src: '' } })
    expect(adminApi.deleteImage).not.toHaveBeenCalled() // draft-only until Save
  })

  it('Business Analysis keeps Track 01 items before Track 02 after edits', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Business Analysis'))
    await user.click(screen.getByRole('button', { name: 'Remove: Track 01 features item 1' }))
    await user.click(screen.getByRole('button', { name: 'Add item to Track 02 features' }))
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    const cards = lastPatch()[1].cards as SectionCard[]
    expect(cards.map((c) => c.track)).toEqual([0, 0, 1, 1, 1, 1])
  })

  it('switching groups drops the unsaved draft', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Web Development'))
    await user.click(screen.getByRole('button', { name: 'Remove: Features item 1' }))
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
    await user.click(screen.getByText('Google Ads'))
    await user.click(screen.getByText('Web Development'))
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
  })
})
```

In `src/admin/pages/ServicesPage.test.tsx`:
1. In `'clears the selection when switching tabs'` replace `expect(screen.getByText(/no card selected/i)).toBeInTheDocument()` with `expect(screen.getByText(/no group selected/i)).toBeInTheDocument()`.
2. Replace the test `'a freshly-selected untouched card on the Services page tab is not dirty'` with:

```tsx
  it('the Services page tab edits the /services groups, not the old card list', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByRole('tab', { name: /services page/i }))
    expect(screen.getByText('Hero cards')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add service/i })).not.toBeInTheDocument()
    await user.click(screen.getByText('Web Development'))
    expect(screen.getByText('Badge')).toBeInTheDocument()
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
  })
```

In `src/admin/pages/CardsPage.test.tsx` add:

```tsx
  it('resets the Services sub-tab and group when switching away and back', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByRole('tab', { name: 'Services' }))
    await user.click(screen.getByRole('tab', { name: /services page/i }))
    await user.click(screen.getByText('Google Ads'))
    expect(screen.getByText('Badge')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Hero' }))
    await user.click(screen.getByRole('tab', { name: 'Services' }))
    expect(screen.getByRole('tab', { name: /on the home page/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('Badge')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/admin/pages/ServicesPageCards.test.tsx src/admin/pages/ServicesPage.test.tsx src/admin/pages/CardsPage.test.tsx`
Expected: FAIL — `ServicesPageCards` not found; the Services page tab still shows the old list.

- [ ] **Step 3: Create `FeatureListEditor`**

Create `src/admin/components/FeatureListEditor.tsx`:

```tsx
import type { ImageRef, L, SectionCard } from '../types'
import { ImageUpload } from './ImageUpload'
import { LocalizedField } from './LocalizedField'

const emptyL = (): L => ({ en: '', uk: '' })

/** Feature items of a /services block: icon, title, text; add, remove, reorder. */
export function FeatureListEditor({
  label,
  items,
  onChange,
  newItemIcon,
}: {
  label: string
  items: SectionCard[]
  onChange: (next: SectionCard[]) => void
  /** icon a new item starts with — the block's first built-in feature icon */
  newItemIcon: ImageRef
}) {
  const set = (i: number, patch: Partial<SectionCard>) =>
    onChange(items.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const move = (i: number, j: number) => {
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <fieldset className="admin-group">
      <legend className="admin-field__label">{label}</legend>
      {items.length === 0 && <p className="admin-field__hint">No items yet.</p>}
      {items.map((item, i) => {
        const name = `${label} item ${i + 1}`
        return (
          <div key={i} className="admin-group__item">
            <div className="admin-group__head">
              <span>Item {i + 1}</span>
              <button
                type="button"
                className="admin-cardrow__move"
                aria-label={`Move up: ${name}`}
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
              >
                ▲
              </button>
              <button
                type="button"
                className="admin-cardrow__move"
                aria-label={`Move down: ${name}`}
                disabled={i === items.length - 1}
                onClick={() => move(i, i + 1)}
              >
                ▼
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--danger"
                aria-label={`Remove: ${name}`}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
            <ImageUpload
              label="Icon"
              folder="cards"
              variant="icon"
              value={item.icon}
              onChange={async (icon) => set(i, { icon })}
              onClear={async () => set(i, { icon: { kind: 'asset', src: '' } })}
              // draft-only until Save — the old Storage object must outlive a discard
              deferDelete={true}
            />
            <LocalizedField label="Title" value={item.title} onChange={(title) => set(i, { title })} />
            <LocalizedField label="Text" value={item.text} multiline onChange={(text) => set(i, { text })} />
          </div>
        )
      })}
      <button
        type="button"
        className="admin-btn"
        aria-label={`Add item to ${label}`}
        onClick={() => onChange([...items, { icon: { ...newItemIcon }, title: emptyL(), text: emptyL() }])}
      >
        + Add item
      </button>
    </fieldset>
  )
}
```

Append to `src/admin/admin.css`:

```css
/* --- grouped editors (/services cards) --- */
.admin-group { border: 1px solid var(--border, #e8e8ec); border-radius: var(--radius-md, 12px); padding: 0.75rem 1rem 1rem; margin: 0 0 1rem; min-width: 0; display: flex; flex-direction: column; gap: 0.75rem; }
.admin-group__item { border-top: 1px solid var(--border, #e8e8ec); padding-top: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
.admin-group__item:first-of-type { border-top: 0; padding-top: 0; }
.admin-group__head { display: flex; align-items: center; gap: 0.4rem; font-weight: 600; }
.admin-group__head > span { flex: 1; }
.admin-group > .admin-btn { align-self: flex-start; }
```

- [ ] **Step 4: Create `ServicesPageCards`**

Create `src/admin/pages/ServicesPageCards.tsx`:

```tsx
import { useMemo, useState, type ReactNode } from 'react'
import type { ImageRef, SectionCard, SectionMedia, SectionText, ServicesSectionKey } from '../types'
import { useSiteContentRaw } from '../../content/SiteContentProvider'
import { defaultSections } from '../../content/defaults/sections'
import { isAiBuildMedia, isBlockMedia, mergeTrack } from '../../content/servicesSections'
import { CardScreen } from './CardScreen'
import { FixedCardList } from '../components/FixedCardList'
import { FeatureListEditor } from '../components/FeatureListEditor'
import { ImageUpload } from '../components/ImageUpload'
import { LocalizedField } from '../components/LocalizedField'
import { LocalizedListField } from '../components/LocalizedListField'
import { SaveBar } from '../components/SaveBar'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'

type Group = Exclude<ServicesSectionKey, 'svcCta'>

const GROUPS: { id: Group; label: string }[] = [
  { id: 'svcHero', label: 'Hero cards' },
  { id: 'svcWebDevelopment', label: 'Web Development' },
  { id: 'svcAiBuild', label: 'AI Build' },
  { id: 'svcWebsiteSupport', label: 'Website Support' },
  { id: 'svcBusinessAnalysis', label: 'Business Analysis' },
  { id: 'svcGoogleAds', label: 'Google Ads' },
]

/** The Google Ads block has no illustration in the design (spec §5.3). */
const NO_PICTURE: Group[] = ['svcGoogleAds']

const emptyImage = (): ImageRef => ({ kind: 'asset', src: '' })
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** A new feature item starts with the block's first built-in icon (spec §6.2). */
const placeholderIcon = (key: Group): ImageRef => ({
  ...(defaultSections.find((s) => s.key === key)?.cards?.[0]?.icon ?? emptyImage()),
})

interface Draft {
  cards: SectionCard[]
  media?: SectionMedia
}

function GroupEditor({ sectionKey, section }: { sectionKey: Group; section: SectionText }) {
  const { actions } = useSiteContentRaw()
  const toast = useToast()

  const stored = useMemo<Draft>(
    () => clone({ cards: section.cards ?? [], ...(section.media ? { media: section.media } : {}) }),
    [section],
  )
  const [draft, setDraft] = useState<Draft>(() => clone(stored))
  const dirty = !same(draft, stored)

  const save = async () => {
    // Cards owns `cards` + `media` only — never `texts` (spec §5.3).
    const patch: Partial<Pick<SectionText, 'cards' | 'media'>> = {}
    if (!same(draft.cards, stored.cards)) patch.cards = draft.cards
    if (draft.media && !same(draft.media, stored.media)) patch.media = draft.media
    try {
      await actions.updateSection(sectionKey, patch)
      toast('Saved')
    } catch {
      toast('Save failed', 'error')
    }
  }

  const setCards = (cards: SectionCard[]) => setDraft((d) => ({ ...d, cards }))
  const setMedia = (media: SectionMedia) => setDraft((d) => ({ ...d, media }))
  const setCard = (i: number, patch: Partial<SectionCard>) =>
    setCards(draft.cards.map((c, j) => (j === i ? { ...c, ...patch } : c)))

  const image = (label: string, value: ImageRef, onSet: (ref: ImageRef) => void, variant: 'icon' | 'photo') => (
    <ImageUpload
      label={label}
      folder="cards"
      variant={variant}
      value={value}
      onChange={async (ref) => onSet(ref)}
      onClear={async () => onSet(emptyImage())}
      // draft-only until Save — the old Storage object must outlive a discard
      deferDelete={true}
    />
  )

  let body: ReactNode
  if (sectionKey === 'svcHero') {
    body = draft.cards.map((card, i) => (
      <fieldset key={i} className="admin-group">
        <legend className="admin-field__label">Card {i + 1}</legend>
        {image('Icon', card.icon, (icon) => setCard(i, { icon }), 'icon')}
        <LocalizedField label="Title" value={card.title} onChange={(title) => setCard(i, { title })} />
        <LocalizedListField label="Tags" items={card.tags ?? []} onChange={(tags) => setCard(i, { tags })} addLabel="Add tag" />
      </fieldset>
    ))
  } else if (sectionKey === 'svcAiBuild') {
    const media =
      draft.media && isAiBuildMedia(draft.media)
        ? draft.media
        : { site: emptyImage(), admin: emptyImage(), bot: emptyImage() }
    body = (
      <>
        {image('Site mockup', media.site, (site) => setMedia({ ...media, site }), 'photo')}
        {image('Admin panel mockup', media.admin, (admin) => setMedia({ ...media, admin }), 'photo')}
        {image('Telegram bot mockup', media.bot, (bot) => setMedia({ ...media, bot }), 'photo')}
      </>
    )
  } else {
    const media = draft.media && isBlockMedia(draft.media) ? draft.media : { badge: emptyImage() }
    const icon = placeholderIcon(sectionKey)
    body = (
      <>
        {image('Badge', media.badge, (badge) => setMedia({ ...media, badge }), 'icon')}
        {!NO_PICTURE.includes(sectionKey) &&
          image('Illustration', media.picture ?? emptyImage(), (picture) => setMedia({ ...media, picture }), 'photo')}
        {sectionKey === 'svcBusinessAnalysis' ? (
          ([0, 1] as const).map((track) => (
            <FeatureListEditor
              key={track}
              label={`Track 0${track + 1} features`}
              items={draft.cards.filter((c) => c.track === track)}
              newItemIcon={icon}
              onChange={(next) => setCards(mergeTrack(draft.cards, track, next))}
            />
          ))
        ) : (
          <FeatureListEditor label="Features" items={draft.cards} newItemIcon={icon} onChange={setCards} />
        )}
      </>
    )
  }

  return (
    <div>
      {body}
      <SaveBar dirty={dirty} onSave={save} onDiscard={() => setDraft(clone(stored))} />
    </div>
  )
}

/** Cards → Services → Services page: the /services cards and images (spec §6.2). */
export function ServicesPageCards<K extends string>({
  tabs,
  activeList,
  onActiveListChange,
}: {
  tabs: { key: K; label: string }[]
  activeList: K
  onActiveListChange: (l: K) => void
}) {
  const { data } = useSiteContentRaw()
  const [selected, setSelected] = useState<Group | null>(null)
  const section = selected ? data.sections.find((s) => s.key === selected) : undefined

  const list = (
    <FixedCardList items={GROUPS} selectedId={selected} onSelect={(id) => setSelected(id as Group)} />
  )
  const editor =
    selected && section ? (
      // keyed by group: switching groups starts a fresh draft
      <GroupEditor key={selected} sectionKey={selected} section={section} />
    ) : (
      <EmptyState title="No group selected" hint="Pick a group from the list." />
    )

  return (
    <CardScreen
      title="Services"
      hint="Cards and images on the /services page. Texts are edited under Content → Services."
      tabs={tabs}
      activeList={activeList}
      onActiveListChange={onActiveListChange}
      list={list}
      editor={editor}
    />
  )
}
```

- [ ] **Step 5: Route the Services page tab to the new editor**

In `src/admin/pages/ServicesPage.tsx`:
1. Add `import { ServicesPageCards } from './ServicesPageCards'`.
2. Directly before the final `return (` add:

```tsx
  // The old list='page' service cards are no longer rendered anywhere; this
  // tab now edits the /services page itself (spec §6.2). The rows stay in the DB.
  if (list === 'servicesPage') {
    return (
      <ServicesPageCards
        tabs={TABS}
        activeList={list}
        onActiveListChange={(l) => {
          setList(l)
          setSelectedId(null)
        }}
      />
    )
  }
```

3. Change the `CardScreen` `hint` to `"Service cards shown in the Services block on the home page."`.

In `src/admin/pages/DashboardPage.tsx` delete the `admin-stat` block whose label is `Services — page` (the hidden list).

- [ ] **Step 6: Run the admin tests**

Run: `npx vitest run src/admin`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/admin/components/FeatureListEditor.tsx src/admin/pages/ServicesPageCards.tsx src/admin/pages/ServicesPageCards.test.tsx src/admin/pages/ServicesPage.tsx src/admin/pages/ServicesPage.test.tsx src/admin/pages/CardsPage.test.tsx src/admin/pages/DashboardPage.tsx src/admin/admin.css
git commit -m "feat(admin): Cards → Services page edits the /services cards and images"
```

---

### Task 10: SEO — tabs `Home | Services | Projects | About`

**Files:**
- Modify: `src/admin/pages/SeoPage.tsx`
- Test: `src/admin/pages/SeoPage.test.tsx`

**Interfaces:**
- Consumes: `SERVICE_BLOCKS[*].id` from `src/data/servicesPage.ts`.
- Produces: no new exports. `pageKey`s and `seo_pages` rows are unchanged (spec §6.3).

- [ ] **Step 1: Write the failing tests**

In `src/admin/pages/SeoPage.test.tsx` replace the `'lists all 8 pages'` test with:

```tsx
  it('groups the 8 entries in tabs; Home is the default', async () => {
    const user = userEvent.setup()
    wrap()
    expect(screen.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: /^Home$/ })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /web development/i })).not.toBeInTheDocument()
    expect(screen.getAllByText(/\/ 60$/).length).toBeGreaterThan(0) // char counters

    await user.click(screen.getByRole('tab', { name: 'Services' }))
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(5)
    expect(screen.getByText('Web Development → /services#web-development')).toBeInTheDocument()
    expect(screen.getByText('Google Ads → /services#paid-search')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Projects' }))
    expect(screen.getByRole('heading', { name: /^Projects$/ })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'About' }))
    expect(screen.getByRole('heading', { name: /^About$/ })).toBeInTheDocument()
  })

  it('the SERP preview of a block entry shows its real address', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByRole('tab', { name: 'Services' }))
    expect(screen.getByText('onvorx.com/services#paid-search')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/admin/pages/SeoPage.test.tsx`
Expected: FAIL — no tabs.

- [ ] **Step 3: Implement**

In `src/admin/pages/SeoPage.tsx`:
1. Add imports: `useState` (to the `react` import), `import type { SeoPageKey } from '../types'` (merge into the existing type import), `import { SERVICE_BLOCKS } from '../../data/servicesPage'`.
2. Change `SeoEntryEditor`'s signature to `function SeoEntryEditor({ entry, label, address }: { entry: SeoEntry; label?: string; address?: string })`, its heading to `<h2>{label ?? entry.label}</h2>`, add as the first child of `admin-disclosure__body`:

```tsx
        {address && <p className="admin-field__hint">{label} → {address}</p>}
```

and change the preview to `<SerpPreview … path={address ?? entry.path} />`.
3. Replace `SeoPage` with:

```tsx
type SeoTab = 'home' | 'services' | 'projects' | 'about'

interface TabEntry {
  pageKey: SeoPageKey
  /** overrides the stored label, e.g. for the /services blocks */
  label?: string
  /** where the entry really lives now; also used by the SERP preview */
  address?: string
}

const block = (id: string) => `/services#${id}`

/** spec §6.3 — grouping and labels only; pageKeys and rows are unchanged. */
const SEO_TABS: { key: SeoTab; label: string; entries: TabEntry[] }[] = [
  { key: 'home', label: 'Home', entries: [{ pageKey: 'home' }] },
  {
    key: 'services',
    label: 'Services',
    entries: [
      { pageKey: 'services' },
      { pageKey: 'web-development', label: 'Web Development', address: block(SERVICE_BLOCKS.webDevelopment.id) },
      { pageKey: 'support', label: 'Website Support & Development', address: block(SERVICE_BLOCKS.websiteSupport.id) },
      { pageKey: 'business-analysis', label: 'Business Analysis', address: block(SERVICE_BLOCKS.businessAnalysis.id) },
      { pageKey: 'google-ads', label: 'Google Ads', address: block(SERVICE_BLOCKS.googleAds.id) },
    ],
  },
  { key: 'projects', label: 'Projects', entries: [{ pageKey: 'projects' }] },
  { key: 'about', label: 'About', entries: [{ pageKey: 'about' }] },
]

export function SeoPage() {
  useAdminTitle('SEO')
  const { data } = useSiteContentRaw()
  const [tab, setTab] = useState<SeoTab>('home')
  const active = SEO_TABS.find((t) => t.key === tab)!
  return (
    <section className="admin-page">
      <h1>SEO</h1>
      <p className="admin-page__hint">
        The title and description search engines show for each page. Keep the title under ~60
        characters and the description under ~155.
      </p>
      <div className="admin-tabs" role="tablist" aria-label="Page">
        {SEO_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === tab}
            className={`admin-tab${t.key === tab ? ' is-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {active.entries.map(({ pageKey, label, address }) => {
        const entry = data.seo.find((e) => e.pageKey === pageKey)
        return entry ? <SeoEntryEditor key={pageKey} entry={entry} label={label} address={address} /> : null
      })}
    </section>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/admin/pages/SeoPage.test.tsx`
Expected: PASS (new tests and `'edits the Home SEO title and saves'`).

- [ ] **Step 5: Commit**

```bash
git add src/admin/pages/SeoPage.tsx src/admin/pages/SeoPage.test.tsx
git commit -m "feat(admin): SEO tabs Home/Services/Projects/About with real block addresses"
```

---

### Task 11: Telegram bot — page choice, svc Title/Body, Services cards = Home only

**Files:**
- Modify: `api/_lib/telegramMenu.ts`, `api/_lib/telegramDispatch.ts`, `api/_lib/telegramCardsDispatch.ts`
- Test: `api/_lib/telegramMenu.test.ts`, `api/_lib/telegramDispatch.test.ts`, `api/_lib/telegramCardsDispatch.test.ts`

**Interfaces:**
- Consumes: `isSectionKey` accepting `svc*` (Task 1) through `handleAdminContent`.
- Produces (`telegramMenu.ts`): `type ContentPage = 'home' | 'services'`; `buildContentPagePicker(): BotReply`; `buildContentList(page: ContentPage): BotReply`; `contentPageOf(key: string): ContentPage`; `sectionFieldsFor(key: string): ContentField[]` (now exported); `buildCardTypeTabs(type: 'projects')`. Callbacks: `content:list` → picker; `content:page:home` / `content:page:services` → block list; Services card list Back → `menu:main`.

- [ ] **Step 1: Write the failing tests**

In `api/_lib/telegramMenu.test.ts`:
1. Add `buildContentPagePicker, contentPageOf, sectionFieldsFor` to the import list.
2. Replace `describe('buildContentList', …)` with:

```ts
describe('buildContentPagePicker / buildContentList', () => {
  it('asks for the page first', () => {
    const r = buildContentPagePicker()
    expect(r.text).toBe('Content — choose a page:')
    expect(readButtons(r)).toEqual([
      { text: 'Home', data: 'content:page:home' },
      { text: 'Services', data: 'content:page:services' },
      { text: '⬅ Back', data: 'menu:main' },
    ])
  })
  it('Home lists the six home blocks, then Back to the page choice', () => {
    expect(readButtons(buildContentList('home'))).toEqual([
      { text: 'Hero', data: 'content:section:hero' },
      { text: 'Services', data: 'content:section:services' },
      { text: 'Projects', data: 'content:section:projects' },
      { text: 'How We Work', data: 'content:section:howWork' },
      { text: 'About', data: 'content:section:about' },
      { text: 'CTA', data: 'content:section:cta' },
      { text: '⬅ Back', data: 'content:list' },
    ])
  })
  it('Services lists the 7 /services sections', () => {
    expect(readButtons(buildContentList('services'))).toEqual([
      { text: 'Hero', data: 'content:section:svcHero' },
      { text: 'Web Development', data: 'content:section:svcWebDevelopment' },
      { text: 'AI Build', data: 'content:section:svcAiBuild' },
      { text: 'Website Support', data: 'content:section:svcWebsiteSupport' },
      { text: 'Business Analysis', data: 'content:section:svcBusinessAnalysis' },
      { text: 'Google Ads', data: 'content:section:svcGoogleAds' },
      { text: 'CTA', data: 'content:section:svcCta' },
      { text: '⬅ Back', data: 'content:list' },
    ])
  })
  it('svc sections expose Title and Body only', () => {
    expect(sectionFieldsFor('svcCta')).toEqual(['title', 'body'])
    expect(contentPageOf('svcCta')).toBe('services')
    expect(contentPageOf('hero')).toBe('home')
  })
})
```

3. Add inside `describe('buildSectionDetail', …)`:

```ts
  it('a svc section offers Title/Body and goes Back to the Services list', () => {
    const r = buildSectionDetail({ ...HERO, key: 'svcGoogleAds', ctaLabel: L('Plan', 'Plan') })
    expect(readButtons(r)).toEqual([
      { text: 'Title', data: 'content:field:title' },
      { text: 'Body', data: 'content:field:body' },
      { text: '⬅ Back', data: 'content:page:services' },
    ])
  })
```

(If `L` is not defined in that test file, use `{ en: 'Plan', uk: 'Plan' }`.) Also change any existing assertion in that describe that expects `{ text: '⬅ Back', data: 'content:list' }` to `data: 'content:page:home'`.

4. In `describe('buildCardTypeTabs', …)` delete the `'services: …'` test. In `describe('buildServiceList', …)` change the expected Back button to `{ text: '⬅ Back', data: 'menu:main' }`.

In `api/_lib/telegramDispatch.test.ts`:
1. Change the test `'owner opens content:list and sees the six blocks'` to expect `reply.text` `'Content — choose a page:'` and rename it `'owner opens content:list and is asked for the page'`.
2. In `'an unknown section key shows an error and falls back to the list'` keep the expectation (`'Content — choose a block:'`) — the fallback now shows the Home list.
3. Add `svcGoogleAds: { key: 'svcGoogleAds', eyebrow: L('', ''), title: L('Google Ads', 'Google Ads'), body: L('B', 'B'), ctaLabel: L('Plan', 'Plan') }` to the `sections` record inside `makeDeps`.
4. Add inside `describe('dispatch — Content, owner + content_manager', …)`:

```ts
  it('content:page:services lists the /services sections', async () => {
    const { deps } = makeDeps()
    const ctx = makeCtx({ callbackData: 'content:page:services' })
    await dispatch(ctx, ENV, deps)
    const reply = (ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(reply.text).toBe('Content — choose a block:')
    const data = (reply.keyboard.inline_keyboard as { callback_data: string }[][]).flat().map((b) => b.callback_data)
    expect(data).toContain('content:section:svcGoogleAds')
  })

  it('edits the title of a svc section through the shared content handler', async () => {
    const { deps, getSections } = makeDeps()
    await dispatch(makeCtx({ callbackData: 'content:section:svcGoogleAds' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'content:field:title' }), ENV, deps)
    await dispatch(makeCtx({ callbackData: 'content:lang:en' }), ENV, deps)
    await dispatch(makeCtx({ text: 'Paid search' }), ENV, deps)
    expect(getSections().svcGoogleAds.title).toEqual({ en: 'Paid search', uk: 'Google Ads' })
  })

  it('a stale Eyebrow button on a svc section is refused', async () => {
    const { deps } = makeDeps()
    await dispatch(makeCtx({ callbackData: 'content:section:svcGoogleAds' }), ENV, deps)
    const ctx = makeCtx({ callbackData: 'content:field:eyebrow' })
    await dispatch(ctx, ENV, deps)
    expect(ctx.reply).toHaveBeenCalledWith({ text: "That field can't be edited here." })
  })
```

In `api/_lib/telegramCardsDispatch.test.ts` add inside `describe('dispatchCardsCallback — list and detail', …)`:

```ts
  it('cards:services:list goes straight to the home list (no Services page list)', async () => {
    const { deps, cards } = makeDeps()
    const ctx = makeCtx({ callbackData: 'cards:services:list' })
    await dispatchCardsCallback(ctx, 'cards:services:list', ENV, deps)
    expect(cards.listServices).toHaveBeenCalledWith('home', ENV)
    expect((ctx.reply as ReturnType<typeof vi.fn>).mock.calls[0][0].text).toContain('home page')
  })

  it('an old "Services page" button opens the home list, never list=page', async () => {
    const { deps, cards } = makeDeps()
    const ctx = makeCtx({ callbackData: 'cards:services:tab:page' })
    await dispatchCardsCallback(ctx, 'cards:services:tab:page', ENV, deps)
    expect(cards.listServices).toHaveBeenCalledWith('home', ENV)
    expect(cards.listServices).not.toHaveBeenCalledWith('page', ENV)
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run api/_lib/telegramMenu.test.ts api/_lib/telegramDispatch.test.ts api/_lib/telegramCardsDispatch.test.ts`
Expected: FAIL — `buildContentPagePicker` not exported; `content:list` still shows blocks; services list goes to tabs.

- [ ] **Step 3: Implement the menu**

In `api/_lib/telegramMenu.ts` replace the `// ---- Content ----` block up to (not including) `buildSectionDetail` with:

```ts
// ---- Content ----

export type ContentPage = 'home' | 'services'

const CONTENT_SECTIONS: Record<ContentPage, { key: string; label: string }[]> = {
  home: [
    { key: 'hero', label: 'Hero' },
    { key: 'services', label: 'Services' },
    { key: 'projects', label: 'Projects' },
    { key: 'howWork', label: 'How We Work' },
    { key: 'about', label: 'About' },
    { key: 'cta', label: 'CTA' },
  ],
  services: [
    { key: 'svcHero', label: 'Hero' },
    { key: 'svcWebDevelopment', label: 'Web Development' },
    { key: 'svcAiBuild', label: 'AI Build' },
    { key: 'svcWebsiteSupport', label: 'Website Support' },
    { key: 'svcBusinessAnalysis', label: 'Business Analysis' },
    { key: 'svcGoogleAds', label: 'Google Ads' },
    { key: 'svcCta', label: 'CTA' },
  ],
}

const CTA_SECTIONS = ['hero', 'cta']

const CONTENT_FIELD_LABEL: Record<ContentField, string> = {
  eyebrow: 'Eyebrow',
  title: 'Title',
  body: 'Body',
  ctaLabel: 'CTA label',
}

export const contentPageOf = (key: string): ContentPage => (key.startsWith('svc') ? 'services' : 'home')

/** The bot edits only Title + Body of the /services sections (spec §7). */
export function sectionFieldsFor(key: string): ContentField[] {
  if (contentPageOf(key) === 'services') return ['title', 'body']
  return CTA_SECTIONS.includes(key) ? ['eyebrow', 'title', 'body', 'ctaLabel'] : ['eyebrow', 'title', 'body']
}

export function sectionFieldValue(record: SectionRecord, field: ContentField): { en: string; uk: string } {
  return field === 'ctaLabel' ? (record.ctaLabel ?? { en: '', uk: '' }) : record[field]
}

export function buildContentPagePicker(): BotReply {
  const kb = new InlineKeyboard()
    .text('Home', 'content:page:home')
    .row()
    .text('Services', 'content:page:services')
    .row()
    .text('⬅ Back', 'menu:main')
  return { text: 'Content — choose a page:', keyboard: kb }
}

export function buildContentList(page: ContentPage): BotReply {
  const kb = new InlineKeyboard()
  CONTENT_SECTIONS[page].forEach((s) => kb.text(s.label, `content:section:${s.key}`).row())
  kb.text('⬅ Back', 'content:list')
  return { text: 'Content — choose a block:', keyboard: kb }
}
```

In `buildSectionDetail` replace `kb.text('⬅ Back', 'content:list')` with `kb.text('⬅ Back', \`content:page:${contentPageOf(record.key)}\`)`.

Change `buildCardTypeTabs`'s signature to `buildCardTypeTabs(type: 'projects'): BotReply` and simplify its body to the projects case only:

```ts
export function buildCardTypeTabs(type: 'projects'): BotReply {
  const kb = new InlineKeyboard()
    .text('On the home page', `cards:${type}:tab:home`)
    .row()
    .text('Projects page', `cards:${type}:tab:page`)
    .row()
    .text('⬅ Back', 'menu:main')
  return { text: 'Projects — choose a list:', keyboard: kb }
}
```

In `buildServiceList` replace `kb.text('⬅ Back', 'cards:services:list')` with:

```ts
  // Services has only the home list now (spec §7) — Back returns to the main menu
  kb.text('⬅ Back', 'menu:main')
```

- [ ] **Step 4: Implement the content dispatch**

In `api/_lib/telegramDispatch.ts` replace `showContentList` with:

```ts
async function showContentPicker(ctx: BotCtx, env: Env, deps: DispatchDeps): Promise<void> {
  await deps.sessions.save(ctx.chatId, { screen: 'content_pages' }, env)
  await ctx.reply(menu.buildContentPagePicker())
}

async function showContentList(
  ctx: BotCtx, env: Env, deps: DispatchDeps, page: menu.ContentPage = 'home',
): Promise<void> {
  await deps.sessions.save(ctx.chatId, { screen: 'content_list', data: { page } }, env)
  await ctx.reply(menu.buildContentList(page))
}
```

Every existing `await showContentList(ctx, env, deps)` call that follows a failed `getSection(key, …)` becomes `await showContentList(ctx, env, deps, menu.contentPageOf(key))` (in `showSectionDetail`, the `content:lang:` branch and `saveContentField`).

In `handleContentCallback`:
1. Replace the `content:list` branch body with `await showContentPicker(ctx, env, deps)`.
2. Add right after it:

```ts
  if (data === 'content:page:home' || data === 'content:page:services') {
    await showContentList(ctx, env, deps, data === 'content:page:services' ? 'services' : 'home')
    return
  }
```

3. In the `content:field:` branch, after the `if (!key) { … }` guard, add:

```ts
    // a stale button (e.g. Eyebrow) must not reach a field this section doesn't offer
    if (!menu.sectionFieldsFor(key).includes(field)) {
      await ctx.reply({ text: "That field can't be edited here." })
      return
    }
```

- [ ] **Step 5: Implement the cards dispatch**

In `api/_lib/telegramCardsDispatch.ts` replace the first two `if` branches of `dispatchCardsCallback` with:

```ts
  if (data === 'cards:projects:list') {
    await showTabs(ctx, 'projects', env, deps)
    return
  }
  // Services has only the home list; an old "Services page" button lands there too (spec §7)
  if (data === 'cards:services:list' || data.startsWith('cards:services:tab:')) {
    await showList(ctx, 'services', 'home', env, deps)
    return
  }
  if (data.startsWith('cards:projects:tab:')) {
    await showList(ctx, 'projects', data.split(':')[3] as CardList, env, deps)
    return
  }
```

and change `showTabs`'s `type` parameter to `'projects'`.

- [ ] **Step 6: Run the bot tests and the API type check**

Run: `npx vitest run api && npm run typecheck:api`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add api/_lib/telegramMenu.ts api/_lib/telegramDispatch.ts api/_lib/telegramCardsDispatch.ts api/_lib/telegramMenu.test.ts api/_lib/telegramDispatch.test.ts api/_lib/telegramCardsDispatch.test.ts
git commit -m "feat(bot): Content page choice with /services Title/Body; Services cards = home list only"
```

---

### Task 12: Full verification, project map, rollout

**Files:**
- Modify: `docs/PROJECT-MAP.md`

- [ ] **Step 1: Full test, lint and build**

Run: `npm test && npm run lint && npm run build`
Expected: all tests PASS, lint reports 0 errors, build succeeds. Fix anything that fails before continuing.

- [ ] **Step 2: Local smoke test of the admin**

Run `npx vite --port 5191` and, without Supabase env (store runs on defaults), open:
- `/admin` → Content → Services: 7 sections; edit a tag in Web Development, Save → no error toast in the network-less dev (the call fails with 401/500 and shows "Save failed" — that is expected locally; check the request body in DevTools contains only `texts`).
- Cards → Services → Services page: all 6 groups open; Business Analysis shows two feature lists.
- SEO → Services: 5 entries, "Google Ads → /services#paid-search".
Stop the server.

- [ ] **Step 3: Update the project map**

In `docs/PROJECT-MAP.md`, in `## 🔲 Публичный сайт — недостающие страницы`, replace the line starting with `- [ ] \`/services\` — редактирование из админки` with:

```markdown
- [x] `/services` — весь контент (тексты, списки, карточки, иконки, бейджи, иллюстрации, мокапы) редактируется из админки; Content/Cards/SEO с вкладками; бот правит Title/Body секций — [spec](superpowers/specs/2026-10-05-services-admin-design.md) · [plan](superpowers/plans/2026-10-05-services-admin.md)
- [ ] `/about`, `/projects` — ждут дизайна
- [ ] Перевод на украинский — после завершения EN-версии сайта (сейчас `uk` = английский текст)
```

and delete the now-duplicated `- [ ] \`/about\` — заглушка` and `- [ ] \`/projects\` — отдельной страницы нет вообще …` lines.

- [ ] **Step 4: Commit**

```bash
git add docs/PROJECT-MAP.md
git commit -m "docs: PROJECT-MAP — /services admin editing done"
```

- [ ] **Step 5: Rollout (operator + engineer, in this order — spec §11)**

1. **Operator:** open the Supabase project → SQL Editor → New query, paste the whole of `supabase/migration-2026-10-05-services-page.sql`, Run. Expected: "Success. No rows returned". Check: `select key, texts is not null as has_texts, media is not null as has_media from public.site_sections where key like 'svc%' order by key;` returns 7 rows; `svcHero` and `svcCta` have both `false`, the other five have both `true`.
2. **Engineer:** open a PR from `feat/services-admin`, let Vercel build a Preview, then do the live round-trip on the Preview against the real Supabase:
   - Content → Services → Web Development: change a tag, Save, reload `/services` on the Preview → the tag changed.
   - Cards → Services page → Website Support: add a feature item with a title, upload a new icon for it, upload a new illustration, Save → both images show on `/services`.
   - Content again: change Website Support's title, Save → the uploaded illustration is still there (columns don't collide).
   - Telegram bot → Content → Services → Google Ads → Title → EN → send a new title → shows on `/services`.
   - Settings → Reset to defaults → `/services` returns to the original copy and images.
3. Merge to `main`; Vercel deploys Production. Repeat a quick look at `/services` and `/admin` on production together with the owner.
