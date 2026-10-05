import { useMemo } from 'react'
import type { SectionCard, SectionKey, SeoPageKey, ServicesSectionKey } from '../admin/types'
import { useI18n } from '../i18n/i18n'
import { useSiteContentRaw } from './SiteContentProvider'
import { isAiBuildMedia, isAiBuildTexts, isBlockMedia, isBlockTexts } from './servicesSections'

const pad2 = (n: number) => String(n).padStart(2, '0')

export interface ResolvedProjectCard {
  id: string
  indexLabel: string
  title: string
  tags: string[]
  description: string
  imageSrc: string
  imageAlt: string
}

export interface ResolvedServiceCard {
  id: string
  featured: boolean
  title: string
  text: string
  iconSrc: string
}

export interface ResolvedSectionCard {
  iconSrc: string
  title: string
  sub?: string
  text: string
}

export interface ResolvedSvcCard {
  iconSrc: string
  title: string
  text: string
  tags: string[]
  track?: 0 | 1
}

export interface ResolvedSvcSection {
  eyebrow: string
  title: string
  body: string
  ctaLabel: string
  cards: ResolvedSvcCard[]
  /** block tags; empty items are dropped */
  tags: string[]
  /** AI Build stack; empty items are dropped */
  stack: string[]
  get?: { title: string; text: string }
  tracks: { label: string; title: string }[]
  /** only the images that have a src */
  images: Partial<Record<'badge' | 'picture' | 'site' | 'admin' | 'bot', string>>
}

export function useSiteContent() {
  const { data, actions } = useSiteContentRaw()
  const { lang } = useI18n()

  return useMemo(() => {
    const pick = (l: { en: string; uk: string }) => l[lang] || l.en

    const resolveCard = (c: SectionCard): ResolvedSectionCard => ({
      iconSrc: c.icon.src,
      title: pick(c.title),
      text: pick(c.text),
      ...(c.sub ? { sub: pick(c.sub) } : {}),
    })

    const section = (key: SectionKey) => {
      const s = data.sections.find((x) => x.key === key)
      return {
        eyebrow: s ? pick(s.eyebrow) : '',
        title: s ? pick(s.title) : '',
        body: s ? pick(s.body) : '',
        ctaLabel: s?.ctaLabel ? pick(s.ctaLabel) : '',
        cards: s?.cards ? s.cards.map(resolveCard) : [],
        launch: s?.launch ? resolveCard(s.launch) : undefined,
      }
    }

    const list = (items: { en: string; uk: string }[] | undefined) =>
      (items ?? []).map(pick).filter((s) => s !== '')

    const svcSection = (key: ServicesSectionKey): ResolvedSvcSection => {
      const s = data.sections.find((x) => x.key === key)
      const texts = s?.texts
      const media = s?.media
      const block = texts && isBlockTexts(texts) ? texts : undefined
      const images: ResolvedSvcSection['images'] = {}
      const put = (slot: keyof ResolvedSvcSection['images'], src: string | undefined) => {
        if (src) images[slot] = src
      }
      if (media && isBlockMedia(media)) {
        put('badge', media.badge.src)
        put('picture', media.picture?.src)
      }
      if (media && isAiBuildMedia(media)) {
        put('site', media.site.src)
        put('admin', media.admin.src)
        put('bot', media.bot.src)
      }
      return {
        eyebrow: s ? pick(s.eyebrow) : '',
        title: s ? pick(s.title) : '',
        body: s ? pick(s.body) : '',
        ctaLabel: s?.ctaLabel ? pick(s.ctaLabel) : '',
        cards: (s?.cards ?? []).map((c) => ({
          iconSrc: c.icon.src,
          title: pick(c.title),
          text: pick(c.text),
          tags: list(c.tags),
          ...(c.track !== undefined ? { track: c.track } : {}),
        })),
        tags: list(block?.tags),
        stack: list(texts && isAiBuildTexts(texts) ? texts.stack : undefined),
        ...(block?.get ? { get: { title: pick(block.get.title), text: pick(block.get.text) } } : {}),
        tracks: (block?.tracks ?? []).map((t) => ({ label: pick(t.label), title: pick(t.title) })),
        images,
      }
    }

    const projectsHome = (): ResolvedProjectCard[] =>
      [...data.projectsHome]
        .filter((c) => c.published)
        .sort((a, b) => a.order - b.order)
        .map((c, i) => ({
          id: c.id,
          indexLabel: pad2(i + 1),
          title: pick(c.title),
          tags: [...c.tags],
          description: pick(c.description),
          imageSrc: c.image.src,
          imageAlt: pick(c.imageAlt),
        }))

    const servicesHome = (): ResolvedServiceCard[] =>
      [...data.servicesHome]
        .filter((c) => c.published)
        .sort((a, b) => a.order - b.order)
        .map((c) => ({
          id: c.id,
          featured: c.featured,
          title: pick(c.title),
          text: pick(c.text),
          iconSrc: c.icon.src,
        }))

    const seoFor = (pageKey: SeoPageKey) => {
      const e = data.seo.find((x) => x.pageKey === pageKey)
      return {
        title: e ? pick(e.title) : '',
        description: e ? pick(e.description) : '',
      }
    }

    return { raw: data, actions, section, svcSection, projectsHome, servicesHome, seoFor }
  }, [data, actions, lang])
}
