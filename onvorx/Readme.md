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
npm run build      # tsc -b -> tsc api -> vite build
npm run preview    # serve the production build
npm run seed:gen   # regenerate supabase/seed.sql from src/content/defaults
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
scripts/        gen-seed.ts (regenerates supabase/seed.sql)
supabase/       schema.sql + seed.sql
docs/CMS-SETUP.md
```

## Content / CMS

Editable site content (section texts, project & service cards, per-page SEO) and
"Request an Estimate" submissions live in **Supabase**, edited through the
password-gated **`/admin`** panel. Schema: `supabase/schema.sql`; seed:
`supabase/seed.sql`, generated from `src/content/defaults/*` by `npm run seed:gen`.
There is **no** build-time content step. Setup: `docs/CMS-SETUP.md`.

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
