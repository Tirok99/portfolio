/**
 * Content build step (Rendering "Variant A").
 *
 * Reads the committed base dictionaries, pulls the CMS-managed fields from
 * Supabase (when env vars are present), deep-merges them and writes the
 * result back to src/i18n/{en,uk}.json — which the app imports as-is.
 *
 * No Supabase env  -> base content is written unchanged (site still builds).
 * Fetch failure     -> logged, base content is used (build never breaks).
 *
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY   (public read via RLS)
 * Run: automatically via `prebuild`; manually via `npm run content:pull`.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const i18nDir = join(root, "src", "i18n");
const baseDir = join(i18nDir, ".base");
const LANGS = ["en", "uk"];

const log = (m) => console.log(`[content] ${m}`);

/* ---- 1. pristine base ---------------------------------------------------- */
if (!existsSync(baseDir)) mkdirSync(baseDir, { recursive: true });
for (const lang of LANGS) {
  const base = join(baseDir, `${lang}.json`);
  if (!existsSync(base)) copyFileSync(join(i18nDir, `${lang}.json`), base);
}
const readBase = (lang) => JSON.parse(readFileSync(join(baseDir, `${lang}.json`), "utf8"));

/* ---- 2. helpers -------------------------------------------------------- */
const clean = (v) => (typeof v === "string" ? v.trim() : v);
const has = (v) => v !== null && v !== undefined && !(typeof v === "string" && v.trim() === "");
const set = (obj, path, value) => {
  if (!has(value)) return;
  const keys = path.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]] ??= {};
  cur[keys.at(-1)] = clean(value);
};

async function supabase(table) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  const res = await fetch(`${url}/rest/v1/${table}?select=*`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

/* ---- 3. mapping CMS row -> dictionary --------------------------------- */
function applySiteContent(dict, row, lang) {
  const L = (field) => row[`${field}_${lang}`];
  set(dict, "hero.eyebrow", L("hero_eyebrow"));
  set(dict, "hero.title", L("hero_title"));
  set(dict, "hero.description", L("hero_description"));
  set(dict, "hero.cta", L("hero_cta"));

  set(dict, "services.eyebrow", L("services_eyebrow"));
  set(dict, "services.title", L("services_title"));
  set(dict, "services.description", L("services_description"));

  set(dict, "projects.eyebrow", L("projects_eyebrow"));
  set(dict, "projects.title", L("projects_title"));
  set(dict, "projects.lede", L("projects_lede"));

  set(dict, "howWork.eyebrow", L("howwork_eyebrow"));
  set(dict, "howWork.title", L("howwork_title"));
  set(dict, "howWork.description", L("howwork_description"));

  set(dict, "about.eyebrow", L("about_eyebrow"));
  set(dict, "about.title", L("about_title"));
  set(dict, "about.description", L("about_description"));

  set(dict, "cta.eyebrow", L("cta_eyebrow"));
  set(dict, "cta.title", L("cta_title"));
  set(dict, "cta.description", L("cta_description"));
  set(dict, "cta.button", L("cta_button"));

  set(dict, "footer.tagline", L("footer_tagline"));
  set(dict, "footer.email", row.contact_email);
  set(dict, "footer.telegram", row.contact_telegram);
  set(dict, "footer.telegramHref", row.contact_telegram_href);
  set(dict, "footer.copyright", row.footer_copyright);
}

function applyServices(dict, rows, lang) {
  const items = rows
    .filter((r) => r.published !== false)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((r) => {
      const it = {
        id: r.slug,
        title: clean(r[`title_${lang}`]) || clean(r.title_en) || r.slug,
        text: clean(r[`text_${lang}`]) || clean(r.text_en) || "",
      };
      if (r.featured) it.featured = true;
      if (has(r.icon_url)) it.icon = r.icon_url;
      if (has(r.preview_url)) it.preview = r.preview_url;
      return it;
    });
  if (items.length) dict.services.items = items;
}

function applyProjects(dict, rows, lang) {
  const items = rows
    .filter((r) => r.published !== false)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((r) => ({
      id: r.slug,
      index: clean(r.index_label) || "",
      title: clean(r[`title_${lang}`]) || clean(r.title_en) || r.slug,
      tags: Array.isArray(r.tags) ? r.tags : [],
      text: clean(r[`text_${lang}`]) || clean(r.text_en) || "",
      image: has(r.image_url) ? r.image_url : `/assets/projects/${r.slug}.png`,
      imageAlt: clean(r[`image_alt_${lang}`]) || clean(r.image_alt_en) || "",
    }));
  if (items.length) dict.projects.items = items;
}

/* ---- 4. run ---------------------------------------------------------- */
const hasEnv = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY;
let cms = null;

if (hasEnv) {
  try {
    const [site, services, projects] = await Promise.all([
      supabase("site_content"),
      supabase("services"),
      supabase("projects"),
    ]);
    cms = { site: site[0] ?? null, services, projects };
    log(`pulled from Supabase — ${services.length} services, ${projects.length} projects`);
  } catch (err) {
    log(`WARN Supabase fetch failed, using base content: ${err.message}`);
  }
} else {
  log("no SUPABASE_URL / SUPABASE_ANON_KEY — using base content");
}

for (const lang of LANGS) {
  const dict = readBase(lang);
  if (cms) {
    if (cms.site) applySiteContent(dict, cms.site, lang);
    applyServices(dict, cms.services, lang);
    applyProjects(dict, cms.projects, lang);
  }
  writeFileSync(join(i18nDir, `${lang}.json`), JSON.stringify(dict, null, 2) + "\n");
}
log(`wrote ${LANGS.map((l) => `${l}.json`).join(", ")}`);
