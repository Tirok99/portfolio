import { describe, it, expect } from 'vitest'
import { buildDefaults } from '../content/defaults'
import {
  updateSection,
  addCard,
  appendCard,
  orderedIdsAfterMove,
  blankProjectCard,
  updateCard,
  removeCard,
  moveCard,
  setCardImage,
  updateSeo,
  resetAll,
} from './actions'

const base = () => buildDefaults()

describe('updateSection', () => {
  it('patches one section and does not mutate input', () => {
    const d = base()
    const next = updateSection(d, 'hero', { title: { en: 'New', uk: 'Нове' } })
    expect(next.sections.find((s) => s.key === 'hero')!.title.en).toBe('New')
    expect(d.sections.find((s) => s.key === 'hero')!.title.en).not.toBe('New')
    expect(next).not.toBe(d)
    expect(next.updatedAt).not.toBe(d.updatedAt)
  })
})

describe('card CRUD', () => {
  it('adds a blank unpublished card at the end', () => {
    const d = base()
    const before = d.projectsHome.length
    const next = addCard(d, 'projectsHome')
    expect(next.projectsHome).toHaveLength(before + 1)
    const added = next.projectsHome[before]
    expect(added.published).toBe(false)
    expect(added.order).toBe(before)
    expect(added.id).toBeTruthy()
  })

  it('appendCard adds the exact card object passed in', () => {
    const d = base()
    const before = d.projectsHome.length
    const card = blankProjectCard(before)
    const next = appendCard(d, 'projectsHome', card)
    expect(next.projectsHome).toHaveLength(before + 1)
    expect(next.projectsHome[before]).toBe(card)
    expect(next).not.toBe(d)
  })

  it('updates a card by id', () => {
    const d = base()
    const id = d.servicesHome[0].id
    const next = updateCard(d, 'servicesHome', id, { featured: false })
    expect(next.servicesHome[0].featured).toBe(false)
  })

  it('removes a card and renumbers order', () => {
    const d = addCard(addCard(base(), 'projectsPage'), 'projectsPage')
    const victim = d.projectsPage[1].id
    const next = removeCard(d, 'projectsPage', victim)
    expect(next.projectsPage.find((c) => c.id === victim)).toBeUndefined()
    expect(next.projectsPage.map((c) => c.order)).toEqual(
      next.projectsPage.map((_, i) => i),
    )
  })

  it('moves a card up and renumbers, no-op at the top', () => {
    const d = base()
    const firstId = d.projectsHome[0].id
    const secondId = d.projectsHome[1].id
    const moved = moveCard(d, 'projectsHome', secondId, 'up')
    expect(moved.projectsHome[0].id).toBe(secondId)
    expect(moved.projectsHome[1].id).toBe(firstId)
    expect(moved.projectsHome.map((c) => c.order)).toEqual([0, 1])
    const noop = moveCard(d, 'projectsHome', firstId, 'up')
    expect(noop.projectsHome[0].id).toBe(firstId)
  })

  it('sets image on a project card and icon on a service card', () => {
    const d = base()
    const p = setCardImage(d, 'projectsHome', d.projectsHome[0].id, {
      kind: 'upload',
      src: 'data:image/png;base64,AAAA',
      fileName: 'x.png',
    })
    expect(p.projectsHome[0].image.kind).toBe('upload')
    const s = setCardImage(d, 'servicesHome', d.servicesHome[0].id, {
      kind: 'upload',
      src: 'data:image/png;base64,BBBB',
    })
    expect(s.servicesHome[0].icon.src).toBe('data:image/png;base64,BBBB')
  })
})

describe('orderedIdsAfterMove', () => {
  const cards = [
    { id: 'a', order: 0 },
    { id: 'b', order: 1 },
    { id: 'c', order: 2 },
  ]

  it('moves the middle card up', () => {
    expect(orderedIdsAfterMove(cards, 'b', 'up')).toEqual(['b', 'a', 'c'])
  })

  it('moves the middle card down', () => {
    expect(orderedIdsAfterMove(cards, 'b', 'down')).toEqual(['a', 'c', 'b'])
  })

  it('is a no-op at the top edge', () => {
    expect(orderedIdsAfterMove(cards, 'a', 'up')).toEqual(['a', 'b', 'c'])
  })

  it('is a no-op at the bottom edge', () => {
    expect(orderedIdsAfterMove(cards, 'c', 'down')).toEqual(['a', 'b', 'c'])
  })

  it('sorts by order before moving (unsorted input)', () => {
    const unsorted = [
      { id: 'c', order: 2 },
      { id: 'a', order: 0 },
      { id: 'b', order: 1 },
    ]
    expect(orderedIdsAfterMove(unsorted, 'a', 'down')).toEqual(['b', 'a', 'c'])
  })

  it('returns the sorted order for an unknown id', () => {
    expect(orderedIdsAfterMove(cards, 'zzz', 'up')).toEqual(['a', 'b', 'c'])
  })
})

describe('updateSeo', () => {
  it('patches title/description for one page', () => {
    const d = base()
    const next = updateSeo(d, 'about', {
      title: { en: 'About us', uk: 'Про нас' },
    })
    expect(next.seo.find((e) => e.pageKey === 'about')!.title.en).toBe(
      'About us',
    )
  })
})

describe('resetAll', () => {
  it('returns a fresh seeded dataset', () => {
    const fresh = resetAll()
    expect(fresh.sections).toHaveLength(6)
  })
})
