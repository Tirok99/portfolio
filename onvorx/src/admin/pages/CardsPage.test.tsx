import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

const pageTab = (name: string) => within(screen.getByRole('tablist', { name: 'Page' })).getByRole('tab', { name })
const blockTab = (name: string) => within(screen.getByRole('tablist', { name: 'Card type' })).getByRole('tab', { name })

describe('CardsPage', () => {
  it('defaults to Home → Hero', () => {
    wrap()
    expect(pageTab('Home')).toHaveAttribute('aria-selected', 'true')
    expect(blockTab('Hero')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: /^hero$/i })).toBeInTheDocument()
  })

  it('Home holds the five home-page blocks', async () => {
    const user = userEvent.setup()
    wrap()
    for (const [tab, heading] of [
      ['How it works', /^how it works$/i],
      ['About', /^about$/i],
      ['Projects', /^projects$/i],
      ['Services', /^services$/i],
    ] as const) {
      await user.click(blockTab(tab))
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    }
  })

  it('Home → Projects and Home → Services show only the home-page lists', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(blockTab('Projects'))
    expect(screen.getByText('Relax Ahill')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /projects page/i })).not.toBeInTheDocument()
    await user.click(blockTab('Services'))
    expect(screen.getByRole('button', { name: /add service/i })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /services page/i })).not.toBeInTheDocument()
  })

  it('the Services page tab edits the /services groups, without block sub-tabs', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(pageTab('Services'))
    expect(screen.queryByRole('tablist', { name: 'Card type' })).not.toBeInTheDocument()
    for (const g of ['Hero cards', 'Web Development', 'AI Build', 'Website Support', 'Business Analysis', 'Google Ads'])
      expect(screen.getByText(g)).toBeInTheDocument()
    await user.click(screen.getByText('Google Ads'))
    expect(screen.getByText('Badge')).toBeInTheDocument()
  })

  it('only one tab per row is aria-selected at a time', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(blockTab('Projects'))
    expect(blockTab('Projects')).toHaveAttribute('aria-selected', 'true')
    expect(blockTab('Hero')).toHaveAttribute('aria-selected', 'false')
    await user.click(pageTab('Services'))
    expect(pageTab('Services')).toHaveAttribute('aria-selected', 'true')
    expect(pageTab('Home')).toHaveAttribute('aria-selected', 'false')
  })

  it('resets the selected card when switching away and back to a section type', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText(/1 —/))
    expect(screen.getByLabelText(/^card title$/i)).toBeInTheDocument()
    await user.click(blockTab('About'))
    await user.click(blockTab('Hero'))
    expect(screen.getByText(/no card selected/i)).toBeInTheDocument()
  })

  it('resets the selected project card when switching away and back', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(blockTab('Projects'))
    await user.click(screen.getByText('Relax Ahill'))
    expect(screen.getAllByLabelText('Title')[0]).toBeInTheDocument()
    await user.click(blockTab('Hero'))
    await user.click(blockTab('Projects'))
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
    expect(screen.getByText(/no card selected/i)).toBeInTheDocument()
  })

  it('resets the /services group when switching pages and back', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(pageTab('Services'))
    await user.click(screen.getByText('Google Ads'))
    expect(screen.getByText('Badge')).toBeInTheDocument()
    await user.click(pageTab('Home'))
    await user.click(pageTab('Services'))
    expect(screen.queryByText('Badge')).not.toBeInTheDocument()
    expect(screen.getByText(/no group selected/i)).toBeInTheDocument()
  })

  it('returning to Home starts again at Hero', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(blockTab('About'))
    await user.click(pageTab('Services'))
    await user.click(pageTab('Home'))
    expect(blockTab('Hero')).toHaveAttribute('aria-selected', 'true')
  })
})
