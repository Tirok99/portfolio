import { describe, it, expect } from 'vitest'
import type { AdminData, L, ProjectCard } from './types'

describe('types', () => {
  it('shapes an AdminData literal without type errors', () => {
    const l: L = { en: 'a', uk: 'b' }
    const card: ProjectCard = {
      id: '1',
      order: 0,
      published: true,
      title: l,
      tags: ['WordPress'],
      description: l,
      image: { kind: 'asset', src: '/assets/x.png' },
      imageAlt: l,
    }
    const data: AdminData = {
      version: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      sections: [],
      projectsHome: [card],
      projectsPage: [],
      servicesHome: [],
      servicesPage: [],
      seo: [],
      requests: [],
    }
    expect(data.projectsHome[0].tags[0]).toBe('WordPress')
  })
})
