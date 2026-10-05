import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import App from '../App'
import { saveContentCache } from '../content/contentCache'
import { toSiteContent } from '../content/toSiteContent'
import { buildDefaults } from '../content/defaults'
import type { SiteContent } from '../content/mappers'

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

/** Seed the store through the content cache, then open /services. */
function renderWith(edit: (c: SiteContent) => void) {
  const content = toSiteContent(buildDefaults())
  edit(content)
  saveContentCache(content)
  window.history.pushState({}, '', '/services')
  return render(<App />)
}
const sec = (c: SiteContent, key: string) => c.sections.find((s) => s.key === key)!

describe('/services — content from the store', () => {
  it('shows edited titles, tags and hero cards', () => {
    renderWith((c) => {
      sec(c, 'svcWebDevelopment').title = { en: 'Websites, built right', uk: 'x' }
      sec(c, 'svcWebDevelopment').texts = { tags: [{ en: 'Astro', uk: 'Astro' }] }
      sec(c, 'svcHero').cards![0].title = { en: 'Build', uk: 'x' }
    })
    expect(screen.getByRole('heading', { level: 2, name: 'Websites, built right' })).toBeInTheDocument()
    expect(screen.getByText('Astro')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Build/ })).toHaveAttribute('href', '/services#web-development')
  })

  it('renders a block with no tags, no features and no badge without crashing', () => {
    const { container } = renderWith((c) => {
      const ads = sec(c, 'svcGoogleAds')
      ads.texts = { tags: [] }
      ads.cards = []
      ads.media = { badge: { kind: 'asset', src: '' } }
    })
    const block = container.querySelector('#paid-search')!
    expect(within(block as HTMLElement).getByRole('heading', { level: 2, name: 'Google Ads' })).toBeInTheDocument()
    expect(block.querySelector('.service-block__tags')).toBeNull()
    expect(block.querySelector('.service-block__badge')).toBeNull()
  })

  it('groups Business Analysis items by their track, whatever the array order', () => {
    renderWith((c) => {
      const ba = sec(c, 'svcBusinessAnalysis')
      const icon = { kind: 'asset' as const, src: '' }
      ba.cards = [
        { icon, title: { en: 'Second-track item', uk: '' }, text: { en: '', uk: '' }, track: 1 },
        { icon, title: { en: 'First-track item', uk: '' }, text: { en: '', uk: '' }, track: 0 },
      ]
    })
    const second = screen.getByText('Second-track item').closest('.service-block__track')!
    expect(second).toHaveTextContent('IT Business Analysis')
    const first = screen.getByText('First-track item').closest('.service-block__track')!
    expect(first).toHaveTextContent('Business Process Analysis')
  })

  it('an uploaded illustration has no fixed width/height; the built-in one keeps them', () => {
    const { container } = renderWith((c) => {
      sec(c, 'svcWebDevelopment').media = {
        badge: { kind: 'asset', src: '/assets/services-page/badge-web.webp' },
        picture: { kind: 'upload', src: 'https://cdn.example/new.webp', path: 'cards/new.webp' },
      }
    })
    const uploaded = container.querySelector('img[src="https://cdn.example/new.webp"]')!
    expect(uploaded.hasAttribute('width')).toBe(false)
    const builtIn = container.querySelector('img[src="/assets/services-page/picture-support.webp"]')!
    expect(builtIn.getAttribute('width')).toBe('960')
  })

  it('hides "What you get" when both of its fields are blanked', () => {
    const { container } = renderWith((c) => {
      sec(c, 'svcWebDevelopment').texts = {
        tags: [],
        get: { title: { en: '', uk: '' }, text: { en: '', uk: '' } },
      }
    })
    expect(container.querySelector('#web-development .service-block__get')).toBeNull()
    expect(container.querySelector('#website-support .service-block__get')).not.toBeNull()
  })

  it('uses the svcCta texts for the bottom call-to-action', () => {
    renderWith((c) => {
      sec(c, 'svcCta').title = { en: 'Let us talk', uk: '' }
    })
    expect(screen.getByRole('heading', { level: 2, name: 'Let us talk' })).toBeInTheDocument()
  })
})
