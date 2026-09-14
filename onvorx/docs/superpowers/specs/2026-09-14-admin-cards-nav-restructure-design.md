# Admin: Unified CARDS Navigation — Design Spec

**Status:** Approved by user, ready for implementation planning.

## 1. Problem

`/admin` currently edits five distinct kinds of "card" content through two unrelated UI patterns:

- **Projects and Services** each have their own dedicated top-level nav entry (`/admin/projects`, `/admin/services`) and a full-page list+detail editor (`CardScreen` + `CardList`): a left-hand list with add/reorder/publish controls, a right-hand detail form, backed by genuinely open-ended, operator-managed lists (cards can be added, removed, reordered, and hidden).
- **Hero, HowWork, and About** (added in the prior "admin-hero-howwork-about-cards" project) live inside the "Content" page, nested as collapsible per-card accordions under each section's own text-editing disclosure — a fixed-count (4/4/3), edit-only shape with no add/remove/reorder/publish concept at all.

An operator managing "the cards on the site" has to know which of two unrelated places to look, and the two experiences don't share a visual language. This project unifies all five under one navigation entry and one consistent list+detail interaction pattern, without pretending the fixed-count types are open-ended lists they aren't.

This is explicitly the deferred second half of a two-project split approved during the prior project's brainstorming: that project ("Project A") moved Hero/HowWork/About's card data into Supabase and built the (soon-to-be-superseded) accordion editors; this project ("Project B") only reorganizes how that already-correct data is navigated to and edited — it does not touch the data model, the public site, or the Telegram bot.

## 2. Goal

A single "CARDS" entry in the admin sidebar, replacing the standalone "Projects" and "Services" entries, from which an operator reaches all five card types (Hero, HowWork, About, Projects, Services) through one consistent list-left/editor-right layout — the existing `CardScreen` pattern, applied uniformly, with the each type's actual editing capabilities (add/reorder/publish for Projects/Services; none of that for the fixed-count types) preserved exactly as they work today, just presented consistently.

## 3. Non-goals (explicitly out of scope)

- **The Telegram bot is not touched in any way.** Explicitly confirmed by the user this session ("Функционал бота не расширяем. Эти изменения только для админки") — no file under `api/_lib/telegram*.ts` is part of this project, regardless of any surface-level similarity between the bot's own Cards menu (Projects/Services only) and this admin-UI work.
- **No add/remove/reorder for Hero/HowWork/About's cards.** Still a fixed count (4/4/3) — this project changes ONLY where and how they're navigated to and edited, never what operations are possible on them.
- **No data model or backend changes.** `site_sections.cards`/`.launch` (JSONB), `sectionRow()`'s validation, `api/_lib/adminRows.ts`, and every other backend file from Project A are untouched — this is a pure `src/admin/` UI reorganization. The existing `actions.updateSection(key, patch)` write path is reused exactly as-is.
- **No public-site changes.** `Hero.tsx`/`HowWork.tsx`/`About.tsx`/`SiteFooter.tsx` and the public content-read pipeline are untouched.
- **`Icon.tsx` is untouched**, as before — irrelevant to this project regardless.
- **Projects' and Services' own editing behavior does not change** — same fields, same add/reorder/publish/delete, same validation, same tests-worth-of-behavior. Only their navigation entry point and page-shell wrapper change.
- **No new Supabase migration.** The data this project displays is already fully correct from Project A.

## 4. Navigation

`src/admin/AdminLayout.tsx`'s `NAV` array changes from:

```
Dashboard, Content, Projects, Services, SEO, Requests, Settings
```

to:

```
Dashboard, Content, CARDS, SEO, Requests, Settings
```

`src/admin/AdminApp.tsx`'s routes: the `path="projects"` and `path="services"` routes are removed and replaced with one `path="cards"` route rendering a new `CardsPage`. There is no `/admin/cards/hero`-style sub-routing — which of the five card types is being edited is component state within `CardsPage`, exactly matching how Projects' own existing Home/Page sub-tabs are component state (`activeList`) today, not separate URLs. Direct-linking to a specific card type is not a current requirement (it isn't one for Projects/Services' own sub-tabs either).

## 5. Page structure

`CardsPage.tsx` (new) renders a top-level type selector — five tabs: **Hero / How it works / About / Projects / Services** — and, for whichever is active, a `CardScreen` instance (the existing, unmodified `src/admin/pages/CardScreen.tsx` component: title, hint, an optional inner sub-tab row, and a list-pane/editor-pane split).

- **Projects and Services**: the CURRENT `ProjectsPage.tsx`/`ServicesPage.tsx` components' internals (list, editor, save/discard, delete, add, reorder, image upload, the `useConfirm` delete dialog, their own inner Home/Page `CardScreen` sub-tabs) are preserved essentially unchanged — they stop being routed pages and become the content rendered for their respective `CardsPage` tab. Concretely: each keeps its own file and its own `export function ProjectsPage()`/`ServicesPage()` (still using `useAdminTitle`, still wrapping its own `<CardScreen>` + confirm dialog), and `CardsPage.tsx` simply renders `<ProjectsPage />` / `<ServicesPage />` inside its own "Projects"/"Services" tab panel — no internal restructuring of either file is needed beyond this.
- **Hero, HowWork, About**: a new shared component (`SectionCardsPage.tsx` or similar — exact name decided at plan time) renders one `CardScreen` per section with:
  - **List pane**: a new, simpler list component (`FixedCardList.tsx` or similar) — no add button, no move arrows, no publish indicator, just clickable rows. Each row shows a 1-based position label and the card's current EN title (e.g. "1 — Since 2023"), matching the existing accordion summary convention from Project A (`${title} — ${card.title.en}`). For Hero specifically, one extra row is appended at the end labeled "Launch" (its own `card.title.en`, e.g. "Launch — Launch") representing the standalone `launch` object — visually just another row, not specially grouped or separated, per the approved design.
  - **Editor pane**: the same fields Project A's `CardEditor` already has — icon (`ImageUpload`, `variant="icon"`, `folder="cards"`, `deferDelete={true}`), Card title, Sub (only when the card has one — HowWork only), Card text — but now editing ONE selected card at a time in a page-shell matching Projects/Services' own editor pane (an `EmptyState` when nothing is selected, a `SaveBar` with dirty-tracking, matching visual conventions), rather than several always-visible nested accordions.

## 6. Data flow for the fixed-count types

No backend change: a section's `cards` (and, for `hero`, its `launch`) still round-trip as ONE JSONB blob through `PUT /api/admin/content` → `sectionRow()`, exactly as Project A built it. What changes is only how the ADMIN UI assembles the patch:

- The page holds the section's full, current `cards` array (and `launch`, for hero) from `useSiteContentRaw()`'s `data`, plus a `selectedIndex` (or `'launch'` sentinel for hero's launch row) and a `draft` of ONLY the selected card.
- Dirty-tracking and Save/Discard operate on that one draft card, exactly like Project A's `CardEditor`/`eqCard` comparison already does.
- On Save: build the patch by copying the section's current `cards` array and replacing just the edited index with the draft (or replacing `launch` directly, if that's what's selected), then call the SAME `actions.updateSection(key, { cards: nextCards })` (or `{ launch: nextLaunch }`) the current `ContentPage.tsx` already calls — no new action, no new API method.
- Switching the selected card while the current one is dirty: match the existing app-wide convention (Projects' own `useEffect`-driven draft re-seed on selection change, which silently drops unsaved edits — confirmed this is how Projects already behaves when you click a different card mid-edit without saving; SEO/Content's disclosures don't have this problem since everything is always visible). This project does not add an "unsaved changes" confirmation guard that doesn't already exist elsewhere in this admin panel — consistent with existing behavior, not a regression.

## 7. Component reuse and changes

| Component | Change |
|---|---|
| `AdminLayout.tsx` | `NAV` array edited (remove Projects/Services entries, add CARDS). |
| `AdminApp.tsx` | Routes edited (remove `projects`/`services` routes, add `cards` → `CardsPage`). |
| `CardsPage.tsx` | **New.** Owns the 5-way type tab state; renders `ProjectsPage`/`ServicesPage` as-is for those two tabs, and a new section-cards view for the other three. |
| `CardScreen.tsx` | **Unchanged.** Already generic enough (title/hint/optional-sub-tabs/list-slot/editor-slot) to serve all five card types without modification. |
| `CardList.tsx` | **Unchanged.** Stays exactly what Projects/Services use (add/move/publish) — not reused for the fixed-count types, which get their own simpler list component instead of overloading this one with optional/hidden props. |
| `FixedCardList.tsx` (exact name TBD at plan time) | **New.** Plain clickable-row list, no add/move/publish, for Hero/HowWork/About. |
| `SectionCardsPage.tsx` (exact name TBD) or equivalent | **New.** One component parameterized by section key (`hero`/`howWork`/`about`), rendering `CardScreen` + `FixedCardList` + a single-card editor pane reusing the field set from Project A's `CardEditor`. |
| `ContentPage.tsx` | `CardEditor` component and the `cards`/`launch` rendering blocks in `SectionEditor` are REMOVED (moved to the new page). Section text fields (Eyebrow/Title/Body/Button label, footer's Tagline-only view) are UNCHANGED — every section, including hero/howWork/about, keeps its text-editing accordion in Content exactly as today, just without the nested card blocks. |
| `ProjectsPage.tsx` / `ServicesPage.tsx` | Internals unchanged. Only consequence: they're no longer directly routed (rendered as tab content by `CardsPage` instead of by `AdminApp`'s router) — their own `useAdminTitle('Projects')`/`('Services')` calls need reconciling with `CardsPage`'s own title (exact handling — e.g. `CardsPage` sets the document title based on the active tab instead — decided at plan time, but the title must reflect the active card type, not always say "Cards"). |

## 8. Testing

- `AdminLayout.test.tsx` (if it exists) / a new test: NAV no longer contains Projects/Services entries, contains CARDS.
- `CardsPage.test.tsx` (new): tab switching renders the right sub-view for each of the 5 types; Projects/Services tabs render real `ProjectsPage`/`ServicesPage` content (smoke-level, not re-testing their internals).
- `ProjectsPage.test.tsx` / `ServicesPage.test.tsx`: unchanged in substance (they test the component's own behavior, which doesn't change) — only their render harness may need adjusting if they currently assume being mounted at a specific route.
- New tests for `FixedCardList`/the section-cards editor component covering: row selection, dirty-tracking on one card, Save assembling the full `cards` array patch correctly (only the edited index changes), Discard reverting, the Launch row for Hero.
- `ContentPage.test.tsx`: existing card-related tests (from Project A: card-count rendering, Sub-field-only-on-HowWork, the save-round-trip test) are REMOVED or MOVED to the new component's test file, since that behavior no longer lives in `ContentPage`.
- No public-site test changes (none exist for the affected components, and none are added — consistent with this repo's established convention).

## 9. Open questions (none blocking)

- Exact new-file names (`CardsPage.tsx`, `FixedCardList.tsx`, `SectionCardsPage.tsx` or equivalents) — cosmetic, settled at plan-writing time.
- Exact handling of `useAdminTitle` when Projects/Services render as tab content instead of routed pages (the document title should still reflect the active card type) — a small, mechanical decision for the plan, not a design fork.
