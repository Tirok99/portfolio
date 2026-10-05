import { describe, it, expect } from 'vitest'
import { isServicesSectionKey, mergeTrack, SVC_SECTION_KEYS } from './servicesSections'
import type { SectionCard } from '../admin/types'

const L = (s: string) => ({ en: s, uk: s })
const item = (title: string, track?: 0 | 1): SectionCard => ({
  icon: { kind: 'asset', src: '' }, title: L(title), text: L(''), ...(track !== undefined ? { track } : {}),
})

describe('servicesSections', () => {
  it('lists the 7 keys in page order', () => {
    expect(SVC_SECTION_KEYS).toEqual(['svcHero', 'svcWebDevelopment', 'svcAiBuild', 'svcWebsiteSupport',
      'svcBusinessAnalysis', 'svcGoogleAds', 'svcCta'])
    expect(isServicesSectionKey('svcCta')).toBe(true)
    expect(isServicesSectionKey('hero')).toBe(false)
  })

  it('mergeTrack replaces one track and keeps Track 01 items before Track 02 items', () => {
    const cards = [item('a', 0), item('b', 0), item('c', 1)]
    expect(mergeTrack(cards, 1, [item('c', 1), item('new')]).map((c) => [c.title.en, c.track]))
      .toEqual([['a', 0], ['b', 0], ['c', 1], ['new', 1]])
    expect(mergeTrack(cards, 0, []).map((c) => [c.title.en, c.track])).toEqual([['c', 1]])
  })
})
