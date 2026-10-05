import type {
  ImageRef,
  L,
  ProjectCard,
  SectionCard,
  SectionKey,
  SectionMedia,
  SectionText,
  SectionTexts,
  SeoEntry,
  SeoPageKey,
  ServiceBlockTexts,
  ServiceCard,
  TrackHead,
} from '../admin/types'
import type {
  DbContentRows,
  DbProjectRow,
  DbSectionRow,
  DbSeoRow,
  DbServiceRow,
} from './dbTypes'
import { defaultSections } from './defaults/sections'
import { defaultSeo } from './defaults/seo'

export interface SiteContent {
  sections: SectionText[]
  seo: SeoEntry[]
  projectsHome: ProjectCard[]
  projectsPage: ProjectCard[]
  servicesHome: ServiceCard[]
  servicesPage: ServiceCard[]
}

const SECTION_ORDER = defaultSections.map((s) => s.key)
const SECTION_LABEL = new Map(defaultSections.map((s) => [s.key, s.label]))
const SEO_ORDER = defaultSeo.map((s) => s.pageKey)
const SEO_META = new Map(defaultSeo.map((s) => [s.pageKey, { label: s.label, path: s.path }]))

const asL = (v: L | null | undefined): L => ({ en: v?.en ?? '', uk: v?.uk ?? '' })

const isLLike = (v: unknown): v is L =>
  typeof v === 'object' && v !== null &&
  typeof (v as Record<string, unknown>).en === 'string' &&
  typeof (v as Record<string, unknown>).uk === 'string'

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const asImageRef = (v: unknown): ImageRef | undefined => {
  if (!isObj(v) || typeof v.src !== 'string') return undefined
  const ref: ImageRef = { kind: v.kind === 'upload' ? 'upload' : 'asset', src: v.src }
  if (typeof v.path === 'string' && v.path) ref.path = v.path
  return ref
}

/** Keeps the well-formed `L` entries of an array; anything else is dropped. */
const asLList = (v: unknown[]): L[] => v.filter(isLLike).map(asL)

/**
 * `cards`/`launch` arrive as raw JSONB, so — unlike every other column here —
 * their shape is not guaranteed: `sectionRow()` validates admin writes, but a
 * row hand-edited in the Supabase SQL editor (how this project's migrations
 * and seeds are applied) can hold a card with no `title`/`text`. `pick()` in
 * `useSiteContent` would throw on that, and there is no error boundary, so one
 * bad row would white-screen the whole public page. Mirror the shape check
 * `api/_lib/adminRows.ts` applies server-side — duplicated deliberately, so
 * this client-bundle module keeps no dependency on `api/_lib`.
 */
const asCard = (v: unknown): SectionCard | undefined => {
  if (!isObj(v)) return undefined
  if (!isLLike(v.title) || !isLLike(v.text)) return undefined
  const card: SectionCard = {
    icon: asImageRef(v.icon) ?? { kind: 'asset', src: '' },
    title: asL(v.title),
    text: asL(v.text),
  }
  if (isLLike(v.sub)) card.sub = asL(v.sub)
  if (Array.isArray(v.tags)) card.tags = asLList(v.tags)
  if (v.track === 0 || v.track === 1) card.track = v.track
  return card
}

/** Non-array → `undefined`; otherwise every entry that fails `asCard` is dropped. */
const asCards = (v: unknown): SectionCard[] | undefined =>
  Array.isArray(v)
    ? v.map(asCard).filter((c): c is SectionCard => c !== undefined)
    : undefined

const asTrackHead = (v: unknown): TrackHead | undefined =>
  isObj(v) && isLLike(v.label) && isLLike(v.title) ? { label: asL(v.label), title: asL(v.title) } : undefined

/** Same idea as `asCard`: `sectionRow()` validates admin writes, a hand-edited row may not be. */
const asTexts = (v: unknown): SectionTexts | undefined => {
  if (!isObj(v)) return undefined
  if (Array.isArray(v.stack)) return { stack: asLList(v.stack) }
  if (!Array.isArray(v.tags)) return undefined
  const t: ServiceBlockTexts = { tags: asLList(v.tags) }
  if (isObj(v.get) && isLLike(v.get.title) && isLLike(v.get.text))
    t.get = { title: asL(v.get.title), text: asL(v.get.text) }
  if (Array.isArray(v.tracks) && v.tracks.length === 2) {
    const a = asTrackHead(v.tracks[0])
    const b = asTrackHead(v.tracks[1])
    if (a && b) t.tracks = [a, b]
  }
  return t
}

const asMedia = (v: unknown): SectionMedia | undefined => {
  if (!isObj(v)) return undefined
  const site = asImageRef(v.site)
  const admin = asImageRef(v.admin)
  const bot = asImageRef(v.bot)
  if (site && admin && bot) return { site, admin, bot }
  const badge = asImageRef(v.badge)
  if (!badge) return undefined
  const picture = asImageRef(v.picture)
  return picture ? { badge, picture } : { badge }
}

function rowToSection(row: DbSectionRow): SectionText {
  const s: SectionText = {
    key: row.key as SectionKey,
    label: SECTION_LABEL.get(row.key as SectionKey) ?? row.key,
    eyebrow: asL(row.eyebrow),
    title: asL(row.title),
    body: asL(row.body),
  }
  if (row.cta_label) s.ctaLabel = asL(row.cta_label)
  const cards = asCards(row.cards)
  if (cards) s.cards = cards
  const launch = asCard(row.launch)
  if (launch) s.launch = launch
  const texts = asTexts(row.texts)
  if (texts) s.texts = texts
  const media = asMedia(row.media)
  if (media) s.media = media
  return s
}

function rowToSeo(row: DbSeoRow): SeoEntry {
  const meta = SEO_META.get(row.page_key as SeoPageKey)
  return {
    pageKey: row.page_key as SeoPageKey,
    label: meta?.label ?? row.page_key,
    path: row.path || meta?.path || '/',
    title: asL(row.title),
    description: asL(row.description),
  }
}

function rowToProjectCard(row: DbProjectRow, order: number): ProjectCard {
  return {
    id: row.id,
    order,
    published: row.published,
    title: asL(row.title),
    tags: [...(row.tags ?? [])],
    description: asL(row.description),
    image: { kind: row.image_path ? 'upload' : 'asset', src: row.image_url ?? '' },
    imageAlt: asL(row.image_alt),
  }
}

function rowToServiceCard(row: DbServiceRow, order: number): ServiceCard {
  return {
    id: row.id,
    order,
    published: row.published,
    featured: row.featured,
    title: asL(row.title),
    text: asL(row.text),
    icon: { kind: row.icon_path ? 'upload' : 'asset', src: row.icon_url ?? '' },
  }
}

const bySort = <T extends { sort: number }>(a: T, b: T) => a.sort - b.sort

/** Postgres rows → the content slice of `AdminData` (no `requests`, no `version`). */
export function rowsToSiteContent(rows: DbContentRows): SiteContent {
  // A section with no row yet (production DB before its migration ran) falls
  // back to the bundled default instead of disappearing from the page.
  const present = new Set(rows.sections.map((r) => r.key))
  const missing = defaultSections
    .filter((s) => !present.has(s.key))
    .map((s) => JSON.parse(JSON.stringify(s)) as SectionText)
  const sections = [...rows.sections.map(rowToSection), ...missing].sort(
    (a, b) => SECTION_ORDER.indexOf(a.key) - SECTION_ORDER.indexOf(b.key),
  )

  const seo = [...rows.seo]
    .sort((a, b) => SEO_ORDER.indexOf(a.page_key as SeoPageKey) - SEO_ORDER.indexOf(b.page_key as SeoPageKey))
    .map(rowToSeo)

  const projectsFor = (list: 'home' | 'page') =>
    rows.projects.filter((r) => r.list === list).sort(bySort).map((r, i) => rowToProjectCard(r, i))
  const servicesFor = (list: 'home' | 'page') =>
    rows.services.filter((r) => r.list === list).sort(bySort).map((r, i) => rowToServiceCard(r, i))

  return {
    sections,
    seo,
    projectsHome: projectsFor('home'),
    projectsPage: projectsFor('page'),
    servicesHome: servicesFor('home'),
    servicesPage: servicesFor('page'),
  }
}
