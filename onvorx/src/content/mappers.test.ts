import { describe, it, expect } from 'vitest'
import { rowsToSiteContent } from './mappers'
import type { DbContentRows } from './dbTypes'
import { defaultSections } from './defaults/sections'

const L = (en: string, uk = en) => ({ en, uk })

const rows: DbContentRows = {
  sections: [
    { key: 'hero', eyebrow: L('E'), title: L('T'), body: L('B'), cta_label: L('Go') },
    { key: 'about', eyebrow: L('AE'), title: L('AT'), body: L('AB'), cta_label: null },
  ],
  seo: [{ page_key: 'home', path: '/', title: L('HT'), description: L('HD') }],
  projects: [
    { list: 'home', id: 'p2', sort: 1, published: true, title: L('P2'), tags: ['x'],
      description: L('d2'), image_url: 'https://cdn/x.webp', image_path: 'projects/x.webp', image_alt: L('a2') },
    { list: 'home', id: 'p1', sort: 0, published: false, title: L('P1'), tags: [],
      description: L('d1'), image_url: '/assets/projects/p1.png', image_path: null, image_alt: L('a1') },
    { list: 'page', id: 'p1', sort: 0, published: true, title: L('P1p'), tags: [],
      description: L('d1p'), image_url: null, image_path: null, image_alt: L('') },
  ],
  services: [
    { list: 'home', id: 's1', sort: 0, published: true, featured: true, title: L('S1'),
      text: L('t1'), icon_url: '/assets/services/icon-web.png', icon_path: null },
  ],
}

describe('rowsToSiteContent', () => {
  it('maps sections, attaching the code-owned label and ctaLabel only when present', () => {
    const c = rowsToSiteContent(rows)
    const hero = c.sections.find((s) => s.key === 'hero')!
    expect(hero.title).toEqual(L('T'))
    expect(hero.label).toBe(defaultSections.find((s) => s.key === 'hero')!.label)
    expect(hero.ctaLabel).toEqual(L('Go'))
    expect(c.sections.find((s) => s.key === 'about')!.ctaLabel).toBeUndefined()
  })

  it('maps seo entries with path from defaults', () => {
    const c = rowsToSiteContent(rows)
    expect(c.seo[0]).toMatchObject({ pageKey: 'home', path: '/', title: L('HT') })
  })

  it('splits project cards by list and sorts by sort → order', () => {
    const c = rowsToSiteContent(rows)
    expect(c.projectsHome.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(c.projectsHome.map((p) => p.order)).toEqual([0, 1])
    expect(c.projectsPage.map((p) => p.id)).toEqual(['p1'])
  })

  it('derives ImageRef.kind from image_path and src from image_url (null → "")', () => {
    const c = rowsToSiteContent(rows)
    const p2 = c.projectsHome.find((p) => p.id === 'p2')!
    const p1p = c.projectsPage[0]
    expect(p2.image).toEqual({ kind: 'upload', src: 'https://cdn/x.webp' })
    expect(p1p.image).toEqual({ kind: 'asset', src: '' })
  })

  it('maps service cards including featured + icon', () => {
    const c = rowsToSiteContent(rows)
    expect(c.servicesHome[0]).toMatchObject({
      id: 's1', featured: true, order: 0, published: true,
      icon: { kind: 'asset', src: '/assets/services/icon-web.png' },
    })
    expect(c.servicesPage).toEqual([])
  })
})
