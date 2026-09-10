import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { SiteContent } from './mappers'
import {
  CONTENT_CACHE_KEY,
  loadContentCache,
  saveContentCache,
} from './contentCache'

const sample = (): SiteContent => ({
  sections: [
    {
      key: 'hero',
      label: 'Hero',
      eyebrow: { en: '', uk: '' },
      title: { en: 'T', uk: 'T' },
      body: { en: '', uk: '' },
    },
  ],
  seo: [
    {
      pageKey: 'home',
      label: 'Home',
      path: '/',
      title: { en: 'HT', uk: 'HT' },
      description: { en: 'HD', uk: 'HD' },
    },
  ],
  projectsHome: [],
  projectsPage: [],
  servicesHome: [],
  servicesPage: [],
})

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('contentCache', () => {
  it('round-trips a SiteContent value', () => {
    const c = sample()
    saveContentCache(c)
    expect(loadContentCache()).toEqual(c)
  })

  it('returns null when nothing is cached', () => {
    expect(loadContentCache()).toBeNull()
  })

  it('returns null on malformed JSON', () => {
    localStorage.setItem(CONTENT_CACHE_KEY, '{not json')
    expect(loadContentCache()).toBeNull()
  })

  it('returns null when sections is not an array', () => {
    localStorage.setItem(
      CONTENT_CACHE_KEY,
      JSON.stringify({ sections: 'nope', seo: [] }),
    )
    expect(loadContentCache()).toBeNull()
  })

  it('returns null when seo is not an array', () => {
    localStorage.setItem(
      CONTENT_CACHE_KEY,
      JSON.stringify({ sections: [], seo: null }),
    )
    expect(loadContentCache()).toBeNull()
  })

  it('swallows a throwing setItem', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => saveContentCache(sample())).not.toThrow()
  })
})
