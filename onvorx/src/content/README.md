# Content store

`SiteContentProvider` holds all owner-editable site content as one `AdminData`
object, seeded from `src/i18n/{en,uk}.json` (+ mock estimate requests) and
persisted to `localStorage` under `onvorx.admin.v1`.

- **Read** managed fields via `useSiteContent()` — language-resolved helpers
  (`section`, `projectsHome`, `servicesHome`, `seoFor`).
- **Read/write** the raw object via `useSiteContentRaw()` — used by the `/admin`
  screens (added in a later plan).
- **Mutations** are pure functions in `src/admin/actions.ts`; the provider binds
  them and persists synchronously after each change, with cross-tab `storage`
  sync.

Unmanaged strings (nav, hero feature cards, "how we work" steps, About stats,
footer, 404) still come from `useI18n()` and `src/i18n/*.json`.

To move persistence to a real backend later, replace `src/content/persistence.ts`
(`loadAdminData` / `saveAdminData`) — the `AdminData` shape stays the same.
