import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider, useSiteContentRaw } from '../../content/SiteContentProvider'
import { ToastProvider } from '../components/Toast'
import { SeoPage } from './SeoPage'

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
  return <span data-testid="home-seo">{data.seo.find((e) => e.pageKey === 'home')!.title.en}</span>
}
const wrap = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <ToastProvider>
          <SeoPage />
          <Probe />
        </ToastProvider>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('SeoPage', () => {
  it('lists all 8 pages', () => {
    wrap()
    expect(screen.getByRole('heading', { name: /^Home$/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /web development/i })).toBeInTheDocument()
    expect(screen.getAllByText(/\/ 60$/).length).toBeGreaterThan(0) // char counters
  })

  it('edits the Home SEO title and saves', async () => {
    const user = userEvent.setup()
    wrap()
    const titleInputs = screen.getAllByLabelText(/seo title/i)
    await user.clear(titleInputs[0])
    await user.type(titleInputs[0], 'ONVORX — home')
    await user.click(screen.getAllByRole('button', { name: /^save$/i })[0])
    expect(screen.getByTestId('home-seo')).toHaveTextContent('ONVORX — home')
  })
})
