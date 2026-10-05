import type {
  AiBuildMedia,
  AiBuildTexts,
  SectionCard,
  SectionMedia,
  SectionTexts,
  ServiceBlockKey,
  ServiceBlockMedia,
  ServiceBlockTexts,
  ServicesSectionKey,
} from '../admin/types'

/** The /services sections in page order (spec §5.1). */
export const SVC_SECTION_KEYS: ServicesSectionKey[] = [
  'svcHero',
  'svcWebDevelopment',
  'svcAiBuild',
  'svcWebsiteSupport',
  'svcBusinessAnalysis',
  'svcGoogleAds',
  'svcCta',
]

export const SVC_BLOCK_KEYS: ServiceBlockKey[] = [
  'svcWebDevelopment',
  'svcWebsiteSupport',
  'svcBusinessAnalysis',
  'svcGoogleAds',
]

export const isServicesSectionKey = (k: string): k is ServicesSectionKey =>
  (SVC_SECTION_KEYS as string[]).includes(k)

export const isBlockTexts = (t: SectionTexts): t is ServiceBlockTexts => 'tags' in t
export const isAiBuildTexts = (t: SectionTexts): t is AiBuildTexts => 'stack' in t
export const isBlockMedia = (m: SectionMedia): m is ServiceBlockMedia => 'badge' in m
export const isAiBuildMedia = (m: SectionMedia): m is AiBuildMedia => 'site' in m

/**
 * Business Analysis keeps its feature items in one `cards` array, Track 01
 * items first, then Track 02. Replace one track's items with `next` (stamping
 * the track on each) and keep that order.
 */
export function mergeTrack(cards: SectionCard[], track: 0 | 1, next: SectionCard[]): SectionCard[] {
  const t0 = track === 0 ? next.map((c) => ({ ...c, track: 0 as const })) : cards.filter((c) => c.track === 0)
  const t1 = track === 1 ? next.map((c) => ({ ...c, track: 1 as const })) : cards.filter((c) => c.track === 1)
  return [...t0, ...t1]
}
