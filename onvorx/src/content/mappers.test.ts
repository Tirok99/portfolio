import { describe, it, expect } from 'vitest'
import { rowsToSiteContent } from './mappers'
import type { DbContentRows } from './dbTypes'
import { defaultSections } from './defaults/sections'

const L = (en: string, uk = en) => ({ en, uk })

const rows: DbContentRows = {
  sections: [
    { key: 'hero', eyebrow: L('E'), title: L('T'), body: L('B'), cta_label: L('Go'),
      cards: [{ icon: { kind: 'asset', src: '/assets/icons/x.svg', path: null }, title: L('Card1'), text: L('t1') }],
      launch: { icon: { kind: 'asset', src: '/assets/icons/l.svg', path: null }, title: L('Launch'), text: L('lt') } },
    { key: 'about', eyebrow: L('AE'), title: L('AT'), body: L('AB'), cta_label: null, cards: null, launch: null },
  ],
  seo: [
    { page_key: 'home', path: '/', title: L('HT'), description: L('HD') },
    { page_key: 'services', path: '', title: L('ST'), description: L('SD') },
  ],
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

/** `rows` with only its `sections` swapped, for the malformed-JSONB cases below. */
const withSections = (sections: DbContentRows['sections']): DbContentRows => ({ ...rows, sections })

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

  it('falls back to the default path when the seo row path is empty', () => {
    const c = rowsToSiteContent(rows)
    const services = c.seo.find((s) => s.pageKey === 'services')!
    expect(services.path).toBe('/services')
  })

  it('maps image_alt → imageAlt on project cards', () => {
    const c = rowsToSiteContent(rows)
    const p2 = c.projectsHome.find((p) => p.id === 'p2')!
    expect(p2.imageAlt).toEqual(L('a2'))
  })

  it('does not mutate the input rows', () => {
    const clone = structuredClone(rows)
    rowsToSiteContent(rows)
    expect(rows).toEqual(clone)
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

  it('maps cards and launch onto the section, defaulting to undefined when the row has none', () => {
    const c = rowsToSiteContent(rows)
    const hero = c.sections.find((s) => s.key === 'hero')!
    // `path: null` is normalized away, same as ImageRef.path on project/service rows
    expect(hero.cards).toEqual([
      { icon: { kind: 'asset', src: '/assets/icons/x.svg' }, title: L('Card1'), text: L('t1') },
    ])
    expect(hero.launch).toEqual({
      icon: { kind: 'asset', src: '/assets/icons/l.svg' }, title: L('Launch'), text: L('lt'),
    })
    const about = c.sections.find((s) => s.key === 'about')!
    expect(about.cards).toBeUndefined()
    expect(about.launch).toBeUndefined()
  })

  it('keeps a valid card icon path and a HowWork-style sub field', () => {
    const c = rowsToSiteContent(withSections([
      { key: 'howWork', eyebrow: L('E'), title: L('T'), body: L('B'), cta_label: null,
        cards: [{ icon: { kind: 'upload', src: 'https://cdn/i.png', path: 'cards/i.png' },
          title: L('Define'), sub: L('s'), text: L('t') }] as never, launch: null },
    ]))
    expect(c.sections.find((s) => s.key === 'howWork')!.cards).toEqual([
      { icon: { kind: 'upload', src: 'https://cdn/i.png', path: 'cards/i.png' },
        title: L('Define'), sub: L('s'), text: L('t') },
    ])
  })

  it('drops malformed cards instead of letting them reach the page', () => {
    // a hand-edited Supabase row: missing title, non-L text, a non-object entry
    const c = rowsToSiteContent(withSections([
      { key: 'hero', eyebrow: L('E'), title: L('T'), body: L('B'), cta_label: null,
        cards: [
          { icon: { kind: 'asset', src: '/a.svg' }, text: L('no title') },
          { icon: { kind: 'asset', src: '/b.svg' }, title: L('bad text'), text: 'oops' },
          'not-a-card',
          null,
          { icon: { kind: 'asset', src: '/ok.svg' }, title: L('Good'), text: L('t') },
        ] as never,
        launch: null },
    ]))
    expect(c.sections.find((s) => s.key === 'hero')!.cards).toEqual([
      { icon: { kind: 'asset', src: '/ok.svg' }, title: L('Good'), text: L('t') },
    ])
  })

  it('substitutes an empty iconSrc when icon is missing or not string-shaped', () => {
    const c = rowsToSiteContent(withSections([
      { key: 'hero', eyebrow: L('E'), title: L('T'), body: L('B'), cta_label: null,
        cards: [
          { title: L('No icon'), text: L('t') },
          { icon: { kind: 'asset', src: 42 }, title: L('Bad src'), text: L('t') },
        ] as never,
        launch: null },
    ]))
    expect(c.sections.find((s) => s.key === 'hero')!.cards).toEqual([
      { icon: { kind: 'asset', src: '' }, title: L('No icon'), text: L('t') },
      { icon: { kind: 'asset', src: '' }, title: L('Bad src'), text: L('t') },
    ])
  })

  it('treats a non-array cards value and a malformed launch as absent', () => {
    const c = rowsToSiteContent(withSections([
      { key: 'hero', eyebrow: L('E'), title: L('T'), body: L('B'), cta_label: null,
        cards: { title: L('x') } as never,
        launch: { icon: { kind: 'asset', src: '/l.svg' } } as never },
    ]))
    const hero = c.sections.find((s) => s.key === 'hero')!
    expect(hero.cards).toBeUndefined()
    expect(hero.launch).toBeUndefined()
  })
})

describe('rowsToSiteContent — /services sections', () => {
  const svcRow = (over: Partial<DbContentRows['sections'][number]>): DbContentRows['sections'][number] => ({
    key: 'svcWebDevelopment', eyebrow: L(''), title: L('Web Development'), body: L('B'), cta_label: L('Go'),
    cards: null, launch: null, ...over,
  })

  it('maps block texts, media and card tags/track', () => {
    const c = rowsToSiteContent(withSections([
      svcRow({
        texts: { tags: [L('WordPress')], get: { title: L('G'), text: L('g') } },
        media: { badge: { kind: 'upload', src: 'https://cdn/b.webp', path: 'cards/b.webp' } },
      }),
      svcRow({
        key: 'svcBusinessAnalysis',
        texts: { tags: [], tracks: [{ label: L('T1'), title: L('A') }, { label: L('T2'), title: L('B') }] },
        cards: [{ icon: { kind: 'asset', src: '/i.svg' }, title: L('x'), text: L('y'), track: 1 }],
      }),
      svcRow({ key: 'svcHero', cards: [{ icon: { kind: 'asset', src: '/i.svg' }, title: L('x'), text: L(''), tags: [L('a')] }] }),
    ]))
    const wd = c.sections.find((s) => s.key === 'svcWebDevelopment')!
    expect(wd.texts).toEqual({ tags: [L('WordPress')], get: { title: L('G'), text: L('g') } })
    expect(wd.media).toEqual({ badge: { kind: 'upload', src: 'https://cdn/b.webp', path: 'cards/b.webp' } })
    const ba = c.sections.find((s) => s.key === 'svcBusinessAnalysis')!
    expect(ba.texts).toMatchObject({ tracks: [{ label: L('T1') }, { label: L('T2') }] })
    expect(ba.cards![0].track).toBe(1)
    expect(c.sections.find((s) => s.key === 'svcHero')!.cards![0].tags).toEqual([L('a')])
  })

  it('maps AI Build texts and media', () => {
    const img = { kind: 'asset', src: '/m.webp' }
    const c = rowsToSiteContent(withSections([
      svcRow({ key: 'svcAiBuild', texts: { stack: [L('Design')] }, media: { site: img, admin: img, bot: img } }),
    ]))
    const ai = c.sections.find((s) => s.key === 'svcAiBuild')!
    expect(ai.texts).toEqual({ stack: [L('Design')] })
    expect(ai.media).toEqual({ site: { kind: 'asset', src: '/m.webp' }, admin: { kind: 'asset', src: '/m.webp' }, bot: { kind: 'asset', src: '/m.webp' } })
  })

  it('ignores malformed hand-edited texts/media instead of throwing', () => {
    const c = rowsToSiteContent(withSections([
      svcRow({ texts: { tags: 'WordPress' }, media: { badge: 42 } }),
      svcRow({ key: 'svcGoogleAds', texts: { tags: [L('ok'), 'bad', null] }, media: null }),
    ]))
    const wd = c.sections.find((s) => s.key === 'svcWebDevelopment')!
    expect(wd.texts).toBeUndefined()
    expect(wd.media).toBeUndefined()
    expect(c.sections.find((s) => s.key === 'svcGoogleAds')!.texts).toEqual({ tags: [L('ok')] })
  })

  it('fills sections that have no row yet (DB not migrated) from the defaults', () => {
    const c = rowsToSiteContent(rows) // only hero + about rows
    expect(c.sections.map((s) => s.key)).toEqual(defaultSections.map((s) => s.key))
    const ads = c.sections.find((s) => s.key === 'svcGoogleAds')!
    expect(ads.title.en).toBe('Google Ads')
    expect(c.sections.find((s) => s.key === 'hero')!.title).toEqual(L('T')) // DB row still wins
  })
})
