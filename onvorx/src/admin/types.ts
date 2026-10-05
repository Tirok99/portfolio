export type Locale = 'en' | 'uk'
export type L = Record<Locale, string>

export interface ImageRef {
  kind: 'asset' | 'upload'
  /** asset path ('/assets/...') for kind 'asset', or a Supabase Storage public URL for kind 'upload' */
  src: string
  fileName?: string
  /** Supabase Storage object key for kind:'upload'; used to delete/replace the object */
  path?: string
}

export type HomeSectionKey =
  | 'hero'
  | 'services'
  | 'projects'
  | 'howWork'
  | 'about'
  | 'cta'
  | 'footer'

/** The four numbered blocks on /services (spec §5.1). */
export type ServiceBlockKey =
  | 'svcWebDevelopment'
  | 'svcWebsiteSupport'
  | 'svcBusinessAnalysis'
  | 'svcGoogleAds'

export type ServicesSectionKey = 'svcHero' | ServiceBlockKey | 'svcAiBuild' | 'svcCta'

export type SectionKey = HomeSectionKey | ServicesSectionKey

export interface SectionCard {
  icon: ImageRef
  title: L
  /** HowWork cards only */
  sub?: L
  text: L
  /** svcHero cards only — the small tags under the card title */
  tags?: L[]
  /** svcBusinessAnalysis feature items only — which of the 2 tracks */
  track?: 0 | 1
}

export interface TrackHead {
  label: L
  title: L
}

/** `texts` of the 4 service blocks — Content-owned (spec §5.3). */
export interface ServiceBlockTexts {
  tags: L[]
  /** "What you get" box — absent on svcGoogleAds */
  get?: { title: L; text: L }
  /** svcBusinessAnalysis only, exactly 2 */
  tracks?: [TrackHead, TrackHead]
}

/** `texts` of svcAiBuild — Content-owned. */
export interface AiBuildTexts {
  stack: L[]
}

export type SectionTexts = ServiceBlockTexts | AiBuildTexts

/** `media` of the 4 service blocks — Cards-owned (spec §5.3). */
export interface ServiceBlockMedia {
  badge: ImageRef
  /** absent on svcGoogleAds */
  picture?: ImageRef
}

/** `media` of svcAiBuild — Cards-owned. */
export interface AiBuildMedia {
  site: ImageRef
  admin: ImageRef
  bot: ImageRef
}

export type SectionMedia = ServiceBlockMedia | AiBuildMedia

export interface SectionText {
  key: SectionKey
  /** English label shown in the admin UI */
  label: string
  eyebrow: L
  title: L
  /** maps to the section's description / lede */
  body: L
  /** Hero + CTA (Home), every svc section except svcHero — button / link text */
  ctaLabel?: L
  /** Hero/HowWork/About cards; svcHero cards; svc block feature items */
  cards?: SectionCard[]
  /** Hero only — the standalone "Launch" card */
  launch?: SectionCard
  /** svc blocks + svcAiBuild — short text lists (Content-owned) */
  texts?: SectionTexts
  /** svc blocks + svcAiBuild — images (Cards-owned) */
  media?: SectionMedia
}

export interface ProjectCard {
  id: string
  order: number
  published: boolean
  title: L
  /** language-independent (e.g. "WordPress") */
  tags: string[]
  description: L
  image: ImageRef
  imageAlt: L
}

export interface ServiceCard {
  id: string
  order: number
  published: boolean
  /** enlarged 'featured' card style — Home list only */
  featured: boolean
  title: L
  text: L
  icon: ImageRef
}

export type CardListKey =
  | 'projectsHome'
  | 'projectsPage'
  | 'servicesHome'
  | 'servicesPage'

export type SeoPageKey =
  | 'home'
  | 'services'
  | 'projects'
  | 'about'
  | 'web-development'
  | 'support'
  | 'business-analysis'
  | 'google-ads'

export interface SeoEntry {
  pageKey: SeoPageKey
  label: string
  path: string
  title: L
  description: L
}

export type RequestStatus = 'new' | 'in_progress' | 'done' | 'archived'
export type BudgetRange = '<1k' | '1-3k' | '3-10k' | '10k+' | 'not_sure'

export interface EstimateRequest {
  id: string
  createdAt: string
  status: RequestStatus
  name: string
  email: string
  company?: string
  budget?: BudgetRange
  interestedIn: string[]
  message: string
  locale: Locale
  sourcePage?: string
}

export interface RequestNote {
  id: string
  createdAt: string
  author: string
  body: string
}

export type NewRequestInput = Omit<
  EstimateRequest,
  'id' | 'createdAt' | 'status'
>

export interface AdminData {
  version: number
  updatedAt: string
  sections: SectionText[]
  projectsHome: ProjectCard[]
  projectsPage: ProjectCard[]
  servicesHome: ServiceCard[]
  servicesPage: ServiceCard[]
  seo: SeoEntry[]
}
