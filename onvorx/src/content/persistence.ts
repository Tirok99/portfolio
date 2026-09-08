import type { AdminData } from '../admin/types'
import { buildDefaults, DATA_VERSION } from './defaults'
import { mockRequests } from '../admin/mock/requests'

export const STORAGE_KEY = 'onvorx.admin.v1'

export function seedAdminData(): AdminData {
  const base = buildDefaults()
  return { ...base, requests: mockRequests.map((r) => ({ ...r })) }
}

export function saveAdminData(data: AdminData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* private mode / quota exceeded — ignore, keep working from memory */
  }
}

function isAdminData(v: unknown): v is AdminData {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Partial<AdminData>
  return (
    d.version === DATA_VERSION &&
    Array.isArray(d.sections) &&
    Array.isArray(d.projectsHome) &&
    Array.isArray(d.servicesHome) &&
    Array.isArray(d.seo) &&
    Array.isArray(d.requests)
  )
}

export function loadAdminData(): AdminData {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return seedAdminData()
  }
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (isAdminData(parsed)) return parsed
    } catch {
      /* fall through to reseed */
    }
  }
  const seeded = seedAdminData()
  saveAdminData(seeded)
  return seeded
}
