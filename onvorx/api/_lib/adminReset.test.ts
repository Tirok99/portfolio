import { describe, it, expect, vi } from 'vitest'
import { resetContent } from './adminReset'

const L = (s: string) => ({ en: s, uk: s })
const content = {
  sections: [
    { key: 'hero', title: L('T'), eyebrow: L('E'), body: L('B'), ctaLabel: L('Go') },
    { key: 'about', title: L('A2') },
  ],
  seo: [{ pageKey: 'home', title: L('HT'), description: L('HD') }],
  projectsHome: [{ id: 'p1', published: true, title: L('P'), tags: ['x'], description: L('d'),
    image: { kind: 'asset', src: '/a.png' }, imageAlt: L('a') }],
  projectsPage: [], servicesHome: [{ id: 's1', published: true, featured: true, title: L('S'), text: L('t'),
    icon: { kind: 'asset', src: '/i.png' } }],
  servicesPage: [],
}

describe('resetContent', () => {
  it('builds a snake_case payload and calls reset_content once', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null })
    const r = await resetContent({ rpc } as never, content)
    expect(r).toEqual({ error: null })
    expect(rpc).toHaveBeenCalledTimes(1)
    const [fn, args] = rpc.mock.calls[0]
    expect(fn).toBe('reset_content')
    const p = args.payload
    expect(p.sections[0]).toMatchObject({ key: 'hero', title: L('T'), cta_label: L('Go') })
    expect(p.sections.find((s: { key: string }) => s.key === 'about').cta_label).toBeNull()
    expect(p.seo[0]).toMatchObject({ page_key: 'home', title: L('HT') })
    expect(p.cards).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'projects', list: 'home', id: 'p1', sort: 0, published: true, image_url: '/a.png' }),
      expect.objectContaining({ table: 'services', list: 'home', id: 's1', sort: 0, featured: true }),
    ]))
  })
  it('surfaces an rpc error', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: 'boom' } })
    expect(await resetContent({ rpc } as never, content)).toEqual({ error: 'boom' })
  })
  it('rejects a non-object payload', async () => {
    const rpc = vi.fn()
    expect((await resetContent({ rpc } as never, null)).error).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
  })
})
