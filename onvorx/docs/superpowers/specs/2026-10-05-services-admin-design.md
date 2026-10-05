# Admin: /services page content + unified Content / Cards / SEO navigation — Design Spec

**Status:** Approved in conversation (2026-10-05, parts 1–4); awaiting written-spec review.

## 1. Problem

The `/services` page (built 2026-10-05, commit `83b7b93`) reads all of its content
from static `src/i18n/en.json` / `uk.json` (`servicesPage.*`) and hard-coded asset
paths in `src/data/servicesPage.ts`. Nothing on it is editable from `/admin` or the
Telegram bot, unlike the Home page, whose texts, cards and images already live in
Supabase (`site_sections`, `projects`, `services`) behind the shared
`SiteContentProvider` store.

At the same time the admin has two dead spots left over from earlier phases:

- **Cards → Services → Page** edits a 4-card `services` list (`list='page'`) that no
  page renders.
- **SEO** shows 8 flat entries; 4 of them (`web-development`, `support`,
  `business-analysis`, `google-ads`) now belong to routes that redirect to
  `/services#<block>`.

## 2. Goal

1. Every piece of content on `/services` — texts, short text lists, cards, icons and
   images — is editable by the site owner without a developer.
2. The admin's three content areas share one navigation pattern:
   **Content** (all page texts), **Cards** (all cards and their images) and **SEO**
   are each organised with tabs, the way Cards already is.
3. The Telegram bot can edit the title and description of each `/services` section.

## 3. Decisions (from the brainstorming Q&A)

| # | Question | Decision |
|---|---|---|
| 1 | What is editable | **Everything**: texts, lists, icons, badges, illustrations, mockups. Images must be replaceable without a developer. |
| 2 | Telegram bot | Only **title + body** of the `/services` sections. Everything else is web-admin only. |
| 3 | Can item counts change | **Flexible lists**: feature items, block tags, AI Build stack (add / remove / reorder). **Fixed**: the 4 service blocks, the 4 hero cards, the 2 Business Analysis tracks. |
| 4 | Admin structure | Content and SEO are rebuilt with tabs like Cards. Cards → Services → Page becomes the `/services` card editor. SEO keeps all 8 entries (including the 4 redirect targets) — "extra functionality for the future". |
| 5 | Content vs Cards split | Texts and short text lists (tags, AI Build stack, track names, "What you get") → **Content**. Cards and all images (hero cards, feature items, badges, illustrations, AI Build mockups) → **Cards**. |
| 6 | Storage approach | **Extend `site_sections`** (same path as the Hero/HowWork/About cards project), not new tables or a page-level JSON document. |

## 4. Non-goals

- Ukrainian copy. `uk` values are seeded with the English text; translation happens
  after the EN site is complete (user decision).
- Making block **order, theme (dark/light), anchors or layout** editable — these are
  design, not content, and stay in code.
- Editable **alt text** for the services images. Alts stay as static i18n strings
  (`servicesPage.*Alt`), like today.
- Small UI chrome strings: "01 / SERVICE", "WHAT YOU GET", the hero cards
  `aria-label`. They stay in `en.json` / `uk.json`.
- Deleting the old `services` rows with `list='page'` from the database. They are
  only hidden from the web admin and the bot.
- New Supabase tables, new API routes, new serverless functions.
- About / Projects pages (separate projects, waiting for design).

## 5. Data model

### 5.1 New section keys

Seven rows are added to `public.site_sections`; the `key` check constraint is widened
to allow them:

| Key | Section on `/services` |
|---|---|
| `svcHero` | Hero (intro + 4 navigation cards) |
| `svcWebDevelopment` | 01 Web Development |
| `svcAiBuild` | AI Build |
| `svcWebsiteSupport` | 02 Website Support & Development |
| `svcBusinessAnalysis` | 03 Business Analysis |
| `svcGoogleAds` | 04 Google Ads |
| `svcCta` | CTA at the bottom of the page |

### 5.2 Existing columns, by meaning

| Key | `eyebrow` | `title` | `body` | `cta_label` |
|---|---|---|---|---|
| `svcHero` | "Services" | H1 | description | — (null) |
| 4 service blocks | — (empty) | block H2 | description | button text |
| `svcAiBuild` | badge "New" | "AI Build" | description | link text "View project example" |
| `svcCta` | "Start a project" | title | description | button text |

### 5.3 Two new JSONB columns, one owner each

```sql
alter table public.site_sections
  add column if not exists texts jsonb,   -- written only by the Content screen
  add column if not exists media jsonb;   -- written only by the Cards screen
```

Each admin screen sends only the columns it owns, and the server writes only the
columns present in the patch, so a Content save can never overwrite a Cards save
(or the reverse).

All translatable strings use the existing `L = { en, uk }` shape. `ImageRef` is the
existing `{ kind: 'asset' | 'upload', src, path? }`.

**`texts`** (Content-owned):

```ts
// 4 service blocks
{ tags: L[];                                   // flexible list
  get?: { title: L; text: L };                 // absent on svcGoogleAds
  tracks?: [ { label: L; title: L },           // svcBusinessAnalysis only,
             { label: L; title: L } ] }        //   exactly 2
// svcAiBuild
{ stack: L[] }                                 // flexible list
// svcHero, svcCta
null
```

**`media`** (Cards-owned):

```ts
// 4 service blocks
{ badge: ImageRef; picture?: ImageRef }        // picture absent on svcGoogleAds
// svcAiBuild
{ site: ImageRef; admin: ImageRef; bot: ImageRef }
// svcHero, svcCta
null
```

### 5.4 Cards (existing `cards` column)

`SectionCard` gains two optional fields:

```ts
interface SectionCard {
  icon: ImageRef; title: L; text: L; sub?: L    // existing
  tags?: L[]        // NEW — svcHero cards
  track?: 0 | 1     // NEW — svcBusinessAnalysis feature items
}
```

- `svcHero.cards` — exactly 4 cards `{ icon, title, tags, text: empty L }`, in block
  order (Web Development, Website Support, Business Analysis, Google Ads). The
  anchor each card links to is derived from its index in code.
- 4 service blocks' `cards` — the feature items `{ icon, title, text }`, flexible
  count; on `svcBusinessAnalysis` every item carries `track: 0 | 1` and the page
  groups them by track in array order.

### 5.5 Server validation (`api/_lib/adminRows.ts` → `sectionRow`)

`sectionRow(key, patch)` becomes key-aware for the new fields:

- `texts` / `media` are accepted **only** for `svc*` keys, and only when they match
  that key's shape (§5.3). Anything else is dropped, as invalid fields are today.
- `svcBusinessAnalysis.texts.tracks` must have exactly 2 entries; its cards must all
  have `track ∈ {0,1}`.
- `svcHero.cards` must have exactly 4 entries.
- `tags`, `stack` and card `tags` must be arrays of `L`.
- Existing keys keep today's behaviour unchanged.

### 5.6 Migration + seed

One file, `supabase/migration-2026-10-05-services-page.sql`, run once by the
operator in the Supabase SQL Editor:

1. `add column if not exists texts`, `media` (idempotent).
2. Widen `site_sections_key_check` with the 7 new keys (idempotent).
3. `insert … on conflict (key) do nothing` the 7 rows with today's `/services`
   content (texts from `en.json`, `uk` = English, assets = current
   `/assets/services-page/*` WebP/SVG files as `kind:'asset'`).
4. Re-create `public.reset_content(payload jsonb)` so "Reset to defaults" also
   restores `texts` and `media`.

`src/content/defaults/sections.ts` gains the same 7 sections (the in-code defaults and
the reset payload come from here); `scripts/gen-seed.ts` / `seed.sql` include them for
fresh projects. After the switch, the moved content keys are removed from
`servicesPage` in `en.json` / `uk.json`; only the UI chrome strings from §4 remain.

## 6. Admin UI

All three areas follow the same pattern: a tab strip on top (existing
`admin-tabs` styles), familiar editors with explicit **Save / Discard** below.

### 6.1 Content — tabs `Home | Services`

- **Home** — today's 7 section editors, unchanged (`hero … footer`).
- **Services** — 7 collapsible editors in page order: Hero, Web Development,
  AI Build, Website Support, Business Analysis, Google Ads, CTA.
  - Text fields (EN/UA) per §5.2; empty-by-design fields (e.g. a block's eyebrow) are
    not shown.
  - Service blocks: **Tags** and **What you get** (title, text); Business Analysis
    also **Track 01 / Track 02** label + title.
  - AI Build: **Stack** list.
- New shared component **`LocalizedListField`** — an editable list of `L` items:
  add, remove, move up / down. Used for tags and the AI Build stack.
- Tabs for About / Projects are added when those pages exist.

### 6.2 Cards — two levels: page, then block

*Revised 2026-10-05 after the first build (user decision):* Cards is organised by
page, like Content and SEO.

- **Home** → block tabs **Hero | How it works | About | Projects | Services**. Projects
  and Services show only their home-page lists; the Projects-page list returns as its
  own tab when `/projects` exists, and the old `services` `list='page'` rows are no
  longer shown at all.
- **Services** → the new `ServicesPageCards` screen: a group list on the left, the
  selected group's editor on the right (same layout as `CardScreen`).

| Group | Editor |
|---|---|
| Hero cards | 4 fixed cards: icon, title, tags (`LocalizedListField`) |
| Web Development | badge, illustration, feature list |
| AI Build | 3 mockups: site, admin, bot |
| Website Support | badge, illustration, feature list |
| Business Analysis | badge, illustration, Track 01 feature list, Track 02 feature list |
| Google Ads | badge, feature list |

- Feature lists: add, remove, move up / down; each item has icon, title, text.
  New items start with an empty title/text and the first icon of that block as a
  placeholder.
- Images use the existing `ImageUpload` component (upload → `public-media`
  Storage, SVG sanitised server-side, superseded object deleted after the row write).
- The selection resets when switching tabs, preserving the existing CardsPage
  invariant (separate conditional slots, see `CardsPage.test.tsx`).

### 6.3 SEO — tabs `Home | Services | Projects | About`

- **Services** tab lists 5 entries: the page itself and its 4 blocks. Each block
  entry shows its real address under the label, e.g.
  "Web Development → /services#web-development"; the SERP preview uses that address.
- `pageKey`s and the `seo_pages` rows are unchanged; this is a grouping and label
  change only.

## 7. Telegram bot

- **Content**: after choosing Content the bot asks for the page — **Home | Services**.
  Home behaves exactly as today. Services lists the 7 `svc*` sections; each offers
  only **Title** and **Body** for editing (writes go through the existing
  `adminContentHandler` path, so validation is shared with the web admin).
- **Cards → Services**: the "Services page" option is removed (it would edit the
  now-hidden `list='page'` rows). Only the Home list remains.
- No new handlers; no new bot permissions (Content stays `owner` /
  `content_manager`).

## 8. Public site

- `/services` reads everything via `useSiteContent()` instead of `useI18n().tx()`:
  a new language-resolved helper returns, per `svc*` key, the texts, lists, cards and
  media. In-code defaults render first, the Supabase overlay replaces them, admin
  saves appear immediately (same as Home).
- Layout, anchors, block order, themes and chrome strings are unchanged.
- Empty content never breaks layout: an empty tag list renders no tag row, a missing
  `get` / `picture` renders nothing (as Google Ads does today), a feature list can be
  empty.
- Uploaded images have unknown dimensions; images keep CSS-defined sizing
  (`width: 100%` / aspect boxes), so `width`/`height` attributes are only set for
  the built-in assets.

## 9. Error handling

Unchanged from the existing admin: optimistic update → `adminApi` write → on failure
revert via refetch, toast "Save failed". Invalid patch fields are dropped server-side
(§5.5); a patch that becomes empty after validation is rejected with 400, as today.

## 10. Testing

TDD, as in the previous admin projects:

- **Server** — `sectionRow`: accepts valid `texts`/`media`/`cards` per key; drops
  `texts`/`media` on non-`svc*` keys and on wrong shapes; enforces 4 hero cards,
  2 tracks, `track ∈ {0,1}`.
- **Content model** — defaults contain the 7 sections; mappers round-trip
  `texts`/`media`; `reset_content` payload includes them.
- **Admin** — Content/SEO tabs; `LocalizedListField` add/remove/reorder; Services
  editors save only their own columns (Content never sends `media`, Cards never sends
  `texts`); CardsPage selection-reset invariant still holds.
- **Bot** — page choice step; svc sections expose Title/Body only; "Services page"
  card list gone.
- **Public** — `/services` renders from the store; edited values appear; empty
  lists / missing optional media don't throw.
- **Live round-trip** before rollout (lesson from Plans 3–4 and Project A): edit a
  text, a tag, a feature item, upload an icon and an illustration, reset — against
  the real Supabase from a Vercel preview.

## 11. Rollout

Order matters, otherwise production briefly renders `/services` without content:

1. Operator runs `supabase/migration-2026-10-05-services-page.sql` in the Supabase
   SQL Editor (step-by-step instructions provided with the plan).
2. Code is pushed to `main`; Vercel deploys Production.
3. Joint check of `/services` and `/admin` on the live site.

`docs/PROJECT-MAP.md` is updated at the end: Services page + images + services
admin → done; About and Projects → waiting for design; UA translation → after the
EN site is complete.
