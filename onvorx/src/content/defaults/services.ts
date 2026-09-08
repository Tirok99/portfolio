import type { L, ServiceCard } from '../../admin/types'
import en from '../../i18n/en.json'
import uk from '../../i18n/uk.json'

interface RawService {
  id: string
  title: string
  text: string
  featured?: boolean
}

/** design icon assets keyed by service slug (mirrors Services.tsx ASSETS) */
const ICONS: Record<string, string> = {
  'web-development': '/assets/services/icon-web.png',
  support: '/assets/services/icon-support.png',
  'business-analysis': '/assets/services/icon-analysis.png',
  'google-ads': '/assets/services/icon-ads.png',
}

const ukById = new Map<string, RawService>(
  (uk.services.items as unknown as RawService[]).map((s) => [s.id, s]),
)

const pair = (a: string, b: string | undefined): L => ({ en: a, uk: b ?? a })

const cards: ServiceCard[] = (en.services.items as unknown as RawService[]).map(
  (s, i): ServiceCard => {
    const u = ukById.get(s.id)
    return {
      id: s.id,
      order: i,
      published: true,
      featured: Boolean(s.featured),
      title: pair(s.title, u?.title),
      text: pair(s.text, u?.text),
      icon: {
        kind: 'asset',
        src: ICONS[s.id] ?? '/assets/services/icon-web.png',
      },
    }
  },
)

const clone = (list: ServiceCard[]): ServiceCard[] =>
  list.map((c, i) => ({
    ...c,
    order: i,
    title: { ...c.title },
    text: { ...c.text },
    icon: { ...c.icon },
  }))

export const defaultServicesHome: ServiceCard[] = clone(cards)
export const defaultServicesPage: ServiceCard[] = clone(cards)
