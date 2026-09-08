export type Locale = 'en' | 'uk'
export type L = Record<Locale, string>

export interface ImageRef {
  kind: 'asset' | 'upload'
  /** asset path ('/assets/...') or a data: URL for uploads */
  src: string
  fileName?: string
}

export type SectionKey =
  | 'hero'
  | 'services'
  | 'projects'
  | 'howWork'
  | 'about'
  | 'cta'

export interface SectionText {
  key: SectionKey
  /** English label shown in the admin UI */
  label: string
  eyebrow: L
  title: L
  /** maps to the section's description / lede */
  body: L
  /** Hero + CTA only — the button text */
  ctaLabel?: L
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
  note?: string
}

export type NewRequestInput = Omit<
  EstimateRequest,
  'id' | 'createdAt' | 'status' | 'note'
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
  requests: EstimateRequest[]
}
