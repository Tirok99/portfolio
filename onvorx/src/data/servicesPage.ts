/**
 * Static (non-translatable) parts of the /services page: anchors, themes and
 * asset paths. Texts live in i18n under `servicesPage.*` and are matched to
 * these entries by `contentKey` and by index (feature icons follow the order
 * of the `features` arrays in en.json).
 *
 * Source: Figma "onvorx_v0.5" / frame "Services _en_vscode".
 */

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
  /** "01" … "04" in the "01 / SERVICE" label */
  number: string;
  theme: "dark" | "light";
  badge: string;
  picture?: { src: string; width: number; height: number };
  /** one icon per feature; for tracked blocks — flattened across tracks */
  featureIcons: string[];
}

export const SERVICE_BLOCKS: Record<ServiceContentKey, ServiceBlockConfig> = {
  webDevelopment: {
    id: "web-development",
    contentKey: "webDevelopment",
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

/** Hero navigation cards, in i18n `servicesPage.hero.cards` order. */
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
