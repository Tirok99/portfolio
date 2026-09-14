# Admin: Hero/HowWork/About Cards + Footer Tagline — Design Spec

**Status:** Approved by user, ready for implementation planning.

## 1. Problem

The `/admin` panel already lets an operator edit most of the public site's content through Supabase-backed data: section text (`site_sections`, via `ContentPage.tsx`), Projects and Services cards (dedicated tables, via `ProjectsPage.tsx`/`ServicesPage.tsx`), SEO metadata, and — as of the two most recent projects in this repo — the Telegram bot admin and request-notes history. But four pieces of on-page content were never migrated off the original static bundle and remain hard-coded:

- Hero's 4 stat cards ("Business Goals / Define outcomes", etc.) and its single "Launch" card.
- HowWork's 4 step cards (icon, title, sub-heading, and a longer description each).
- About's 3 stat cards (icon, title, description).
- Footer's tagline paragraph under the logo.

All four are sourced from `src/i18n/en.json`/`uk.json` via the `t()`/`tx()` translation functions — a code path entirely separate from `useSiteContent()`/`site_sections`, which is what everything admin-editable actually reads from. Editing any of this today means editing a JSON file and redeploying, not using `/admin`. This project closes that gap for these four pieces, without touching how Projects/Services/SEO/requests already work.

This is the first of two planned projects (per the user's own explicit split): this one gets the underlying data into Supabase and wires up editing; a second, later project restructures the admin's own navigation into a unified "CARDS" section spanning Hero/Services/Projects/HowWork/About, once all five card types exist in Supabase.

## 2. Goal

Every field currently visible in these four pieces of content becomes editable from `/admin`, through the exact same `site_sections` table and `PUT /api/admin/content` endpoint every other section already uses — no new table, no new route.

## 3. Non-goals (explicitly out of scope)

- Adding or removing cards. Hero's 4 stat cards, HowWork's 4 steps, and About's 3 stats are a fixed, structural count baked into each section's CSS grid (e.g. HowWork's `grid-template-columns: repeat(4, ...)`) — changing the count would require a code change regardless of what the admin panel allows, so the editors only ever edit the existing N cards, never add or remove one. Unlike Projects/Services, these are not an open-ended list.
- The admin navigation restructure ("CARDS" section unifying Hero/Services/Projects/HowWork/About) — that is the explicitly deferred second project, once this one's data exists for all three new sections.
- Any change to the fixed-icon-set `Icon` component (`src/components/Icon/Icon.tsx`) or its use elsewhere in the codebase. These three sections stop rendering icons through it (they switch to uploaded images, like Services already does), but nothing else that still uses `<Icon name=.../>` is touched.
- Retiring `en.json`/`uk.json` entirely, or the `t()`/`tx()` mechanism itself — plenty of other static strings (nav labels, form copy, etc.) still legitimately live there. Only the specific keys this project migrates (`hero.cards`, `hero.launch`, `howWork.steps`, `about.stats`, `footer.tagline`) stop being read at runtime; the JSON keys can be deleted once the migration is confirmed live, but that cleanup isn't load-bearing for this spec.

## 4. Data model

Extend `public.site_sections` (no new table) with two new nullable JSONB columns, and widen its `key` check constraint to allow `'footer'`:

```sql
alter table public.site_sections
  add column if not exists cards  jsonb,
  add column if not exists launch jsonb;

alter table public.site_sections drop constraint if exists site_sections_key_check;
alter table public.site_sections add constraint site_sections_key_check
  check (key in ('hero','services','projects','howWork','about','cta','footer'));

insert into public.site_sections (key, eyebrow, title, body, cta_label)
values ('footer', '{"en":"","uk":""}', '{"en":"","uk":""}', '{"en":"","uk":""}', null)
on conflict (key) do nothing;
```

- `cards` holds an array of card objects for `hero`/`howWork`/`about`; stays `null` for every other key (`services`/`projects`/`cta`/`footer` — Services/Projects keep their own dedicated tables, unaffected by this project).
- `launch` holds a single card object, populated only for the `hero` row.
- `footer`'s row uses only its existing `body` column for the tagline — `eyebrow`/`title`/`cta_label` stay at their empty defaults and are simply never shown for this one key in the admin UI (see §6).
- Each card object has the same shape regardless of which section it belongs to, with one optional field:
  ```json
  { "icon": { "kind": "asset|upload", "src": "...", "path": "..." },
    "title": { "en": "...", "uk": "..." },
    "sub":   { "en": "...", "uk": "..." },
    "text":  { "en": "...", "uk": "..." } }
  ```
  `sub` is present only on HowWork's cards (its 3-line title/sub/text shape); Hero and About cards omit it (2-line title/text). `icon` uses the exact same `ImageRef` shape (`kind`/`src`/`path`) already used by Projects/Services cards on the frontend — this project just stores it nested inside JSONB instead of as flat `icon_url`/`icon_path` columns, since it's part of a JSON array rather than its own table row.
- Why extend `site_sections` rather than add per-section tables (`hero_cards`, `howwork_steps`, `about_stats`): these are fixed-count, edit-only structural content, not an open-ended, independently-published, sortable list the way Projects/Services cards are. A JSONB column that gets overwritten wholesale on every save matches that shape directly, with far less new code (no new table, no new list/create/delete endpoints, no new `list`/`sort`/`published` bookkeeping that would never actually be used since nothing here is ever added, removed, or reordered).

## 5. One-time data migration (seed)

A migration script (same `migration-YYYY-MM-DD-*.sql` convention as every prior Supabase change in this repo) populates `cards`/`launch`/the new `footer` row from the current `en.json`/`uk.json` values, so the site shows real content immediately after this ships rather than empty cards. Icons are seeded as `{ kind: 'asset', src: '<existing static SVG path or a rendered PNG of it>', path: null }` — i.e. pointing at the icons that already ship in the bundle today, not a freshly uploaded file — so nothing on the live site visibly changes until an operator chooses to replace one via the admin UI. (The exact source path per icon — whether the existing inline SVGs in `Icon.tsx` can be reused as static asset URLs directly, or need to be exported as standalone files first — is worked out at plan-writing time by reading `Icon.tsx`'s exact structure.)

Because `en.json` and `uk.json` may not have identical text for every card today (translations drift over time), the migration seeds whatever each language file currently has, verbatim, into the matching `en`/`uk` key of each `L` field — it does not try to reconcile or improve mismatched translations.

## 6. Backend

No new route. `api/_lib/adminRows.ts`'s `sectionRow(key, patch)` — already the single place that whitelists which fields a `PUT {kind:'section', ...}` request is allowed to write — gains handling for `cards` and `launch`:

```ts
const isImageRef = (v: unknown): v is { kind: string; src: string; path: string | null } =>
  typeof v === 'object' && v !== null &&
  typeof (v as Record<string, unknown>).kind === 'string' &&
  typeof (v as Record<string, unknown>).src === 'string'

const isCard = (v: unknown): boolean =>
  typeof v === 'object' && v !== null &&
  isImageRef((v as Record<string, unknown>).icon) &&
  isL((v as Record<string, unknown>).title) &&
  isL((v as Record<string, unknown>).text) &&
  ((v as Record<string, unknown>).sub === undefined || isL((v as Record<string, unknown>).sub))

// inside sectionRow(), alongside the existing eyebrow/title/body/ctaLabel checks:
if (Array.isArray(patch.cards) && patch.cards.every(isCard)) out.cards = patch.cards
if (isCard(patch.launch)) out.launch = patch.launch
```

`isSectionKey()` (also in `adminRows.ts`) gains `'footer'` in its allowed set. `useSiteContentRaw`'s existing `updateSection(key, patch)` action and the `PUT /api/admin/content` handler need no changes at all — they already forward whatever `sectionRow()` lets through.

## 7. Admin UI

`admin/types.ts`'s `SectionText` gains two optional fields:

```ts
export interface SectionCard {
  icon: ImageRef
  title: L
  sub?: L
  text: L
}
export interface SectionText {
  key: SectionKey
  label: string
  eyebrow: L
  title: L
  body: L
  ctaLabel?: L
  cards?: SectionCard[]
  launch?: SectionCard
}
```

`ContentPage.tsx`'s `SectionEditor` gains a new sub-block, rendered when `section.cards` is present: one `ImageUpload` (reusing the existing component verbatim, with a new `'cards'` folder value added to its existing `folder: 'projects' | 'services'` union — all uploaded card icons for Hero/HowWork/About land in this one Supabase Storage folder, regardless of which of the three sections they belong to) plus one `LocalizedField` per text field (`title`, `sub` when present, `text`), repeated for each card in the fixed-length array, plus one more block for `launch` when present (hero only). Dirty-tracking and save follow the exact same pattern `SectionEditor` already uses for `eyebrow`/`title`/`body` (compare current draft to stored via `isL`-style equality, submit only the changed top-level keys — here, the whole `cards` array or `launch` object is submitted together if anything inside it changed, since these are single JSONB columns, not row-level fields).

For the `footer` key specifically, `SectionEditor` renders only the `Body` field (relabeled "Tagline" for this one key) — `Eyebrow`/`Title`/`ctaLabel` are skipped entirely for `footer`, since that row's other columns are unused placeholders (§4).

## 8. Public site

`useSiteContent()`'s `section(key)` (in `src/content/useSiteContent.ts`) gains resolved, localized `cards`/`launch` in its return value, following the exact pattern already used for `projectsHome()`/`servicesHome()` (map each stored card through `pick()` for every `L` field, expose `iconSrc` instead of the raw `ImageRef`):

```ts
export interface ResolvedSectionCard {
  iconSrc: string
  title: string
  sub?: string
  text: string
}
```

`Hero.tsx`, `HowWork.tsx`, `About.tsx` switch their cards from `tx<HeroCard[]>("hero.cards")`-style calls to `section("hero").cards` (etc.), and render each card's icon as `<img src={card.iconSrc} alt="" />` instead of `<Icon name={CARD_ICONS[i]} />` — removing the hard-coded `CARD_ICONS`/`STEP_ICONS`/`STAT_ICONS` index-matched arrays entirely, since the icon is now part of the card's own data. `SiteFooter.tsx` switches its tagline from `t("footer.tagline")` to `section("footer").body`.

## 9. Testing approach (consistent with every prior project in this repo)

- `sectionRow()`'s new `cards`/`launch` validation gets unit tests with fakes (valid card passes through, missing `icon`/`title`/`text`, wrong `L` shape, or a non-array `cards` all get rejected) — same style as its existing eyebrow/title/body tests.
- The new admin UI pieces (card sub-editor in `ContentPage.tsx`) get component tests following `ProjectsPage.test.tsx`'s existing patterns (render, edit a field, save, assert the right patch shape reached `updateSection`).
- Real Supabase round-trips (the migration, the actual save) are verified live by the human operator on a deployed preview, not mocked in CI — same convention as every prior project.
- `Hero.tsx`/`HowWork.tsx`/`About.tsx`/`SiteFooter.tsx` stay untested at the unit level, consistent with this repo's existing convention that public marketing sections have no test files at all (confirmed: none exist today) — this project doesn't introduce new test infrastructure there.

## 10. Open questions / deferred (none blocking)

- Exact source path/format for seeding each card's icon as a static asset (§5) — resolved at plan-writing time by reading `Icon.tsx`'s current SVG definitions.
- Whether to delete the now-unread `hero.cards`/`hero.launch`/`howWork.steps`/`about.stats`/`footer.tagline` keys from `en.json`/`uk.json` after this ships — left as an optional cleanup, not required for the feature to work (dead JSON keys are harmless).
- The admin-navigation "CARDS" restructure (unifying Hero/Services/Projects/HowWork/About) is explicitly the next, separate project — not scoped here.
