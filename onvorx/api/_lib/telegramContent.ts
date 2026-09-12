import type { SupabaseAdminEnv } from './types'
import { getSupabaseAdmin } from './supabaseAdmin'
import type { L } from './adminRows'

export type ContentField = 'eyebrow' | 'title' | 'body' | 'ctaLabel'
export type SeoField = 'title' | 'description'

export interface SectionRecord {
  key: string
  eyebrow: L
  title: L
  body: L
  ctaLabel: L | null
}

export interface SeoRecord {
  pageKey: string
  title: L
  description: L
}

export interface TelegramContentDeps {
  getSection: (key: string, env: SupabaseAdminEnv) => Promise<SectionRecord | null>
  getSeo: (pageKey: string, env: SupabaseAdminEnv) => Promise<SeoRecord | null>
}

const emptyL = (): L => ({ en: '', uk: '' })

export const defaultTelegramContentDeps: TelegramContentDeps = {
  getSection: async (key, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return null
    const { data, error } = await c.from('site_sections').select('*').eq('key', key).maybeSingle()
    if (error || !data) return null
    return {
      key: String(data.key),
      eyebrow: (data.eyebrow as L) ?? emptyL(),
      title: (data.title as L) ?? emptyL(),
      body: (data.body as L) ?? emptyL(),
      ctaLabel: (data.cta_label as L | null) ?? null,
    }
  },
  getSeo: async (pageKey, env) => {
    const c = getSupabaseAdmin(env)
    if (!c) return null
    const { data, error } = await c.from('seo_pages').select('*').eq('page_key', pageKey).maybeSingle()
    if (error || !data) return null
    return {
      pageKey: String(data.page_key),
      title: (data.title as L) ?? emptyL(),
      description: (data.description as L) ?? emptyL(),
    }
  },
}
