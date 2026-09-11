# Content store

`SiteContentProvider` holds all owner-editable site content as one `AdminData`
object, seeded from `src/content/defaults` (`buildDefaults()`), overlaid on
mount with Supabase content and a local `onvorx.content.cache.v2` cache
(`src/content/contentCache.ts`).

- **Read** managed fields via `useSiteContent()` — language-resolved helpers
  (`section`, `projectsHome`, `servicesHome`, `seoFor`).
- **Read/write** the raw object via `useSiteContentRaw()` — used by the `/admin`
  screens (added in a later plan).
- **Mutations** are pure functions in `src/admin/actions.ts`; the provider binds
  them to an optimistic `setData` + `adminApi.*` write to Supabase, with a
  revert-on-error `refetch` and a debounced reconcile. It also refetches on
  mount and on window focus.

Unmanaged strings (nav, hero feature cards, "how we work" steps, About stats,
footer, 404) still come from `useI18n()` and `src/i18n/*.json`.

Persistence is Supabase, reached through `src/admin/api.ts` (`adminApi.*` →
`/api/admin/*`) for writes and `src/content/remote.ts` for the read overlay.
