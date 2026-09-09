# ONVORX — marketing site

Multi-section marketing site for ONVORX (web development & business analysis),
built from the Figma design `onvorx_v0.5`.

## Stack

- **Vite + React 19 + TypeScript**
- **React Router 7** — home page now; stub routes for `services`, `about`,
  `web-development`, `support`, `business-analysis`, plus a 404
- Plain CSS with design tokens + BEM class names (matching the Figma layer names)
- Inter, self-hosted via `@fontsource` (Latin + Cyrillic)
- Lightweight i18n (`src/i18n/`) — EN complete, UA scaffolded

## Scripts

```bash
npm install
npm run dev        # local dev server
npm run build      # prebuild (content) -> tsc -> vite build -> postbuild (restore)
npm run preview    # serve the production build
npm run content:pull      # pull CMS content from Supabase into src/i18n/*.json
npm run content:restore   # revert those files to the committed base
```

A production install that omits devDependencies (`npm ci --omit=dev`) will fail
the build: `tsc -b` typechecks `playwright.config.ts`, which needs
`@playwright/test` present — use a full install. Vercel installs devDependencies
by default, so real deploys are unaffected.

## Structure

```
src/
  styles/       tokens, themes (dark/light), reset, base
  i18n/         i18n provider + en.json / uk.json (content source of truth)
  components/   Layout, SiteHeader, SiteFooter, LangSwitch, Logo, Icon, Reveal
  sections/     Hero, Services, Projects, HowWork, About, Cta
  pages/        HomePage, StubPage, NotFoundPage
  data/         nav
public/assets/  images (radar, hub, previews, laptops, decor waves)
scripts/        build-content / restore-content (Supabase -> static JSON)
supabase/       schema.sql + seed.sql
docs/CMS-SETUP.md
```

## Content / CMS

Content (projects, services, hero & CTA copy, section headings, contacts) is
editable in **Supabase Table Editor**; a Supabase webhook triggers a Vercel
rebuild that bakes the content into the static output. Setup: `docs/CMS-SETUP.md`.

Without `SUPABASE_URL` / `SUPABASE_ANON_KEY` the site builds from the committed
base content in `src/i18n/*.json`.

## Admin panel

An owner-facing panel at `/admin`, gated by a single shared password
(`ADMIN_PASSWORD`) — verified by a Vercel function with a signed session cookie;
`npm run dev` serves the same `/api/admin/*` routes via a Vite plugin. See
`src/admin/auth/README.md`.

Once in, the panel edits the site's curated content: the six section header
blocks (eyebrow / title / body), the Project and Service cards for both Home and
their listing pages, and the per-page SEO title & meta description — and it reads
the estimate requests submitted through the public form. Every screen writes
through the shared content store (`src/content/`), which persists to
`localStorage` only, so edits show on the public site immediately; a real backend
later replaces `src/content/persistence.ts` (see `src/content/README.md`). Full
tour: `src/admin/README.md`.

## Deployment

Vercel (framework preset **Vite**). `vercel.json` adds the SPA rewrite so deep
links resolve. Env vars are set in the Vercel dashboard, never in the repo.
