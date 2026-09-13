import type { SupabaseAdminEnv } from './types'
import { getSupabaseAdmin } from './supabaseAdmin'
import type { L } from './adminRows'

export type ProjectField = 'title' | 'description' | 'imageAlt' | 'tags'
export type ServiceField = 'title' | 'text'

export interface ProjectCardRecord {
  list: 'home' | 'page'
  id: string
  sort: number
  published: boolean
  title: L
  tags: string[]
  description: L
  imageUrl: string | null
  imagePath: string | null
  imageAlt: L
}

export interface ServiceCardRecord {
  list: 'home' | 'page'
  id: string
  sort: number
  published: boolean
  featured: boolean
  title: L
  text: L
  iconUrl: string | null
  iconPath: string | null
}

export interface TelegramCardsDeps {
  listProjects: (list: 'home' | 'page', env: SupabaseAdminEnv) => Promise<ProjectCardRecord[]>
  getProject: (list: 'home' | 'page', id: string, env: SupabaseAdminEnv) => Promise<ProjectCardRecord | null>
  listServices: (list: 'home' | 'page', env: SupabaseAdminEnv) => Promise<ServiceCardRecord[]>
  getService: (list: 'home' | 'page', id: string, env: SupabaseAdminEnv) => Promise<ServiceCardRecord | null>
}

const emptyL = (): L => ({ en: '', uk: '' })

const rowToProject = (row: Record<string, unknown>): ProjectCardRecord => ({
  list: row.list as 'home' | 'page',
  id: String(row.id),
  sort: Number(row.sort),
  published: Boolean(row.published),
  title: (row.title as L) ?? emptyL(),
  tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
  description: (row.description as L) ?? emptyL(),
  imageUrl: (row.image_url as string | null) ?? null,
  imagePath: (row.image_path as string | null) ?? null,
  imageAlt: (row.image_alt as L) ?? emptyL(),
})

const rowToService = (row: Record<string, unknown>): ServiceCardRecord => ({
  list: row.list as 'home' | 'page',
  id: String(row.id),
  sort: Number(row.sort),
  published: Boolean(row.published),
  featured: Boolean(row.featured),
  title: (row.title as L) ?? emptyL(),
  text: (row.text as L) ?? emptyL(),
  iconUrl: (row.icon_url as string | null) ?? null,
  iconPath: (row.icon_path as string | null) ?? null,
})

export const defaultTelegramCardsDeps: TelegramCardsDeps = {
  listProjects: async (list, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return []
    const { data, error } = await c
      .from('projects')
      .select('*')
      .eq('list', list)
      .order('sort', { ascending: true })
    if (error || !data) return []
    return data.map(rowToProject)
  },
  getProject: async (list, id, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return null
    const { data, error } = await c
      .from('projects')
      .select('*')
      .eq('list', list)
      .eq('id', id)
      .maybeSingle()
    if (error || !data) return null
    return rowToProject(data)
  },
  listServices: async (list, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return []
    const { data, error } = await c
      .from('services')
      .select('*')
      .eq('list', list)
      .order('sort', { ascending: true })
    if (error || !data) return []
    return data.map(rowToService)
  },
  getService: async (list, id, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return null
    const { data, error } = await c
      .from('services')
      .select('*')
      .eq('list', list)
      .eq('id', id)
      .maybeSingle()
    if (error || !data) return null
    return rowToService(data)
  },
}
