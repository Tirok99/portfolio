import type { SeoPageKey } from '../admin/types'
import { STUB_ROUTES } from './nav'

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

/**
 * Paths that actually render a page: the index route plus the registered
 * stub routes (see App.tsx). Anything else resolves to a 404, so it must
 * not receive a real page title.
 */
export const KNOWN_ROUTES: ReadonlySet<string> = new Set<string>([
  '/',
  ...STUB_ROUTES,
])

export function seoKeyForPath(path: string): SeoPageKey {
  if (!KNOWN_ROUTES.has(path)) return 'home'
  return ROUTE_SEO[path] ?? 'home'
}
