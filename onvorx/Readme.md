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

## Deployment

Vercel (framework preset **Vite**). `vercel.json` adds the SPA rewrite so deep
links resolve. Env vars are set in the Vercel dashboard, never in the repo.
