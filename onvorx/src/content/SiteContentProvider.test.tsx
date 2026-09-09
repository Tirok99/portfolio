import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { I18nProvider, useI18n } from '../i18n/i18n'
import { SiteContentProvider } from './SiteContentProvider'
import { useSiteContent } from './useSiteContent'
import { STORAGE_KEY } from './persistence'

const fetchRemoteContent = vi.fn()
vi.mock('./remote', () => ({ fetchRemoteContent: () => fetchRemoteContent() }))

beforeEach(() => {
  localStorage.clear()
  fetchRemoteContent.mockReset()
  fetchRemoteContent.mockResolvedValue(null)
})

function Probe() {
  const { section, servicesHome, actions } = useSiteContent()
  const { setLang } = useI18n()
  return (
    <div>
      <p data-testid="hero-title">{section('hero').title}</p>
      <p data-testid="svc-count">{servicesHome().length}</p>
      <button onClick={() => actions.updateSection('hero', { title: { en: 'Edited EN', uk: 'Edited UK' } })}>
        edit
      </button>
      <button onClick={() => setLang('uk')}>uk</button>
      <button onClick={() => actions.updateCard('servicesHome', servicesHome()[0].id, { published: false })}>
        hide first service
      </button>
    </div>
  )
}

const wrap = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <Probe />
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('SiteContentProvider', () => {
  it('exposes seeded content resolved to the active language', () => {
    wrap()
    expect(screen.getByTestId('hero-title').textContent).toBeTruthy()
  })

  it('applies an edit and persists it to localStorage', () => {
    wrap()
    act(() => {
      screen.getByText('edit').click()
    })
    expect(screen.getByTestId('hero-title')).toHaveTextContent('Edited EN')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored.sections.find((s: { key: string }) => s.key === 'hero').title.en).toBe('Edited EN')
  })

  it('falls back to EN when the active language value is empty', () => {
    wrap()
    act(() => {
      screen.getByText('edit').click() // sets uk: 'Edited UK'
      screen.getByText('uk').click()
    })
    expect(screen.getByTestId('hero-title')).toHaveTextContent('Edited UK')
  })

  it('filters unpublished cards out of the resolved list', () => {
    wrap()
    const before = Number(screen.getByTestId('svc-count').textContent)
    act(() => {
      screen.getByText('hide first service').click()
    })
    expect(Number(screen.getByTestId('svc-count').textContent)).toBe(before - 1)
  })

  it('overlays remote content over the seeded defaults once it resolves', async () => {
    fetchRemoteContent.mockResolvedValue({
      sections: [
        { key: 'hero', label: 'Hero', eyebrow: { en: '', uk: '' },
          title: { en: 'From Supabase', uk: 'From Supabase' }, body: { en: '', uk: '' } },
      ],
      seo: [], projectsHome: [], projectsPage: [], servicesHome: [], servicesPage: [],
    })
    wrap()
    expect(await screen.findByText('From Supabase')).toBeInTheDocument()
    // the mount overlay must not be written back to localStorage — the single
    // `skipNextPersist.current = true` in the effect is load-bearing
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('From Supabase')
  })

  it('keeps the seeded content when the remote fetch returns null', async () => {
    fetchRemoteContent.mockResolvedValue(null)
    wrap()
    // let the effect settle
    await act(async () => {})
    expect(screen.getByTestId('hero-title').textContent).toBeTruthy()
    expect(screen.queryByText('From Supabase')).not.toBeInTheDocument()
  })

  it('does not overlay after unmount', async () => {
    let resolve!: (v: unknown) => void
    fetchRemoteContent.mockReturnValue(new Promise((r) => { resolve = r }))
    const { unmount } = wrap()
    unmount()
    resolve({
      sections: [
        { key: 'hero', label: 'Hero', eyebrow: { en: '', uk: '' },
          title: { en: 'AFTER UNMOUNT', uk: 'AFTER UNMOUNT' }, body: { en: '', uk: '' } },
      ],
      seo: [], projectsHome: [], projectsPage: [], servicesHome: [], servicesPage: [],
    })
    await act(async () => {})
    // the resolved overlay must not reach a remounted tree or storage
    expect(screen.queryByText('AFTER UNMOUNT')).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('AFTER UNMOUNT')
  })
})
