import { describe, it, expect } from 'vitest'
import { buildDefaults, DATA_VERSION } from './index'

describe('buildDefaults', () => {
  it('produces a versioned AdminData with the expected shape', () => {
    const d = buildDefaults()
    expect(d.version).toBe(DATA_VERSION)
    expect(d.sections).toHaveLength(6)
    expect(d.sections.map((s) => s.key)).toEqual([
      'hero',
      'services',
      'projects',
      'howWork',
      'about',
      'cta',
    ])
    expect(d.seo).toHaveLength(8)
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
