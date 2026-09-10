import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { I18nProvider, useI18n } from '../i18n/i18n'
import {
  SiteContentProvider,
  useSiteContentRaw,
  type SiteContentActions,
} from './SiteContentProvider'
import { useSiteContent } from './useSiteContent'
import { adminApi } from '../admin/api'
import type { AdminData } from '../admin/types'

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
let ctxData: AdminData
function Capture() {
  const ctx = useSiteContentRaw()
  ctxActions = ctx.actions
  ctxData = ctx.data
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

  it('clears the retired admin working store (onvorx.admin.v1) on mount', () => {
    localStorage.setItem('onvorx.admin.v1', '{"stale":true}')
    const spy = vi.spyOn(Storage.prototype, 'removeItem')
    wrap()
    expect(spy).toHaveBeenCalledWith('onvorx.admin.v1')
    expect(localStorage.getItem('onvorx.admin.v1')).toBeNull()
    spy.mockRestore()
  })

  it('applies an edit optimistically and calls adminApi.updateSection through the button', async () => {
    wrap()
    await act(async () => {
      screen.getByText('edit').click()
    })
    expect(screen.getByTestId('hero-title')).toHaveTextContent('Edited EN')
    expect(adminApi.saveSection).toHaveBeenCalledWith('hero', {
      title: { en: 'Edited EN', uk: 'Edited UK' },
    })
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

  describe('provider → adminApi wiring', () => {
    beforeEach(() => {
      vi.mocked(adminApi.updateCard).mockClear()
      vi.mocked(adminApi.deleteCard).mockClear()
      vi.mocked(adminApi.createCard).mockClear()
      vi.mocked(adminApi.reorderCards).mockClear()
      vi.mocked(adminApi.saveSeo).mockClear()
      vi.mocked(adminApi.resetContent).mockClear()
    })

    it('updateSeo → adminApi.saveSeo(pageKey, patch)', async () => {
      wrap()
      const patch = { title: { en: 'Home SEO', uk: 'Home SEO' } }
      await act(async () => {
        await ctxActions.updateSeo('home', patch)
      })
      expect(adminApi.saveSeo).toHaveBeenCalledWith('home', patch)
    })

    it('updateCard → adminApi.updateCard(kind, list, id, patch)', async () => {
      wrap()
      const id = ctxData.projectsHome[0].id
      const patch = { published: false }
      await act(async () => {
        await ctxActions.updateCard('projectsHome', id, patch)
      })
      expect(adminApi.updateCard).toHaveBeenCalledWith('project', 'home', id, patch)
    })

    it('removeCard → adminApi.deleteCard(kind, list, id)', async () => {
      wrap()
      const id = ctxData.servicesPage[0].id
      await act(async () => {
        await ctxActions.removeCard('servicesPage', id)
      })
      expect(adminApi.deleteCard).toHaveBeenCalledWith('service', 'page', id)
    })

    it('setCardImage on a project card → adminApi.updateCard(..., { image })', async () => {
      wrap()
      const id = ctxData.projectsHome[0].id
      const image = { kind: 'upload' as const, src: 'https://x/p.png', path: 'projects/p.png' }
      await act(async () => {
        await ctxActions.setCardImage('projectsHome', id, image)
      })
      expect(adminApi.updateCard).toHaveBeenCalledWith('project', 'home', id, { image })
    })

    it('setCardImage on a service card → adminApi.updateCard(..., { icon }) (regression)', async () => {
      wrap()
      const id = ctxData.servicesHome[0].id
      const image = { kind: 'upload' as const, src: 'https://x/s.png', path: 'services/s.png' }
      await act(async () => {
        await ctxActions.setCardImage('servicesHome', id, image)
      })
      expect(adminApi.updateCard).toHaveBeenCalledWith('service', 'home', id, { icon: image })
    })

    it('addCard → adminApi.createCard(kind, list, <the appended card>)', async () => {
      wrap()
      await act(async () => {
        await ctxActions.addCard('projectsHome')
      })
      const appended = ctxData.projectsHome[ctxData.projectsHome.length - 1]
      expect(adminApi.createCard).toHaveBeenCalledWith('project', 'home', appended)
    })

    it('moveCard → adminApi.reorderCards(kind, list, <orderedIds>)', async () => {
      wrap()
      const ids = ctxData.servicesHome.map((c) => c.id)
      const target = ids[1]
      await act(async () => {
        await ctxActions.moveCard('servicesHome', target, 'up')
      })
      expect(adminApi.reorderCards).toHaveBeenCalledWith('service', 'home', [
        ids[1],
        ids[0],
        ...ids.slice(2),
      ])
    })

    it('resetAll → adminApi.resetContent(<6-key SiteContent>)', async () => {
      wrap()
      await act(async () => {
        await ctxActions.resetAll()
      })
      expect(adminApi.resetContent).toHaveBeenCalledTimes(1)
      const arg = vi.mocked(adminApi.resetContent).mock.calls[0][0]
      expect(Object.keys(arg).sort()).toEqual(
        ['projectsHome', 'projectsPage', 'sections', 'seo', 'servicesHome', 'servicesPage'].sort(),
      )
    })
  })

  it('overlays remote content over the seeded defaults once it resolves', async () => {
    fetchRemoteContent.mockResolvedValue(remoteWith('From Supabase'))
    wrap()
    expect(await screen.findByText('From Supabase')).toBeInTheDocument()
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
  })
})
