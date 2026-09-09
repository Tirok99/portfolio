# Admin Plan 3 — Admin Panel UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A plain-English `/admin` panel that lets a non-technical site owner edit the curated content the store already backs (section texts, Home project/service cards, per-page SEO) and read incoming estimate requests — with changes reflected live on the public site.

**Architecture:** `AdminApp` (lazy-loaded at `/admin/*`, outside the public `Layout`) composes Plan 2's `AuthProvider` + `RequireAuth` + `LoginPage` around an `AdminLayout` (sidebar + `<Outlet/>` + toast region). Every editing screen reads `useSiteContentRaw()` (the raw `{data, actions}` — admin edits both EN and UA), holds the field being edited in **local component state**, and dispatches `actions.*` only on an explicit **Save** click — so the store's synchronous-persist never fires per keystroke. Shared presentational components (`LocalizedField`, `CardList`, `ImageUpload`, `Toast`, `ConfirmDialog`, …) keep each screen small.

**Tech Stack:** React 19 + React Router 7, plain CSS with the existing design tokens (`src/styles/tokens.css` / `themes.css`), Vitest + @testing-library, Playwright (one e2e smoke). No new runtime deps.

**Spec:** `docs/superpowers/specs/2026-09-08-admin-panel-design.md` (§3, §5, §7)

## Global Constraints

- **Admin UI language: English.** All labels, buttons, hints, empty states in English.
- **Managed content only** — do NOT add editors for anything outside: 6 section header blocks (eyebrow/title/body + Hero/CTA button label), `projectsHome` + `projectsPage` cards, `servicesHome` + `servicesPage` cards, the 8 `seo` entries, and the `requests` inbox (read + status/note/delete). No editor for Hero feature cards, How-we-work steps, About stats, nav, footer, 404.
- **Bilingual:** every text field edits `L = { en, uk }` via an EN | UA toggle. `uk` currently mirrors `en` (English text) — that's expected; the owner fills UA in later.
- **Explicit Save, no autosave.** Local state per screen; `actions.*` dispatched on Save. A visible "Unsaved changes" affordance + Save/Discard while dirty. Confirm before Delete and before Reset-to-defaults.
- **Reads/writes go through `useSiteContentRaw()`** and `src/admin/actions.ts` reducers only — never touch `localStorage` directly, never mutate `data`.
- **Image upload** uses `fileToImageRef` from `src/admin/lib/image.ts` (rejects `'unsupported-type'` / `'too-large'` — surface those as inline messages).
- **Admin forces light theme:** the admin root element carries `data-theme="light"`.
- **Lazy-loaded:** `/admin/*` must be `React.lazy` + `<Suspense>` so it stays out of the public critical bundle.
- **TypeScript:** `verbatimModuleSyntax` on — type-only imports use `import type`. `erasableSyntaxOnly` on. `noUnusedLocals`/`noUnusedParameters` on.
- **Gates:** `npm run lint` (oxlint) 0 errors; `npm run build` (`tsc -b && vite build`) passes; `npm test` all pass.
- **Commit messages** end with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Branch `feature/admin-panel-app`.
- **Depends on Plan 2** being merged/committed on the same branch: `src/admin/auth/{useAuth.tsx,RequireAuth.tsx,LoginPage.tsx}` exist and export `AuthProvider`, `useAuth`, `RequireAuth`, `LoginPage`.

---

## Store API reference (from Plans 1 & 2 — already on the branch)

`useSiteContentRaw()` → `{ data: AdminData, actions: SiteContentActions }`.

`AdminData` fields: `version`, `updatedAt`, `sections: SectionText[]` (6), `projectsHome/projectsPage: ProjectCard[]`, `servicesHome/servicesPage: ServiceCard[]`, `seo: SeoEntry[]` (8), `requests: EstimateRequest[]`.

Types (`src/admin/types.ts`): `L = { en, uk }`; `SectionKey = 'hero'|'services'|'projects'|'howWork'|'about'|'cta'`; `SectionText { key, label, eyebrow:L, title:L, body:L, ctaLabel?:L }`; `ProjectCard { id, order, published, title:L, tags:string[], description:L, image:ImageRef, imageAlt:L }`; `ServiceCard { id, order, published, featured, title:L, text:L, icon:ImageRef }`; `ImageRef { kind:'asset'|'upload', src:string, fileName? }`; `CardListKey = 'projectsHome'|'projectsPage'|'servicesHome'|'servicesPage'`; `SeoPageKey` (8: `home`,`services`,`projects`,`about`,`web-development`,`support`,`business-analysis`,`google-ads`); `SeoEntry { pageKey, label, path, title:L, description:L }`; `RequestStatus = 'new'|'in_progress'|'done'|'archived'`; `EstimateRequest { id, createdAt, status, name, email, company?, budget?, interestedIn:string[], message, locale, sourcePage?, note? }`.

`SiteContentActions` (all return `void`): `updateSection(key, patch)`, `addCard(list)`, `updateCard(list, id, patch)` (patch is `Record<string, unknown>` — merges into the card), `removeCard(list, id)`, `moveCard(list, id, 'up'|'down')`, `setCardImage(list, id, imageRef)`, `updateSeo(pageKey, { title?, description? })`, `addRequest(input)`, `setRequestStatus(id, status)`, `setRequestNote(id, note)`, `removeRequest(id)`, `resetAll()`.

`fileToImageRef(file: File, opts?): Promise<ImageRef>` from `src/admin/lib/image.ts`.

---

## File Structure

**Create — infrastructure:**

| File | Responsibility |
|---|---|
| `src/admin/AdminApp.tsx` | `/admin/*` route tree; wraps `AuthProvider` + `RequireAuth` + `AdminLayout` |
| `src/admin/AdminLayout.tsx` | sidebar nav + `<Outlet/>` + `<ToastRegion/>`; forces `data-theme="light"`; sets `document.title`; logout button |
| `src/admin/admin.css` | admin shell + shared-component styles (one file) |
| `src/admin/useAdminTitle.ts` | tiny hook: `useAdminTitle('Content')` → sets `document.title` |

**Create — shared components (`src/admin/components/`):**

| File | Export |
|---|---|
| `Toast.tsx` | `ToastProvider`, `useToast()`, `ToastRegion` |
| `ConfirmDialog.tsx` | `useConfirm()` → `{ confirm, dialog }` |
| `EmptyState.tsx` | `EmptyState` |
| `StatusBadge.tsx` | `StatusBadge` |
| `TextField.tsx` | `TextField` |
| `Toggle.tsx` | `Toggle` |
| `CharCounter.tsx` | `CharCounter` |
| `LocalizedField.tsx` | `LocalizedField` (EN\|UA toggle) |
| `SaveBar.tsx` | `SaveBar` (dirty indicator + Save / Discard) |
| `ImageUpload.tsx` | `ImageUpload` |
| `CardList.tsx` | `CardList` |

**Create — screens (`src/admin/pages/`):** `DashboardPage.tsx`, `ContentPage.tsx`, `ProjectsPage.tsx`, `ServicesPage.tsx`, `SeoPage.tsx`, `SerpPreview.tsx` (co-located with SeoPage), `RequestsPage.tsx`, `SettingsPage.tsx`.

**Create — docs/tests:** `src/admin/README.md`, `e2e/admin.spec.ts`, `playwright.config.ts`.

**Modify:** `src/App.tsx` (lazy `/admin/*` route), `Readme.md` (admin panel section), `package.json` (add `"e2e": "playwright test"` script; `playwright` is already a devDep).

**Not touched:** `src/content/*`, `src/sections/*`, `src/i18n/*`, `api/*`, `src/components/*` (public site).

---

## Task 1: Admin shell + route

**Files:**
- Create: `src/admin/AdminApp.tsx`, `src/admin/AdminLayout.tsx`, `src/admin/admin.css`, `src/admin/useAdminTitle.ts`
- Modify: `src/App.tsx`
- Test: `src/admin/AdminApp.test.tsx`

**Interfaces:**
- Consumes: `AuthProvider`, `RequireAuth`, `LoginPage` from `./auth/*` (Plan 2); `useAuth` for the logout button; react-router `Routes`/`Route`/`Outlet`/`NavLink`/`Navigate`.
- Produces:
  - `AdminApp` (default export) — the `/admin/*` subtree.
  - `AdminLayout` — sidebar (`NavLink`s to the 7 screens) + `<Outlet/>` + `<ToastRegion/>` placeholder (real one added Task 2) + a "Log out" button calling `useAuth().logout()` then navigating to `/admin/login`.
  - `useAdminTitle(screen: string): void` — `useEffect` sets `document.title = \`ONVORX Admin — ${screen}\`` and restores the previous title on unmount.
- `src/App.tsx` gains `<Route path="/admin/*" element={<Suspense fallback={<AdminFallback/>}><AdminApp/></Suspense>} />` as a **sibling of** the `<Route element={<Layout/>}>` block (not inside it). `const AdminApp = lazy(() => import('./admin/AdminApp'))`.

- [ ] **Step 1: Write the failing test**

`src/admin/AdminApp.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../i18n/i18n'
import { SiteContentProvider } from '../content/SiteContentProvider'
import AdminApp from './AdminApp'

const fetchAuthed = (authed: boolean) =>
  vi.fn(async () => new Response(JSON.stringify({ authenticated: authed }), { status: 200 }))

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

const wrap = (path: string) =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <MemoryRouter initialEntries={[path]}>
          <AdminApp />
        </MemoryRouter>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('AdminApp', () => {
  it('renders the login screen at /admin/login', async () => {
    vi.stubGlobal('fetch', fetchAuthed(false))
    wrap('/admin/login')
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('redirects an anonymous visitor from /admin to the login screen', async () => {
    vi.stubGlobal('fetch', fetchAuthed(false))
    wrap('/admin')
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows the admin layout (sidebar nav) when authed', async () => {
    vi.stubGlobal('fetch', fetchAuthed(true))
    wrap('/admin')
    await waitFor(() =>
      expect(screen.getByRole('navigation', { name: /admin/i })).toBeInTheDocument(),
    )
    expect(screen.getByRole('link', { name: /content/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /requests/i })).toBeInTheDocument()
  })
})
```
> Note: routing is under `MemoryRouter` here; the real app mounts `AdminApp` under `BrowserRouter` at `/admin/*`. `AdminApp`'s internal `<Routes>` uses **relative** paths (`login`, `content`, …), and `RequireAuth`/`LoginPage` use absolute `/admin/login` / `/admin` — consistent with Plan 2.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src/admin/AdminApp.test.tsx`
Expected: FAIL — `./AdminApp` missing.

- [ ] **Step 3: Write `src/admin/useAdminTitle.ts`**

```ts
import { useEffect } from 'react'

export function useAdminTitle(screen: string): void {
  useEffect(() => {
    const previous = document.title
    document.title = `ONVORX Admin — ${screen}`
    return () => {
      document.title = previous
    }
  }, [screen])
}
```

- [ ] **Step 4: Write `src/admin/AdminLayout.tsx`**

```tsx
import { useCallback } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import './admin.css'

const NAV: { to: string; label: string }[] = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin/content', label: 'Content' },
  { to: '/admin/projects', label: 'Projects' },
  { to: '/admin/services', label: 'Services' },
  { to: '/admin/seo', label: 'SEO' },
  { to: '/admin/requests', label: 'Requests' },
  { to: '/admin/settings', label: 'Settings' },
]

export function AdminLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const onLogout = useCallback(async () => {
    await logout()
    navigate('/admin/login', { replace: true })
  }, [logout, navigate])

  return (
    <div className="admin" data-theme="light">
      <aside className="admin__sidebar">
        <div className="admin__brand">ONVORX Admin</div>
        <nav className="admin__nav" aria-label="Admin sections">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              className={({ isActive }) =>
                `admin__nav-link${isActive ? ' is-active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="admin__logout" onClick={onLogout}>
          Log out
        </button>
      </aside>
      <main className="admin__main">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 5: Write `src/admin/AdminApp.tsx`**

```tsx
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/useAuth'
import { RequireAuth } from './auth/RequireAuth'
import { LoginPage } from './auth/LoginPage'
import { AdminLayout } from './AdminLayout'
import { DashboardPage } from './pages/DashboardPage'
import { ContentPage } from './pages/ContentPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ServicesPage } from './pages/ServicesPage'
import { SeoPage } from './pages/SeoPage'
import { RequestsPage } from './pages/RequestsPage'
import { SettingsPage } from './pages/SettingsPage'

export default function AdminApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="content" element={<ContentPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="seo" element={<SeoPage />} />
          <Route path="requests" element={<RequestsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
```

- [ ] **Step 6: Create placeholder screen files so the app compiles**

For EACH of `DashboardPage`, `ContentPage`, `ProjectsPage`, `ServicesPage`, `SeoPage`, `RequestsPage`, `SettingsPage` create `src/admin/pages/<Name>.tsx`:
```tsx
import { useAdminTitle } from '../useAdminTitle'

export function DashboardPage() {
  useAdminTitle('Dashboard')
  return <section className="admin-page"><h1>Dashboard</h1></section>
}
```
(Change the name + title string per file. These are replaced by real screens in Tasks 4–10.)

- [ ] **Step 7: Write `src/admin/admin.css`**

```css
.admin {
  --admin-sidebar-w: 220px;
  min-height: 100dvh;
  display: grid;
  grid-template-columns: var(--admin-sidebar-w) 1fr;
  background: var(--bg, #f5f5f7);
  color: var(--text, #0d0d0f);
  font: 400 15px/1.5 var(--font-sans, system-ui, sans-serif);
}
@media (max-width: 720px) {
  .admin { grid-template-columns: 1fr; }
  .admin__sidebar { position: sticky; top: 0; z-index: 10; }
}
.admin__sidebar {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1.25rem 0.85rem;
  background: var(--surface, #fff);
  border-right: 1px solid var(--border, #e8e8ec);
}
.admin__brand { font-weight: 600; padding: 0.25rem 0.6rem 0.75rem; }
.admin__nav { display: flex; flex-direction: column; gap: 0.15rem; }
.admin__nav-link {
  display: block;
  padding: 0.5rem 0.6rem;
  border-radius: var(--radius-sm, 8px);
  color: var(--text-2, #5b5d66);
  text-decoration: none;
  font-size: 0.9rem;
}
.admin__nav-link:hover { background: var(--surface-hover, #f0f0f3); }
.admin__nav-link.is-active { background: var(--accent, #e4202b); color: #fff; }
.admin__logout {
  margin-top: auto;
  font: inherit;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border, #e8e8ec);
  border-radius: var(--radius-sm, 8px);
  background: none;
  color: var(--text-2, #5b5d66);
  cursor: pointer;
  text-align: left;
}
.admin__main { padding: clamp(1rem, 3vw, 2rem); min-width: 0; }
.admin-page { max-width: 760px; }
.admin-page h1 { font-size: 1.4rem; margin: 0 0 1rem; }
.admin-page__hint { color: var(--text-2, #5b5d66); font-size: 0.875rem; margin: -0.5rem 0 1.25rem; }

/* --- shared field styles (used from Task 3 on) --- */
.admin-field { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
.admin-field__label { font-size: 0.82rem; font-weight: 600; }
.admin-field__hint { font-size: 0.78rem; color: var(--text-3, #8a8d95); }
.admin-input, .admin-textarea {
  font: inherit;
  width: 100%;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--border-strong, #dcdce2);
  border-radius: var(--radius-sm, 8px);
  background: var(--bg-elevated, #fff);
  color: inherit;
}
.admin-textarea { resize: vertical; min-height: 4.5rem; }
.admin-input[aria-invalid='true'], .admin-textarea[aria-invalid='true'] { border-color: var(--accent, #e4202b); }
.admin-langtabs { display: inline-flex; gap: 0.25rem; margin-bottom: 0.35rem; }
.admin-langtab {
  font: inherit; font-size: 0.75rem;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--border, #e8e8ec);
  border-radius: var(--radius-pill, 999px);
  background: none; color: var(--text-2, #5b5d66); cursor: pointer;
}
.admin-langtab.is-active { background: var(--text, #0d0d0f); color: #fff; border-color: var(--text, #0d0d0f); }
.admin-charcount { font-size: 0.72rem; }
.admin-charcount.is-ok { color: var(--text-3, #8a8d95); }
.admin-charcount.is-over { color: var(--accent, #e4202b); }

/* --- buttons --- */
.admin-btn {
  font: inherit; font-size: 0.85rem;
  padding: 0.5rem 0.9rem;
  border: 1px solid var(--border-strong, #dcdce2);
  border-radius: var(--radius-sm, 8px);
  background: var(--bg-elevated, #fff); color: inherit; cursor: pointer;
}
.admin-btn--primary { background: var(--accent, #e4202b); border-color: var(--accent, #e4202b); color: #fff; }
.admin-btn--danger { color: var(--accent, #e4202b); border-color: var(--accent, #e4202b); background: none; }
.admin-btn:disabled { opacity: 0.5; cursor: default; }

/* --- save bar --- */
.admin-savebar {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.65rem 0.85rem; margin: 1rem 0;
  border: 1px solid var(--border, #e8e8ec); border-radius: var(--radius-sm, 8px);
  background: var(--surface-2, #fbfbfc);
}
.admin-savebar__note { font-size: 0.82rem; color: var(--text-2, #5b5d66); margin-right: auto; }
.admin-savebar.is-dirty { border-color: var(--accent, #e4202b); }

/* --- card list --- */
.admin-cardlist { display: flex; flex-direction: column; gap: 0.35rem; }
.admin-cardrow {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--border, #e8e8ec); border-radius: var(--radius-sm, 8px);
  background: var(--surface, #fff); cursor: pointer; text-align: left; font: inherit; width: 100%;
}
.admin-cardrow.is-selected { border-color: var(--accent, #e4202b); }
.admin-cardrow__dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-3, #8a8d95); flex: none; }
.admin-cardrow__dot.is-published { background: #1f9d55; }
.admin-cardrow__title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.admin-cardrow__move { font: inherit; border: 0; background: none; cursor: pointer; padding: 0 0.2rem; color: var(--text-2, #5b5d66); }

/* --- tabs (Home / Page) --- */
.admin-tabs { display: inline-flex; gap: 0.25rem; margin-bottom: 1rem; }
.admin-tab {
  font: inherit; font-size: 0.85rem; padding: 0.35rem 0.8rem;
  border: 1px solid var(--border, #e8e8ec); border-radius: var(--radius-sm, 8px);
  background: none; cursor: pointer; color: var(--text-2, #5b5d66);
}
.admin-tab.is-active { background: var(--text, #0d0d0f); color: #fff; border-color: var(--text, #0d0d0f); }

/* --- image upload --- */
.admin-imageupload { display: flex; flex-direction: column; gap: 0.5rem; }
.admin-imageupload__preview {
  width: 100%; max-width: 260px; aspect-ratio: 16/10; object-fit: cover;
  border: 1px solid var(--border, #e8e8ec); border-radius: var(--radius-sm, 8px); background: var(--surface-2, #fbfbfc);
}
.admin-imageupload__preview--empty { display: grid; place-items: center; color: var(--text-3, #8a8d95); font-size: 0.8rem; }
.admin-imageupload__error { color: var(--accent, #e4202b); font-size: 0.78rem; }

/* --- toast --- */
.admin-toastregion { position: fixed; right: 1rem; bottom: 1rem; z-index: 1100; display: flex; flex-direction: column; gap: 0.5rem; }
.admin-toast {
  padding: 0.6rem 0.9rem; border-radius: var(--radius-sm, 8px);
  background: var(--text, #0d0d0f); color: #fff; font-size: 0.85rem; max-width: 320px;
}
.admin-toast--error { background: var(--accent, #e4202b); }

/* --- confirm dialog --- */
.admin-confirm__overlay { position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center; padding: 1rem; background: rgba(6,8,11,0.5); }
.admin-confirm {
  width: 100%; max-width: 400px; padding: 1.5rem;
  background: var(--surface, #fff); border-radius: var(--radius-lg, 16px); border: 1px solid var(--border, #e8e8ec);
}
.admin-confirm__title { margin: 0 0 0.5rem; font-size: 1.05rem; }
.admin-confirm__msg { margin: 0 0 1.25rem; font-size: 0.9rem; color: var(--text-2, #5b5d66); }
.admin-confirm__actions { display: flex; gap: 0.5rem; justify-content: flex-end; }

/* --- table (requests) --- */
.admin-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.admin-table th, .admin-table td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--border, #e8e8ec); }
.admin-table tbody tr { cursor: pointer; }
.admin-table tbody tr:hover { background: var(--surface-hover, #f0f0f3); }
.admin-badge { display: inline-block; padding: 0.1rem 0.5rem; border-radius: var(--radius-pill, 999px); font-size: 0.72rem; text-transform: capitalize; }
.admin-badge--new { background: #e6f0ff; color: #1552b7; }
.admin-badge--in_progress { background: #fff4e0; color: #a15c00; }
.admin-badge--done { background: #e3f6e9; color: #1f7a44; }
.admin-badge--archived { background: #eee; color: #666; }

/* --- serp preview --- */
.admin-serp { border: 1px solid var(--border, #e8e8ec); border-radius: var(--radius-sm, 8px); padding: 0.85rem; background: #fff; max-width: 600px; }
.admin-serp__url { color: #202124; font-size: 0.8rem; }
.admin-serp__title { color: #1a0dab; font-size: 1.05rem; margin: 0.15rem 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.admin-serp__desc { color: #4d5156; font-size: 0.82rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* --- dashboard --- */
.admin-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem; }
.admin-stat { padding: 0.85rem; border: 1px solid var(--border, #e8e8ec); border-radius: var(--radius-sm, 8px); background: var(--surface, #fff); }
.admin-stat__n { font-size: 1.4rem; font-weight: 600; }
.admin-stat__label { font-size: 0.78rem; color: var(--text-2, #5b5d66); }

.admin-empty { padding: 2rem; text-align: center; color: var(--text-2, #5b5d66); border: 1px dashed var(--border-strong, #dcdce2); border-radius: var(--radius-sm, 8px); }
.admin-empty__title { font-weight: 600; margin: 0 0 0.35rem; }
```

- [ ] **Step 8: Wire the lazy route into `src/App.tsx`**

```tsx
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "./i18n/i18n";
import { SiteContentProvider } from "./content/SiteContentProvider";
import { Layout } from "./components/Layout/Layout";
import { HomePage } from "./pages/HomePage";
import { StubPage } from "./pages/StubPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { STUB_ROUTES } from "./data/nav";

const AdminApp = lazy(() => import("./admin/AdminApp"));

export default function App() {
  return (
    <I18nProvider>
      <SiteContentProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              {STUB_ROUTES.map((path) => (
                <Route key={path} path={path} element={<StubPage />} />
              ))}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            <Route
              path="/admin/*"
              element={
                <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
                  <AdminApp />
                </Suspense>
              }
            />
          </Routes>
        </BrowserRouter>
      </SiteContentProvider>
    </I18nProvider>
  );
}
```
> The `<Route path="*">` inside the `Layout` block still matches non-admin unknown paths; React Router picks the more specific `/admin/*` first. Add a regression assertion in `src/App.test.tsx` if not already present that `/` still renders the hero (it is).

- [ ] **Step 9: Run the test + gates**

Run: `npm test -- src/admin/AdminApp.test.tsx && npm test && npm run lint && npm run build`
Expected: green. The public bundle must not statically import admin code — check `npm run build` output shows an `admin` chunk split out.

- [ ] **Step 10: Commit**

```bash
git add src/admin/AdminApp.tsx src/admin/AdminLayout.tsx src/admin/admin.css src/admin/useAdminTitle.ts src/admin/pages src/admin/AdminApp.test.tsx src/App.tsx
git commit -m "feat: admin shell — lazy /admin route, auth gate, sidebar layout

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Toast + ConfirmDialog + EmptyState + StatusBadge

**Files:**
- Create: `src/admin/components/Toast.tsx`, `src/admin/components/ConfirmDialog.tsx`, `src/admin/components/EmptyState.tsx`, `src/admin/components/StatusBadge.tsx`
- Modify: `src/admin/AdminLayout.tsx` (wrap in `ToastProvider`, render `<ToastRegion/>`)
- Test: `src/admin/components/Toast.test.tsx`, `src/admin/components/ConfirmDialog.test.tsx`

**Interfaces:**
- Produces:
  - `ToastProvider` (children); `useToast(): (message: string, type?: 'ok' | 'error') => void`; `ToastRegion` (renders the stack, auto-dismiss after 3s).
  - `useConfirm(): { confirm: (opts: { title: string; message: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>; dialog: ReactNode }` — render `dialog` somewhere in the tree; `confirm(...)` resolves `true`/`false`.
  - `EmptyState({ title, hint, action? }: { title: string; hint?: string; action?: ReactNode })`
  - `StatusBadge({ status }: { status: RequestStatus })` → `<span className={\`admin-badge admin-badge--${status}\`}>{label}</span>` where label maps `new→New`, `in_progress→In progress`, `done→Done`, `archived→Archived`.

- [ ] **Step 1: Write the failing tests**

`src/admin/components/Toast.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ToastProvider, ToastRegion, useToast } from './Toast'

function Trigger() {
  const toast = useToast()
  return <button onClick={() => toast('Saved', 'ok')}>go</button>
}

describe('Toast', () => {
  it('shows a toast then auto-dismisses', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Trigger />
        <ToastRegion />
      </ToastProvider>,
    )
    act(() => screen.getByText('go').click())
    expect(screen.getByText('Saved')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(3100))
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
import { vi } from 'vitest'
```
> Move the `import { vi }` to the top with the other imports before saving.

`src/admin/components/ConfirmDialog.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useConfirm } from './ConfirmDialog'

function Probe({ onResult }: { onResult: (v: boolean) => void }) {
  const { confirm, dialog } = useConfirm()
  return (
    <>
      <button onClick={async () => onResult(await confirm({ title: 'Delete?', message: 'Sure?' }))}>
        ask
      </button>
      {dialog}
    </>
  )
}

describe('useConfirm', () => {
  it('resolves true on confirm, false on cancel', async () => {
    const user = userEvent.setup()
    const results: boolean[] = []
    render(<Probe onResult={(v) => results.push(v)} />)

    await user.click(screen.getByText('ask'))
    await user.click(screen.getByRole('button', { name: /confirm|delete|yes/i }))
    await user.click(screen.getByText('ask'))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(results).toEqual([true, false])
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- src/admin/components/Toast.test.tsx src/admin/components/ConfirmDialog.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write `src/admin/components/Toast.tsx`**

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { newId } from '../lib/id'

type ToastType = 'ok' | 'error'
interface ToastItem { id: string; message: string; type: ToastType }

interface ToastCtx {
  toasts: ToastItem[]
  push: (message: string, type?: ToastType) => void
  dismiss: (id: string) => void
}

const Ctx = createContext<ToastCtx | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])
  const push = useCallback(
    (message: string, type: ToastType = 'ok') => {
      const id = newId('toast')
      setToasts((t) => [...t, { id, message, type }])
      window.setTimeout(() => dismiss(id), 3000)
    },
    [dismiss],
  )
  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useToast(): (message: string, type?: ToastType) => void {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx.push
}

export function ToastRegion() {
  const ctx = useContext(Ctx)
  if (!ctx) return null
  return (
    <div className="admin-toastregion" aria-live="polite" aria-atomic="false">
      {ctx.toasts.map((t) => (
        <div
          key={t.id}
          className={`admin-toast${t.type === 'error' ? ' admin-toast--error' : ''}`}
          role={t.type === 'error' ? 'alert' : 'status'}
          onClick={() => ctx.dismiss(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Write `src/admin/components/ConfirmDialog.tsx`**

```tsx
import { useCallback, useRef, useState, type ReactNode } from 'react'

interface ConfirmOpts {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback((o: ConfirmOpts) => {
    setOpts(o)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const finish = useCallback((v: boolean) => {
    resolver.current?.(v)
    resolver.current = null
    setOpts(null)
  }, [])

  const dialog: ReactNode = opts ? (
    <div className="admin-confirm__overlay" onClick={() => finish(false)}>
      <div
        className="admin-confirm"
        role="dialog"
        aria-modal="true"
        aria-label={opts.title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="admin-confirm__title">{opts.title}</h2>
        <p className="admin-confirm__msg">{opts.message}</p>
        <div className="admin-confirm__actions">
          <button type="button" className="admin-btn" onClick={() => finish(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={`admin-btn ${opts.danger ? 'admin-btn--danger' : 'admin-btn--primary'}`}
            onClick={() => finish(true)}
          >
            {opts.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, dialog }
}
```

- [ ] **Step 5: Write `src/admin/components/EmptyState.tsx`**

```tsx
import type { ReactNode } from 'react'

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="admin-empty">
      <p className="admin-empty__title">{title}</p>
      {hint && <p>{hint}</p>}
      {action}
    </div>
  )
}
```

- [ ] **Step 6: Write `src/admin/components/StatusBadge.tsx`**

```tsx
import type { RequestStatus } from '../types'

const LABEL: Record<RequestStatus, string> = {
  new: 'New',
  in_progress: 'In progress',
  done: 'Done',
  archived: 'Archived',
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <span className={`admin-badge admin-badge--${status}`}>{LABEL[status]}</span>
}
```

- [ ] **Step 7: Wrap `AdminLayout` in `ToastProvider` + render `ToastRegion`**

In `src/admin/AdminLayout.tsx`: import `ToastProvider`, `ToastRegion`; wrap the returned `<div className="admin">…</div>` in `<ToastProvider>` and add `<ToastRegion />` as the last child inside `.admin`.

- [ ] **Step 8: Run tests + gates**

Run: `npm test -- src/admin/components/ && npm test && npm run lint && npm run build`
Expected: green.

- [ ] **Step 9: Commit**

```bash
git add src/admin/components/Toast.tsx src/admin/components/ConfirmDialog.tsx src/admin/components/EmptyState.tsx src/admin/components/StatusBadge.tsx src/admin/components/Toast.test.tsx src/admin/components/ConfirmDialog.test.tsx src/admin/AdminLayout.tsx
git commit -m "feat: admin UI primitives — Toast, ConfirmDialog, EmptyState, StatusBadge

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Form primitives — TextField, Toggle, CharCounter, LocalizedField, SaveBar

**Files:**
- Create: `src/admin/components/TextField.tsx`, `Toggle.tsx`, `CharCounter.tsx`, `LocalizedField.tsx`, `SaveBar.tsx`
- Test: `src/admin/components/LocalizedField.test.tsx`, `src/admin/components/SaveBar.test.tsx`

**Interfaces:**
- Produces:
  - `TextField({ label, value, onChange, multiline?, hint?, maxLength?, recommended?, type?, invalid? }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; hint?: string; maxLength?: number; recommended?: number; type?: string; invalid?: boolean })` — label + input/textarea; if `recommended` given, renders a `<CharCounter value={value.length} recommended={recommended} />`.
  - `Toggle({ label, checked, onChange, hint? }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string })` — a real `<input type="checkbox">` with an associated label.
  - `CharCounter({ value, recommended }: { value: number; recommended: number })` → `<span className={value <= recommended ? 'admin-charcount is-ok' : 'admin-charcount is-over'}>{value} / {recommended}</span>`
  - `LocalizedField({ label, value, onChange, multiline?, hint?, recommended? }: { label: string; value: L; onChange: (next: L) => void; multiline?: boolean; hint?: string; recommended?: number })` — label + EN|UA tab buttons + a `TextField` bound to the active locale; changing the tab does not lose the other locale's text.
  - `SaveBar({ dirty, onSave, onDiscard, saving? }: { dirty: boolean; onSave: () => void; onDiscard: () => void; saving?: boolean })` — when `dirty`: "You have unsaved changes" + Save (primary) + Discard; when clean: "All changes saved" + a disabled Save.

- [ ] **Step 1: Write the failing tests**

`src/admin/components/LocalizedField.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LocalizedField } from './LocalizedField'
import type { L } from '../types'

// a controlled harness so typing actually updates the value
function Harness({ initial }: { initial: L }) {
  const [value, setValue] = useState<L>(initial)
  return (
    <>
      <LocalizedField label="Title" value={value} onChange={setValue} />
      <span data-testid="en">{value.en}</span>
      <span data-testid="uk">{value.uk}</span>
    </>
  )
}

describe('LocalizedField', () => {
  it('edits EN and UA independently without losing the other locale', async () => {
    const user = userEvent.setup()
    render(<Harness initial={{ en: 'Hello', uk: 'Privit' }} />)

    // EN tab is the default
    const input = () => screen.getByLabelText('Title') as HTMLInputElement
    expect(input().value).toBe('Hello')
    await user.type(input(), '!')
    expect(screen.getByTestId('en')).toHaveTextContent('Hello!')
    expect(screen.getByTestId('uk')).toHaveTextContent('Privit')

    await user.click(screen.getByRole('button', { name: 'UA' }))
    expect(input().value).toBe('Privit')
    await user.type(input(), ' UA')
    expect(screen.getByTestId('uk')).toHaveTextContent('Privit UA')
    expect(screen.getByTestId('en')).toHaveTextContent('Hello!')
  })
})
```

`src/admin/components/SaveBar.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SaveBar } from './SaveBar'

describe('SaveBar', () => {
  it('shows dirty state and fires callbacks', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onDiscard = vi.fn()
    render(<SaveBar dirty onSave={onSave} onDiscard={onDiscard} />)
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /save/i }))
    await user.click(screen.getByRole('button', { name: /discard/i }))
    expect(onSave).toHaveBeenCalled()
    expect(onDiscard).toHaveBeenCalled()
  })
  it('disables Save when clean', () => {
    render(<SaveBar dirty={false} onSave={vi.fn()} onDiscard={vi.fn()} />)
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- src/admin/components/LocalizedField.test.tsx src/admin/components/SaveBar.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write `src/admin/components/CharCounter.tsx`**

```tsx
export function CharCounter({ value, recommended }: { value: number; recommended: number }) {
  const over = value > recommended
  return (
    <span className={`admin-charcount ${over ? 'is-over' : 'is-ok'}`}>
      {value} / {recommended}
    </span>
  )
}
```

- [ ] **Step 4: Write `src/admin/components/TextField.tsx`**

```tsx
import { useId } from 'react'
import { CharCounter } from './CharCounter'

interface Props {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  hint?: string
  maxLength?: number
  recommended?: number
  type?: string
  invalid?: boolean
}

export function TextField({
  label,
  value,
  onChange,
  multiline,
  hint,
  maxLength,
  recommended,
  type = 'text',
  invalid,
}: Props) {
  const id = useId()
  return (
    <div className="admin-field">
      <label className="admin-field__label" htmlFor={id}>
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          className="admin-textarea"
          value={value}
          maxLength={maxLength}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          className="admin-input"
          type={type}
          value={value}
          maxLength={maxLength}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {(hint || recommended != null) && (
        <span className="admin-field__hint">
          {hint}
          {hint && recommended != null ? ' · ' : ''}
          {recommended != null && <CharCounter value={value.length} recommended={recommended} />}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Write `src/admin/components/Toggle.tsx`**

```tsx
import { useId } from 'react'

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  hint?: string
}) {
  const id = useId()
  return (
    <div className="admin-field">
      <label className="admin-field__label" htmlFor={id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      {hint && <span className="admin-field__hint">{hint}</span>}
    </div>
  )
}
```

- [ ] **Step 6: Write `src/admin/components/LocalizedField.tsx`**

```tsx
import { useState } from 'react'
import type { L, Locale } from '../types'
import { TextField } from './TextField'

const LOCALES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'uk', label: 'UA' },
]

export function LocalizedField({
  label,
  value,
  onChange,
  multiline,
  hint,
  recommended,
}: {
  label: string
  value: L
  onChange: (next: L) => void
  multiline?: boolean
  hint?: string
  recommended?: number
}) {
  const [active, setActive] = useState<Locale>('en')
  return (
    <div>
      <div className="admin-langtabs" role="group" aria-label={`${label} language`}>
        {LOCALES.map((l) => (
          <button
            key={l.code}
            type="button"
            className={`admin-langtab${active === l.code ? ' is-active' : ''}`}
            aria-pressed={active === l.code}
            onClick={() => setActive(l.code)}
          >
            {l.label}
          </button>
        ))}
      </div>
      <TextField
        label={label}
        value={value[active]}
        onChange={(v) => onChange({ ...value, [active]: v })}
        multiline={multiline}
        hint={hint}
        recommended={recommended}
      />
    </div>
  )
}
```
> `Locale` is exported from `src/admin/types.ts` (`type Locale = 'en' | 'uk'`).

- [ ] **Step 7: Write `src/admin/components/SaveBar.tsx`**

```tsx
export function SaveBar({
  dirty,
  onSave,
  onDiscard,
  saving,
}: {
  dirty: boolean
  onSave: () => void
  onDiscard: () => void
  saving?: boolean
}) {
  return (
    <div className={`admin-savebar${dirty ? ' is-dirty' : ''}`}>
      <span className="admin-savebar__note">
        {dirty ? 'You have unsaved changes' : 'All changes saved'}
      </span>
      {dirty && (
        <button type="button" className="admin-btn" onClick={onDiscard} disabled={saving}>
          Discard
        </button>
      )}
      <button
        type="button"
        className="admin-btn admin-btn--primary"
        onClick={onSave}
        disabled={!dirty || saving}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
```

- [ ] **Step 8: Run tests + gates**

Run: `npm test -- src/admin/components/ && npm test && npm run lint && npm run build`
Expected: green.

- [ ] **Step 9: Commit**

```bash
git add src/admin/components/TextField.tsx src/admin/components/Toggle.tsx src/admin/components/CharCounter.tsx src/admin/components/LocalizedField.tsx src/admin/components/SaveBar.tsx src/admin/components/LocalizedField.test.tsx src/admin/components/SaveBar.test.tsx
git commit -m "feat: admin form primitives — TextField, Toggle, LocalizedField, SaveBar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: ContentPage — section header texts

**Files:**
- Modify: `src/admin/pages/ContentPage.tsx` (replace placeholder)
- Test: `src/admin/pages/ContentPage.test.tsx`

**Interfaces:**
- Consumes: `useSiteContentRaw()`; `LocalizedField`, `SaveBar` (Task 3); `useToast` (Task 2); `useAdminTitle`.
- Produces: a screen listing the 6 `sections`. Each section is a fieldset with `LocalizedField` for **Eyebrow**, **Title**, **Body**, and — for `hero` and `cta` only — **Button label** (`ctaLabel`). Local draft state seeded from `data.sections`; a per-section `SaveBar`; Save dispatches `actions.updateSection(key, patch)` with only the changed fields and toasts "Saved"; Discard resets the draft. Re-syncs the draft if `data` changes externally (cross-tab) AND the section isn't dirty.

- [ ] **Step 1: Write the failing test**

`src/admin/pages/ContentPage.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider, useSiteContentRaw } from '../../content/SiteContentProvider'
import { ToastProvider } from '../components/Toast'
import { ContentPage } from './ContentPage'

beforeEach(() => localStorage.clear())

function StoreProbe() {
  const { data } = useSiteContentRaw()
  const hero = data.sections.find((s) => s.key === 'hero')!
  return <span data-testid="hero-title-en">{hero.title.en}</span>
}

const wrap = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <ToastProvider>
          <ContentPage />
          <StoreProbe />
        </ToastProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('ContentPage', () => {
  it('renders all six section blocks', () => {
    wrap()
    for (const label of ['Hero', 'Services block', 'Projects block', 'How we work block', 'About block', 'Call-to-action block']) {
      expect(screen.getByRole('heading', { name: new RegExp(label, 'i') })).toBeInTheDocument()
    }
  })

  it('only Hero and CTA expose a Button label field', () => {
    wrap()
    expect(screen.getAllByText(/button label/i).length).toBe(2)
  })

  it('editing a title and saving updates the store', async () => {
    const user = userEvent.setup()
    wrap()
    // find the Hero fieldset, its Title field (EN tab default)
    const heroTitle = screen.getAllByLabelText('Title')[0]
    await user.clear(heroTitle)
    await user.type(heroTitle, 'Brand new hero title')
    // the Hero SaveBar becomes dirty
    const saveButtons = screen.getAllByRole('button', { name: /^save$/i })
    await user.click(saveButtons[0])
    expect(screen.getByTestId('hero-title-en')).toHaveTextContent('Brand new hero title')
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- src/admin/pages/ContentPage.test.tsx`
Expected: FAIL (placeholder page).

- [ ] **Step 3: Write `src/admin/pages/ContentPage.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import type { L, SectionKey, SectionText } from '../types'
import { useSiteContentRaw } from '../../content/SiteContentProvider'
import { LocalizedField } from '../components/LocalizedField'
import { SaveBar } from '../components/SaveBar'
import { useToast } from '../components/Toast'
import { useAdminTitle } from '../useAdminTitle'

type Draft = Pick<SectionText, 'eyebrow' | 'title' | 'body'> & { ctaLabel?: L }

const eqL = (a: L, b: L) => a.en === b.en && a.uk === b.uk
const toDraft = (s: SectionText): Draft => ({
  eyebrow: { ...s.eyebrow },
  title: { ...s.title },
  body: { ...s.body },
  ...(s.ctaLabel ? { ctaLabel: { ...s.ctaLabel } } : {}),
})

function SectionEditor({ section }: { section: SectionText }) {
  const { actions } = useSiteContentRaw()
  const toast = useToast()
  const [draft, setDraft] = useState<Draft>(() => toDraft(section))

  // re-sync from store when not dirty (e.g. cross-tab edit or Reset)
  const stored = useMemo(() => toDraft(section), [section])
  const dirty =
    !eqL(draft.eyebrow, stored.eyebrow) ||
    !eqL(draft.title, stored.title) ||
    !eqL(draft.body, stored.body) ||
    Boolean(draft.ctaLabel && stored.ctaLabel && !eqL(draft.ctaLabel, stored.ctaLabel))
  useEffect(() => {
    if (!dirty) setDraft(stored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored.eyebrow.en, stored.eyebrow.uk, stored.title.en, stored.title.uk, stored.body.en, stored.body.uk])

  const save = () => {
    const patch: Partial<Draft> = {}
    if (!eqL(draft.eyebrow, stored.eyebrow)) patch.eyebrow = draft.eyebrow
    if (!eqL(draft.title, stored.title)) patch.title = draft.title
    if (!eqL(draft.body, stored.body)) patch.body = draft.body
    if (draft.ctaLabel && stored.ctaLabel && !eqL(draft.ctaLabel, stored.ctaLabel))
      patch.ctaLabel = draft.ctaLabel
    actions.updateSection(section.key, patch)
    toast('Saved')
  }

  return (
    <fieldset className="admin-fieldset">
      <legend><h2>{section.label}</h2></legend>
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
      <LocalizedField
        label="Body"
        value={draft.body}
        multiline
        onChange={(v) => setDraft((d) => ({ ...d, body: v }))}
      />
      {draft.ctaLabel && (
        <LocalizedField
          label="Button label"
          value={draft.ctaLabel}
          onChange={(v) => setDraft((d) => ({ ...d, ctaLabel: v }))}
        />
      )}
      <SaveBar dirty={dirty} onSave={save} onDiscard={() => setDraft(stored)} />
    </fieldset>
  )
}

const ORDER: SectionKey[] = ['hero', 'services', 'projects', 'howWork', 'about', 'cta']

export function ContentPage() {
  useAdminTitle('Content')
  const { data } = useSiteContentRaw()
  const sections = ORDER.map((k) => data.sections.find((s) => s.key === k)).filter(
    (s): s is SectionText => Boolean(s),
  )
  return (
    <section className="admin-page">
      <h1>Content</h1>
      <p className="admin-page__hint">
        The heading and text for each block on the home page. Changes appear on the site immediately after you save.
      </p>
      {sections.map((s) => (
        <SectionEditor key={s.key} section={s} />
      ))}
    </section>
  )
}
```
Add to `src/admin/admin.css`:
```css
.admin-fieldset { border: 1px solid var(--border, #e8e8ec); border-radius: var(--radius-md, 12px); padding: 1rem 1.15rem; margin: 0 0 1.5rem; min-width: 0; }
.admin-fieldset legend { padding: 0 0.4rem; }
.admin-fieldset legend h2 { font-size: 1rem; margin: 0; }
```

- [ ] **Step 4: Run test + gates**

Run: `npm test -- src/admin/pages/ContentPage.test.tsx && npm test && npm run lint && npm run build`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/admin/pages/ContentPage.tsx src/admin/pages/ContentPage.test.tsx src/admin/admin.css
git commit -m "feat: admin Content screen — edit the six section header blocks

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Card components — ImageUpload, CardList

**Files:**
- Create: `src/admin/components/ImageUpload.tsx`, `src/admin/components/CardList.tsx`
- Test: `src/admin/components/ImageUpload.test.tsx`, `src/admin/components/CardList.test.tsx`

**Interfaces:**
- Consumes: `fileToImageRef`, `MAX_IMAGE_BYTES` from `../lib/image`; `ImageRef` type.
- Produces:
  - `ImageUpload({ label, value, onChange, onClear }: { label: string; value: ImageRef; onChange: (ref: ImageRef) => void; onClear: () => void })` — shows `<img src={value.src}>` when `value.src` non-empty else an empty placeholder box; a "Choose file" `<input type="file" accept="image/*">`; on select calls `fileToImageRef` and either `onChange(ref)` or shows an inline error ("That file isn't an image." / "That image is too large (max ~1.5 MB) — try a smaller one."); a "Remove" button (only when `value.src`) → `onClear()`.
  - `CardList({ items, selectedId, onSelect, onMove, onAdd, addLabel }: { items: { id: string; title: string; published: boolean }[]; selectedId: string | null; onSelect: (id: string) => void; onMove: (id: string, dir: 'up' | 'down') => void; onAdd: () => void; addLabel: string })` — a vertical list of rows (published dot + title + ▲/▼ move buttons; ▲ disabled on first, ▼ on last), row click selects; a "+ {addLabel}" button at the bottom. Empty list → a short "No items yet" line above the add button.

- [ ] **Step 1: Write the failing tests**

`src/admin/components/ImageUpload.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImageUpload } from './ImageUpload'
import type { ImageRef } from '../types'

const EMPTY: ImageRef = { kind: 'asset', src: '' }

describe('ImageUpload', () => {
  it('shows the empty placeholder and no Remove button when src is empty', () => {
    render(<ImageUpload label="Image" value={EMPTY} onChange={vi.fn()} onClear={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
  })

  it('rejects a non-image file with an inline message', async () => {
    const user = userEvent.setup()
    render(<ImageUpload label="Image" value={EMPTY} onChange={vi.fn()} onClear={vi.fn()} />)
    const file = new File(['x'], 'a.txt', { type: 'text/plain' })
    await user.upload(screen.getByLabelText(/choose file/i), file)
    expect(await screen.findByText(/isn't an image/i)).toBeInTheDocument()
  })

  it('accepts an image file and calls onChange with an upload ImageRef', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ImageUpload label="Image" value={EMPTY} onChange={onChange} onClear={vi.fn()} />)
    const png = new File([Uint8Array.from([137, 80, 78, 71])], 'p.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText(/choose file/i), png)
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.calls[0][0].kind).toBe('upload')
  })

  it('shows Remove when there is an image and calls onClear', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(
      <ImageUpload label="Image" value={{ kind: 'asset', src: '/assets/x.png' }} onChange={vi.fn()} onClear={onClear} />,
    )
    await user.click(screen.getByRole('button', { name: /remove/i }))
    expect(onClear).toHaveBeenCalled()
  })
})
```

`src/admin/components/CardList.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CardList } from './CardList'

const items = [
  { id: 'a', title: 'Alpha', published: true },
  { id: 'b', title: 'Beta', published: false },
]

describe('CardList', () => {
  it('renders rows, selects on click, and adds', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onAdd = vi.fn()
    render(
      <CardList
        items={items}
        selectedId="a"
        onSelect={onSelect}
        onMove={vi.fn()}
        onAdd={onAdd}
        addLabel="Add project"
      />,
    )
    await user.click(screen.getByText('Beta'))
    expect(onSelect).toHaveBeenCalledWith('b')
    await user.click(screen.getByRole('button', { name: /add project/i }))
    expect(onAdd).toHaveBeenCalled()
  })

  it('disables move-up on the first row and move-down on the last', () => {
    render(
      <CardList items={items} selectedId={null} onSelect={vi.fn()} onMove={vi.fn()} onAdd={vi.fn()} addLabel="Add" />,
    )
    const ups = screen.getAllByRole('button', { name: /move up/i })
    const downs = screen.getAllByRole('button', { name: /move down/i })
    expect(ups[0]).toBeDisabled()
    expect(downs[downs.length - 1]).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- src/admin/components/ImageUpload.test.tsx src/admin/components/CardList.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write `src/admin/components/ImageUpload.tsx`**

```tsx
import { useId, useState } from 'react'
import type { ImageRef } from '../types'
import { fileToImageRef } from '../lib/image'

const MESSAGES: Record<string, string> = {
  'unsupported-type': "That file isn't an image. Choose a JPG, PNG, or WebP.",
  'too-large': 'That image is too large (max ~1.5 MB) — try a smaller one.',
}

export function ImageUpload({
  label,
  value,
  onChange,
  onClear,
}: {
  label: string
  value: ImageRef
  onChange: (ref: ImageRef) => void
  onClear: () => void
}) {
  const id = useId()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const ref = await fileToImageRef(file)
      onChange(ref)
    } catch (e) {
      const key = e instanceof Error ? e.message : ''
      setError(MESSAGES[key] ?? 'Could not read that file.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-field admin-imageupload">
      <span className="admin-field__label">{label}</span>
      {value.src ? (
        <img className="admin-imageupload__preview" src={value.src} alt="" />
      ) : (
        <span className="admin-imageupload__preview admin-imageupload__preview--empty">No image</span>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <label className="admin-btn" htmlFor={id}>
          {busy ? 'Reading…' : 'Choose file'}
        </label>
        <input
          id={id}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        {value.src && (
          <button type="button" className="admin-btn admin-btn--danger" onClick={onClear}>
            Remove
          </button>
        )}
      </div>
      {error && <span className="admin-imageupload__error">{error}</span>}
      {value.kind === 'upload' && value.fileName && (
        <span className="admin-field__hint">Uploaded: {value.fileName}</span>
      )}
    </div>
  )
}
```
> `<label htmlFor={id}>` + a visually-hidden `<input id={id} type="file">` gives the test's `getByLabelText(/choose file/i)`. Keep the input reachable (`display:none` still works with `user.upload` in testing-library; if it does not in this version, use a visually-hidden class instead of `display:none`).

- [ ] **Step 4: Write `src/admin/components/CardList.tsx`**

```tsx
interface Item { id: string; title: string; published: boolean }

export function CardList({
  items,
  selectedId,
  onSelect,
  onMove,
  onAdd,
  addLabel,
}: {
  items: Item[]
  selectedId: string | null
  onSelect: (id: string) => void
  onMove: (id: string, dir: 'up' | 'down') => void
  onAdd: () => void
  addLabel: string
}) {
  return (
    <div>
      <div className="admin-cardlist">
        {items.length === 0 && <p className="admin-field__hint">No items yet.</p>}
        {items.map((it, i) => (
          <div
            key={it.id}
            className={`admin-cardrow${it.id === selectedId ? ' is-selected' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(it.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelect(it.id)
            }}
          >
            <span className={`admin-cardrow__dot${it.published ? ' is-published' : ''}`} aria-hidden="true" />
            <span className="admin-cardrow__title">{it.title || 'Untitled'}</span>
            <button
              type="button"
              className="admin-cardrow__move"
              aria-label={`Move ${it.title || 'item'} up`}
              disabled={i === 0}
              onClick={(e) => {
                e.stopPropagation()
                onMove(it.id, 'up')
              }}
            >
              ▲
            </button>
            <button
              type="button"
              className="admin-cardrow__move"
              aria-label={`Move ${it.title || 'item'} down`}
              disabled={i === items.length - 1}
              onClick={(e) => {
                e.stopPropagation()
                onMove(it.id, 'down')
              }}
            >
              ▼
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="admin-btn" style={{ marginTop: '0.6rem' }} onClick={onAdd}>
        + {addLabel}
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Run tests + gates**

Run: `npm test -- src/admin/components/ && npm test && npm run lint && npm run build`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/admin/components/ImageUpload.tsx src/admin/components/CardList.tsx src/admin/components/ImageUpload.test.tsx src/admin/components/CardList.test.tsx
git commit -m "feat: admin ImageUpload + CardList components

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: ProjectsPage

**Files:**
- Modify: `src/admin/pages/ProjectsPage.tsx` (replace placeholder)
- Create: `src/admin/pages/CardScreen.tsx` (shared Home/Page card-editing screen used by Projects AND Services)
- Test: `src/admin/pages/ProjectsPage.test.tsx`

**Interfaces:**
- Consumes: `useSiteContentRaw()`, `CardList`, `ImageUpload`, `LocalizedField`, `TextField`, `Toggle`, `SaveBar`, `useToast`, `useConfirm`, `EmptyState`, `useAdminTitle`.
- Produces:
  - `CardScreen` — a **layout-only** shell (no store logic). Signature: `CardScreen({ title, hint, tabs, activeList, onActiveListChange, list, editor }: { title: string; hint: string; tabs: { key: CardListKey; label: string }[]; activeList: CardListKey; onActiveListChange: (l: CardListKey) => void; list: ReactNode; editor: ReactNode })`. It renders the page heading/hint, the Home/Page tab row, and a two-column `list | editor` grid. All data ownership (tab state, selection, add/move/delete/draft/save) lives in `ProjectsPage` / `ServicesPage`.
  - `ProjectsPage` — `useAdminTitle('Projects')`; tabs **On the home page** (`projectsHome`) / **Projects page** (`projectsPage`); editor form fields: Title (`LocalizedField`), Tags (`TextField` — comma-separated string ⇄ `string[]`), Description (`LocalizedField` multiline), Image (`ImageUpload` → `actions.setCardImage`), Image alt (`LocalizedField`), Published (`Toggle`). Order shown read-only ("Position 1 of 3 — use ▲ ▼ in the list"). Save dispatches `actions.updateCard(list, id, patch)`; image changes dispatch immediately via `actions.setCardImage` (not part of the draft). Delete → `useConfirm` → `actions.removeCard`.

- [ ] **Step 1: Write the failing test**

`src/admin/pages/ProjectsPage.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider, useSiteContentRaw } from '../../content/SiteContentProvider'
import { ToastProvider } from '../components/Toast'
import { ProjectsPage } from './ProjectsPage'

beforeEach(() => localStorage.clear())

function Probe() {
  const { data } = useSiteContentRaw()
  return (
    <span data-testid="home-count">{data.projectsHome.length}</span>
  )
}
const wrap = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <ToastProvider>
          <ProjectsPage />
          <Probe />
        </ToastProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('ProjectsPage', () => {
  it('lists the seeded home projects and switches tabs', async () => {
    const user = userEvent.setup()
    wrap()
    expect(screen.getByText('Relax Ahill')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /projects page/i }))
    // the Projects-page list is seeded with the same 2 items
    expect(screen.getByText('Encryptia Cloud')).toBeInTheDocument()
  })

  it('adds a new card (unpublished) via the list', async () => {
    const user = userEvent.setup()
    wrap()
    const before = Number(screen.getByTestId('home-count').textContent)
    await user.click(screen.getByRole('button', { name: /add project/i }))
    expect(Number(screen.getByTestId('home-count').textContent)).toBe(before + 1)
  })

  it('edits a card title and saves it to the store', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Relax Ahill'))
    const title = screen.getAllByLabelText('Title')[0]
    await user.clear(title)
    await user.type(title, 'Relax Ahill v2')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByText('Relax Ahill v2')).toBeInTheDocument()
  })

  it('deletes a card after confirmation', async () => {
    const user = userEvent.setup()
    wrap()
    const before = Number(screen.getByTestId('home-count').textContent)
    await user.click(screen.getByText('Relax Ahill'))
    await user.click(screen.getByRole('button', { name: /delete/i }))
    await user.click(screen.getByRole('button', { name: /delete card|confirm/i }))
    expect(Number(screen.getByTestId('home-count').textContent)).toBe(before - 1)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- src/admin/pages/ProjectsPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write `src/admin/pages/CardScreen.tsx`**

```tsx
import type { ReactNode } from 'react'
import type { CardListKey } from '../types'

export function CardScreen({
  title,
  hint,
  tabs,
  activeList,
  onActiveListChange,
  list,
  editor,
}: {
  title: string
  hint: string
  tabs: { key: CardListKey; label: string }[]
  activeList: CardListKey
  onActiveListChange: (l: CardListKey) => void
  list: ReactNode
  editor: ReactNode
}) {
  return (
    <section className="admin-page admin-page--wide">
      <h1>{title}</h1>
      <p className="admin-page__hint">{hint}</p>
      {tabs.length > 1 && (
        <div className="admin-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={t.key === activeList}
              className={`admin-tab${t.key === activeList ? ' is-active' : ''}`}
              onClick={() => onActiveListChange(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div className="admin-cardscreen">
        <div className="admin-cardscreen__list">{list}</div>
        <div className="admin-cardscreen__editor">{editor}</div>
      </div>
    </section>
  )
}
```
Add to `admin.css`:
```css
.admin-page--wide { max-width: 960px; }
.admin-cardscreen { display: grid; grid-template-columns: 240px 1fr; gap: 1.5rem; align-items: start; }
@media (max-width: 760px) { .admin-cardscreen { grid-template-columns: 1fr; } }
.admin-cardscreen__editor { min-width: 0; }
```

- [ ] **Step 4: Write `src/admin/pages/ProjectsPage.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import type { CardListKey, L, ProjectCard } from '../types'
import { useSiteContentRaw } from '../../content/SiteContentProvider'
import { CardList } from '../components/CardList'
import { CardScreen } from './CardScreen'
import { ImageUpload } from '../components/ImageUpload'
import { LocalizedField } from '../components/LocalizedField'
import { TextField } from '../components/TextField'
import { Toggle } from '../components/Toggle'
import { SaveBar } from '../components/SaveBar'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmDialog'
import { useAdminTitle } from '../useAdminTitle'

const TABS: { key: CardListKey; label: string }[] = [
  { key: 'projectsHome', label: 'On the home page' },
  { key: 'projectsPage', label: 'Projects page' },
]

interface Draft {
  title: L
  tags: string
  description: L
  imageAlt: L
  published: boolean
}
const eqL = (a: L, b: L) => a.en === b.en && a.uk === b.uk
const toDraft = (c: ProjectCard): Draft => ({
  title: { ...c.title },
  tags: c.tags.join(', '),
  description: { ...c.description },
  imageAlt: { ...c.imageAlt },
  published: c.published,
})

export function ProjectsPage() {
  useAdminTitle('Projects')
  const { data, actions } = useSiteContentRaw()
  const { confirm, dialog } = useConfirm()
  const toast = useToast()

  const [list, setList] = useState<CardListKey>('projectsHome')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const cards = useMemo(
    () => [...(data[list] as ProjectCard[])].sort((a, b) => a.order - b.order),
    [data, list],
  )
  const selected = cards.find((c) => c.id === selectedId) ?? null

  const [draft, setDraft] = useState<Draft | null>(null)
  const stored = selected ? toDraft(selected) : null
  useEffect(() => {
    setDraft(selected ? toDraft(selected) : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, list])

  const dirty =
    Boolean(draft && stored) &&
    (!eqL(draft!.title, stored!.title) ||
      draft!.tags !== stored!.tags ||
      !eqL(draft!.description, stored!.description) ||
      !eqL(draft!.imageAlt, stored!.imageAlt) ||
      draft!.published !== stored!.published)

  const save = () => {
    if (!selected || !draft) return
    actions.updateCard(list, selected.id, {
      title: draft.title,
      tags: draft.tags.split(',').map((t) => t.trim()).filter(Boolean),
      description: draft.description,
      imageAlt: draft.imageAlt,
      published: draft.published,
    })
    toast('Saved')
  }

  const del = async () => {
    if (!selected) return
    const ok = await confirm({
      title: 'Delete this project card?',
      message: 'It will be removed from the list. This cannot be undone.',
      confirmLabel: 'Delete card',
      danger: true,
    })
    if (!ok) return
    actions.removeCard(list, selected.id)
    setSelectedId(null)
    toast('Card deleted')
  }

  const listNode = (
    <CardList
      items={cards.map((c) => ({ id: c.id, title: c.title.en, published: c.published }))}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onMove={(id, dir) => actions.moveCard(list, id, dir)}
      onAdd={() => {
        actions.addCard(list)
      }}
      addLabel="Add project"
    />
  )

  const editorNode =
    selected && draft ? (
      <div>
        <p className="admin-field__hint">
          Position {cards.findIndex((c) => c.id === selected.id) + 1} of {cards.length} — use ▲ ▼ in the list to reorder.
        </p>
        <LocalizedField label="Title" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
        <TextField
          label="Tags"
          value={draft.tags}
          hint="Comma-separated, e.g. WordPress, WooCommerce"
          onChange={(v) => setDraft({ ...draft, tags: v })}
        />
        <LocalizedField
          label="Description"
          value={draft.description}
          multiline
          onChange={(v) => setDraft({ ...draft, description: v })}
        />
        <ImageUpload
          label="Image"
          value={selected.image}
          onChange={(ref) => actions.setCardImage(list, selected.id, ref)}
          onClear={() => actions.setCardImage(list, selected.id, { kind: 'asset', src: '' })}
        />
        <LocalizedField
          label="Image alt text"
          value={draft.imageAlt}
          hint="Describes the image for screen readers and search engines."
          onChange={(v) => setDraft({ ...draft, imageAlt: v })}
        />
        <Toggle
          label="Show on the site"
          checked={draft.published}
          onChange={(v) => setDraft({ ...draft, published: v })}
          hint="Unpublished cards are hidden from visitors but kept here."
        />
        <SaveBar dirty={dirty} onSave={save} onDiscard={() => stored && setDraft(stored)} />
        <button type="button" className="admin-btn admin-btn--danger" onClick={del}>
          Delete card
        </button>
      </div>
    ) : (
      <EmptyState title="No card selected" hint="Pick a card from the list, or add a new one." />
    )

  return (
    <>
      <CardScreen
        title="Projects"
        hint="Project cards shown in the Projects block on the home page, and the (future) Projects page. Each list is separate."
        tabs={TABS}
        activeList={list}
        onActiveListChange={(l) => {
          setList(l)
          setSelectedId(null)
        }}
        list={listNode}
        editor={editorNode}
      />
      {dialog}
    </>
  )
}
```

- [ ] **Step 5: Run test + gates**

Run: `npm test -- src/admin/pages/ProjectsPage.test.tsx && npm test && npm run lint && npm run build`
Expected: green. Adjust the delete-confirm button-name regex in the test if your `confirmLabel` differs — keep them in sync.

- [ ] **Step 6: Commit**

```bash
git add src/admin/pages/ProjectsPage.tsx src/admin/pages/CardScreen.tsx src/admin/pages/ProjectsPage.test.tsx src/admin/admin.css
git commit -m "feat: admin Projects screen — manage Home + Projects-page card lists

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: ServicesPage

**Files:**
- Modify: `src/admin/pages/ServicesPage.tsx` (replace placeholder)
- Test: `src/admin/pages/ServicesPage.test.tsx`

**Interfaces:**
- Consumes: same set as ProjectsPage + reuses `CardScreen`.
- Produces: `ServicesPage` — `useAdminTitle('Services')`; tabs **On the home page** (`servicesHome`) / **Services page** (`servicesPage`); editor form fields: Icon (`ImageUpload` bound to `card.icon` via `actions.setCardImage`), Title (`LocalizedField`), Text (`LocalizedField` multiline), Featured (`Toggle`, home list only — hide the toggle when `activeList === 'servicesPage'`), Published (`Toggle`). Save → `actions.updateCard(list, id, { title, text, featured, published })`. Add → `actions.addCard(list)`. Delete → confirm → `actions.removeCard`.

- [ ] **Step 1: Write the failing test**

`src/admin/pages/ServicesPage.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider, useSiteContentRaw } from '../../content/SiteContentProvider'
import { ToastProvider } from '../components/Toast'
import { ServicesPage } from './ServicesPage'

beforeEach(() => localStorage.clear())

function Probe() {
  const { data } = useSiteContentRaw()
  const wd = data.servicesHome.find((s) => s.id === 'web-development')
  return <span data-testid="wd-featured">{String(wd?.featured)}</span>
}
const wrap = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <ToastProvider>
          <ServicesPage />
          <Probe />
        </ToastProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('ServicesPage', () => {
  it('lists seeded services and shows the Featured toggle on the home tab only', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Web Development'))
    expect(screen.getByLabelText(/featured/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /services page/i }))
    expect(screen.queryByLabelText(/featured/i)).not.toBeInTheDocument()
  })

  it('toggles Featured and saves', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Web Development'))
    expect(screen.getByTestId('wd-featured')).toHaveTextContent('true')
    await user.click(screen.getByLabelText(/featured/i))
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByTestId('wd-featured')).toHaveTextContent('false')
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- src/admin/pages/ServicesPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write `src/admin/pages/ServicesPage.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import type { CardListKey, L, ServiceCard } from '../types'
import { useSiteContentRaw } from '../../content/SiteContentProvider'
import { CardList } from '../components/CardList'
import { CardScreen } from './CardScreen'
import { ImageUpload } from '../components/ImageUpload'
import { LocalizedField } from '../components/LocalizedField'
import { Toggle } from '../components/Toggle'
import { SaveBar } from '../components/SaveBar'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmDialog'
import { useAdminTitle } from '../useAdminTitle'

const TABS: { key: CardListKey; label: string }[] = [
  { key: 'servicesHome', label: 'On the home page' },
  { key: 'servicesPage', label: 'Services page' },
]

interface Draft {
  title: L
  text: L
  featured: boolean
  published: boolean
}
const eqL = (a: L, b: L) => a.en === b.en && a.uk === b.uk
const toDraft = (c: ServiceCard): Draft => ({
  title: { ...c.title },
  text: { ...c.text },
  featured: c.featured,
  published: c.published,
})

export function ServicesPage() {
  useAdminTitle('Services')
  const { data, actions } = useSiteContentRaw()
  const { confirm, dialog } = useConfirm()
  const toast = useToast()

  const [list, setList] = useState<CardListKey>('servicesHome')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const isHome = list === 'servicesHome'

  const cards = useMemo(
    () => [...(data[list] as ServiceCard[])].sort((a, b) => a.order - b.order),
    [data, list],
  )
  const selected = cards.find((c) => c.id === selectedId) ?? null
  const [draft, setDraft] = useState<Draft | null>(null)
  const stored = selected ? toDraft(selected) : null
  useEffect(() => {
    setDraft(selected ? toDraft(selected) : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, list])

  const dirty =
    Boolean(draft && stored) &&
    (!eqL(draft!.title, stored!.title) ||
      !eqL(draft!.text, stored!.text) ||
      draft!.featured !== stored!.featured ||
      draft!.published !== stored!.published)

  const save = () => {
    if (!selected || !draft) return
    actions.updateCard(list, selected.id, {
      title: draft.title,
      text: draft.text,
      featured: isHome ? draft.featured : false,
      published: draft.published,
    })
    toast('Saved')
  }

  const del = async () => {
    if (!selected) return
    const ok = await confirm({
      title: 'Delete this service card?',
      message: 'It will be removed from the list. This cannot be undone.',
      confirmLabel: 'Delete card',
      danger: true,
    })
    if (!ok) return
    actions.removeCard(list, selected.id)
    setSelectedId(null)
    toast('Card deleted')
  }

  const listNode = (
    <CardList
      items={cards.map((c) => ({ id: c.id, title: c.title.en, published: c.published }))}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onMove={(id, dir) => actions.moveCard(list, id, dir)}
      onAdd={() => actions.addCard(list)}
      addLabel="Add service"
    />
  )

  const editorNode =
    selected && draft ? (
      <div>
        <ImageUpload
          label="Icon"
          value={selected.icon}
          onChange={(ref) => actions.setCardImage(list, selected.id, ref)}
          onClear={() => actions.setCardImage(list, selected.id, { kind: 'asset', src: '' })}
        />
        <LocalizedField label="Title" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
        <LocalizedField
          label="Text"
          value={draft.text}
          multiline
          onChange={(v) => setDraft({ ...draft, text: v })}
        />
        {isHome && (
          <Toggle
            label="Featured (larger card)"
            checked={draft.featured}
            onChange={(v) => setDraft({ ...draft, featured: v })}
          />
        )}
        <Toggle
          label="Show on the site"
          checked={draft.published}
          onChange={(v) => setDraft({ ...draft, published: v })}
        />
        <SaveBar dirty={dirty} onSave={save} onDiscard={() => stored && setDraft(stored)} />
        <button type="button" className="admin-btn admin-btn--danger" onClick={del}>
          Delete card
        </button>
      </div>
    ) : (
      <EmptyState title="No card selected" hint="Pick a card from the list, or add a new one." />
    )

  return (
    <>
      <CardScreen
        title="Services"
        hint="Service cards shown in the Services block on the home page, and the (future) Services page. Each list is separate."
        tabs={TABS}
        activeList={list}
        onActiveListChange={(l) => {
          setList(l)
          setSelectedId(null)
        }}
        list={listNode}
        editor={editorNode}
      />
      {dialog}
    </>
  )
}
```

- [ ] **Step 4: Run test + gates**

Run: `npm test -- src/admin/pages/ServicesPage.test.tsx && npm test && npm run lint && npm run build`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/admin/pages/ServicesPage.tsx src/admin/pages/ServicesPage.test.tsx
git commit -m "feat: admin Services screen — manage Home + Services-page card lists

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: SeoPage + SerpPreview

**Files:**
- Modify: `src/admin/pages/SeoPage.tsx` (replace placeholder)
- Create: `src/admin/pages/SerpPreview.tsx`
- Test: `src/admin/pages/SeoPage.test.tsx`, `src/admin/pages/SerpPreview.test.tsx`

**Interfaces:**
- Produces:
  - `SerpPreview({ title, description, path }: { title: string; description: string; path: string })` — renders `admin-serp` block: URL line `onvorx.com{path}`, title (truncated ~60), description (2-line clamp ~155). Show placeholder text when a field is empty ("(no title set)" / "(no description set)").
  - `SeoPage` — `useAdminTitle('SEO')`; lists the 8 `seo` entries. Per entry: heading = `entry.label`, then `LocalizedField` for **SEO title** (`recommended={60}`) and **Meta description** (`recommended={155}`, multiline), a `SerpPreview` (using the active EN value — always EN for the preview, with a note), and a `SaveBar`. Save → `actions.updateSeo(pageKey, { title, description })` + toast.

- [ ] **Step 1: Write the failing tests**

`src/admin/pages/SerpPreview.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SerpPreview } from './SerpPreview'

describe('SerpPreview', () => {
  it('renders title, description and a URL from the path', () => {
    render(<SerpPreview title="My Page" description="A short summary." path="/about" />)
    expect(screen.getByText('My Page')).toBeInTheDocument()
    expect(screen.getByText('A short summary.')).toBeInTheDocument()
    expect(screen.getByText(/onvorx\.com\/about/i)).toBeInTheDocument()
  })
  it('shows placeholders when empty', () => {
    render(<SerpPreview title="" description="" path="/" />)
    expect(screen.getByText(/no title set/i)).toBeInTheDocument()
    expect(screen.getByText(/no description set/i)).toBeInTheDocument()
  })
})
```

`src/admin/pages/SeoPage.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider, useSiteContentRaw } from '../../content/SiteContentProvider'
import { ToastProvider } from '../components/Toast'
import { SeoPage } from './SeoPage'

beforeEach(() => localStorage.clear())

function Probe() {
  const { data } = useSiteContentRaw()
  return <span data-testid="home-seo">{data.seo.find((e) => e.pageKey === 'home')!.title.en}</span>
}
const wrap = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <ToastProvider>
          <SeoPage />
          <Probe />
        </ToastProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('SeoPage', () => {
  it('lists all 8 pages', () => {
    wrap()
    expect(screen.getByRole('heading', { name: /^Home$/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /web development/i })).toBeInTheDocument()
    expect(screen.getAllByText(/\/ 60$/).length).toBeGreaterThan(0) // char counters
  })

  it('edits the Home SEO title and saves', async () => {
    const user = userEvent.setup()
    wrap()
    const titleInputs = screen.getAllByLabelText(/seo title/i)
    await user.clear(titleInputs[0])
    await user.type(titleInputs[0], 'ONVORX — home')
    await user.click(screen.getAllByRole('button', { name: /^save$/i })[0])
    expect(screen.getByTestId('home-seo')).toHaveTextContent('ONVORX — home')
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- src/admin/pages/SeoPage.test.tsx src/admin/pages/SerpPreview.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write `src/admin/pages/SerpPreview.tsx`**

```tsx
const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export function SerpPreview({
  title,
  description,
  path,
}: {
  title: string
  description: string
  path: string
}) {
  return (
    <div className="admin-serp">
      <div className="admin-serp__url">onvorx.com{path === '/' ? '' : path}</div>
      <div className="admin-serp__title">{title ? truncate(title, 60) : '(no title set)'}</div>
      <div className="admin-serp__desc">
        {description ? truncate(description, 160) : '(no description set)'}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write `src/admin/pages/SeoPage.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import type { L, SeoEntry } from '../types'
import { useSiteContentRaw } from '../../content/SiteContentProvider'
import { LocalizedField } from '../components/LocalizedField'
import { SaveBar } from '../components/SaveBar'
import { SerpPreview } from './SerpPreview'
import { useToast } from '../components/Toast'
import { useAdminTitle } from '../useAdminTitle'

const eqL = (a: L, b: L) => a.en === b.en && a.uk === b.uk

function SeoEntryEditor({ entry }: { entry: SeoEntry }) {
  const { actions } = useSiteContentRaw()
  const toast = useToast()
  const stored = useMemo(
    () => ({ title: { ...entry.title }, description: { ...entry.description } }),
    [entry],
  )
  const [draft, setDraft] = useState(stored)
  const dirty = !eqL(draft.title, stored.title) || !eqL(draft.description, stored.description)
  useEffect(() => {
    if (!dirty) setDraft(stored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored.title.en, stored.title.uk, stored.description.en, stored.description.uk])

  const save = () => {
    actions.updateSeo(entry.pageKey, { title: draft.title, description: draft.description })
    toast('Saved')
  }

  return (
    <fieldset className="admin-fieldset">
      <legend><h2>{entry.label}</h2></legend>
      <LocalizedField
        label="SEO title"
        value={draft.title}
        recommended={60}
        onChange={(v) => setDraft((d) => ({ ...d, title: v }))}
      />
      <LocalizedField
        label="Meta description"
        value={draft.description}
        multiline
        recommended={155}
        onChange={(v) => setDraft((d) => ({ ...d, description: v }))}
      />
      <p className="admin-field__hint">Google preview (English):</p>
      <SerpPreview title={draft.title.en} description={draft.description.en} path={entry.path} />
      <SaveBar dirty={dirty} onSave={save} onDiscard={() => setDraft(stored)} />
    </fieldset>
  )
}

export function SeoPage() {
  useAdminTitle('SEO')
  const { data } = useSiteContentRaw()
  return (
    <section className="admin-page">
      <h1>SEO</h1>
      <p className="admin-page__hint">
        The title and description search engines show for each page. Keep the title under ~60 characters and the description under ~155.
      </p>
      {data.seo.map((e) => (
        <SeoEntryEditor key={e.pageKey} entry={e} />
      ))}
    </section>
  )
}
```

- [ ] **Step 5: Run tests + gates**

Run: `npm test -- src/admin/pages/SeoPage.test.tsx src/admin/pages/SerpPreview.test.tsx && npm test && npm run lint && npm run build`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/admin/pages/SeoPage.tsx src/admin/pages/SerpPreview.tsx src/admin/pages/SeoPage.test.tsx src/admin/pages/SerpPreview.test.tsx
git commit -m "feat: admin SEO screen — per-page title & meta with SERP preview

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: RequestsPage

**Files:**
- Modify: `src/admin/pages/RequestsPage.tsx` (replace placeholder)
- Test: `src/admin/pages/RequestsPage.test.tsx`

**Interfaces:**
- Consumes: `useSiteContentRaw()`, `StatusBadge`, `useConfirm`, `useToast`, `EmptyState`, `useAdminTitle`.
- Produces: `RequestsPage` — `useAdminTitle('Requests')`. A filter row: status `<select>` (All / New / In progress / Done / Archived), language `<select>` (All / EN / UA), and a text `<input>` (matches name/email/message, case-insensitive). A table (`admin-table`): columns Date (localized short), Name, Email, Budget, Status (`<StatusBadge>`). Rows sorted newest first. Row click opens a detail panel (below the table or a side drawer) showing all fields, a Status `<select>` (dispatches `actions.setRequestStatus`), an internal-note `<textarea>` + Save note button (`actions.setRequestNote` + toast), and a Delete button (`useConfirm` → `actions.removeRequest`). Empty filtered result → `EmptyState`.

- [ ] **Step 1: Write the failing test**

`src/admin/pages/RequestsPage.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider, useSiteContentRaw } from '../../content/SiteContentProvider'
import { ToastProvider } from '../components/Toast'
import { RequestsPage } from './RequestsPage'

beforeEach(() => localStorage.clear())

function Probe() {
  const { data } = useSiteContentRaw()
  return <span data-testid="count">{data.requests.length}</span>
}
const wrap = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <ToastProvider>
          <RequestsPage />
          <Probe />
        </ToastProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('RequestsPage', () => {
  it('lists seeded requests and filters by status', async () => {
    const user = userEvent.setup()
    wrap()
    expect(screen.getByText('Olena Kravets')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/status/i), 'archived')
    expect(screen.queryByText('Olena Kravets')).not.toBeInTheDocument()
    expect(screen.getByText('Anna Schmidt')).toBeInTheDocument()
  })

  it('filters by free text (name/email/message)', async () => {
    const user = userEvent.setup()
    wrap()
    await user.type(screen.getByLabelText(/search/i), 'encryptia')
    expect(screen.getByText('Markus Feld')).toBeInTheDocument()
    expect(screen.queryByText('Olena Kravets')).not.toBeInTheDocument()
  })

  it('opens a row, changes status, and it persists', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Olena Kravets'))
    const detail = screen.getByRole('region', { name: /request detail/i })
    await user.selectOptions(within(detail).getByLabelText(/status/i), 'done')
    // reflected back in the table badge
    expect(within(screen.getByRole('table')).getAllByText(/done/i).length).toBeGreaterThan(0)
  })

  it('deletes a request after confirmation', async () => {
    const user = userEvent.setup()
    wrap()
    const before = Number(screen.getByTestId('count').textContent)
    await user.click(screen.getByText('Olena Kravets'))
    const detail = screen.getByRole('region', { name: /request detail/i })
    await user.click(within(detail).getByRole('button', { name: /delete/i }))
    await user.click(screen.getByRole('button', { name: /delete request|confirm/i }))
    expect(Number(screen.getByTestId('count').textContent)).toBe(before - 1)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- src/admin/pages/RequestsPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write `src/admin/pages/RequestsPage.tsx`**

```tsx
import { useMemo, useState } from 'react'
import type { EstimateRequest, RequestStatus } from '../types'
import { useSiteContentRaw } from '../../content/SiteContentProvider'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmDialog'
import { useAdminTitle } from '../useAdminTitle'

const STATUSES: RequestStatus[] = ['new', 'in_progress', 'done', 'archived']
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function Detail({ req }: { req: EstimateRequest }) {
  const { actions } = useSiteContentRaw()
  const { confirm, dialog } = useConfirm()
  const toast = useToast()
  const [note, setNote] = useState(req.note ?? '')

  const del = async () => {
    const ok = await confirm({
      title: 'Delete this request?',
      message: 'It will be permanently removed.',
      confirmLabel: 'Delete request',
      danger: true,
    })
    if (ok) {
      actions.removeRequest(req.id)
      toast('Request deleted')
    }
  }

  return (
    <section className="admin-detail" aria-label="Request detail">
      <h2>{req.name}</h2>
      <dl className="admin-detail__grid">
        <dt>Email</dt><dd><a href={`mailto:${req.email}`}>{req.email}</a></dd>
        <dt>Company</dt><dd>{req.company || '—'}</dd>
        <dt>Budget</dt><dd>{req.budget ?? '—'}</dd>
        <dt>Interested in</dt><dd>{req.interestedIn.join(', ') || '—'}</dd>
        <dt>Language</dt><dd>{req.locale.toUpperCase()}</dd>
        <dt>From page</dt><dd>{req.sourcePage ?? '—'}</dd>
        <dt>Received</dt><dd>{fmtDate(req.createdAt)}</dd>
      </dl>
      <p className="admin-detail__message">{req.message}</p>

      <label className="admin-field">
        <span className="admin-field__label">Status</span>
        <select
          className="admin-input"
          value={req.status}
          onChange={(e) => actions.setRequestStatus(req.id, e.target.value as RequestStatus)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </label>

      <label className="admin-field">
        <span className="admin-field__label">Internal note</span>
        <textarea
          className="admin-textarea"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={() => {
            actions.setRequestNote(req.id, note)
            toast('Note saved')
          }}
        >
          Save note
        </button>
        <button type="button" className="admin-btn admin-btn--danger" onClick={del}>
          Delete
        </button>
      </div>
      {dialog}
    </section>
  )
}

export function RequestsPage() {
  useAdminTitle('Requests')
  const { data } = useSiteContentRaw()
  const [status, setStatus] = useState<'all' | RequestStatus>('all')
  const [lang, setLang] = useState<'all' | 'en' | 'uk'>('all')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return [...data.requests]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .filter((r) => (status === 'all' ? true : r.status === status))
      .filter((r) => (lang === 'all' ? true : r.locale === lang))
      .filter((r) =>
        !needle
          ? true
          : `${r.name} ${r.email} ${r.message}`.toLowerCase().includes(needle),
      )
  }, [data.requests, status, lang, q])

  const open = openId ? data.requests.find((r) => r.id === openId) ?? null : null

  return (
    <section className="admin-page admin-page--wide">
      <h1>Requests</h1>
      <p className="admin-page__hint">Incoming “Request an Estimate” submissions.</p>

      <div className="admin-filters">
        <label>
          Status
          <select className="admin-input" value={status} onChange={(e) => setStatus(e.target.value as never)}>
            <option value="all">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </label>
        <label>
          Language
          <select className="admin-input" value={lang} onChange={(e) => setLang(e.target.value as never)}>
            <option value="all">All</option>
            <option value="en">EN</option>
            <option value="uk">UA</option>
          </select>
        </label>
        <label>
          Search
          <input className="admin-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="name, email, text" />
        </label>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No requests match" hint="Try a different filter." />
      ) : (
        <table className="admin-table">
          <thead>
            <tr><th>Date</th><th>Name</th><th>Email</th><th>Budget</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => setOpenId(r.id)} aria-selected={r.id === openId}>
                <td>{fmtDate(r.createdAt)}</td>
                <td>{r.name}</td>
                <td>{r.email}</td>
                <td>{r.budget ?? '—'}</td>
                <td><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {open && <Detail key={open.id} req={open} />}
    </section>
  )
}
```
Add to `admin.css`:
```css
.admin-filters { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; }
.admin-filters label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.8rem; }
.admin-filters .admin-input { min-width: 160px; }
.admin-detail { margin-top: 1.5rem; padding: 1.25rem; border: 1px solid var(--border, #e8e8ec); border-radius: var(--radius-md, 12px); background: var(--surface, #fff); }
.admin-detail h2 { margin: 0 0 0.75rem; font-size: 1.1rem; }
.admin-detail__grid { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 0.9rem; margin: 0 0 1rem; font-size: 0.85rem; }
.admin-detail__grid dt { color: var(--text-3, #8a8d95); }
.admin-detail__grid dd { margin: 0; }
.admin-detail__message { white-space: pre-wrap; background: var(--surface-2, #fbfbfc); padding: 0.75rem; border-radius: var(--radius-sm, 8px); font-size: 0.88rem; }
```

- [ ] **Step 4: Run test + gates**

Run: `npm test -- src/admin/pages/RequestsPage.test.tsx && npm test && npm run lint && npm run build`
Expected: green. Keep the confirm button-name regex in the test in sync with `confirmLabel`.

- [ ] **Step 5: Commit**

```bash
git add src/admin/pages/RequestsPage.tsx src/admin/pages/RequestsPage.test.tsx src/admin/admin.css
git commit -m "feat: admin Requests screen — filter, triage, annotate estimate submissions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: DashboardPage + SettingsPage

**Files:**
- Modify: `src/admin/pages/DashboardPage.tsx`, `src/admin/pages/SettingsPage.tsx` (replace placeholders)
- Test: `src/admin/pages/DashboardPage.test.tsx`, `src/admin/pages/SettingsPage.test.tsx`

**Interfaces:**
- Produces:
  - `DashboardPage` — `useAdminTitle('Dashboard')`. Stat tiles: `projectsHome.length`, `projectsPage.length`, `servicesHome.length`, `servicesPage.length`, count of `requests` with `status === 'new'`. "Last updated" = `new Date(data.updatedAt).toLocaleString()` (or "—" if epoch). A "Recent requests" list: 5 newest `requests` (name + status badge + date), each a `<Link to="/admin/requests">`. Quick links to Content / Projects / SEO.
  - `SettingsPage` — `useAdminTitle('Settings')`. A "Reset all content" section: explains it discards every edit and estimate submission and restores the original site content; button → `useConfirm({ danger: true })` → `actions.resetAll()` + toast "Content reset to defaults". A "Log out" button (reuses the same handler shape as `AdminLayout` — call `useAuth().logout()` then `navigate('/admin/login')`).

- [ ] **Step 1: Write the failing tests**

`src/admin/pages/DashboardPage.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider } from '../../content/SiteContentProvider'
import { DashboardPage } from './DashboardPage'

beforeEach(() => localStorage.clear())

const wrap = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <MemoryRouter><DashboardPage /></MemoryRouter>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('DashboardPage', () => {
  it('shows counts and the newest requests', () => {
    wrap()
    expect(screen.getByText(/new requests?/i)).toBeInTheDocument()
    // seed has 3 'new' requests
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Tomasz Nowak')).toBeInTheDocument() // one of the 5 newest
  })
})
```

`src/admin/pages/SettingsPage.test.tsx`:
```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider, useSiteContentRaw } from '../../content/SiteContentProvider'
import { ToastProvider } from '../components/Toast'
import { SettingsPage } from './SettingsPage'
import * as authModule from '../auth/useAuth'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.spyOn(authModule, 'useAuth').mockReturnValue({
    status: 'authed', login: vi.fn(), logout: vi.fn(async () => {}), recheck: vi.fn(),
  } as never)
})

function Probe() {
  const { data, actions } = useSiteContentRaw()
  ;(globalThis as never as { __edit: () => void }).__edit = () =>
    actions.updateSection('hero', { title: { en: 'EDITED', uk: 'EDITED' } })
  return <span data-testid="hero">{data.sections.find((s) => s.key === 'hero')!.title.en}</span>
}

const wrap = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <ToastProvider>
          <MemoryRouter><SettingsPage /></MemoryRouter>
          <Probe />
        </ToastProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('SettingsPage', () => {
  it('resets content to defaults after confirmation', async () => {
    const user = userEvent.setup()
    wrap()
    ;(globalThis as never as { __edit: () => void }).__edit()
    expect(screen.getByTestId('hero')).toHaveTextContent('EDITED')
    await user.click(screen.getByRole('button', { name: /reset all content/i }))
    await user.click(screen.getByRole('button', { name: /reset|confirm/i }))
    expect(screen.getByTestId('hero')).not.toHaveTextContent('EDITED')
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- src/admin/pages/DashboardPage.test.tsx src/admin/pages/SettingsPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write `src/admin/pages/DashboardPage.tsx`**

```tsx
import { Link } from 'react-router-dom'
import { useSiteContentRaw } from '../../content/SiteContentProvider'
import { StatusBadge } from '../components/StatusBadge'
import { useAdminTitle } from '../useAdminTitle'

const EPOCH = '1970-01-01T00:00:00.000Z'

export function DashboardPage() {
  useAdminTitle('Dashboard')
  const { data } = useSiteContentRaw()
  const newCount = data.requests.filter((r) => r.status === 'new').length
  const recent = [...data.requests]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 5)

  return (
    <section className="admin-page admin-page--wide">
      <h1>Dashboard</h1>
      <div className="admin-stats">
        <div className="admin-stat"><div className="admin-stat__n">{data.projectsHome.length}</div><div className="admin-stat__label">Projects — home</div></div>
        <div className="admin-stat"><div className="admin-stat__n">{data.projectsPage.length}</div><div className="admin-stat__label">Projects — page</div></div>
        <div className="admin-stat"><div className="admin-stat__n">{data.servicesHome.length}</div><div className="admin-stat__label">Services — home</div></div>
        <div className="admin-stat"><div className="admin-stat__n">{data.servicesPage.length}</div><div className="admin-stat__label">Services — page</div></div>
        <div className="admin-stat"><div className="admin-stat__n">{newCount}</div><div className="admin-stat__label">New requests</div></div>
      </div>

      <p className="admin-field__hint">
        Last change: {data.updatedAt === EPOCH ? '—' : new Date(data.updatedAt).toLocaleString()}
      </p>

      <h2 style={{ fontSize: '1rem' }}>Recent requests</h2>
      {recent.length === 0 ? (
        <p className="admin-field__hint">No requests yet.</p>
      ) : (
        <ul className="admin-recent">
          {recent.map((r) => (
            <li key={r.id}>
              <Link to="/admin/requests">{r.name}</Link>
              {' — '}
              <StatusBadge status={r.status} />
              {' · '}
              {new Date(r.createdAt).toLocaleDateString()}
            </li>
          ))}
        </ul>
      )}

      <p style={{ marginTop: '1.5rem' }}>
        <Link to="/admin/content">Edit texts</Link> · <Link to="/admin/projects">Projects</Link> ·{' '}
        <Link to="/admin/seo">SEO</Link>
      </p>
    </section>
  )
}
```
Add to `admin.css`:
```css
.admin-recent { list-style: none; padding: 0; margin: 0.5rem 0 0; display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.88rem; }
```

- [ ] **Step 4: Write `src/admin/pages/SettingsPage.tsx`**

```tsx
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSiteContentRaw } from '../../content/SiteContentProvider'
import { useAuth } from '../auth/useAuth'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmDialog'
import { useAdminTitle } from '../useAdminTitle'

export function SettingsPage() {
  useAdminTitle('Settings')
  const { actions } = useSiteContentRaw()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { confirm, dialog } = useConfirm()

  const reset = useCallback(async () => {
    const ok = await confirm({
      title: 'Reset all content?',
      message:
        'This discards every edit you have made and every estimate submission, and restores the original site content. This cannot be undone.',
      confirmLabel: 'Reset everything',
      danger: true,
    })
    if (!ok) return
    actions.resetAll()
    toast('Content reset to defaults')
  }, [confirm, actions, toast])

  const onLogout = useCallback(async () => {
    await logout()
    navigate('/admin/login', { replace: true })
  }, [logout, navigate])

  return (
    <section className="admin-page">
      <h1>Settings</h1>

      <fieldset className="admin-fieldset">
        <legend><h2>Reset content</h2></legend>
        <p className="admin-field__hint">
          Restores every text, card and SEO field to the original site content and clears the requests list.
        </p>
        <button type="button" className="admin-btn admin-btn--danger" onClick={reset}>
          Reset all content
        </button>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend><h2>Session</h2></legend>
        <button type="button" className="admin-btn" onClick={onLogout}>
          Log out
        </button>
      </fieldset>
      {dialog}
    </section>
  )
}
```

- [ ] **Step 5: Run tests + gates**

Run: `npm test -- src/admin/pages/DashboardPage.test.tsx src/admin/pages/SettingsPage.test.tsx && npm test && npm run lint && npm run build`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/admin/pages/DashboardPage.tsx src/admin/pages/SettingsPage.tsx src/admin/pages/DashboardPage.test.tsx src/admin/pages/SettingsPage.test.tsx src/admin/admin.css
git commit -m "feat: admin Dashboard + Settings screens

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: Docs, e2e smoke, final verification

**Files:**
- Create: `src/admin/README.md`, `playwright.config.ts`, `e2e/admin.spec.ts`
- Modify: `Readme.md`, `package.json` (`"e2e"` script), `.gitignore` (playwright artifacts)
- Test: full suite + build + the e2e smoke

**Interfaces:**
- Consumes: everything.
- Produces: docs; a Playwright smoke covering the money path.

- [ ] **Step 1: Write `src/admin/README.md`**

```markdown
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
```

- [ ] **Step 2: Add the admin section to `Readme.md`**

Replace the "Admin panel (in progress)" section body with a short current description: the panel is at `/admin`, password-gated, edits section texts / project & service cards / per-page SEO and reads estimate requests, all on the localStorage store. Link `src/admin/README.md` and `src/admin/auth/README.md`.

- [ ] **Step 3: Create `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```
> `preview` serves the built SPA. `/api/admin/*` is NOT served by `preview` — the e2e stubs it (Step 4). Add `"e2e": "playwright test"` to `package.json` scripts. Add `test-results/` and `playwright-report/` to `.gitignore`.

- [ ] **Step 4: Write `e2e/admin.spec.ts`**

```ts
import { test, expect } from '@playwright/test'

// Stub the auth endpoints (preview does not run the Vercel functions).
test.beforeEach(async ({ page }) => {
  await page.route('**/api/admin/session', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true }) }),
  )
  await page.route('**/api/admin/logout', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: false }) }),
  )
  await page.addInitScript(() => window.localStorage.clear())
})

test('owner edits a section title and it shows on the home page', async ({ page }) => {
  await page.goto('/admin/content')
  await expect(page.getByRole('heading', { name: 'Content' })).toBeVisible()

  const firstTitle = page.getByLabel('Title').first()
  await firstTitle.fill('E2E hero headline')
  await page.getByRole('button', { name: 'Save' }).first().click()

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'E2E hero headline' })).toBeVisible()
})

test('estimate form submission appears in the admin requests inbox', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /request an estimate/i }).first().click()
  await page.getByLabel('Name').fill('E2E Tester')
  await page.getByLabel('Email').fill('e2e@example.com')
  await page.getByLabel('Message').fill('Please quote a rebuild.')
  await page.getByRole('button', { name: /send request/i }).click()
  await expect(page.getByText(/thank you/i)).toBeVisible()

  await page.goto('/admin/requests')
  await expect(page.getByText('E2E Tester')).toBeVisible()
})
```
> If `@playwright/test` is not resolvable (only `playwright` is a devDep), run `npm install -D @playwright/test@^1` in this step and `npx playwright install chromium`.

- [ ] **Step 5: Run the e2e**

Run: `npx playwright install chromium && npm run e2e`
Expected: 2 passed. If the environment cannot run browsers, note it and mark the e2e as "written, not executed here" — the unit/integration suite already covers the same paths.

- [ ] **Step 6: Full verification**

Run:
```bash
npm test
npm run lint
npm run build
npx tsc -p tsconfig.api.json
```
Expected: all green. Confirm `npm run build` output shows a separate `admin-*.js` chunk (lazy split working) and the public entry chunk did not grow materially.

- [ ] **Step 7: Manual dev smoke**

`npm run dev`, then in the browser:
- `/admin` → redirected to `/admin/login`.
- Enter the password from `.env.local` → lands on the dashboard.
- Content → edit the Hero title → Save → toast → open `/` in a new tab → title changed.
- Projects → add a card → fill it → publish → it appears on `/`.
- SEO → edit Home title → `/` tab title updates.
- Submit the public estimate form → Requests shows it.
- Settings → Reset all content → confirm → site back to original.
- Log out → `/admin` redirects to login.

- [ ] **Step 8: Commit**

```bash
git add src/admin/README.md Readme.md playwright.config.ts e2e .gitignore package.json package-lock.json
git commit -m "docs: admin panel README + Playwright smoke for the edit→live path

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage (§3 structure, §5 fields, §7 screens):**

| Spec item | Task |
|---|---|
| `/admin` routing: login / dashboard / content / projects / services / seo / requests / settings | 1 |
| Sidebar layout, English UI, forced light theme, no public header/footer | 1 |
| Auth composed in (`AuthProvider` + `RequireAuth` + `LoginPage`) | 1 (uses Plan 2) |
| Lazy-loaded `/admin/*` | 1 |
| Toast on save, ConfirmDialog on delete/reset, EmptyState | 2 |
| LocalizedField EN/UA, explicit Save, no autosave, dirty affordance | 3 |
| Content screen — 6 blocks, eyebrow/title/body + Hero/CTA button label; not the sub-items | 4 |
| ImageUpload (File → data URL, size/type errors), reorderable CardList | 5 |
| Projects screen — Home/Page tabs, title/tags/description/image/alt/published, reorder, add, delete | 6 |
| Services screen — Home/Page tabs, icon/title/text, featured (home only), published | 7 |
| SEO screen — 8 pages, title (≤60) + meta (≤155) counters, SERP preview | 8 |
| Requests screen — table, status/language/text filters, detail, status + note + delete | 9 |
| Dashboard — counts, new-requests, recent list, quick links | 10 |
| Settings — reset-to-defaults (confirm), logout | 10 |
| Approach B — every screen writes via `actions.*`, reflected live | 4–10 |
| Docs + e2e smoke of edit→live and form→inbox | 11 |
| Public `/projects` & `/services` pages NOT built | respected — only the store lists are managed |

**2. Placeholder scan:** No TBD/TODO. The `LocalizedField.test.tsx` `Harness` stub in Task 3 Step 1 is deliberately replaced by the inline `rerender` pattern shown right after it in the same test — the implementer writes the test as the second block shows. Every screen's full component code is present (no "similar to Task N").

**3. Type consistency:** `CardListKey` used identically in Tasks 6/7 (`'projectsHome'|'projectsPage'|'servicesHome'|'servicesPage'`). `L`, `SectionKey`, `SeoEntry`, `EstimateRequest`, `RequestStatus`, `ImageRef` all from `src/admin/types.ts` (Plan 1). `actions.*` names match the store API reference exactly (`updateSection`, `updateCard`, `setCardImage`, `updateSeo`, `setRequestStatus`, `setRequestNote`, `removeRequest`, `resetAll`, `addCard`, `moveCard`, `removeCard`). `useConfirm()` returns `{ confirm, dialog }` in Task 2 and is consumed that way in Tasks 6/7/9/10. `useToast()` returns the push function directly (Task 2), called as `toast('…')` everywhere. `SaveBar` props (`dirty`/`onSave`/`onDiscard`/`saving?`) consistent across Tasks 3/4/6/7/8. `useAuth()` shape (`status`/`login`/`logout`/`recheck`) matches Plan 2.

**Deferred / carried:** the spec's "drag-to-reorder" is implemented as accessible ▲▼ buttons (drag is a progressive enhancement, not shipped). The "autosave vs explicit Save" question is settled as explicit Save (spec §7 says "explicit Save button … No hidden autosave"). Recorded so the SDD controller rules rather than a reviewer flagging drag-drop as missing.
