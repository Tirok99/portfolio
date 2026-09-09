import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { I18nProvider } from '../../i18n/i18n'
import { SiteContentProvider } from '../../content/SiteContentProvider'
import { DashboardPage } from './DashboardPage'

beforeEach(() => localStorage.clear())

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
  it('shows counts and the newest requests', () => {
    wrap()
    expect(screen.getByText(/new requests?/i)).toBeInTheDocument()
    // seed has 3 'new' requests
    expect(screen.getByText('3')).toBeInTheDocument()
    // one of the 5 newest by createdAt
    expect(screen.getByRole('link', { name: 'Tomasz Nowak' })).toBeInTheDocument()
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
