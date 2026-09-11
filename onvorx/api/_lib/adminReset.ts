import type { SupabaseClient } from '@supabase/supabase-js'
import { projectRow, serviceRow, sectionRow, seoRow } from './adminRows'

const LISTS: [string, 'projects' | 'services', 'home' | 'page'][] = [
  ['projectsHome', 'projects', 'home'], ['projectsPage', 'projects', 'page'],
  ['servicesHome', 'services', 'home'], ['servicesPage', 'services', 'page'],
]

/** Replace all content rows with the supplied `SiteContent`-shaped payload, atomically. */
export async function resetContent(
  c: SupabaseClient,
  content: unknown,
): Promise<{ error: string | null }> {
  if (typeof content !== 'object' || content === null || Array.isArray(content)) return { error: 'invalid_payload' }
  const x = content as Record<string, unknown>

  const sections = (Array.isArray(x.sections) ? x.sections : []).map((s) => {
    const o = s as Record<string, unknown>
    const r = sectionRow(String(o.key), o)
    return { key: String(o.key), ...r, cta_label: r.cta_label ?? null }
  })
  const seo = (Array.isArray(x.seo) ? x.seo : []).map((e) => {
    const o = e as Record<string, unknown>
    return { page_key: String(o.pageKey), ...seoRow(o) }
  })
  const cards: Record<string, unknown>[] = []
  for (const [key, table, list] of LISTS) {
    const arr = Array.isArray(x[key]) ? (x[key] as Record<string, unknown>[]) : []
    arr.forEach((card, i) => {
      const row = table === 'projects' ? projectRow({ ...card, order: i }) : serviceRow({ ...card, order: i })
      cards.push({ table, list, id: String(card.id), ...row })
    })
  }

  const { error } = await c.rpc('reset_content', { payload: { sections, seo, cards } })
  return { error: error ? error.message : null }
}
