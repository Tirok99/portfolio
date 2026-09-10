import type { AdminData } from '../../admin/types'
import { defaultSections } from './sections'
import { defaultProjectsHome, defaultProjectsPage } from './projects'
import { defaultServicesHome, defaultServicesPage } from './services'
import { defaultSeo } from './seo'

export const DATA_VERSION = 1

const EPOCH = '1970-01-01T00:00:00.000Z'

const deepCopy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export function buildDefaults(): AdminData {
  return {
    version: DATA_VERSION,
    updatedAt: EPOCH,
    sections: deepCopy(defaultSections),
    projectsHome: deepCopy(defaultProjectsHome),
    projectsPage: deepCopy(defaultProjectsPage),
    servicesHome: deepCopy(defaultServicesHome),
    servicesPage: deepCopy(defaultServicesPage),
    seo: deepCopy(defaultSeo),
  }
}
