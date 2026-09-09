# Admin panel (`/admin`)

Owner-facing UI for the curated content the store backs. English only.

- **Auth** — `src/admin/auth/` (Plan 2): shared password → signed cookie.
- **Shell** — `AdminApp` (lazy at `/admin/*`, outside the public layout) → `AuthProvider`
  → `RequireAuth` → `AdminLayout` (sidebar + `<Outlet/>` + toast region).
- **Data** — every screen uses `useSiteContentRaw()` and the `src/admin/actions.ts`
  reducers. Screens hold the field being edited in local state and dispatch on an
  explicit **Save** (so the store's synchronous persist never fires per keystroke).
- **Screens** — Dashboard, Content (6 section blocks), Projects (Home / Page card
  lists), Services (Home / Page), SEO (8 pages + SERP preview), Requests (inbox),
  Settings (reset / log out).
- **What is NOT editable here** — Hero feature cards, "How we work" steps, About
  stats, nav, footer, 404. By design.

Changes are reflected on the public site immediately (Approach B), still
`localStorage`-only. Moving to a real backend = replace `src/content/persistence.ts`.
