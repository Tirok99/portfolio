import type { SeoPageKey } from '../admin/types'

export const ROUTE_SEO: Record<string, SeoPageKey> = {
  '/': 'home',
  '/services': 'services',
  '/projects': 'projects',
  '/about': 'about',
  '/web-development': 'web-development',
  '/support': 'support',
  '/business-analysis': 'business-analysis',
  '/google-ads': 'google-ads',
}

export function seoKeyForPath(path: string): SeoPageKey {
  return ROUTE_SEO[path] ?? 'home'
}
