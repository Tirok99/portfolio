import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider } from '../../content/SiteContentProvider'
import { ToastProvider, ToastRegion } from '../components/Toast'
import { SectionCardsPage } from './SectionCardsPage'
import { adminApi } from '../../admin/api'

vi.mock('../../admin/api', () => ({
  adminApi: {
    saveSection: vi.fn().mockResolvedValue(undefined),
    saveSeo: vi.fn().mockResolvedValue(undefined),
    resetContent: vi.fn().mockResolvedValue(undefined),
    createCard: vi.fn().mockResolvedValue(undefined),
    updateCard: vi.fn().mockResolvedValue(undefined),
    deleteCard: vi.fn().mockResolvedValue(undefined),
    reorderCards: vi.fn().mockResolvedValue(undefined),
    uploadImage: vi.fn().mockResolvedValue({ url: 'https://cdn/new-icon.png', path: 'cards/new-icon.png' }),
    deleteImage: vi.fn().mockResolvedValue(undefined),
  },
}))

beforeEach(() => localStorage.clear())

const wrapHero = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <ToastProvider>
          <SectionCardsPage sectionKey="hero" title="Hero" hint="Hero cards." />
          <ToastRegion />
        </ToastProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

const wrapHowWork = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <ToastProvider>
          <SectionCardsPage sectionKey="howWork" title="How it works" hint="Step cards." />
          <ToastRegion />
        </ToastProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('SectionCardsPage', () => {
  it('lists Hero\'s 4 cards plus a Launch row, nothing selected initially', () => {
    wrapHero()
    expect(screen.getByText(/1 —/)).toBeInTheDocument()
    expect(screen.getByText(/2 —/)).toBeInTheDocument()
    expect(screen.getByText(/3 —/)).toBeInTheDocument()
    expect(screen.getByText(/4 —/)).toBeInTheDocument()
    expect(screen.getByText(/^Launch —/)).toBeInTheDocument()
    expect(screen.getByText(/no card selected/i)).toBeInTheDocument()
  })

  it('selecting a card shows its editor fields, no Sub field for Hero', async () => {
    const user = userEvent.setup()
    wrapHero()
    await user.click(screen.getByText(/1 —/))
    expect(screen.getByLabelText(/^card title$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^card text$/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^sub$/i)).not.toBeInTheDocument()
  })

  it('shows a Sub field when editing a HowWork card', async () => {
    const user = userEvent.setup()
    wrapHowWork()
    await user.click(screen.getByText(/1 —/))
    expect(screen.getByLabelText(/^sub$/i)).toBeInTheDocument()
  })

  it('editing a card\'s text and saving sends only the cards key, with only that card changed', async () => {
    vi.mocked(adminApi.saveSection).mockClear()
    const user = userEvent.setup()
    wrapHero()
    await user.click(screen.getByText(/1 —/))
    const text = screen.getByLabelText(/^card text$/i)
    await user.clear(text)
    await user.type(text, 'Edited card text')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(adminApi.saveSection).toHaveBeenCalledTimes(1)
    expect(adminApi.saveSection).toHaveBeenCalledWith(
      'hero',
      expect.objectContaining({ cards: expect.any(Array) }),
    )
    const patch = vi.mocked(adminApi.saveSection).mock.calls[0][1] as {
      cards: { text: { en: string } }[]
    }
    expect(patch.cards).toHaveLength(4)
    expect(patch.cards[0].text.en).toBe('Edited card text')
    expect(patch.cards[1].text.en).not.toBe('Edited card text')
    expect(Object.keys(patch)).toEqual(['cards'])
    expect(await screen.findByText(/^saved$/i)).toBeInTheDocument()
  })

  it('editing and saving the Launch row sends only the launch key', async () => {
    vi.mocked(adminApi.saveSection).mockClear()
    const user = userEvent.setup()
    wrapHero()
    await user.click(screen.getByText(/^Launch —/))
    const text = screen.getByLabelText(/^card text$/i)
    await user.clear(text)
    await user.type(text, 'Edited launch text')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(adminApi.saveSection).toHaveBeenCalledTimes(1)
    const patch = vi.mocked(adminApi.saveSection).mock.calls[0][1] as {
      launch: { text: { en: string } }
    }
    expect(patch.launch.text.en).toBe('Edited launch text')
    expect(Object.keys(patch)).toEqual(['launch'])
  })

  it('Cancel returns to the empty state without saving', async () => {
    const user = userEvent.setup()
    wrapHero()
    await user.click(screen.getByText(/1 —/))
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.getByText(/no card selected/i)).toBeInTheDocument()
  })

  it('shows a "Save failed" toast when the api rejects', async () => {
    vi.mocked(adminApi.saveSection).mockRejectedValueOnce(new Error('x'))
    const user = userEvent.setup()
    wrapHero()
    await user.click(screen.getByText(/1 —/))
    const text = screen.getByLabelText(/^card text$/i)
    await user.type(text, ' more')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    expect(await screen.findByText(/save failed/i)).toBeInTheDocument()
  })
})
