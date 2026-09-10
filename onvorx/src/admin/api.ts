import type {
  SectionKey, SeoPageKey, SectionText, SeoEntry, ProjectCard, ServiceCard,
  RequestStatus, EstimateRequest,
} from './types'
import type { SiteContent } from '../content/mappers'

async function call<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
  return data
}

type CardKind = 'project' | 'service'
const cardsUrl = (type: CardKind) => `/api/admin/cards?type=${type}`

export const adminApi = {
  saveSection: (key: SectionKey, patch: Partial<Pick<SectionText, 'eyebrow' | 'title' | 'body' | 'ctaLabel'>>) =>
    call<void>('/api/admin/content', 'PUT', { kind: 'section', key, patch }),
  saveSeo: (pageKey: SeoPageKey, patch: Partial<Pick<SeoEntry, 'title' | 'description'>>) =>
    call<void>('/api/admin/content', 'PUT', { kind: 'seo', pageKey, patch }),
  resetContent: (content: SiteContent) =>
    call<void>('/api/admin/content', 'POST', { op: 'reset', content }),

  createCard: (type: CardKind, list: 'home' | 'page', card: ProjectCard | ServiceCard) =>
    call<void>(cardsUrl(type), 'POST', { list, card }),
  updateCard: (type: CardKind, list: 'home' | 'page', id: string, patch: Record<string, unknown>) =>
    call<void>(cardsUrl(type), 'PUT', { list, id, patch }),
  deleteCard: (type: CardKind, list: 'home' | 'page', id: string) =>
    call<void>(cardsUrl(type), 'DELETE', { list, id }),
  reorderCards: (type: CardKind, list: 'home' | 'page', orderedIds: string[]) =>
    call<void>(cardsUrl(type), 'POST', { op: 'reorder', list, orderedIds }),

  uploadImage: (folder: 'projects' | 'services', dataUrl: string, fileName: string) =>
    call<{ url: string; path: string }>('/api/admin/upload', 'POST', { dataUrl, fileName, folder }),
  deleteImage: (path: string) => call<void>('/api/admin/upload', 'DELETE', { path }),

  listRequests: () => call<{ requests: EstimateRequest[] }>('/api/admin/requests', 'GET').then((r) => r.requests),
  setRequestStatus: (id: string, status: RequestStatus) =>
    call<void>('/api/admin/requests', 'PATCH', { id, status }),
  setRequestNote: (id: string, note: string) =>
    call<void>('/api/admin/requests', 'PATCH', { id, note }),
  deleteRequest: (id: string) => call<void>('/api/admin/requests', 'DELETE', { id }),
}
