import type { SupabaseClient } from '@supabase/supabase-js'
import { projectRow, serviceRow, sectionRow, seoRow } from './adminRows'

/** Replace all content rows with the supplied `SiteContent`-shaped payload. */
export async function resetContent(
  c: SupabaseClient,
  content: unknown,
): Promise<{ error: string | null }> {
  const x = content as Record<string, unknown>
  const sections = Array.isArray(x.sections) ? x.sections : []
  const seo = Array.isArray(x.seo) ? x.seo : []
  const lists: [string, 'project' | 'service', 'home' | 'page'][] = [
    ['projectsHome', 'project', 'home'], ['projectsPage', 'project', 'page'],
    ['servicesHome', 'service', 'home'], ['servicesPage', 'service', 'page'],
  ]
  try {
    for (const s of sections as Record<string, unknown>[]) {
      const row = sectionRow(String(s.key), s)
      const { error } = await c.from('site_sections').update({ ...row, cta_label: row.cta_label ?? null }).eq('key', s.key)
      if (error) return { error: error.message }
    }
    for (const e of seo as Record<string, unknown>[]) {
      const { error } = await c.from('seo_pages').update(seoRow(e)).eq('page_key', e.pageKey)
      if (error) return { error: error.message }
    }
    for (const [key, type, list] of lists) {
      const cards = Array.isArray(x[key]) ? (x[key] as Record<string, unknown>[]) : []
      const table = type === 'project' ? 'projects' : 'services'
      const { error: delErr } = await c.from(table).delete().eq('list', list)
      if (delErr) return { error: delErr.message }
      if (cards.length === 0) continue
      const rows = cards.map((card, i) => ({
        list, id: String(card.id),
        ...(type === 'project' ? projectRow({ ...card, order: i }) : serviceRow({ ...card, order: i })),
      }))
      const { error: insErr } = await c.from(table).insert(rows)
      if (insErr) return { error: insErr.message }
    }
    return { error: null }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'reset_failed' }
  }
}
