import type { AdminData } from '../admin/types'
import type { SiteContent } from './mappers'

/** The 6 content keys of `AdminData` (drops `version`, `updatedAt`). */
export function toSiteContent(d: AdminData): SiteContent {
  return {
    sections: d.sections,
    seo: d.seo,
    projectsHome: d.projectsHome,
    projectsPage: d.projectsPage,
    servicesHome: d.servicesHome,
    servicesPage: d.servicesPage,
  }
}
