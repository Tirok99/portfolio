import { describe, it, expect } from 'vitest'
import { seedAdminData } from './persistence'
import { toSiteContent } from './toSiteContent'

describe('toSiteContent', () => {
  it('picks the 6 content keys and nothing else', () => {
    const d = seedAdminData()
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
