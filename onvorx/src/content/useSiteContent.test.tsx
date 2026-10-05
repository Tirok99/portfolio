import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { I18nProvider } from '../i18n/i18n'
import { SiteContentProvider } from './SiteContentProvider'
import { useSiteContent } from './useSiteContent'
import { saveContentCache } from './contentCache'
import { toSiteContent } from './toSiteContent'
import { buildDefaults } from './defaults'

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider>
    <SiteContentProvider>{children}</SiteContentProvider>
  </I18nProvider>
)

beforeEach(() => localStorage.clear())

describe('useSiteContent().svcSection', () => {
  it('resolves a block from the defaults', () => {
    const { result } = renderHook(() => useSiteContent(), { wrapper })
    const wd = result.current.svcSection('svcWebDevelopment')
    expect(wd.title).toBe('Web Development')
    expect(wd.ctaLabel).toBe('Get a project estimate')
    expect(wd.tags).toEqual(['WordPress', 'Webflow', 'Framer'])
    expect(wd.cards[0]).toMatchObject({ title: 'Design implementation', iconSrc: '/assets/services-page/icons/code.svg' })
    expect(wd.get?.title).toBe('A responsive website, ready to launch')
    expect(wd.images).toEqual({
      badge: '/assets/services-page/badge-web.webp',
      picture: '/assets/services-page/picture-web.webp',
    })
  })

  it('resolves tracks, stack and AI Build images', () => {
    const { result } = renderHook(() => useSiteContent(), { wrapper })
    const ba = result.current.svcSection('svcBusinessAnalysis')
    expect(ba.tracks.map((t) => t.label)).toEqual(['Track 01', 'Track 02'])
    expect(ba.cards.filter((c) => c.track === 1)).toHaveLength(3)
    const ai = result.current.svcSection('svcAiBuild')
    expect(ai.stack).toContain('Telegram bot')
    expect(Object.keys(ai.images).sort()).toEqual(['admin', 'bot', 'site'])
  })

  it('drops empty list items and empty image srcs', () => {
    const content = toSiteContent(buildDefaults())
    const ads = content.sections.find((s) => s.key === 'svcGoogleAds')!
    ads.texts = { tags: [{ en: 'Search', uk: '' }, { en: '', uk: '' }] }
    ads.media = { badge: { kind: 'asset', src: '' } }
    saveContentCache(content)
    const { result } = renderHook(() => useSiteContent(), { wrapper })
    const s = result.current.svcSection('svcGoogleAds')
    expect(s.tags).toEqual(['Search'])
    expect(s.images).toEqual({})
    expect(s.get).toBeUndefined()
    expect(s.tracks).toEqual([])
  })
})
