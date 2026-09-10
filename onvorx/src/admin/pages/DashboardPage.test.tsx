import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider } from '../../content/SiteContentProvider'
import { mockRequests } from '../mock/requests'
import { DashboardPage } from './DashboardPage'

vi.mock('../api', () => ({
  adminApi: {
    listRequests: vi.fn(),
    setRequestStatus: vi.fn().mockResolvedValue(undefined),
    setRequestNote: vi.fn().mockResolvedValue(undefined),
    deleteRequest: vi.fn().mockResolvedValue(undefined),
  },
}))
import { adminApi } from '../api'

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(adminApi.listRequests).mockResolvedValue(
    mockRequests.map((r) => ({ ...r })),
  )
})

const wrap = () =>
  render(
    <I18nProvider>
      <SiteContentProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </SiteContentProvider>
    </I18nProvider>,
  )

describe('DashboardPage', () => {
  it('shows counts and the newest requests', async () => {
    wrap()
    expect(screen.getByText(/new requests?/i)).toBeInTheDocument()
    // mock has 3 'new' requests
    expect(await screen.findByText('3')).toBeInTheDocument()
    // one of the 5 newest by createdAt
    expect(
      await screen.findByRole('link', { name: 'Tomasz Nowak' }),
    ).toBeInTheDocument()
  })

  it('shows an em dash for "Last change" until the first edit', () => {
    wrap()
    expect(screen.getByText(/last change:/i)).toHaveTextContent('Last change: —')
  })

  it('links to the section editors', () => {
    wrap()
    expect(screen.getByRole('link', { name: /edit texts/i })).toHaveAttribute(
      'href',
      '/admin/content',
    )
    expect(screen.getByRole('link', { name: /^seo$/i })).toHaveAttribute(
      'href',
      '/admin/seo',
    )
  })
})
