import { describe, it, expect } from 'vitest'
import {
  sectionRow, seoRow, projectRow, serviceRow, estimateFromRow,
  isL, isSectionKey, isSeoPageKey,
} from './adminRows'

const L = (en: string, uk = en) => ({ en, uk })

describe('validators', () => {
  it('isL accepts {en,uk} strings only', () => {
    expect(isL(L('a'))).toBe(true)
    expect(isL({ en: 'a' })).toBe(false)
    expect(isL({ en: 1, uk: 2 })).toBe(false)
    expect(isL(null)).toBe(false)
  })
  it('isSectionKey / isSeoPageKey gate the enums', () => {
    expect(isSectionKey('howWork')).toBe(true)
    expect(isSectionKey('footer')).toBe(true)
    expect(isSectionKey('nope')).toBe(false)
    expect(isSeoPageKey('business-analysis')).toBe(true)
    expect(isSeoPageKey('nope')).toBe(false)
  })
})

describe('sectionRow', () => {
  it('keeps only provided translatable fields, maps ctaLabel → cta_label', () => {
    expect(sectionRow('hero', { title: L('T'), ctaLabel: L('Go') })).toEqual({
      title: L('T'), cta_label: L('Go'),
    })
  })
  it('drops non-L values', () => {
    expect(sectionRow('hero', { title: 'bad' as never, body: L('B') })).toEqual({ body: L('B') })
  })
})

describe('sectionRow — cards and launch', () => {
  const card = (title: string) => ({
    icon: { kind: 'asset', src: '/assets/icons/x.svg', path: null },
    title: L(title), text: L('text'),
  })
  it('keeps a valid cards array', () => {
    expect(sectionRow('hero', { cards: [card('A'), card('B')] })).toEqual({
      cards: [card('A'), card('B')],
    })
  })
  it('keeps a valid launch object', () => {
    expect(sectionRow('hero', { launch: card('Launch') })).toEqual({ launch: card('Launch') })
  })
  it('keeps a HowWork card with an extra sub field', () => {
    const withSub = { ...card('Define'), sub: L('sub text') }
    expect(sectionRow('howWork', { cards: [withSub] })).toEqual({ cards: [withSub] })
  })
  it('drops cards when any entry is missing icon/title/text', () => {
    expect(sectionRow('hero', { cards: [card('A'), { title: L('bad') }] })).toEqual({})
  })
  it('drops cards when it is not an array', () => {
    expect(sectionRow('hero', { cards: card('A') })).toEqual({})
  })
  it('drops a launch object missing a required field', () => {
    expect(sectionRow('hero', { launch: { title: L('Launch') } })).toEqual({})
  })
  it('drops a card whose icon is not an ImageRef-shaped object', () => {
    expect(sectionRow('hero', { cards: [{ icon: 'not-an-object', title: L('A'), text: L('t') }] })).toEqual({})
  })
})

describe('seoRow', () => {
  it('maps title/description', () => {
    expect(seoRow({ title: L('T'), description: L('D') })).toEqual({ title: L('T'), description: L('D') })
  })
})

describe('projectRow', () => {
  it('maps a full ProjectCard-shaped patch to snake_case incl. image + tags', () => {
    expect(
      projectRow({
        title: L('P'), description: L('d'), imageAlt: L('a'), tags: ['x', 'y'],
        published: true, order: 3,
        image: { kind: 'upload', src: 'https://cdn/x.webp', path: 'projects/x.webp' },
      }),
    ).toEqual({
      title: L('P'), description: L('d'), image_alt: L('a'), tags: ['x', 'y'],
      published: true, sort: 3, image_url: 'https://cdn/x.webp', image_path: 'projects/x.webp',
    })
  })
  it('image with no path → image_path null', () => {
    expect(projectRow({ image: { kind: 'asset', src: '/assets/x.png' } })).toEqual({
      image_url: '/assets/x.png', image_path: null,
    })
  })
  it('ignores unknown keys', () => {
    expect(projectRow({ bogus: 1 } as never)).toEqual({})
  })
})

describe('serviceRow', () => {
  it('maps text/featured/icon', () => {
    expect(
      serviceRow({ text: L('t'), featured: true, published: false, order: 1,
        icon: { kind: 'upload', src: 'https://cdn/i.png', path: 'services/i.png' } }),
    ).toEqual({
      text: L('t'), featured: true, published: false, sort: 1,
      icon_url: 'https://cdn/i.png', icon_path: 'services/i.png',
    })
  })
})

describe('estimateFromRow', () => {
  it('maps a DB row to the camelCase DTO, dropping empty optionals', () => {
    expect(estimateFromRow({
      id: 'r1', created_at: '2026-01-01T00:00:00Z', status: 'new',
      name: 'A', email: 'a@b.c', company: null, budget: '1-3k',
      interested_in: ['web-development'], message: 'hi', locale: 'en',
      source_page: '/',
    })).toEqual({
      id: 'r1', createdAt: '2026-01-01T00:00:00Z', status: 'new',
      name: 'A', email: 'a@b.c', budget: '1-3k',
      interestedIn: ['web-development'], message: 'hi', locale: 'en', sourcePage: '/',
    })
  })
})
