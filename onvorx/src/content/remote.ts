import { rowsToSiteContent, type SiteContent } from './mappers'
import type {
  DbProjectRow,
  DbSeoRow,
  DbSectionRow,
  DbServiceRow,
} from './dbTypes'

/**
 * Reads the 4 public content tables via the anon client and maps them to the
 * `SiteContent` shape. Returns `null` on any failure (no client configured, a
 * query error, a thrown client) so the caller keeps the bundled defaults.
 */
export async function fetchRemoteContent(): Promise<SiteContent | null> {
  let getSupabase: typeof import('./supabaseClient')['getSupabase']
  try {
    ;({ getSupabase } = await import('./supabaseClient'))
  } catch {
    return null
  }
  const client = getSupabase()
  if (!client) return null
  try {
    const [sections, seo, projects, services] = await Promise.all([
      client.from('site_sections').select('*'),
      client.from('seo_pages').select('*'),
      client.from('projects').select('*').order('sort', { ascending: true }),
      client.from('services').select('*').order('sort', { ascending: true }),
    ])
    if (sections.error || seo.error || projects.error || services.error) return null
    // `site_sections` and `seo_pages` are fixed code-owned enum tables that must
    // always have rows. PostgREST returns `200 []` (not an error) when RLS
    // denies the select or the table is truncated — an empty read means
    // something is wrong, so keep the bundled defaults.
    if (!sections.data?.length || !seo.data?.length) return null
    return rowsToSiteContent({
      sections: (sections.data ?? []) as DbSectionRow[],
      seo: (seo.data ?? []) as DbSeoRow[],
      projects: (projects.data ?? []) as DbProjectRow[],
      services: (services.data ?? []) as DbServiceRow[],
    })
  } catch {
    return null
  }
}
