import type { L } from '../admin/types'

export interface DbSectionRow {
  key: string
  eyebrow: L
  title: L
  body: L
  cta_label: L | null
}

export interface DbSeoRow {
  page_key: string
  path: string
  title: L
  description: L
}

export interface DbProjectRow {
  list: 'home' | 'page'
  id: string
  sort: number
  published: boolean
  title: L
  tags: string[]
  description: L
  image_url: string | null
  image_path: string | null
  image_alt: L
}

export interface DbServiceRow {
  list: 'home' | 'page'
  id: string
  sort: number
  published: boolean
  featured: boolean
  title: L
  text: L
  icon_url: string | null
  icon_path: string | null
}

export interface DbContentRows {
  sections: DbSectionRow[]
  seo: DbSeoRow[]
  projects: DbProjectRow[]
  services: DbServiceRow[]
}
