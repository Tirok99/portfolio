import type { L, SectionCard, SectionText } from '../../admin/types'
import en from '../../i18n/en.json'
import uk from '../../i18n/uk.json'

const pair = (a: string, b: string): L => ({ en: a, uk: b })

const cardsFrom = (
  enCards: { title: string; text: string; sub?: string }[],
  ukCards: { title: string; text: string; sub?: string }[],
  iconSrcs: string[],
): SectionCard[] =>
  enCards.map((c, i) => {
    // This module runs at import time on the Supabase-unavailable fallback
    // path, so an uk.json array that is shorter than en.json's (or missing a
    // `sub`) must not throw — that would break the whole site, not just
    // degrade it. Fall back to the EN item's own text.
    const u = ukCards[i] ?? c
    return {
      icon: { kind: 'asset', src: iconSrcs[i] ?? '' },
      title: pair(c.title, u.title ?? c.title),
      text: pair(c.text, u.text ?? c.text),
      ...(c.sub !== undefined ? { sub: pair(c.sub, u.sub ?? c.sub) } : {}),
    }
  })

export const defaultSections: SectionText[] = [
  {
    key: 'hero',
    label: 'Hero (top of page)',
    eyebrow: pair(en.hero.eyebrow, uk.hero.eyebrow),
    title: pair(en.hero.title, uk.hero.title),
    body: pair(en.hero.description, uk.hero.description),
    ctaLabel: pair(en.hero.cta, uk.hero.cta),
    cards: cardsFrom(en.hero.cards, uk.hero.cards, [
      '/assets/icons/hero-target-red.svg',
      '/assets/icons/hero-users-white.svg',
      '/assets/icons/hero-document-white.svg',
      '/assets/icons/hero-sitemap-white.svg',
    ]),
    launch: {
      icon: { kind: 'asset', src: '/assets/icons/hero-launch-check-circle-red.svg' },
      title: pair(en.hero.launch.title, uk.hero.launch.title),
      text: pair(en.hero.launch.text, uk.hero.launch.text),
    },
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
    cards: cardsFrom(en.howWork.steps, uk.howWork.steps, [
      '/assets/icons/howwork-doc-search-white.svg',
      '/assets/icons/howwork-checklist-white.svg',
      '/assets/icons/howwork-code-window-white.svg',
      '/assets/icons/howwork-headset-white.svg',
    ]),
  },
  {
    key: 'about',
    label: 'About block',
    eyebrow: pair(en.about.eyebrow, uk.about.eyebrow),
    title: pair(en.about.title, uk.about.title),
    body: pair(en.about.description, uk.about.description),
    cards: cardsFrom(en.about.stats, uk.about.stats, [
      '/assets/icons/about-calendar-red.svg',
      '/assets/icons/about-folder-red.svg',
      '/assets/icons/about-doc-search-red.svg',
    ]),
  },
  {
    key: 'cta',
    label: 'Call-to-action block',
    eyebrow: pair(en.cta.eyebrow, uk.cta.eyebrow),
    title: pair(en.cta.title, uk.cta.title),
    body: pair(en.cta.description, uk.cta.description),
    ctaLabel: pair(en.cta.button, uk.cta.button),
  },
  {
    key: 'footer',
    label: 'Footer tagline',
    eyebrow: { en: '', uk: '' },
    title: { en: '', uk: '' },
    body: pair(en.footer.tagline, uk.footer.tagline),
  },
]
