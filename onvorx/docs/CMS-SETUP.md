# CMS setup — Supabase + Vercel (Rendering "Variant A")

Content is edited in **Supabase Table Editor**. On publish, a webhook triggers a
**Vercel rebuild**; the build pulls the content, bakes it into static HTML/JS and
deploys. Typical propagation: ~40–60 s.

Editable in the CMS: **projects, services, hero & CTA copy, section headings
(eyebrow / title / description), contacts (email, Telegram), footer tagline &
copyright.** Everything else (nav labels, hero cards, "how we work" steps, "about"
stats, footer link lists, 404 text) stays in `src/i18n/*.json`.

---

## 1. Create the database

Supabase → **SQL Editor** → run, in order:

1. `supabase/schema.sql` — tables (`site_content`, `services`, `projects`) + RLS (public read).
2. `supabase/seed.sql` — fills them with the current English content.

UA (`*_uk`) fields are left empty; the build falls back to EN for any missing UA
value, so the UA site works before it's translated.

## 2. Wire env vars in Vercel

Vercel → Project → **Settings → Environment Variables** (Production + Preview):

| Name | Value |
|---|---|
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API → **anon public** key |

The anon key is read-only here (RLS allows `select` only). No secret is exposed to
the browser — it's used only by the build step.

## 3. Rebuild on publish

- Vercel → Settings → **Git → Deploy Hooks** → create one (e.g. `content`), copy the URL.
- Supabase → **Database → Webhooks** → new webhook:
  - Tables: `site_content`, `services`, `projects`
  - Events: `INSERT`, `UPDATE`, `DELETE`
  - Type: **HTTP Request** → `POST` → paste the Deploy Hook URL.

Now every save in the Table Editor redeploys the site.

## 4. Project images

`projects.image_url` accepts either:

- a **Supabase Storage** public URL (create a public bucket `project-images`,
  upload, copy the public URL) — lets editors swap images without a code change; or
- a repo path like `/assets/projects/<slug>.png` (default in the seed).

## 5. Local development

- `npm run dev` — always uses the committed base content (`src/i18n/*.json`). No Supabase needed.
- `npm run content:pull` — with `SUPABASE_*` in a local `.env`, pulls live content into `src/i18n/*.json` for a realistic preview.
- `npm run content:restore` — reverts those files to the committed base.

`npm run build` runs `content:pull` before and `content:restore` after, so a local
production build never leaves CMS-merged JSON in your working tree. On Vercel the
merged content is already compiled into `dist/`.

## Adding a new service / project

Insert a row in the `services` / `projects` table:

- `slug` — url-safe id (e.g. `seo-audit`). For services it also maps to the icon/preview asset.
- `sort` — display order.
- `published` — uncheck to hide without deleting.
- For a **new service** without a matching icon asset, set `icon_url` / `preview_url`
  to a Storage URL, or add `public/assets/services/icon-<slug>.png` +
  `preview-<slug>.png` and extend `ASSETS` in `src/sections/Services/Services.tsx`.
