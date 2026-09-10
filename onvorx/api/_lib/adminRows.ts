export interface L { en: string; uk: string }

const SECTION_KEYS = ['hero', 'services', 'projects', 'howWork', 'about', 'cta'] as const
const SEO_KEYS = [
  'home', 'services', 'projects', 'about',
  'web-development', 'support', 'business-analysis', 'google-ads',
] as const

export const isL = (v: unknown): v is L =>
  typeof v === 'object' && v !== null &&
  typeof (v as Record<string, unknown>).en === 'string' &&
  typeof (v as Record<string, unknown>).uk === 'string'

export const isSectionKey = (v: unknown): boolean =>
  typeof v === 'string' && (SECTION_KEYS as readonly string[]).includes(v)
export const isSeoPageKey = (v: unknown): boolean =>
  typeof v === 'string' && (SEO_KEYS as readonly string[]).includes(v)
export const isCardList = (v: unknown): v is 'home' | 'page' => v === 'home' || v === 'page'
export const isCardType = (v: unknown): v is 'project' | 'service' => v === 'project' || v === 'service'

type Patch = Record<string, unknown>

/** section patch → DB column subset. Only well-typed L fields survive. */
export function sectionRow(_key: string, patch: Patch): Patch {
  const out: Patch = {}
  if (isL(patch.eyebrow)) out.eyebrow = patch.eyebrow
  if (isL(patch.title)) out.title = patch.title
  if (isL(patch.body)) out.body = patch.body
  if (isL(patch.ctaLabel)) out.cta_label = patch.ctaLabel
  return out
}

export function seoRow(patch: Patch): Patch {
  const out: Patch = {}
  if (isL(patch.title)) out.title = patch.title
  if (isL(patch.description)) out.description = patch.description
  return out
}

interface ImageRefLike { kind?: string; src?: unknown; path?: unknown }
const imageCols = (img: ImageRefLike, urlCol: string, pathCol: string): Patch => {
  const out: Patch = {}
  if (typeof img.src === 'string') out[urlCol] = img.src || null
  out[pathCol] = typeof img.path === 'string' && img.path ? img.path : null
  return out
}

export function projectRow(patch: Patch): Patch {
  const out: Patch = {}
  if (isL(patch.title)) out.title = patch.title
  if (isL(patch.description)) out.description = patch.description
  if (isL(patch.imageAlt)) out.image_alt = patch.imageAlt
  if (Array.isArray(patch.tags) && patch.tags.every((t) => typeof t === 'string')) out.tags = patch.tags
  if (typeof patch.published === 'boolean') out.published = patch.published
  if (typeof patch.order === 'number') out.sort = patch.order
  if (patch.image && typeof patch.image === 'object') Object.assign(out, imageCols(patch.image as ImageRefLike, 'image_url', 'image_path'))
  return out
}

export function serviceRow(patch: Patch): Patch {
  const out: Patch = {}
  if (isL(patch.title)) out.title = patch.title
  if (isL(patch.text)) out.text = patch.text
  if (typeof patch.featured === 'boolean') out.featured = patch.featured
  if (typeof patch.published === 'boolean') out.published = patch.published
  if (typeof patch.order === 'number') out.sort = patch.order
  if (patch.icon && typeof patch.icon === 'object') Object.assign(out, imageCols(patch.icon as ImageRefLike, 'icon_url', 'icon_path'))
  return out
}

export interface EstimateRequestDTO {
  id: string; createdAt: string; status: string; name: string; email: string
  company?: string; budget?: string; interestedIn: string[]; message: string
  locale: string; sourcePage?: string; note?: string
}

export function estimateFromRow(row: Record<string, unknown>): EstimateRequestDTO {
  const s = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    status: String(row.status),
    name: String(row.name ?? ''),
    email: String(row.email ?? ''),
    company: s(row.company),
    budget: s(row.budget),
    interestedIn: Array.isArray(row.interested_in) ? (row.interested_in as string[]) : [],
    message: String(row.message ?? ''),
    locale: String(row.locale ?? 'en'),
    sourcePage: s(row.source_page),
    note: s(row.note),
  }
}
