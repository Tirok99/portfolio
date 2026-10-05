import { describe, it, expect } from 'vitest'
import { buildDefaults, DATA_VERSION } from './index'

describe('buildDefaults', () => {
  it('produces a versioned AdminData with the expected shape', () => {
    const d = buildDefaults()
    expect(d.version).toBe(DATA_VERSION)
    expect(d.sections.map((s) => s.key)).toEqual([
      'hero', 'services', 'projects', 'howWork', 'about', 'cta', 'footer',
      'svcHero', 'svcWebDevelopment', 'svcAiBuild', 'svcWebsiteSupport',
      'svcBusinessAnalysis', 'svcGoogleAds', 'svcCta',
    ])
    expect(d.seo).toHaveLength(8)
  })

  it('seeds the /services sections from the moved copy, uk = en', () => {
    const byKey = Object.fromEntries(buildDefaults().sections.map((s) => [s.key, s]))
    expect(byKey.svcHero.title.en).toBe('Every stage of your web project, covered')
    expect(byKey.svcHero.cards).toHaveLength(4)
    expect(byKey.svcHero.cards![3].tags!.map((t) => t.en)).toEqual(['Search', 'Analytics', 'Optimization'])
    expect(byKey.svcHero.cards![0].icon.src).toBe('/assets/services-page/icons/hero-code.svg')
    expect(byKey.svcWebDevelopment.ctaLabel!.en).toBe('Get a project estimate')
    expect(byKey.svcWebDevelopment.cards).toHaveLength(6)
    expect(byKey.svcWebDevelopment.media).toEqual({
      badge: { kind: 'asset', src: '/assets/services-page/badge-web.webp' },
      picture: { kind: 'asset', src: '/assets/services-page/picture-web.webp' },
    })
    expect(byKey.svcAiBuild.eyebrow.en).toBe('New')
    expect(byKey.svcAiBuild.texts).toEqual({ stack: expect.arrayContaining([{ en: 'Database', uk: 'Database' }]) })
    expect(byKey.svcCta.ctaLabel!.en).toBe('Request a Project Estimate')
    expect(byKey.svcWebDevelopment.title.uk).toBe(byKey.svcWebDevelopment.title.en)
  })

  it('Business Analysis has 2 track heads and items ordered Track 01 then Track 02', () => {
    const ba = buildDefaults().sections.find((s) => s.key === 'svcBusinessAnalysis')!
    expect(ba.texts).toMatchObject({ tracks: [{ title: { en: 'Business Process Analysis' } }, { title: { en: 'IT Business Analysis' } }] })
    expect(ba.cards!.map((c) => c.track)).toEqual([0, 0, 0, 1, 1, 1])
    expect(ba.cards![3].icon.src).toBe('/assets/services-page/icons/chat.svg')
  })

  it('Google Ads has no picture and no "What you get"', () => {
    const ads = buildDefaults().sections.find((s) => s.key === 'svcGoogleAds')!
    expect(ads.media).toEqual({ badge: { kind: 'asset', src: '/assets/services-page/badge-ads.webp' } })
    expect(ads.texts).toEqual({ tags: expect.any(Array) })
  })

  it('seeds project and service cards from i18n content', () => {
    const d = buildDefaults()
    expect(d.projectsHome.length).toBeGreaterThan(0)
    expect(d.projectsHome[0].image.src).toMatch(/^\/assets\/projects\//)
    expect(d.servicesHome.length).toBeGreaterThan(0)
    expect(d.servicesHome.some((s) => s.featured)).toBe(true)
    expect(d.servicesHome[0].icon.src).toMatch(/^\/assets\/services\//)
  })

  it('returns a fresh independent copy each call', () => {
    const a = buildDefaults()
    const b = buildDefaults()
    a.sections[0].title.en = 'MUTATED'
    expect(b.sections[0].title.en).not.toBe('MUTATED')
  })

  it('hero and cta sections have a ctaLabel; others do not', () => {
    const d = buildDefaults()
    const byKey = Object.fromEntries(d.sections.map((s) => [s.key, s]))
    expect(byKey.hero.ctaLabel).toBeDefined()
    expect(byKey.cta.ctaLabel).toBeDefined()
    expect(byKey.about.ctaLabel).toBeUndefined()
  })
})
