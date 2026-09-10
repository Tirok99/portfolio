import type {
  L,
  ProjectCard,
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

function rowToSection(row: DbSectionRow): SectionText {
  const s: SectionText = {
    key: row.key as SectionKey,
    label: SECTION_LABEL.get(row.key as SectionKey) ?? row.key,
    eyebrow: asL(row.eyebrow),
    title: asL(row.title),
    body: asL(row.body),
  }
  if (row.cta_label) s.ctaLabel = asL(row.cta_label)
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
