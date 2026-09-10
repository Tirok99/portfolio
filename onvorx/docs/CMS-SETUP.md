# Content & CMS

Editable site content (section texts, project & service cards, per-page SEO) and
"Request an Estimate" submissions live in **Supabase** and are edited through the
password-gated **`/admin`** panel. The public site reads them at runtime via the
Supabase anon key (RLS: public read on content tables only).

- Schema: `supabase/schema.sql` — run once in the Supabase SQL Editor.
- Seed: `supabase/seed.sql` — generated from `src/content/defaults/*` by
  `npm run seed:gen`; run **once**, right after the schema, on a freshly
  provisioned project. ⚠ It is **destructive**: it `TRUNCATE`s the content
  tables and reloads the bundled defaults, so re-running it after content has
  been edited in `/admin` erases every edit.
- Images: Supabase Storage bucket `public-media` (`projects/`, `services/`).
- Env vars: see `.env.example`.

**Estimate form spam:** the `/api/estimate` function checks a hidden honeypot
field and applies a best-effort per-instance rate limit (5 / 10 min / IP). For
authoritative rate limiting, add a Vercel Firewall rate-limit rule on
`/api/estimate` in the Vercel dashboard.

Design docs: `docs/superpowers/specs/2026-09-09-supabase-integration-design.md`.

There is **no** build-time content step — the old `scripts/build-content.mjs`
pipeline was removed on the Supabase migration.
