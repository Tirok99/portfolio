import type { L, SectionText } from '../../admin/types'
import en from '../../i18n/en.json'
import uk from '../../i18n/uk.json'

const pair = (a: string, b: string): L => ({ en: a, uk: b })

export const defaultSections: SectionText[] = [
  {
    key: 'hero',
    label: 'Hero (top of page)',
    eyebrow: pair(en.hero.eyebrow, uk.hero.eyebrow),
    title: pair(en.hero.title, uk.hero.title),
    body: pair(en.hero.description, uk.hero.description),
    ctaLabel: pair(en.hero.cta, uk.hero.cta),
  },
  {
    key: 'services',
    label: 'Services block',
    eyebrow: pair(en.services.eyebrow, uk.services.eyebrow),
    title: pair(en.services.title, uk.services.title),
    body: pair(en.services.description, uk.services.description),
  },
  {
    key: 'projects',
    label: 'Projects block',
    eyebrow: pair(en.projects.eyebrow, uk.projects.eyebrow),
    title: pair(en.projects.title, uk.projects.title),
    body: pair(en.projects.lede, uk.projects.lede),
  },
  {
    key: 'howWork',
    label: 'How we work block',
    eyebrow: pair(en.howWork.eyebrow, uk.howWork.eyebrow),
    title: pair(en.howWork.title, uk.howWork.title),
    body: pair(en.howWork.description, uk.howWork.description),
  },
  {
    key: 'about',
    label: 'About block',
    eyebrow: pair(en.about.eyebrow, uk.about.eyebrow),
    title: pair(en.about.title, uk.about.title),
    body: pair(en.about.description, uk.about.description),
  },
  {
    key: 'cta',
    label: 'Call-to-action block',
    eyebrow: pair(en.cta.eyebrow, uk.cta.eyebrow),
    title: pair(en.cta.title, uk.cta.title),
    body: pair(en.cta.description, uk.cta.description),
    ctaLabel: pair(en.cta.button, uk.cta.button),
  },
]
