import { useMemo } from 'react'
import type { SectionKey, SeoPageKey } from '../admin/types'
import { useI18n } from '../i18n/i18n'
import { useSiteContentRaw } from './SiteContentProvider'

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

export function useSiteContent() {
  const { data, actions } = useSiteContentRaw()
  const { lang } = useI18n()

  return useMemo(() => {
    const pick = (l: { en: string; uk: string }) => l[lang] || l.en

    const section = (key: SectionKey) => {
      const s = data.sections.find((x) => x.key === key)
      return {
        eyebrow: s ? pick(s.eyebrow) : '',
        title: s ? pick(s.title) : '',
        body: s ? pick(s.body) : '',
        ctaLabel: s?.ctaLabel ? pick(s.ctaLabel) : '',
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
          tags: c.tags,
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

    return { raw: data, actions, section, projectsHome, servicesHome, seoFor }
  }, [data, actions, lang])
}
