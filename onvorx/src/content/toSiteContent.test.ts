import { describe, it, expect } from 'vitest'
import { buildDefaults } from './defaults'
import { toSiteContent } from './toSiteContent'

describe('toSiteContent', () => {
  it('picks the 6 content keys and nothing else', () => {
    const d = buildDefaults()
    expect(Object.keys(toSiteContent(d)).sort()).toEqual(
      [
        'projectsHome',
        'projectsPage',
        'sections',
        'seo',
        'servicesHome',
        'servicesPage',
      ].sort(),
    )
    expect(toSiteContent(d).sections).toBe(d.sections)
  })
})
