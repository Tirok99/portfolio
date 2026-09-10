import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import {
  SiteContentProvider,
  useSiteContentRaw,
} from '../../content/SiteContentProvider'
import { ToastProvider } from '../components/Toast'
import { ServicesPage } from './ServicesPage'

vi.mock('../../admin/api', () => ({
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

beforeEach(() => localStorage.clear())

function Probe() {
  const { data } = useSiteContentRaw()
  const wd = data.servicesHome.find((s) => s.id === 'web-development')
  return (
    <>
      <span data-testid="wd-featured">{String(wd?.featured)}</span>
      <span data-testid="home-count">{data.servicesHome.length}</span>
    </>
  )
}

const wrap = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <ToastProvider>
          <ServicesPage />
          <Probe />
        </ToastProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('ServicesPage', () => {
  it('lists seeded services and shows the Featured toggle on the home tab only', async () => {
    const user = userEvent.setup()
    wrap()
    expect(screen.getByText('Web Development')).toBeInTheDocument()
    await user.click(screen.getByText('Web Development'))
    expect(screen.getByLabelText(/featured/i)).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /services page/i }))
    expect(screen.queryByLabelText(/featured/i)).not.toBeInTheDocument()
  })

  it('toggles Featured and saves', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Web Development'))
    expect(screen.getByTestId('wd-featured')).toHaveTextContent('true')
    await user.click(screen.getByLabelText(/featured/i))
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByTestId('wd-featured')).toHaveTextContent('false')
  })

  it('clears the selection when switching tabs', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Web Development'))
    expect(screen.getAllByLabelText('Title')[0]).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /services page/i }))
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
    expect(screen.getByText(/no card selected/i)).toBeInTheDocument()
  })

  it('clears the SaveBar after a successful save (not stuck dirty)', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByText('Web Development'))
    const title = screen.getAllByLabelText('Title')[0]
    await user.clear(title)
    await user.type(title, 'Web Development v2')
    await user.click(screen.getByRole('button', { name: /^save$/i }))
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('a freshly-selected untouched card on the Services page tab is not dirty', async () => {
    const user = userEvent.setup()
    wrap()
    await user.click(screen.getByRole('tab', { name: /services page/i }))
    await user.click(screen.getByText('Web Development'))
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('deletes a card after confirmation', async () => {
    const user = userEvent.setup()
    wrap()
    const before = Number(screen.getByTestId('home-count').textContent)
    await user.click(screen.getByText('Web Development'))
    await user.click(screen.getByRole('button', { name: /delete card/i }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /delete/i }))
    expect(Number(screen.getByTestId('home-count').textContent)).toBe(before - 1)
  })
})
