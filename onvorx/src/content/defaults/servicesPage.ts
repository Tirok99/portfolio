import type { ImageRef, L, SectionCard, SectionText, ServiceBlockKey, TrackHead } from '../../admin/types'
import {
  AI_BUILD_MOCKUPS,
  SERVICE_BLOCKS,
  SERVICES_HERO_CARDS,
  type ServiceBlockConfig,
} from '../../data/servicesPage'
import c from './servicesPage.content.json'

// UA copy = EN until the site is translated (spec §4)
const same = (s: string): L => ({ en: s, uk: s })
const asset = (src: string): ImageRef => ({ kind: 'asset', src })

interface Feature {
  title: string
  text: string
}

interface BlockSource {
  title: string
  body: string
  tags: string[]
  cta: string
  features?: Feature[]
  tracks?: { label: string; title: string; features: Feature[] }[]
  get?: { title: string; text: string }
}

const LABELS: Record<ServiceBlockKey, string> = {
  svcWebDevelopment: 'Web Development',
  svcWebsiteSupport: 'Website Support & Development',
  svcBusinessAnalysis: 'Business Analysis',
  svcGoogleAds: 'Google Ads',
}

const head = (t: { label: string; title: string }): TrackHead => ({ label: same(t.label), title: same(t.title) })

function block(cfg: ServiceBlockConfig, src: BlockSource): SectionText {
  // tracked blocks keep one item list, Track 01 first; default icons follow it
  const items: { f: Feature; track?: 0 | 1 }[] = src.tracks
    ? src.tracks.flatMap((t, ti) => t.features.map((f) => ({ f, track: ti as 0 | 1 })))
    : (src.features ?? []).map((f) => ({ f }))
  const cards: SectionCard[] = items.map(({ f, track }, i) => ({
    icon: asset(cfg.featureIcons[i] ?? ''),
    title: same(f.title),
    text: same(f.text),
    ...(track !== undefined ? { track } : {}),
  }))
  return {
    key: cfg.sectionKey,
    label: LABELS[cfg.sectionKey],
    eyebrow: same(''),
    title: same(src.title),
    body: same(src.body),
    ctaLabel: same(src.cta),
    cards,
    texts: {
      tags: src.tags.map(same),
      ...(src.get ? { get: { title: same(src.get.title), text: same(src.get.text) } } : {}),
      ...(src.tracks ? { tracks: [head(src.tracks[0]), head(src.tracks[1])] as [TrackHead, TrackHead] } : {}),
    },
    media: {
      badge: asset(cfg.badge),
      ...(cfg.picture ? { picture: asset(cfg.picture.src) } : {}),
    },
  }
}

export const defaultServicesSections: SectionText[] = [
  {
    key: 'svcHero',
    label: 'Hero',
    eyebrow: same(c.hero.eyebrow),
    title: same(c.hero.title),
    body: same(c.hero.body),
    cards: c.hero.cards.map((card, i) => ({
      icon: asset(SERVICES_HERO_CARDS[i]?.icon ?? ''),
      title: same(card.title),
      text: same(''),
      tags: card.tags.map(same),
    })),
  },
  block(SERVICE_BLOCKS.webDevelopment, c.webDevelopment),
  {
    key: 'svcAiBuild',
    label: 'AI Build',
    eyebrow: same(c.aiBuild.badge),
    title: same(c.aiBuild.title),
    body: same(c.aiBuild.body),
    ctaLabel: same(c.aiBuild.link),
    texts: { stack: c.aiBuild.stack.map(same) },
    media: {
      site: asset(AI_BUILD_MOCKUPS.site.src),
      admin: asset(AI_BUILD_MOCKUPS.admin.src),
      bot: asset(AI_BUILD_MOCKUPS.bot.src),
    },
  },
  block(SERVICE_BLOCKS.websiteSupport, c.websiteSupport),
  block(SERVICE_BLOCKS.businessAnalysis, c.businessAnalysis),
  block(SERVICE_BLOCKS.googleAds, c.googleAds),
  {
    key: 'svcCta',
    label: 'Call-to-action',
    eyebrow: same(c.cta.eyebrow),
    title: same(c.cta.title),
    body: same(c.cta.body),
    ctaLabel: same(c.cta.button),
  },
]
