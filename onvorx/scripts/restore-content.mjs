/**
 * Restores src/i18n/{en,uk}.json from the pristine base after a build,
 * so a local `npm run build` never leaves CMS-merged content in the working tree.
 * On Vercel this is a harmless no-op (the merged content is already baked into dist/).
 */
import { existsSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const i18nDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "i18n");
const baseDir = join(i18nDir, ".base");

for (const lang of ["en", "uk"]) {
  const base = join(baseDir, `${lang}.json`);
  if (existsSync(base)) copyFileSync(base, join(i18nDir, `${lang}.json`));
}
console.log("[content] restored base dictionaries");
