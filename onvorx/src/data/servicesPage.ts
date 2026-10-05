/**
 * Code-owned parts of the /services page: anchors, themes, the site_sections
 * key per block and the built-in (default) asset paths. Texts, lists, cards and
 * images are content — they live in site_sections (`svc*` keys, defaults in
 * src/content/defaults/servicesPage.ts). `contentKey` only picks the block's
 * alt text under `servicesPage.*` in i18n.
 *
 * Source: Figma "onvorx_v0.5" / frame "Services _en_vscode".
 */

import type { ServiceBlockKey } from "../admin/types";

const ICONS = "/assets/services-page/icons";
const ASSETS = "/assets/services-page";

export type ServiceContentKey =
  | "webDevelopment"
  | "websiteSupport"
  | "businessAnalysis"
  | "googleAds";

export interface ServiceBlockConfig {
  /** section id + BEM block name */
  id: string;
  contentKey: ServiceContentKey;
  /** the site_sections row this block reads from */
  sectionKey: ServiceBlockKey;
  /** "01" … "04" in the "01 / SERVICE" label */
  number: string;
  theme: "dark" | "light";
  badge: string;
  picture?: { src: string; width: number; height: number };
  /** default icon per feature item, in item order (tracked blocks: Track 01 first) */
  featureIcons: string[];
}

export const SERVICE_BLOCKS: Record<ServiceContentKey, ServiceBlockConfig> = {
  webDevelopment: {
    id: "web-development",
    contentKey: "webDevelopment",
    sectionKey: "svcWebDevelopment",
    number: "01",
    theme: "dark",
    badge: `${ASSETS}/badge-web.webp`,
    picture: { src: `${ASSETS}/picture-web.webp`, width: 960, height: 720 },
    featureIcons: [
      `${ICONS}/code.svg`,
      `${ICONS}/cms.svg`,
      `${ICONS}/code.svg`,
      `${ICONS}/layout.svg`,
      `${ICONS}/nodes.svg`,
      `${ICONS}/launch.svg`,
    ],
  },
  websiteSupport: {
    id: "website-support",
    contentKey: "websiteSupport",
    sectionKey: "svcWebsiteSupport",
    number: "02",
    theme: "light",
    badge: `${ASSETS}/badge-support.webp`,
    picture: { src: `${ASSETS}/picture-support.webp`, width: 960, height: 600 },
    featureIcons: [
      `${ICONS}/pages.svg`,
      `${ICONS}/gear.svg`,
      `${ICONS}/integration.svg`,
      `${ICONS}/wrench.svg`,
      `${ICONS}/clock.svg`,
      `${ICONS}/plug.svg`,
    ],
  },
  businessAnalysis: {
    id: "business-analysis",
    contentKey: "businessAnalysis",
    sectionKey: "svcBusinessAnalysis",
    number: "03",
    theme: "dark",
    badge: `${ASSETS}/badge-analysis.webp`,
    picture: { src: `${ASSETS}/picture-analysis.webp`, width: 960, height: 686 },
    featureIcons: [
      `${ICONS}/integration.svg`,
      `${ICONS}/target.svg`,
      `${ICONS}/doc.svg`,
      `${ICONS}/chat.svg`,
      `${ICONS}/list.svg`,
      `${ICONS}/doc-check.svg`,
    ],
  },
  googleAds: {
    // not "google-ads": EasyList hides #google-ads / .google-ads, so ad
    // blockers would drop the whole section
    id: "paid-search",
    contentKey: "googleAds",
    sectionKey: "svcGoogleAds",
    number: "04",
    theme: "light",
    badge: `${ASSETS}/badge-ads.webp`,
    featureIcons: [
      `${ICONS}/browser.svg`,
      `${ICONS}/sliders.svg`,
      `${ICONS}/target.svg`,
      `${ICONS}/external.svg`,
    ],
  },
};

/** Hero navigation cards: anchor per index; `icon` is the default card icon. */
export const SERVICES_HERO_CARDS = [
  { anchor: SERVICE_BLOCKS.webDevelopment.id, icon: `${ICONS}/hero-code.svg` },
  { anchor: SERVICE_BLOCKS.websiteSupport.id, icon: `${ICONS}/hero-wrench.svg` },
  { anchor: SERVICE_BLOCKS.businessAnalysis.id, icon: `${ICONS}/hero-target.svg` },
  { anchor: SERVICE_BLOCKS.googleAds.id, icon: `${ICONS}/hero-megaphone.svg` },
] as const;

/**
 * Former per-service routes (linked from the Home services cards and the
 * footer) now point at their block on /services.
 */
export const SERVICE_REDIRECTS: Record<string, string> = {
  "/web-development": `/services#${SERVICE_BLOCKS.webDevelopment.id}`,
  "/support": `/services#${SERVICE_BLOCKS.websiteSupport.id}`,
  "/business-analysis": `/services#${SERVICE_BLOCKS.businessAnalysis.id}`,
  "/google-ads": `/services#${SERVICE_BLOCKS.googleAds.id}`,
};

/** Built-in AI Build mockups — their intrinsic sizes are only known for these files. */
export const AI_BUILD_MOCKUPS = {
  site: { src: `${ASSETS}/ai-mockup-site.webp`, width: 1357, height: 931 },
  admin: { src: `${ASSETS}/ai-mockup-admin.webp`, width: 1107, height: 497 },
  bot: { src: `${ASSETS}/ai-mockup-bot.webp`, width: 370, height: 548 },
} as const;
