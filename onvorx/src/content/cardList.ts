import type { CardListKey } from '../admin/types'

/** `'projectsHome' | 'projectsPage'` → `'project'`, services → `'service'`. */
export const cardKindOf = (l: CardListKey): 'project' | 'service' =>
  l.startsWith('projects') ? 'project' : 'service'

/** `'projectsHome' | 'servicesHome'` → `'home'`, the `*Page` keys → `'page'`. */
export const cardListOf = (l: CardListKey): 'home' | 'page' =>
  l.endsWith('Home') ? 'home' : 'page'
