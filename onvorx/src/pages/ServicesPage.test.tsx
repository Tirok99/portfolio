import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App'

beforeEach(() => {
  localStorage.clear()
  // jsdom has no layout APIs; Layout scrolls to the #hash target on redirects
  Element.prototype.scrollIntoView = vi.fn()
  window.history.pushState({}, '', '/')
})

describe('/services', () => {
  it('renders the hero and all service blocks', () => {
    window.history.pushState({}, '', '/services')
    render(<App />)
    expect(
      screen.getByRole('heading', { level: 1, name: /Every stage of your web project, covered/i }),
    ).toBeInTheDocument()
    for (const name of [/^Web Development$/, /^AI Build$/, /Website Support & Development/, /^Business Analysis$/, /^Google Ads$/]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
    // desktop nav + mobile drawer both mark the current page
    expect(screen.getAllByRole('link', { name: 'Services', current: 'page' })).toHaveLength(2)
  })

  it.each([
    ['/web-development', '#web-development'],
    ['/support', '#website-support'],
    ['/business-analysis', '#business-analysis'],
    ['/google-ads', '#paid-search'],
  ])('redirects %s to its block on /services', (from, hash) => {
    window.history.pushState({}, '', from)
    render(<App />)
    expect(window.location.pathname).toBe('/services')
    expect(window.location.hash).toBe(hash)
  })
})
