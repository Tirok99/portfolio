# ONVORX — Admin panel (`/admin`) — design

**Date:** 2026-09-08
**Status:** Approved direction, spec under review
**Phase:** Interface + logic on mock data. No database, no Supabase/Firebase, no
external services. Auth is a self-contained password check (Vercel function).

---

## 1. Goal

Give a **non-technical site owner** a simple English-language admin panel at
`/admin` to manage a *fixed, curated* set of site content — not a universal CMS.

Through `/admin` the owner can manage:

1. Project cards in the **Projects block on Home**, with image upload.
2. Project cards on the **Projects page** (separate list; public page not built yet).
3. Service cards in the **Services block on Home** — icon, title, text.
4. Service cards on the **Services page** (separate list; public page not built yet).
5. **Block texts** across all Home sections — eyebrow, title, body, and the CTA
   button label where the block has one (Hero, CTA).
6. **SEO Title + Meta Description** for 8 pages: Home, Services, Projects, About,
   and the 4 service pages (`/web-development`, `/support`, `/business-analysis`,
   `/google-ads`).
7. **Incoming "Request an Estimate" submissions** — read, triage, annotate.

### Non-goals

- No editing of sub-item text: Hero's 4 cards, "How we work" steps, About stats,
  nav labels, footer link lists, 404 copy. Only the section header texts.
- No real backend, database, file storage, or CMS pipeline.
- No build of the public `/projects` and `/services` pages (data is kept ready
  for a later phase).
- No real email/delivery for estimate submissions.

---

## 2. Approach — "B": admin edits are reflected on the live site

Admin and the public site share **one content store**, seeded from the current
site content and persisted to `localStorage` (no server, no DB). When the owner
edits a field in `/admin`, the public site renders the new value. "Publish" is
implicit — there is one state.

Consequences:

- A shared `SiteContentProvider` sits at the app root (wraps both public site and
  admin).
- The managed public sections read their managed fields from `useSiteContent()`
  instead of raw `useI18n()`. Unmanaged strings (nav, hero cards, how-we-work
  steps, footer, 404) keep using `useI18n()`.
- SEO becomes real via a `<DocumentHead>` mounted in the layout, driven by a
  route→page map and the store's `seo` entries.
- A public `<EstimateForm>` writes submissions into the same store.

Known limitation (acceptable for this phase): the store is per-browser
`localStorage`. Edits and estimate submissions live in the browser that made
them; they do not sync between visitors or devices. Wiring this to a real backend
is an explicit next phase, and the data shapes are designed to make that a
drop-in change.

---

## 3. Architecture

### 3.1 Providers (app root, `src/main.tsx` → `App`)

```
<I18nProvider>               // language state (unchanged) + unmanaged strings — outermost
  <SiteContentProvider>      // shared content store + actions + localStorage
    <BrowserRouter>
      <Routes>
        <Route element={<Layout/>}>        // public site
          <Route index element={<HomePage/>}/>
          ...stubs, 404
        </Route>
        <Route path="/admin/*" element={<AdminApp/>}/>   // lazy-loaded
      </Routes>
    </BrowserRouter>
  </SiteContentProvider>
</I18nProvider>
```

`I18nProvider` is outermost so `SiteContentProvider` / `useSiteContent()` can
read the active language from `useI18n()`.

- `AdminApp` is `React.lazy` — the admin bundle is not in the public critical path.
- `/admin/*` renders **outside** the public `Layout` (no site header/footer).

### 3.2 `SiteContentProvider` — `src/content/SiteContentProvider.tsx`

Responsibilities:

- On mount: read `localStorage["onvorx.admin.v1"]`. If absent or `version`
  mismatch, seed from `src/content/defaults/` (which mirrors the current site
  content) and write it back.
- Hold `AdminData` in React state.
- Persist to `localStorage` on every change (debounced ~300ms).
- Listen to `window` `storage` events so an edit in the `/admin` tab updates an
  open public-site tab live.
- Expose:
  - `data: AdminData` — raw, for admin editing screens.
  - `useSiteContent()` — convenience hook returning helpers resolved for the
    active language (via `useI18n().lang`), e.g.
    `section("hero")`, `projectsHome()`, `servicesHome()`, `seoFor(pageKey)`.
  - Actions (see §6).
  - `resetAll()` — clear override, re-seed from defaults.

### 3.3 Admin shell — `src/admin/`

- `AdminApp.tsx` — nested `<Routes>` for `/admin/*`, wraps everything in
  `RequireAuth` except `/admin/login`.
- `AdminLayout.tsx` — left sidebar nav + content area + global `<Toast>` region.
- Routes:

| Path | Screen |
|---|---|
| `/admin/login` | `LoginPage` |
| `/admin` | `DashboardPage` |
| `/admin/content` | `ContentPage` — block texts |
| `/admin/projects` | `ProjectsPage` — tabs: Home / Projects page |
| `/admin/services` | `ServicesPage` — tabs: Home / Services page |
| `/admin/seo` | `SeoPage` |
| `/admin/requests` | `RequestsPage` |
| `/admin/settings` | `SettingsPage` — reset data, logout |

### 3.4 SPA routing / hosting

- `vercel.json` catch-all rewrite already serves `/admin/*` as the SPA. `/api/*`
  is handled by Vercel functions automatically. No `vercel.json` change expected.
- `vite.config.ts` gets a small **dev-only middleware plugin** that mounts the
  `api/admin/*` handlers so `npm run dev` works without `vercel dev`.

---

## 4. Auth

Password gate, self-contained. Env vars already in `.env.local` (gitignored):
`ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`.

- `POST /api/admin/login` — body `{ password }`. Compares to `ADMIN_PASSWORD`
  using a constant-time compare. On success sets cookie
  `admin_session=<base64url(payload)>.<hmacSHA256(payload, ADMIN_SESSION_SECRET)>`,
  `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800` (8h). Payload =
  `{ iat, exp }`.
- `GET /api/admin/session` — validates the cookie (signature + `exp`). Returns
  `{ authenticated: boolean }`.
- `POST /api/admin/logout` — clears the cookie.
- Zero dependencies — Node's `crypto` only. Functions typed with `@vercel/node`.
- Client: `useAuth()` calls `/api/admin/session` on load; `RequireAuth`
  redirects to `/admin/login` when not authenticated; `LoginPage` posts the
  password and, on success, navigates to `/admin`.
- Rate-limit: in-memory per-IP counter in the login function (best-effort;
  resets on cold start — acceptable for this phase).

Not in scope: multi-user, password reset, 2FA, audit log.

---

## 5. Data model — `src/admin/types.ts`

```ts
export type Locale = 'en' | 'uk';
export type L = Record<Locale, string>;              // { en: '...', uk: '...' }

export interface ImageRef {
  kind: 'asset' | 'upload';
  src: string;                 // asset path ('/assets/...') or data URL
  fileName?: string;           // original filename for uploads
}

export type SectionKey =
  | 'hero' | 'services' | 'projects' | 'howWork' | 'about' | 'cta';

export interface SectionText {
  key: SectionKey;
  label: string;               // English UI label, e.g. "Hero (top of page)"
  eyebrow: L;
  title: L;
  body: L;                     // maps to description / lede
  ctaLabel?: L;                // Hero + CTA only (button text)
}

export interface ProjectCard {
  id: string;
  order: number;
  published: boolean;
  title: L;
  tags: string[];              // language-independent (e.g. "WordPress")
  description: L;
  image: ImageRef;
  imageAlt: L;
}

export interface ServiceCard {
  id: string;
  order: number;
  published: boolean;
  featured: boolean;           // 'featured' card style — Home list only
  title: L;
  text: L;
  icon: ImageRef;
}

export type SeoPageKey =
  | 'home' | 'services' | 'projects' | 'about'
  | 'web-development' | 'support' | 'business-analysis' | 'google-ads';

export interface SeoEntry {
  pageKey: SeoPageKey;
  label: string;               // "Home", "Service — Web Development"
  path: string;                // '/', '/services', '/web-development', ...
  title: L;                    // recommended <= 60 chars (soft)
  description: L;               // recommended <= 160 chars (soft)
}

export type RequestStatus = 'new' | 'in_progress' | 'done' | 'archived';

export interface EstimateRequest {
  id: string;
  createdAt: string;           // ISO
  status: RequestStatus;
  name: string;
  email: string;
  company?: string;
  budget?: '<1k' | '1-3k' | '3-10k' | '10k+' | 'not_sure';
  interestedIn: string[];      // service ids
  message: string;
  locale: Locale;              // site language at submit time
  sourcePage?: string;         // pathname the form was opened from
  note?: string;               // internal manager note
}

export interface AdminData {
  version: number;             // seed/migration marker
  updatedAt: string;
  sections: SectionText[];     // 6 entries
  projectsHome: ProjectCard[];
  projectsPage: ProjectCard[];
  servicesHome: ServiceCard[];
  servicesPage: ServiceCard[];
  seo: SeoEntry[];             // 8 entries
  requests: EstimateRequest[];
}
```

`localStorage` key: `onvorx.admin.v1`.

---

## 6. Store actions

```
// texts
updateSection(key, patch: Partial<SectionText>)

// project / service cards (list = 'projectsHome' | 'projectsPage' | 'servicesHome' | 'servicesPage')
addCard(list)                       -> new blank card, appended, unpublished
updateCard(list, id, patch)
removeCard(list, id)                -> confirm in UI
reorderCard(list, id, dir: 'up'|'down')   // or setOrder(list, orderedIds[])
setCardImage(list, id, file: File)  -> reads File as data URL, sets ImageRef{kind:'upload'}

// seo
updateSeo(pageKey, patch: Partial<SeoEntry>)

// requests
addRequest(payload)                 // used by the public form
setRequestStatus(id, status)
setRequestNote(id, note)
removeRequest(id)

// global
resetAll()
```

All actions immutably update `AdminData`, bump `updatedAt`, and trigger persist.

---

## 7. Admin screens

Shared components (`src/admin/components/`): `LocalizedField` (label + EN/UA
tab + `<input>`/`<textarea>`), `TextField`, `ImageUpload` (drag/drop + preview +
"remove" → revert to default asset), `Toggle`, `CharCounter`, `SerpPreview`,
`CardList` (reorderable rows with published dot + drag handle),
`CardEditor` (right-hand form), `Toast`, `ConfirmDialog`, `EmptyState`.

Every editing screen: explicit **Save** button, dirty-state guard on navigate
away, success toast. No hidden autosave (predictable for a non-technical user).

### 7.1 Dashboard — `/admin`

Read-only overview: counts (projects Home/Page, services Home/Page), number of
`new` estimate requests, last-updated time, 5 most recent requests, quick links.

### 7.2 Content (block texts) — `/admin/content`

One accordion/section per `SectionText` (6). Fields: Eyebrow, Title, Body — each
EN/UA. Hero and CTA additionally: Button label (EN/UA).

| Store entry | Public source it replaces | Component |
|---|---|---|
| `sections[hero]` | `hero.eyebrow / title / description / cta` | `src/sections/Hero/Hero.tsx` |
| `sections[services]` | `services.eyebrow / title / description` | `src/sections/Services/Services.tsx` |
| `sections[projects]` | `projects.eyebrow / title / lede` | `src/sections/Projects/Projects.tsx` |
| `sections[howWork]` | `howWork.eyebrow / title / description` | `src/sections/HowWork/HowWork.tsx` |
| `sections[about]` | `about.eyebrow / title / description` | `src/sections/About/About.tsx` |
| `sections[cta]` | `cta.eyebrow / title / description / button` | `src/sections/Cta/Cta.tsx` |

### 7.3 Projects — `/admin/projects`

Tabs: **Home block** (`projectsHome`) / **Projects page** (`projectsPage`).
Each tab: `CardList` + `CardEditor`.

Fields: Title (EN/UA), Tags (chip input), Description (EN/UA), Image (upload),
Image alt (EN/UA), Published toggle, order (drag / up-down). The "01/02…" index
label shown on the site is derived from order — not an editable field.

- Home block links to `projectsHome`, consumed by `Projects.tsx` (`projects.items`).
- Projects page list has no public consumer yet.

### 7.4 Services — `/admin/services`

Tabs: **Home block** (`servicesHome`) / **Services page** (`servicesPage`).

Fields: Icon (upload), Title (EN/UA), Text (EN/UA), Published, order.
Home tab also: **Featured** toggle (the enlarged card style).

- Home block links to `servicesHome`, consumed by `Services.tsx`
  (`services.items` + the `ASSETS` icon map — icon now comes from the store).
- The secondary card `preview` image is not managed (not in scope) — it keeps
  resolving from the slug→asset map, with a neutral fallback for new cards.
- Services page list has no public consumer yet.

### 7.5 SEO — `/admin/seo`

List of 8 `SeoEntry`. Per entry: SEO Title (EN/UA, char counter, soft limit 60),
Meta Description (EN/UA, char counter, soft limit 160), and a **Google snippet
preview** (`SerpPreview`) rendering the title/description/URL as a SERP result
for the active language.

Consumed by `<DocumentHead>` (see §8.3).

### 7.6 Requests — `/admin/requests`

Table + detail drawer. Columns: date, name, email, budget, status. Filters:
status, language, free-text search. Detail: all fields + status selector +
internal note textarea + Archive + Delete (confirm). No create/edit of the
core fields (they come from the public form).

Seeded with 6–8 realistic sample submissions in `src/admin/mock/requests.ts`.

---

## 8. Public site changes (Approach B)

### 8.1 Managed sections read from the store

Refactor these to read managed fields from `useSiteContent()` while keeping
`useI18n()` for unmanaged strings:

- `src/sections/Hero/Hero.tsx` — eyebrow, title, description, CTA label.
  (Hero's 4 feature cards + "Launch" stay on `useI18n`.)
- `src/sections/Services/Services.tsx` — header eyebrow/title/description +
  `servicesHome` cards (icon/title/text/featured/published/order).
- `src/sections/Projects/Projects.tsx` — header eyebrow/title/lede +
  `projectsHome` cards.
- `src/sections/HowWork/HowWork.tsx` — header eyebrow/title/description only.
- `src/sections/About/About.tsx` — header eyebrow/title/description only.
- `src/sections/Cta/Cta.tsx` — eyebrow, title, description, button label.

`published: false` cards are filtered out; cards are sorted by `order`.

### 8.2 Estimate form

- `src/components/EstimateForm/EstimateForm.tsx` — accessible modal dialog
  (focus trap, `Esc`, scrim). Fields: Name*, Email*, Company, Budget (select),
  Interested in (checkbox list from `servicesHome`), Message*. Client-side
  validation. On submit → `addRequest({... , locale, sourcePage})` → success
  state → auto-close.
- `src/components/EstimateForm/useEstimateForm.ts` (or context) — open/close
  state shared across triggers.
- Triggers wired to open the modal (replace `href="#"`):
  - `src/components/SiteHeader/SiteHeader.tsx` — bar CTA + drawer CTA
  - `src/sections/Hero/Hero.tsx` — `hero__cta`
  - `src/sections/Cta/Cta.tsx` — `cta__button`
- Rendered once in `src/components/Layout/Layout.tsx`.

### 8.3 SEO — `<DocumentHead>`

- `src/components/DocumentHead/DocumentHead.tsx` — given a `SeoPageKey`, sets
  `document.title` and `<meta name="description">` (creating the tag if missing)
  from `seoFor(pageKey)` in the active language; also updates `og:title` /
  `og:description`.
- A `ROUTE_SEO: Record<string, SeoPageKey>` map + a small resolver in `Layout`
  picks the page key from `useLocation().pathname` (covers Home, stubs, service
  pages). Unknown routes (404) fall back to the Home entry or a static default.
- `index.html` keeps sensible static defaults for first paint / no-JS crawlers;
  `<DocumentHead>` overrides at runtime. Note in the spec: full SSR/prerender
  SEO is out of scope for this phase.

### 8.4 Pre-existing gaps (not fixed here, noted)

- `/google-ads` and `/projects` have no routes today (Services/Projects link to
  them). SEO entries are still authored for them; routing is out of scope.

---

## 9. Mock / default data — `src/content/defaults/`

Mirrors the **current** site content so nothing changes visually until the owner
edits.

```
src/content/defaults/
  sections.ts     // 6 SectionText, filled from en.json + uk.json (uk partly empty — kept empty)
  projects.ts     // projectsHome = current projects.items (2); projectsPage = same 2 as a starting set
  services.ts     // servicesHome = current services.items (4) with icon paths from ASSETS;
                  // servicesPage = same 4 as a starting set
  seo.ts          // 8 SeoEntry — home/services/projects/about from i18n `meta`; others authored
  index.ts        // buildDefaults(): AdminData  (version: 1)

src/admin/mock/
  requests.ts     // 6–8 EstimateRequest samples
```

Images: defaults use `ImageRef{ kind:'asset', src:'/assets/...' }`. Uploads
become `ImageRef{ kind:'upload', src:<dataURL> }`. Upload size cap ~1.5 MB
(localStorage budget); the UI warns and downscales large images via a canvas
before storing.

---

## 10. Files

### Create

```
api/admin/login.ts
api/admin/session.ts
api/admin/logout.ts
api/_lib/session.ts                         // HMAC sign/verify helpers (shared)

src/content/SiteContentProvider.tsx
src/content/useSiteContent.ts
src/content/persistence.ts                   // localStorage read/write/migrate, storage-event sync
src/content/defaults/sections.ts
src/content/defaults/projects.ts
src/content/defaults/services.ts
src/content/defaults/seo.ts
src/content/defaults/index.ts

src/admin/AdminApp.tsx
src/admin/AdminLayout.tsx
src/admin/admin.css
src/admin/types.ts
src/admin/actions.ts                         // pure reducers over AdminData
src/admin/mock/requests.ts

src/admin/auth/LoginPage.tsx
src/admin/auth/useAuth.ts
src/admin/auth/RequireAuth.tsx

src/admin/pages/DashboardPage.tsx
src/admin/pages/ContentPage.tsx
src/admin/pages/ProjectsPage.tsx
src/admin/pages/ServicesPage.tsx
src/admin/pages/SeoPage.tsx
src/admin/pages/RequestsPage.tsx
src/admin/pages/SettingsPage.tsx

src/admin/components/LocalizedField.tsx
src/admin/components/TextField.tsx
src/admin/components/ImageUpload.tsx
src/admin/components/CardList.tsx
src/admin/components/CardEditor.tsx
src/admin/components/Toggle.tsx
src/admin/components/CharCounter.tsx
src/admin/components/SerpPreview.tsx
src/admin/components/StatusBadge.tsx
src/admin/components/Toast.tsx
src/admin/components/ConfirmDialog.tsx
src/admin/components/EmptyState.tsx

src/components/EstimateForm/EstimateForm.tsx
src/components/EstimateForm/EstimateForm.css
src/components/EstimateForm/useEstimateForm.ts
src/components/DocumentHead/DocumentHead.tsx
src/data/routeSeo.ts

src/admin/README.md
```

### Modify

```
src/App.tsx                  // add <SiteContentProvider> under <I18nProvider>; lazy /admin/* route outside <Layout>
src/components/Layout/Layout.tsx        // mount <DocumentHead> + <EstimateForm>
src/components/SiteHeader/SiteHeader.tsx // CTA buttons open EstimateForm
src/sections/Hero/Hero.tsx
src/sections/Services/Services.tsx
src/sections/Projects/Projects.tsx
src/sections/HowWork/HowWork.tsx
src/sections/About/About.tsx
src/sections/Cta/Cta.tsx
vite.config.ts               // dev middleware for api/admin/*
package.json                 // devDeps: @vercel/node, vitest, @testing-library/react, jsdom; "test" script
.env.example                 // document ADMIN_PASSWORD, ADMIN_SESSION_SECRET (names only)
Readme.md                    // "Admin panel" section
```

### Not touched

`src/i18n/*.json` (still the source for unmanaged strings and the default seed),
`supabase/*`, `scripts/*`, `public/*`.

---

## 11. Testing

Add **vitest** + **@testing-library/react** + jsdom.

- **Unit** — `src/admin/actions.ts`: every reducer (add/update/remove/reorder,
  image set, seo update, request status/note, resetAll) — immutability + result.
- **Unit** — `src/content/persistence.ts`: seed-on-empty, version migration,
  corrupt-JSON fallback, storage-event merge.
- **Component** — `LocalizedField` (EN/UA switching), `ImageUpload` (File →
  data URL + downscale + remove), `SerpPreview` truncation, `EstimateForm`
  validation + submit calls `addRequest`, `RequireAuth` redirect.
- **Integration** — edit a section text / toggle a card `published` in an admin
  screen and assert the corresponding public section re-renders (shared provider
  in the test tree).
- **Auth** — `api/_lib/session.ts` sign/verify: valid, tampered, expired.
- **E2E (Playwright, 1 smoke)** — login → edit Hero title → see it on Home →
  submit estimate form → see it in `/admin/requests`.

`npm run lint` (oxlint) must stay clean; `npm run build` (`tsc -b && vite build`)
must pass.

---

## 12. Future phases (out of scope now)

1. Replace `localStorage` persistence with a real backend (the `persistence.ts`
   seam + `AdminData` shape are the drop-in point).
2. Build public `/projects` and `/services` pages that consume `projectsPage` /
   `servicesPage`.
3. Real estimate delivery (email / webhook / CRM).
4. Prerender/SSR for crawler-visible SEO.
5. Add `/google-ads` and `/projects` routes.
6. Real image hosting for uploads.
