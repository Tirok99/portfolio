import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { I18nProvider, useI18n } from '../i18n/i18n'
import {
  SiteContentProvider,
  useSiteContentRaw,
  type SiteContentActions,
} from './SiteContentProvider'
import { useSiteContent } from './useSiteContent'
import { STORAGE_KEY } from './persistence'
import { adminApi } from '../admin/api'

const fetchRemoteContent = vi.fn()
vi.mock('./remote', () => ({ fetchRemoteContent: () => fetchRemoteContent() }))

vi.mock('../admin/api', () => ({
  adminApi: {
    saveSection: vi.fn().mockResolvedValue(undefined),
    saveSeo: vi.fn().mockResolvedValue(undefined),
    resetContent: vi.fn().mockResolvedValue(undefined),
    createCard: vi.fn().mockResolvedValue(undefined),
    updateCard: vi.fn().mockResolvedValue(undefined),
    deleteCard: vi.fn().mockResolvedValue(undefined),
    reorderCards: vi.fn().mockResolvedValue(undefined),
  },
}))

const remoteWith = (title: string) => ({
  sections: [
    {
      key: 'hero',
      label: 'Hero',
      eyebrow: { en: '', uk: '' },
      title: { en: title, uk: title },
      body: { en: '', uk: '' },
    },
  ],
  seo: [],
  projectsHome: [],
  projectsPage: [],
  servicesHome: [],
  servicesPage: [],
})

beforeEach(() => {
  localStorage.clear()
  fetchRemoteContent.mockReset()
  fetchRemoteContent.mockResolvedValue(null)
  vi.mocked(adminApi.saveSection).mockClear().mockResolvedValue(undefined)
  vi.mocked(adminApi.updateCard).mockClear().mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

let ctxActions: SiteContentActions
function Capture() {
  ctxActions = useSiteContentRaw().actions
  return null
}

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
        <Capture />
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('SiteContentProvider', () => {
  it('exposes seeded content resolved to the active language', () => {
    wrap()
    expect(screen.getByTestId('hero-title').textContent).toBeTruthy()
  })

  it('applies an edit and persists it to localStorage', async () => {
    wrap()
    await act(async () => {
      screen.getByText('edit').click()
    })
    expect(screen.getByTestId('hero-title')).toHaveTextContent('Edited EN')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored.sections.find((s: { key: string }) => s.key === 'hero').title.en).toBe('Edited EN')
  })

  it('falls back to EN when the active language value is empty', async () => {
    wrap()
    await act(async () => {
      screen.getByText('edit').click() // sets uk: 'Edited UK'
      screen.getByText('uk').click()
    })
    expect(screen.getByTestId('hero-title')).toHaveTextContent('Edited UK')
  })

  it('filters unpublished cards out of the resolved list', async () => {
    wrap()
    const before = Number(screen.getByTestId('svc-count').textContent)
    await act(async () => {
      screen.getByText('hide first service').click()
    })
    expect(Number(screen.getByTestId('svc-count').textContent)).toBe(before - 1)
  })

  it('applies an edit optimistically and calls adminApi.saveSection', async () => {
    wrap()
    await act(async () => {
      await ctxActions.updateSection('hero', { title: { en: 'Optimistic', uk: 'Optimistic' } })
    })
    expect(screen.getByTestId('hero-title')).toHaveTextContent('Optimistic')
    expect(adminApi.saveSection).toHaveBeenCalledWith('hero', {
      title: { en: 'Optimistic', uk: 'Optimistic' },
    })
  })

  it('reverts via fetchRemoteContent and rejects when the save fails', async () => {
    wrap()
    await act(async () => {})
    fetchRemoteContent.mockClear()
    vi.mocked(adminApi.saveSection).mockRejectedValueOnce(new Error('save boom'))
    let err: unknown
    await act(async () => {
      err = await ctxActions
        .updateSection('hero', { title: { en: 'Doomed', uk: 'Doomed' } })
        .catch((e) => e)
    })
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toBe('save boom')
    expect(fetchRemoteContent).toHaveBeenCalled()
  })

  it('exposes refetch() on the context and re-pulls remote content', async () => {
    wrap()
    await act(async () => {})
    fetchRemoteContent.mockResolvedValueOnce(remoteWith('Refetched'))
    await act(async () => {
      await ctxActions.refetch()
    })
    expect(screen.getByTestId('hero-title')).toHaveTextContent('Refetched')
  })

  it('schedules a debounced refetch ~800ms after a successful write', async () => {
    vi.useFakeTimers()
    wrap()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    fetchRemoteContent.mockClear()
    await act(async () => {
      await ctxActions.updateSection('hero', { title: { en: 'Debounced', uk: 'Debounced' } })
    })
    expect(fetchRemoteContent).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(fetchRemoteContent).toHaveBeenCalled()
  })

  it('overlays remote content over the seeded defaults once it resolves', async () => {
    fetchRemoteContent.mockResolvedValue(remoteWith('From Supabase'))
    wrap()
    expect(await screen.findByText('From Supabase')).toBeInTheDocument()
    // the mount overlay must not be written back to the admin working cache
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('From Supabase')
  })

  it('keeps the seeded content when the remote fetch returns null', async () => {
    fetchRemoteContent.mockResolvedValue(null)
    wrap()
    await act(async () => {})
    expect(screen.getByTestId('hero-title').textContent).toBeTruthy()
    expect(screen.queryByText('From Supabase')).not.toBeInTheDocument()
  })

  it('does not overlay after unmount', async () => {
    let resolve!: (v: unknown) => void
    fetchRemoteContent.mockReturnValue(new Promise((r) => { resolve = r }))
    const { unmount } = wrap()
    unmount()
    resolve(remoteWith('AFTER UNMOUNT'))
    await act(async () => {})
    expect(screen.queryByText('AFTER UNMOUNT')).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('AFTER UNMOUNT')
  })
})
