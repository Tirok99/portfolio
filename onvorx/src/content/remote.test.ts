import { describe, it, expect, vi, beforeEach } from 'vitest'

const from = vi.fn()
const client = { from }
vi.mock('./supabaseClient', () => ({ getSupabase: () => clientOrNull }))

let clientOrNull: typeof client | null

import { fetchRemoteContent } from './remote'

const L = (s: string) => ({ en: s, uk: s })
const rowsByTable: Record<string, unknown[]> = {
  site_sections: [{ key: 'hero', eyebrow: L('E'), title: L('T'), body: L('B'), cta_label: null }],
  seo_pages: [{ page_key: 'home', path: '/', title: L('HT'), description: L('HD') }],
  projects: [
    { list: 'home', id: 'p1', sort: 0, published: true, title: L('P'), tags: [], description: L('d'),
      image_url: null, image_path: null, image_alt: L('a') },
  ],
  services: [
    { list: 'home', id: 's1', sort: 0, published: true, featured: false, title: L('S'), text: L('t'),
      icon_url: null, icon_path: null },
  ],
}

// `select('*')` is awaited directly for the enum tables and chained with
// `.order('sort', …)` for projects/services — so the fake must be both thenable
// and carry an `.order` that resolves the same result.
type Result = { data: unknown[] | null; error: { message: string } | null }
const select = (result: Result) => () => ({
  order: vi.fn().mockResolvedValue(result),
  then: (resolve: (r: Result) => unknown) => Promise.resolve(result).then(resolve),
})

beforeEach(() => {
  clientOrNull = client
  from.mockReset()
  from.mockImplementation((table: string) => ({
    select: vi.fn(select({ data: rowsByTable[table] ?? [], error: null })),
  }))
})

describe('fetchRemoteContent', () => {
  it('returns null when there is no client (unconfigured)', async () => {
    clientOrNull = null
    expect(await fetchRemoteContent()).toBeNull()
  })

  it('queries the 4 content tables and maps them to SiteContent', async () => {
    const c = await fetchRemoteContent()
    expect(from.mock.calls.map((a) => a[0]).sort()).toEqual(
      ['projects', 'seo_pages', 'services', 'site_sections'],
    )
    expect(c).not.toBeNull()
    expect(c!.sections[0].title).toEqual(L('T'))
    expect(c!.projectsHome).toHaveLength(1)
    expect(c!.servicesHome[0].id).toBe('s1')
  })

  it('returns null when a code-owned enum table reads empty', async () => {
    from.mockImplementation((table: string) => ({
      select: vi.fn(select(
        table === 'site_sections'
          ? { data: [], error: null }
          : { data: rowsByTable[table] ?? [], error: null },
      )),
    }))
    expect(await fetchRemoteContent()).toBeNull()
  })

  it('returns null if any table query errors', async () => {
    from.mockImplementation((table: string) => ({
      select: vi.fn(select(
        table === 'services' ? { data: null, error: { message: 'boom' } } : { data: [], error: null },
      )),
    }))
    expect(await fetchRemoteContent()).toBeNull()
  })

  it('returns null if the client throws', async () => {
    from.mockImplementation(() => { throw new Error('network') })
    expect(await fetchRemoteContent()).toBeNull()
  })
})
