import type {
  AdminData,
  CardListKey,
  ImageRef,
  NewRequestInput,
  ProjectCard,
  RequestStatus,
  SectionKey,
  SectionText,
  SeoEntry,
  SeoPageKey,
  ServiceCard,
} from './types'
import { newId } from './lib/id'
import { seedAdminData } from '../content/persistence'

const stamp = (d: AdminData): AdminData => ({
  ...d,
  updatedAt: new Date().toISOString(),
})

const emptyL = () => ({ en: '', uk: '' })

export function blankProjectCard(order: number): ProjectCard {
  return {
    id: newId('proj'),
    order,
    published: false,
    title: emptyL(),
    tags: [],
    description: emptyL(),
    image: { kind: 'asset', src: '' },
    imageAlt: emptyL(),
  }
}

export function blankServiceCard(order: number): ServiceCard {
  return {
    id: newId('svc'),
    order,
    published: false,
    featured: false,
    title: emptyL(),
    text: emptyL(),
    icon: { kind: 'asset', src: '' },
  }
}

const isProjectList = (list: CardListKey) =>
  list === 'projectsHome' || list === 'projectsPage'

const renumber = <T extends { order: number }>(cards: T[]): T[] =>
  cards.map((c, i) => (c.order === i ? c : { ...c, order: i }))

export function updateSection(
  d: AdminData,
  key: SectionKey,
  patch: Partial<Omit<SectionText, 'key' | 'label'>>,
): AdminData {
  return stamp({
    ...d,
    sections: d.sections.map((s) => (s.key === key ? { ...s, ...patch } : s)),
  })
}

export function addCard(d: AdminData, list: CardListKey): AdminData {
  const current = d[list]
  const card = isProjectList(list)
    ? blankProjectCard(current.length)
    : blankServiceCard(current.length)
  return stamp({ ...d, [list]: [...current, card] })
}

export function updateCard(
  d: AdminData,
  list: CardListKey,
  id: string,
  patch: Record<string, unknown>,
): AdminData {
  return stamp({
    ...d,
    [list]: (d[list] as Array<ProjectCard | ServiceCard>).map((c) =>
      c.id === id ? { ...c, ...patch } : c,
    ),
  })
}

export function removeCard(
  d: AdminData,
  list: CardListKey,
  id: string,
): AdminData {
  const filtered = (d[list] as Array<ProjectCard | ServiceCard>).filter(
    (c) => c.id !== id,
  )
  return stamp({ ...d, [list]: renumber(filtered) })
}

export function moveCard(
  d: AdminData,
  list: CardListKey,
  id: string,
  dir: 'up' | 'down',
): AdminData {
  const cards = [...(d[list] as Array<ProjectCard | ServiceCard>)]
  const i = cards.findIndex((c) => c.id === id)
  if (i < 0) return d
  const j = dir === 'up' ? i - 1 : i + 1
  if (j < 0 || j >= cards.length) return d
  ;[cards[i], cards[j]] = [cards[j], cards[i]]
  return stamp({ ...d, [list]: renumber(cards) })
}

export function setCardImage(
  d: AdminData,
  list: CardListKey,
  id: string,
  image: ImageRef,
): AdminData {
  const field = isProjectList(list) ? 'image' : 'icon'
  return updateCard(d, list, id, { [field]: image })
}

export function updateSeo(
  d: AdminData,
  pageKey: SeoPageKey,
  patch: Partial<Pick<SeoEntry, 'title' | 'description'>>,
): AdminData {
  return stamp({
    ...d,
    seo: d.seo.map((e) => (e.pageKey === pageKey ? { ...e, ...patch } : e)),
  })
}

export function addRequest(d: AdminData, input: NewRequestInput): AdminData {
  return stamp({
    ...d,
    requests: [
      {
        ...input,
        id: newId('req'),
        createdAt: new Date().toISOString(),
        status: 'new',
      },
      ...d.requests,
    ],
  })
}

export function setRequestStatus(
  d: AdminData,
  id: string,
  status: RequestStatus,
): AdminData {
  return stamp({
    ...d,
    requests: d.requests.map((r) => (r.id === id ? { ...r, status } : r)),
  })
}

export function setRequestNote(
  d: AdminData,
  id: string,
  note: string,
): AdminData {
  return stamp({
    ...d,
    requests: d.requests.map((r) => (r.id === id ? { ...r, note } : r)),
  })
}

export function removeRequest(d: AdminData, id: string): AdminData {
  return stamp({ ...d, requests: d.requests.filter((r) => r.id !== id) })
}

export function resetAll(): AdminData {
  return seedAdminData()
}
