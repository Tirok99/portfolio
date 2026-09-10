import { describe, it, expect } from 'vitest'
import { cardKindOf, cardListOf } from './cardList'

describe('cardList helpers', () => {
  it('cardKindOf maps the list key to a card kind', () => {
    expect(cardKindOf('projectsHome')).toBe('project')
    expect(cardKindOf('projectsPage')).toBe('project')
    expect(cardKindOf('servicesHome')).toBe('service')
    expect(cardKindOf('servicesPage')).toBe('service')
  })

  it('cardListOf maps the list key to a list bucket', () => {
    expect(cardListOf('projectsHome')).toBe('home')
    expect(cardListOf('servicesHome')).toBe('home')
    expect(cardListOf('projectsPage')).toBe('page')
    expect(cardListOf('servicesPage')).toBe('page')
  })
})
