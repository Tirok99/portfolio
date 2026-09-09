import type { SiteContent } from './mappers'

/**
 * Local mirror of the last-known-good remote `SiteContent`. Bumped to `v2` when
 * the shape changed (Plan 3); a stale `v1` key is simply ignored and overwritten
 * on the next successful `refetch()`.
 */
export const CONTENT_CACHE_KEY = 'onvorx.content.cache.v2'

/** Read the cached remote content, or `null` on missing / malformed data. */
export function loadContentCache(): SiteContent | null {
  try {
    const raw = localStorage.getItem(CONTENT_CACHE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<SiteContent>
    if (!Array.isArray(p.sections) || !Array.isArray(p.seo)) return null
    return p as SiteContent
  } catch {
    return null
  }
}

/** Persist the cached remote content; swallow quota / private-mode failures. */
export function saveContentCache(c: SiteContent): void {
  try {
    localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(c))
  } catch {
    /* private mode / quota exceeded — ignore */
  }
}
