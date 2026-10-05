export interface L { en: string; uk: string }

const HOME_SECTION_KEYS = ['hero', 'services', 'projects', 'howWork', 'about', 'cta', 'footer'] as const
const SVC_BLOCK_KEYS = ['svcWebDevelopment', 'svcWebsiteSupport', 'svcBusinessAnalysis', 'svcGoogleAds'] as const
const SECTION_KEYS = [...HOME_SECTION_KEYS, 'svcHero', ...SVC_BLOCK_KEYS, 'svcAiBuild', 'svcCta'] as const
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

const isImageRefLike = (v: unknown): boolean =>
  typeof v === 'object' && v !== null &&
  typeof (v as Record<string, unknown>).kind === 'string' &&
  typeof (v as Record<string, unknown>).src === 'string'

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isLArray = (v: unknown): boolean => Array.isArray(v) && v.every(isL)
const isBlockKey = (k: string): boolean => (SVC_BLOCK_KEYS as readonly string[]).includes(k)

const isCard = (v: unknown): boolean => {
  if (!isObject(v)) return false
  if (!isImageRefLike(v.icon)) return false
  if (!isL(v.title)) return false
  if (!isL(v.text)) return false
  if (v.sub !== undefined && !isL(v.sub)) return false
  if (v.tags !== undefined && !isLArray(v.tags)) return false
  if (v.track !== undefined && v.track !== 0 && v.track !== 1) return false
  return true
}

/** spec §5.5: per-key rules on top of the per-card shape check. */
const isCardsFor = (key: string, v: unknown): boolean => {
  if (!Array.isArray(v) || !v.every(isCard)) return false
  if (key === 'svcHero') return v.length === 4
  if (key === 'svcBusinessAnalysis') return v.every((c) => c.track === 0 || c.track === 1)
  return true
}

const isTrackHead = (v: unknown): boolean => isObject(v) && isL(v.label) && isL(v.title)

/** spec §5.3 `texts` — Content-owned; only the 4 blocks and AI Build have one. */
const isTextsFor = (key: string, v: unknown): boolean => {
  if (!isObject(v)) return false
  if (key === 'svcAiBuild') return isLArray(v.stack)
  if (!isBlockKey(key)) return false
  if (!isLArray(v.tags)) return false
  if (v.get !== undefined && !(isObject(v.get) && isL(v.get.title) && isL(v.get.text))) return false
  if (key === 'svcBusinessAnalysis')
    return Array.isArray(v.tracks) && v.tracks.length === 2 && v.tracks.every(isTrackHead)
  return v.tracks === undefined
}

/** spec §5.3 `media` — Cards-owned; only the 4 blocks and AI Build have one. */
const isMediaFor = (key: string, v: unknown): boolean => {
  if (!isObject(v)) return false
  if (key === 'svcAiBuild') return isImageRefLike(v.site) && isImageRefLike(v.admin) && isImageRefLike(v.bot)
  if (!isBlockKey(key)) return false
  return isImageRefLike(v.badge) && (v.picture === undefined || isImageRefLike(v.picture))
}

/** section patch → DB column subset. Only well-typed fields survive. */
export function sectionRow(key: string, patch: Patch): Patch {
  const out: Patch = {}
  if (isL(patch.eyebrow)) out.eyebrow = patch.eyebrow
  if (isL(patch.title)) out.title = patch.title
  if (isL(patch.body)) out.body = patch.body
  if (isL(patch.ctaLabel)) out.cta_label = patch.ctaLabel
  if (isCardsFor(key, patch.cards)) out.cards = patch.cards
  if (isCard(patch.launch)) out.launch = patch.launch
  if (isTextsFor(key, patch.texts)) out.texts = patch.texts
  if (isMediaFor(key, patch.media)) out.media = patch.media
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
  locale: string; sourcePage?: string
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
  }
}
