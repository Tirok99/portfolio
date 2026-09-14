import type {
  L,
  ProjectCard,
  SectionCard,
  SectionKey,
  SectionText,
  SeoEntry,
  SeoPageKey,
  ServiceCard,
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
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined
  const c = v as Record<string, unknown>
  if (!isLLike(c.title) || !isLLike(c.text)) return undefined
  const icon = (typeof c.icon === 'object' && c.icon !== null ? c.icon : {}) as Record<string, unknown>
  const card: SectionCard = {
    icon: {
      kind: icon.kind === 'upload' ? 'upload' : 'asset',
      src: typeof icon.src === 'string' ? icon.src : '',
    },
    title: asL(c.title),
    text: asL(c.text),
  }
  if (typeof icon.path === 'string' && icon.path) card.icon.path = icon.path
  if (isLLike(c.sub)) card.sub = asL(c.sub)
  return card
}

/** Non-array → `undefined`; otherwise every entry that fails `asCard` is dropped. */
const asCards = (v: unknown): SectionCard[] | undefined =>
  Array.isArray(v)
    ? v.map(asCard).filter((c): c is SectionCard => c !== undefined)
    : undefined

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
  const sections = [...rows.sections]
    .sort((a, b) => SECTION_ORDER.indexOf(a.key as SectionKey) - SECTION_ORDER.indexOf(b.key as SectionKey))
    .map(rowToSection)

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
