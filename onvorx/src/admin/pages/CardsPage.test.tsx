import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider } from '../../content/SiteContentProvider'
import { ToastProvider, ToastRegion } from '../components/Toast'
import { CardsPage } from './CardsPage'

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

const wrap = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <ToastProvider>
          <CardsPage />
          <ToastRegion />
        </ToastProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('CardsPage', () => {
  it('defaults to the Hero tab', () => {
    wrap()
    expect(screen.getByRole('tab', { name: 'Hero' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: /^hero$/i })).toBeInTheDocument()
  })

  it('switches to each of the other 4 tabs and renders that type\'s page', async () => {
    const user = userEvent.setup()
    wrap()

    await user.click(screen.getByRole('tab', { name: 'How it works' }))
    expect(screen.getByRole('heading', { name: /^how it works$/i })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'About' }))
    expect(screen.getByRole('heading', { name: /^about$/i })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Projects' }))
    expect(screen.getByRole('heading', { name: /^projects$/i })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Services' }))
    expect(screen.getByRole('heading', { name: /^services$/i })).toBeInTheDocument()
  })

  it('only one type tab is aria-selected at a time', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByRole('tab', { name: 'Projects' }))
    expect(screen.getByRole('tab', { name: 'Projects' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Hero' })).toHaveAttribute('aria-selected', 'false')
  })
})
