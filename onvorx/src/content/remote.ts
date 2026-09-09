import { getSupabase } from './supabaseClient'
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
  const client = getSupabase()
  if (!client) return null
  try {
    const [sections, seo, projects, services] = await Promise.all([
      client.from('site_sections').select('*'),
      client.from('seo_pages').select('*'),
      client.from('projects').select('*'),
      client.from('services').select('*'),
    ])
    if (sections.error || seo.error || projects.error || services.error) return null
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
