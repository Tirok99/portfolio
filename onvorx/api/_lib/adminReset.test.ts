import { describe, it, expect } from 'vitest'
import { resetContent } from './adminReset'

const L = (s: string) => ({ en: s, uk: s })

interface Call {
  table: string
  op: 'update' | 'delete' | 'insert'
  payload?: unknown
  col?: string
  val?: unknown
}

function makeClient(errorFor: (c: Call) => string | null = () => null) {
  const calls: Call[] = []
  const settle = (c: Call) => {
    calls.push(c)
    const msg = errorFor(c)
    return Promise.resolve({ error: msg ? { message: msg } : null })
  }
  const client = {
    from(table: string) {
      return {
        update(payload: unknown) {
          return { eq: (col: string, val: unknown) => settle({ table, op: 'update', payload, col, val }) }
        },
        delete() {
          return { eq: (col: string, val: unknown) => settle({ table, op: 'delete', col, val }) }
        },
        insert(payload: unknown) {
          return settle({ table, op: 'insert', payload })
        },
      }
    },
  }
  return { client, calls }
}

const content = () => ({
  sections: [
    { key: 'hero', title: L('H'), ctaLabel: L('Go') },
    { key: 'about', title: L('A') },
  ],
  seo: [{ pageKey: 'home', title: L('T'), description: L('D') }],
  projectsHome: [{ id: 'p1', title: L('P1') }],
  projectsPage: [],
  servicesHome: [],
  servicesPage: [{ id: 's1', title: L('S1'), text: L('t') }],
})

describe('resetContent', () => {
  it('updates each section by key, nulling cta_label when the section has no ctaLabel', async () => {
    const { client, calls } = makeClient()
    const r = await resetContent(client as never, content())
    expect(r).toEqual({ error: null })

    const secCalls = calls.filter((c) => c.table === 'site_sections' && c.op === 'update')
    expect(secCalls.map((c) => [c.col, c.val])).toEqual([
      ['key', 'hero'],
      ['key', 'about'],
    ])
    expect((secCalls[0].payload as Record<string, unknown>).cta_label).toEqual(L('Go'))
    expect((secCalls[1].payload as Record<string, unknown>).cta_label).toBeNull()
  })

  it('updates seo rows by page_key', async () => {
    const { client, calls } = makeClient()
    await resetContent(client as never, content())
    const seoCall = calls.find((c) => c.table === 'seo_pages')
    expect(seoCall).toMatchObject({ op: 'update', col: 'page_key', val: 'home' })
  })

  it('deletes every card list (even empty ones) then inserts only the non-empty ones with sort = index', async () => {
    const { client, calls } = makeClient()
    await resetContent(client as never, content())

    const deletes = calls.filter((c) => c.op === 'delete').map((c) => [c.table, c.val])
    expect(deletes).toEqual([
      ['projects', 'home'],
      ['projects', 'page'],
      ['services', 'home'],
      ['services', 'page'],
    ])

    const inserts = calls.filter((c) => c.op === 'insert')
    expect(inserts.map((c) => c.table)).toEqual(['projects', 'services'])
    const projectRows = inserts[0].payload as Record<string, unknown>[]
    expect(projectRows).toHaveLength(1)
    expect(projectRows[0]).toMatchObject({ list: 'home', id: 'p1', sort: 0 })
  })

  it('stops and returns the first error', async () => {
    const { client, calls } = makeClient((c) => (c.table === 'seo_pages' ? 'boom' : null))
    const r = await resetContent(client as never, content())
    expect(r).toEqual({ error: 'boom' })
    expect(calls.some((c) => c.op === 'delete')).toBe(false)
    expect(calls.some((c) => c.op === 'insert')).toBe(false)
  })
})
